import { Injectable, Post } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { createHash, hash, randomBytes } from 'node:crypto';

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService) { }

  async verifyEmail() { }

  async startVerification(userId: number, email: string) {
    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    if (!frontendOrigin) {
      throw new Error('FRONTEND_ORIGIN is required');
    }

    const link = new URL('/verify-email', frontendOrigin);
    link.searchParams.set('token', token);

    await this.mailService.sendVerificationEmail(email, link.toString());
  }
}
