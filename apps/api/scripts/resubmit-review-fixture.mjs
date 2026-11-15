import { PrismaPg } from '@prisma/adapter-pg'
import { pathToFileURL } from 'node:url'

// Test-only bridge until S2-03 publishes submission/resubmission endpoints.
// It uses Said's actual helper and database transaction, never a test HTTP route.
const url = process.env.TEST_DATABASE_URL
const fixture = JSON.parse(process.env.ADMIN_REVIEW_TEST_FIXTURE ?? '{}')
const [id, expected, academicPosition] = process.argv.slice(2)
const expectedRevision = Number(expected)
if (!url || !decodeURIComponent(new URL(url).pathname).endsWith('_test') ||
  !process.env.ADMIN_REVIEW_API_DIRECTORY || id !== fixture.resubmitted?.id || !Number.isSafeInteger(expectedRevision) || expectedRevision < 1 || !academicPosition) {
  throw new Error('Only the runner-owned resubmission fixture in an isolated _test database may be changed')
}
const backend = process.env.ADMIN_REVIEW_API_DIRECTORY
const { PrismaClient } = await import(pathToFileURL(`${backend}/dist/generated/prisma/client.js`).href)
const { advanceApplicationRevision } = await import(pathToFileURL(`${backend}/dist/admin/application-revision.js`).href)
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
try {
  await db.$transaction(async (tx) => {
    await advanceApplicationRevision(tx, id, expectedRevision)
    const application = await tx.organizationApplication.findUniqueOrThrow({ where: { id } })
    await tx.organization.update({ where: { id: application.organizationId }, data: { academicPosition } })
  })
} finally { await db.$disconnect() }
