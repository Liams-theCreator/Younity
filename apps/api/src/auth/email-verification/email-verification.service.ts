import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';
import { VerifyEmailDto } from '../dto/email-verification.dto.js';
import { MailService } from '../mail/mail.service.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.emailVerificationToken.updateMany({
        where: {
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          usedAt: now,
        },
      });
      if (count !== 1) {
        throw new BadRequestException('Verification link is invalid, expired, or already used.');
      }

      const verification = await tx.emailVerificationToken.findUniqueOrThrow({
        where: {
          tokenHash
        },
        select: { userId: true },
      })

      await tx.user.update({
        where: {
          id: verification.userId,
        },
        data: { emailVerifiedAt: now },
      });
    });
    return { message: 'Email verified successfully.' };
  }

  async startVerification(userId: string, email: string) {
    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    if (!frontendOrigin) {
      throw new Error('FRONTEND_ORIGIN is required');
    }

    const link = new URL('/verify-email', frontendOrigin);
    link.searchParams.set('token', token);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.mailService.sendVerificationEmail(email, link.toString());
  }
}
