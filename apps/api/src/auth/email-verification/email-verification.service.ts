import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';
import { VerifyEmailDto } from '../dto/email-verification.dto.js';
import { MailService } from '../mail/mail.service.js';
import { VERIFICATION_RESEND_SECONDS, VERIFICATION_TTL_MINUTES } from './settings.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) { }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');

    await this.prisma.$transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!verification) {
        throw new BadRequestException('Verification link is invalid, expired, or already used.');
      }
      // Use the same lock order as resend, including for different links owned
      // by one account. This also prevents issuing a token during verification.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${verification.userId}::uuid FOR UPDATE`;
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

      await tx.user.update({
        where: {
          id: verification.userId,
        },
        data: { emailVerifiedAt: now },
      });
      await tx.emailVerificationToken.updateMany({
        where: { userId: verification.userId, usedAt: null },
        data: { usedAt: now },
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

    await this.prisma.$transaction(async (tx) => {
      // Serialize requests for this account so concurrent resends cannot bypass
      // the cooldown. The SMTP call runs after the transaction releases the lock.
      const users = await tx.$queryRaw<{ email_verified_at: Date | null }[]>`
        SELECT email_verified_at FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;
      if (users.length !== 1 || users[0]!.email_verified_at) {
        throw new BadRequestException('Email is already verified. Please sign in.');
      }
      const recent = await tx.emailVerificationToken.findFirst({
        where: {
          userId,
          usedAt: null,
          createdAt: { gt: new Date(Date.now() - VERIFICATION_RESEND_SECONDS * 1000) },
        },
      });
      if (recent) {
        throw new HttpException('Please wait 60 seconds before requesting another email.', HttpStatus.TOO_MANY_REQUESTS);
      }
      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60 * 1000),
        },
      });
    });

    try {
      await this.mailService.sendVerificationEmail(email, link.toString());
    } catch {
      // Remove only this failed attempt, allowing an immediate retry. Other
      // delivered links remain usable until verification or expiry.
      await this.prisma.emailVerificationToken.deleteMany({ where: { tokenHash, usedAt: null } });
      throw new ServiceUnavailableException('We could not send the verification email. Please try again.');
    }
  }
}
