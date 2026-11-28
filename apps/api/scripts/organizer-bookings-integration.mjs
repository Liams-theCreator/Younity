import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { PrismaPg } from '@prisma/adapter-pg'
import { hash } from 'argon2'

// Exercise the production frontend against Aadel's separately built backend.
// Fixtures are confined to an explicit test DB and removed in finally.
const databaseUrl = process.env.TEST_DATABASE_URL
if (!databaseUrl || !decodeURIComponent(new URL(databaseUrl).pathname).endsWith('_test')) {
  throw new Error('Set TEST_DATABASE_URL to an isolated database ending in _test')
}
if (!process.env.BOOKINGS_API_DIRECTORY) throw new Error('Set BOOKINGS_API_DIRECTORY to Aadel’s separately built apps/api directory')
const directory = await realpath(process.env.BOOKINGS_API_DIRECTORY)
if (directory === await realpath(fileURLToPath(new URL('..', import.meta.url)))) {
  throw new Error('Supply a separate backend directory, outside this branch')
}
const { chromium } = await import(process.env.BOOKINGS_PLAYWRIGHT_MODULE ?? 'playwright')
const { PrismaClient } = await import(pathToFileURL(`${directory}/dist/generated/prisma/client.js`).href)
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const artifacts = fileURLToPath(new URL('../../../.local/bookings-integration/', import.meta.url))
await mkdir(artifacts, { recursive: true })
const password = `Bookings-check-${randomUUID()}!`
const passwordHash = await hash(password)
const users = [], organizations = [], events = [], children = []
let browser
let output = ''

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
function start(command, args, cwd, env) {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  child.stdout.on('data', chunk => { output += chunk })
  child.stderr.on('data', chunk => { output += chunk })
  child.on('error', error => { output += error.message })
  return child
}
async function ready(url, child) {
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Server exited before readiness\n${output}`)
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return } catch { /* Starting. */ }
    await delay(200)
  }
  throw new Error(`Server readiness timed out\n${output}`)
}
async function account(role, firstName) {
  const user = await db.user.create({ data: {
    firstName, lastName: 'Integration', email: `bookings-${randomUUID()}@example.test`, passwordHash,
    role, status: 'ACTIVE', emailVerifiedAt: new Date(),
  } })
  users.push(user.id)
  if (role === 'STUDENT') await db.studentProfile.create({ data: { userId: user.id, interests: ['AI_DATA', 'ROBOTICS_IOT'] } })
  return user
}
async function organization(owner) {
  const org = await db.organization.create({ data: {
    ownerId: owner.id, orgName: 'Bookings integration club', type: 'STUDENT_CLUB',
    representativeFullName: 'Test Organizer', academicPosition: 'Coordinator', phoneNumber: '+212600000000',
    verificationStatus: 'APPROVED', verifiedAt: new Date(), approvalAcknowledgedAt: new Date(),
  } })
  organizations.push(org.id)
  return org
}

try {
  const owner = await account('ORGANIZER', 'Owner')
  const other = await account('ORGANIZER', 'Other')
  const student = await account('STUDENT', 'Live student')
  const ownerOrg = await organization(owner)
  const otherOrg = await organization(other)
  const apiPort = await freePort()
  const webPort = await freePort()
  const apiUrl = `http://localhost:${apiPort}`
  const webUrl = `http://localhost:${webPort}`
  const api = start(process.execPath, ['dist/main.js'], directory, {
    NODE_ENV: 'test', DATABASE_URL: databaseUrl, PORT: String(apiPort),
    JWT_SECRET: randomUUID(), ADMIN_DECISION_EMAIL_ENABLED: 'false',
    FRONTEND_ORIGIN: webUrl, CORS_ORIGINS: webUrl,
  })
  await ready(`${apiUrl}/api/health`, api)
  async function call(path, cookie, method = 'GET', body) {
    return fetch(`${apiUrl}/api${path}`, { method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }
  async function login(user) {
    const result = await call('/auth/login', null, 'POST', { email: user.email, password })
    assert.equal(result.status, 200)
    return result.headers.get('set-cookie').split(';')[0]
  }
  const ownerCookie = await login(owner)
  const otherCookie = await login(other)
  const studentCookie = await login(student)
  const category = await db.category.findFirstOrThrow()
  const eventStart = Date.now() + 7 * 86400000
  const published = await call('/organizer-events/publish', ownerCookie, 'POST', {
    title: 'Real API booking workshop', description: 'Isolated acceptance fixture', format: 'IN_PERSON',
    location: 'Test campus', registrationMode: 'AUTOMATIC', capacity: 50, categoryIds: [category.id],
    startDate: new Date(eventStart).toISOString(), endDate: new Date(eventStart + 3600000).toISOString(),
    registrationDeadline: new Date(eventStart - 86400000).toISOString(),
  })
  assert.equal(published.status, 201, await published.clone().text())
  const event = await published.json()
  events.push(event.id)
  const hidden = await db.event.create({ data: {
    organizationId: otherOrg.id, createdById: other.id, title: 'Other organizer private event', description: 'Excluded',
    format: 'IN_PERSON', status: 'PUBLISHED', registrationMode: 'AUTOMATIC', startDate: new Date(eventStart), endDate: new Date(eventStart + 3600000),
  } })
  events.push(hidden.id)
  await db.eventRegistration.create({ data: { eventId: hidden.id, studentId: student.id, status: 'CONFIRMED' } })
  // Twenty existing rows plus one real reservation exercise both pages.
  for (let index = 0; index < 20; index++) {
    const attendee = await account('STUDENT', `Attendee ${String(index).padStart(2, '0')}`)
    await db.eventRegistration.create({ data: { eventId: event.id, studentId: attendee.id, status: 'CONFIRMED' } })
  }
  assert.equal((await call(`/events/${event.id}/my-booking`, studentCookie, 'POST')).status, 201)
  const path = '/organizer/bookings?status=CONFIRMED&pageSize=20'
  const collection = await call(path, ownerCookie)
  assert.equal(collection.headers.get('cache-control'), 'no-store')
  const data = await collection.json()
  assert.equal(data.total, 21)
  assert.equal(data.items.length, 20)
  assert.ok(data.items.every(row => row.eventId === event.id))
  assert.deepEqual(Object.keys(data.items[0]).sort(), ['id', 'eventId', 'eventTitle', 'participantName', 'email', 'registeredAt', 'status', 'cancellationReason'].sort())
  assert.equal((await (await call(path, otherCookie)).json()).total, 1)
  assert.equal((await call(path)).status, 401)
  assert.equal((await call(path, studentCookie)).status, 403)
  assert.equal((await call(`${path}&ownerId=${other.id}`, ownerCookie)).status, 400)
  const webDirectory = fileURLToPath(new URL('../../web', import.meta.url))
  const vite = start(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], webDirectory, { API_PROXY_TARGET: apiUrl })
  await ready(webUrl, vite)
  browser = await chromium.launch({ headless: true,
    ...(process.env.BOOKINGS_BROWSER_EXECUTABLE ? { executablePath: process.env.BOOKINGS_BROWSER_EXECUTABLE } : {}),
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const browserErrors = []
  page.on('pageerror', error => browserErrors.push(error.message))
  await page.goto(`${webUrl}/login`)
  await page.getByLabel('Email Address', { exact: true }).fill(owner.email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In to Younity', exact: true }).click()
  await page.waitForURL('**/organizer/dashboard')
  await page.goto(`${webUrl}/organizer/bookings`)
  await page.getByRole('cell', { name: student.email, exact: true }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 20)
  assert.equal(await page.getByText('Other organizer private event', { exact: true }).count(), 0)
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  await page.getByText('Page 2', { exact: true }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 1)
  await page.getByRole('tab', { name: 'Cancelled', exact: true }).click()
  await page.getByRole('heading', { name: 'No cancelled bookings.' }).waitFor()
  assert.equal((await call(`/events/${event.id}/my-booking`, studentCookie, 'DELETE')).status, 200)
  await page.getByRole('button', { name: 'Refresh bookings' }).click()
  await page.getByRole('cell', { name: student.email, exact: true }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 1)
  assert.equal(await page.locator('tbody code').innerText(), '—')
  assert.equal((await page.locator('tbody td[data-label="Cancelled"]').innerText()).trim(), '—')
  assert.equal(await page.getByText('Page 1', { exact: true }).count(), 1)
  await page.screenshot({ path: `${artifacts}/cancelled-1440.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${artifacts}/cancelled-390.png`, fullPage: true })
  await page.getByRole('tab', { name: 'Confirmed', exact: true }).click()
  await page.locator('tbody tr').filter({ hasText: 'Attendee 00 Integration' }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 20)
  assert.equal(await page.getByRole('cell', { name: student.email, exact: true }).count(), 0)
  // Approval revoked after login must remove previously visible participant rows.
  await db.organization.update({ where: { id: ownerOrg.id }, data: { verificationStatus: 'REJECTED' } })
  await page.getByRole('button', { name: 'Refresh bookings' }).click()
  await page.getByRole('heading', { name: 'Access restricted' }).waitFor()
  assert.equal(await page.locator('tbody tr').count(), 0)
  assert.deepEqual(browserErrors, [])
  await writeFile(`${artifacts}/results.json`, JSON.stringify({
    passed: true, realApi: true, checks: ['owner-scoped rows and totals', '401/403/400', 'no-store and safe fields',
      '21 confirmed bookings across two pages', 'empty cancelled tab', 'real cancellation and refresh',
      'tab pagination reset', 'ticket/date dash fallbacks', '390px/1440px', 'approval revocation clears rows', 'no browser exceptions'],
  }, null, 2))
  console.log('Organizer booking API/browser checks passed. Evidence in .local/bookings-integration/.')
} catch (error) {
  const page = browser?.contexts()[0]?.pages()[0]
  if (page) {
    await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }).catch(() => {})
    await writeFile(`${artifacts}/failure.txt`, await page.locator('body').innerText()).catch(() => {})
  }
  throw error
} finally {
  await browser?.close()
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue
    child.kill('SIGTERM')
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(3000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  await db.eventRegistration.deleteMany({ where: { eventId: { in: events } } })
  await db.eventCategory.deleteMany({ where: { eventId: { in: events } } })
  await db.event.deleteMany({ where: { id: { in: events } } })
  await db.organization.deleteMany({ where: { id: { in: organizations } } })
  await db.studentProfile.deleteMany({ where: { userId: { in: users } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.$disconnect()
}
