import 'dotenv/config'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'argon2'

// Isolated test-data lifecycle and real API runner. No test routes or accounts
// are registered in the production application or normal database seed.
const url = process.env.TEST_DATABASE_URL
if (!url || !decodeURIComponent(new URL(url).pathname).endsWith('_test')) {
  throw new Error('Set an explicit TEST_DATABASE_URL ending in _test; application databases are refused')
}
const backendDirectory = process.env.ADMIN_REVIEW_API_DIRECTORY
if (!backendDirectory) throw new Error('Set ADMIN_REVIEW_API_DIRECTORY to a separately prepared/built S2-09 backend checkout; teammate code is not included in this branch')
const apiDirectory = await realpath(backendDirectory)
if (apiDirectory === await realpath(fileURLToPath(new URL('..', import.meta.url)))) throw new Error('Use a separate backend checkout, not this branch')
const { PrismaClient } = await import(pathToFileURL(`${apiDirectory}/dist/generated/prisma/client.js`).href)
const webDirectory = fileURLToPath(new URL('../../web', import.meta.url))
const artifacts = fileURLToPath(new URL('../../../.local/admin-integration', import.meta.url))
await mkdir(artifacts, { recursive: true })
const serve = process.argv.includes('--serve')
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
const userIds = [], organizationIds = []
let api, browserTests
let apiOutput = ''
const password = 'Isolated-review-fixture-2026!'
const passwordHash = await hash(password)

async function account(role, name, verified = true) {
  const user = await db.user.create({ data: {
    firstName: name, lastName: 'Integration', email: `admin-ui-${name}-${randomUUID()}@example.test`,
    passwordHash, role, status: 'ACTIVE', emailVerifiedAt: verified ? new Date() : null,
  } })
  userIds.push(user.id)
  return { id: user.id, email: user.email, password }
}

