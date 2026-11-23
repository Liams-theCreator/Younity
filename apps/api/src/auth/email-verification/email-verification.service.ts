import { BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import type { Prisma } from '../../generated/prisma/client.js';
import { UserRole, UserStatus, VerificationStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createHash, randomBytes } from 'node:crypto';
import { VerifyEmailDto } from '../dto/email-verification.dto.js';
import { MailService } from '../mail/mail.service.js';
import { VERIFICATION_RECOVERY_AUDIENCE, VERIFICATION_RECOVERY_TTL_SECONDS, VERIFICATION_TTL_MINUTES } from './settings.js';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly jwt: JwtService,
  ) { }

  async verifyEmail(dto: VerifyEmailDto, continuation?: { recoveryToken: string; ttlSeconds: number }) {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    // The mail link alone verifies the address. A match with the originating
    // registration browser is also required to establish a session.
    const registrationUserId = continuation
      ? await this.recoveryUserId(continuation.recoveryToken).catch(() => null)
      : null;

    const accessToken = await this.prisma.$transaction(async (tx) => {
      const verification = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!verification) {
        throw new BadRequestException('Verification link is invalid, expired, or already used.');
      }
      // Use the same lock order as resend, including for different links owned
      // by one account. This also prevents issuing a token during verification.
      const [user] = await tx.$queryRaw<{ status: UserStatus; role: UserRole; email_verified_at: Date | null }[]>`
        SELECT status, role, email_verified_at FROM users WHERE id = ${verification.userId}::uuid FOR UPDATE
      `;
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
      if (user?.role === UserRole.ORGANIZER && user.status !== UserStatus.SUSPENDED) {
        await this.submitRegisteredOrganizer(tx, verification.userId, now);
      }
      await tx.emailVerificationToken.updateMany({
        where: { userId: verification.userId, usedAt: null },
        data: { usedAt: now },
      });
      if (
        continuation && registrationUserId === verification.userId && user &&
        !user.email_verified_at && user.status !== UserStatus.SUSPENDED &&
        (user.role === UserRole.STUDENT || user.role === UserRole.ORGANIZER)
      ) {
        return this.jwt.signAsync({ sub: verification.userId }, { expiresIn: continuation.ttlSeconds });
      }
    });
    return { message: 'Email verified successfully.', ...(accessToken && { accessToken }) };
  }

  private async submitRegisteredOrganizer(tx: Prisma.TransactionClient, ownerId: string, submittedAt: Date) {
    // Verification holds the owner row lock. Queue the signup details in the same transaction.
    const organizations = await tx.organization.findMany({
      where: { ownerId },
      take: 2,
      select: {
        id: true,
        verificationStatus: true,
        orgName: true,
        representativeFullName: true,
        academicPosition: true,
        phoneNumber: true,
        applications: { select: { id: true }, take: 1 },
      },
    });
    const [organization] = organizations;
    if (!organization || organizations.length !== 1 ||
      organization.verificationStatus !== VerificationStatus.PENDING || organization.applications.length > 0 ||
      [organization.orgName, organization.representativeFullName, organization.academicPosition, organization.phoneNumber]
        .some((value) => !value.trim())) return;

    await tx.organizationApplication.create({
      data: {
        organizationId: organization.id,
        submittedById: ownerId,
        status: VerificationStatus.PENDING,
        submittedAt,
      },
      select: { id: true },
    });
  }

  async resendVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, emailVerifiedAt: true, status: true },
    });
    if (user && !user.emailVerifiedAt && user.status !== UserStatus.SUSPENDED) {
      try {
        await this.startVerification(user.id);
      } catch (error) {
        // Public responses cannot expose account status, cooldown or SMTP failure.
        // Failed SMTP attempts are removed by startVerification for immediate retry.
        if (!(error instanceof HttpException) || ![400, 429, 503].includes(error.getStatus())) throw error;
      }
    }
    // No account status, delivery result, or account-specific timing is public.
    return { message: 'If this address belongs to an account awaiting verification, check your inbox.' };
  }

  createRecoveryToken(userId: string) {
    // Deliberately no JWT subject: this capability is never a login token.
    return this.jwt.signAsync({ userId }, { audience: VERIFICATION_RECOVERY_AUDIENCE, expiresIn: VERIFICATION_RECOVERY_TTL_SECONDS });
  }

  private async recoveryUserId(recoveryToken: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{ userId?: unknown; exp?: unknown }>(recoveryToken, { audience: VERIFICATION_RECOVERY_AUDIENCE, algorithms: ['HS256'] });
      if (typeof payload.userId !== 'string' || !isUUID(payload.userId) || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) throw new Error();
      return payload.userId;
    } catch {
      throw new UnauthorizedException('Recovery session expired. Enter your email to request a link.');
    }
  }

  async recoveryStatus(recoveryToken: string) {
    const userId = await this.recoveryUserId(recoveryToken);
    return this.statusForUser(userId);
  }

  private async statusForUser(userId: string) {
    // Read user state and its deadline together under the issuance/verify lock.
    return this.prisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<{ email_verified_at: Date | null; status: string }[]>`
        SELECT email_verified_at, status FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;
      if (users.length !== 1) throw new UnauthorizedException('Recovery session expired. Enter your email to request a link.');
      const verified = Boolean(users[0]!.email_verified_at);
      const unavailable = users[0]!.status === UserStatus.SUSPENDED;
      const active = !verified && !unavailable ? await tx.emailVerificationToken.findFirst({
        where: { userId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { expiresAt: 'desc' },
        select: { expiresAt: true },
      }) : null;
      return { verified, unavailable, expiresAt: active?.expiresAt.toISOString() ?? null };
    });
  }

  async retryRecovery(recoveryToken: string) {
    const userId = await this.recoveryUserId(recoveryToken);
    let deliveryFailed = false;
    try {
      await this.startVerification(userId);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) deliveryFailed = true;
      else if (!(error instanceof HttpException) || ![400, 429].includes(error.getStatus())) throw error;
    }
    const state = await this.statusForUser(userId);
    return { ...state, deliveryFailed: deliveryFailed && !state.expiresAt && !state.verified };
  }

  async startVerification(userId: string) {
    const token = randomBytes(32).toString('hex');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const frontendOrigin = process.env.FRONTEND_ORIGIN;
    if (!frontendOrigin) {
      throw new Error('FRONTEND_ORIGIN is required');
    }

    const link = new URL('/verify-email', frontendOrigin);
    link.searchParams.set('token', token);

    const registeredEmail = await this.prisma.$transaction(async (tx) => {
      // Serialize requests for this account so concurrent resends cannot bypass
      // the current link's expiry. SMTP runs after releasing the lock.
      const users = await tx.$queryRaw<{ email_verified_at: Date | null; email: string; status: string }[]>`
        SELECT email_verified_at, email, status FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;
      if (users.length !== 1 || users[0]!.email_verified_at || users[0]!.status === UserStatus.SUSPENDED) {
        throw new BadRequestException('Email is already verified. Please sign in.');
      }
      const recent = await tx.emailVerificationToken.findFirst({
        where: {
          userId,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (recent) {
        throw new HttpException('Please wait until your current verification link expires.', HttpStatus.TOO_MANY_REQUESTS);
      }
      const verification = await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + VERIFICATION_TTL_MINUTES * 60 * 1000),
        },
      });
      return { email: users[0]!.email, expiresAt: verification.expiresAt };
    });

    try {
      await this.mailService.sendVerificationEmail(registeredEmail.email, link.toString());
    } catch {
      // Remove only this failed attempt, allowing an immediate retry. Other
      // delivered links remain usable until verification or expiry.
      await this.prisma.emailVerificationToken.deleteMany({ where: { tokenHash, usedAt: null } });
      throw new ServiceUnavailableException('We could not send the verification email. Please try again.');
    }
    return registeredEmail.expiresAt.toISOString();
  }
}
