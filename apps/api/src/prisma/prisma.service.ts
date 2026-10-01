import 'dotenv/config';
import { Injectable, Logger } from '@nestjs/common';
import type {
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.$queryRaw`SELECT 1`;
    this.logger.log('Database connection verified');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
