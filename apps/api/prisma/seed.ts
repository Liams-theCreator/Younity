import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { categories } from './seed-data.js';
import { validateEnvironment } from '../src/config/environment.js';

const { databaseUrl } = validateEnvironment();
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
try {
  await prisma.$transaction(async (tx) => {
    for (const category of categories) {
      await tx.category.upsert({
        where: { slug: category.slug },
        create: category,
        update: {},
      });
    }
  });
  console.log(
    `Seeded ${categories.length} categories; existing records were preserved.`,
  );
} finally {
  await prisma.$disconnect();
}
