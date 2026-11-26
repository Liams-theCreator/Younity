import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { validateDatabaseUrl } from '../src/config/database.js';

// Explicit local setup only: never called by the normal application seed.
if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo accounts cannot be created in production.');
}
const password = process.env.DEMO_ACCOUNT_PASSWORD;
if (!password || password.length < 12) {
  throw new Error('Set DEMO_ACCOUNT_PASSWORD to at least 12 characters.');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: validateDatabaseUrl(process.env.DATABASE_URL),
    connectionTimeoutMillis: 5000,
  }),
});
const accounts = [
  { email: 'admin@younity.test', role: 'ADMIN', firstName: 'Demo', lastName: 'Admin' },
  { email: 'organizer@younity.test', role: 'ORGANIZER', firstName: 'Demo', lastName: 'Organizer' },
  { email: 'student@younity.test', role: 'STUDENT', firstName: 'Demo', lastName: 'Student' },
] as const;

try {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const results = await prisma.$transaction(async (tx) => {
    const now = new Date();
    const users = [];
    for (const account of accounts) {
      const existing = await tx.user.findUnique({ where: { email: account.email } });
      if (existing) {
        if (existing.role !== account.role || existing.status !== 'ACTIVE' ||
            !existing.emailVerifiedAt || !await argon2.verify(existing.passwordHash, password)) {
          throw new Error(`Account ${account.email} already exists with different credentials or state; no accounts were changed.`);
        }
        users.push(existing);
        continue;
      }
      users.push(await tx.user.create({
        data: { ...account, passwordHash, status: 'ACTIVE', emailVerifiedAt: now },
      }));
    }
    const admin = users[0]!;
    const organizer = users[1]!;
    const student = users[2]!;
    await tx.studentProfile.upsert({
      where: { userId: student.id },
      update: {},
      create: {
        userId: student.id, university: '1337', academicField: 'COMPUTER_SCIENCE',
        studyLevel: 'FIRST_YEAR', interests: ['HACKATHONS', 'AI_DATA'], opportunityFormat: 'HYBRID',
      },
    });
    const organizations = await tx.organization.findMany({ where: { ownerId: organizer.id } });
    if (organizations.length === 0) {
      await tx.organization.create({
        data: {
          ownerId: organizer.id, orgName: 'Younity Demo Organization', type: 'STUDENT_CLUB',
          representativeFullName: 'Demo Organizer', academicPosition: 'Club coordinator',
          phoneNumber: '+212600000000', verificationStatus: 'APPROVED',
          verifiedAt: now, verifiedById: admin.id, approvalAcknowledgedAt: now,
          applications: { create: {
            submittedById: organizer.id, reviewerId: admin.id, status: 'APPROVED',
            reviewedAt: now, reviewerNote: 'Local demo account setup.',
          } },
        },
      });
    } else if (organizations.length !== 1 || organizations[0]!.verificationStatus !== 'APPROVED') {
      throw new Error('Existing demo organizer has a different organization state; no accounts were changed.');
    }
    return users.map(({ email, role }) => ({ email, role }));
  }, { timeout: 15000 });
  console.table(results);
  console.log('Demo accounts are active and email verified. Use DEMO_ACCOUNT_PASSWORD to sign in.');
} finally {
  await prisma.$disconnect();
}