async function submission(name, { verified = true, draft = false } = {}) {
  const owner = await account('ORGANIZER', name, verified)
  const organization = await db.organization.create({ data: {
    ownerId: owner.id, orgName: `Integration ${name}`, type: 'STUDENT_CLUB',
    representativeFullName: `${name} Organizer`, academicPosition: 'Coordinator',
    phoneNumber: '+212612345678', proofUrl: 'https://example.test/evidence.pdf', verificationStatus: 'PENDING',
  } })
  organizationIds.push(organization.id)
  if (draft) return { id: organization.id, name: organization.orgName }
  const application = await db.organizationApplication.create({ data: {
    organizationId: organization.id, submittedById: owner.id, status: 'PENDING',
  } })
  return { id: application.id, name: organization.orgName }
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function run(command, args, options) {
  return new Promise((resolve, reject) => {
    browserTests = spawn(command, args, { ...options, stdio: 'inherit' })
    browserTests.once('error', reject)
    browserTests.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Live frontend tests failed (${code ?? signal})`)))
  })
}

async function stop(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGTERM')
  await Promise.race([exited, delay(5000)])
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  await exited
}

let release
const interrupted = new Promise((resolve) => { release = resolve })
process.once('SIGINT', () => release())
process.once('SIGTERM', () => release())

try {
  await db.$connect()
  const fixture = {
    admin: await account('ADMIN', 'reviewer'), otherAdmin: await account('ADMIN', 'other-reviewer'),
    student: await account('STUDENT', 'student'),
    approve: await submission('Approval'), reject: await submission('Rejection'),
    changes: await submission('Corrections'), stale: await submission('Concurrent'),
    duplicate: await submission('Duplicate'),
    resubmitted: await submission('Resubmission'),
    unverified: await submission('Unverified', { verified: false }), draft: await submission('Draft', { draft: true }),
  }
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const env = {
    ...process.env, NODE_ENV: 'test', DATABASE_URL: url, TEST_DATABASE_URL: url, PORT: String(port),
    JWT_SECRET: process.env.JWT_SECRET ?? 'isolated_admin_integration_test_only_secret', JWT_TTL_SECONDS: '900',
    ADMIN_DECISION_EMAIL_ENABLED: 'false',
    ADMIN_REVIEW_API_DIRECTORY: apiDirectory,
    CORS_ORIGINS: 'https://localhost,http://localhost:5173', FRONTEND_ORIGIN: 'https://localhost',
    ADMIN_REVIEW_TEST_BASE_URL: baseUrl, ADMIN_REVIEW_TEST_FIXTURE: JSON.stringify(fixture),
    ADMIN_REVIEW_TEST_RESUBMIT_SCRIPT: fileURLToPath(new URL('resubmit-review-fixture.mjs', import.meta.url)),
  }
  api = spawn(process.execPath, ['dist/main.js'], { cwd: apiDirectory, env, stdio: ['ignore', 'pipe', 'pipe'] })
  api.stdout.on('data', (chunk) => { apiOutput += chunk })
  api.stderr.on('data', (chunk) => { apiOutput += chunk })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (api.exitCode !== null) throw new Error('API exited before becoming healthy')
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) })
      if (response.ok) { ready = true; break }
    } catch { /* Wait for the real API to listen. */ }
    await delay(200)
  }
  if (!ready) throw new Error('Isolated integration API did not become healthy')
  if (serve) {
    await writeFile(`${artifacts}/session.json`, JSON.stringify({ baseUrl, fixture }, null, 2) + '\n', { mode: 0o600 })
    console.log(`Isolated admin integration API ready at ${baseUrl}; fixture configuration saved locally.`)
    await interrupted
  } else {
    await run('npm', ['test', '--', '--maxWorkers=1', 'src/admin/live.test.tsx'], { cwd: webDirectory, env })
    for (const [key, status] of [['approve', 'APPROVED'], ['reject', 'REJECTED'], ['changes', 'NEEDS_CHANGES'], ['stale', 'REJECTED'], ['duplicate', 'APPROVED'], ['resubmitted', 'APPROVED']]) {
      const row = await db.organizationApplication.findUniqueOrThrow({ where: { id: fixture[key].id } })
      const reviewerId = key === 'stale' ? fixture.otherAdmin.id : fixture.admin.id
      if (row.status !== status || row.reviewerId !== reviewerId || !row.reviewerNote || !row.reviewedAt) throw new Error(`Persistence assertion failed for ${key}`)
      const history = await db.applicationDecision.findMany({ where: { applicationId: row.id }, include: { email: true }, orderBy: { revision: 'asc' } })
      if (history.length !== (key === 'resubmitted' ? 2 : 1) || history.some((entry) => !entry.email || entry.email.status !== 'PENDING')) throw new Error(`Audit/outbox assertion failed for ${key}`)
      if (key === 'resubmitted' && (row.revision !== 3 || history[1].revision !== 3)) throw new Error('Resubmission revision assertion failed')
    }
    await writeFile(`${artifacts}/persistence-results.json`, JSON.stringify({ passed: true, backend: 'PR #16 / 42346ac', checked: ['approve', 'reject', 'changes', 'stale', 'duplicate', 'resubmitted', 'revision/history/outbox persistence'], database: 'isolated _test database' }, null, 2) + '\n')
    console.log('Verified live decisions, revisions, audit history and unsent email intents in PostgreSQL.')
  }
} finally {
  await stop(browserTests)
  await stop(api)
  if (serve) await rm(`${artifacts}/session.json`, { force: true })
  await writeFile(`${artifacts}/api.log`, apiOutput)
  const ownedDecisions = { application: { organizationId: { in: organizationIds } } }
  await db.decisionEmail.deleteMany({ where: { decision: ownedDecisions } })
  await db.applicationDecision.deleteMany({ where: ownedDecisions })
  await db.organizationApplication.deleteMany({ where: { organizationId: { in: organizationIds } } })
  await db.organization.deleteMany({ where: { id: { in: organizationIds } } })
  await db.user.deleteMany({ where: { id: { in: userIds } } })
  await db.$disconnect()
}
