/// just to create and save a dummy hash password user /
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const rawEmail = process.env.SEED_USER_EMAIL;
  const password = process.env.SEED_USER_PASSWORD;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  if (!rawEmail?.trim() || !password) {
    throw new Error('Local seed email and password are required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const email = rawEmail.trim().toLowerCase();
    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
      },
    });

    console.log('Local test user ready:', user);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Seeding failed; check local configuration and database access.');
  process.exitCode = 1;
});
