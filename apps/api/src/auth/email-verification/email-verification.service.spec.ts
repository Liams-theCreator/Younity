import { HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { EmailVerificationService } from './email-verification.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import type { MailService } from '../mail/mail.service.js';

const token = 'a'.repeat(64);
const tokenHash = createHash('sha256').update(token).digest('hex');

describe('EmailVerificationService', () => {
  const tx = {
    $queryRaw: vi.fn(),
    emailVerificationToken: { create: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
    user: { update: vi.fn() },
  };
  const prisma = { user: { findUnique: vi.fn() }, $transaction: vi.fn(), emailVerificationToken: { deleteMany: vi.fn() } };
  const mail = { sendVerificationEmail: vi.fn() };
  let service: EmailVerificationService;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('FRONTEND_ORIGIN', 'https://localhost:8443');
    prisma.$transaction.mockImplementation((callback) => callback(tx));
    tx.$queryRaw.mockResolvedValue([{ email_verified_at: null, status: 'ACTIVE', email: 'student@example.test' }]);
    tx.emailVerificationToken.findFirst.mockResolvedValue(null);
    tx.emailVerificationToken.findUnique.mockResolvedValue({ userId: 'user-id' });
    tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
    service = new EmailVerificationService(prisma as unknown as PrismaService, mail as unknown as MailService);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('sends a frontend link, stores only its hash and expires it in 10 minutes', async () => {
    const before = Date.now();
    await service.startVerification('user-id');
    const link = new URL(mail.sendVerificationEmail.mock.calls[0]![1]);
    expect(link.origin).toBe('https://localhost:8443');
    expect(link.pathname).toBe('/verify-email');
    const rawToken = link.searchParams.get('token')!;
    expect(rawToken).toMatch(/^[a-f0-9]{64}$/);
    const data = tx.emailVerificationToken.create.mock.calls[0]![0].data;
    expect(data.tokenHash).toBe(createHash('sha256').update(rawToken).digest('hex'));
    expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 600000);
    expect(data.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 600000);
  });

  it('rate limits recent requests without creating another token or sending mail', async () => {
    tx.emailVerificationToken.findFirst.mockResolvedValue({ id: 'recent' });
    await expect(service.startVerification('user-id')).rejects.toMatchObject({ status: 429 });
    expect(tx.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('does not send mail for an already verified account', async () => {
    tx.$queryRaw.mockResolvedValue([{ email_verified_at: new Date() }]);
    await expect(service.startVerification('user-id')).rejects.toMatchObject({ status: 400 });
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('removes only the failed delivery token and returns a retryable error', async () => {
    mail.sendVerificationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    await expect(service.startVerification('user-id')).rejects.toMatchObject({ status: 503 });
    const data = tx.emailVerificationToken.create.mock.calls[0]![0].data;
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: data.tokenHash, usedAt: null } });
  });

  it.each([null, { id: 'id', emailVerifiedAt: new Date() }, { id: 'id', status: 'SUSPENDED' }])('does not send to ineligible addresses', async (user) => {
    prisma.user.findUnique.mockResolvedValue(user);
    await expect(service.resendVerification('unknown@example.test')).resolves.toEqual({ message: 'If this address belongs to an account awaiting verification, check your inbox.' });
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('normalizes lookup and sends only to the locked registered address without a password lookup', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'student@example.test', emailVerifiedAt: null, status: 'ACTIVE' });
    await service.resendVerification(' Student@Example.Test ');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'student@example.test' }, select: { id: true, email: true, emailVerifiedAt: true, status: true } });
    expect(mail.sendVerificationEmail).toHaveBeenCalledWith('student@example.test', expect.any(String));
  });

  it.each([429, 503, 400])('hides account-specific resend outcomes (%s)', async (status) => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-id', email: 'student@example.test', emailVerifiedAt: null, status: 'ACTIVE' });
    vi.spyOn(service, 'startVerification').mockRejectedValueOnce(new HttpException('Private account outcome', status));
    await expect(service.resendVerification('student@example.test')).resolves.toEqual({ message: 'If this address belongs to an account awaiting verification, check your inbox.' });
  });

  it('rechecks suspension under the row lock', async () => {
    tx.$queryRaw.mockResolvedValue([{ email_verified_at: null, status: 'SUSPENDED', email: 'student@example.test' }]);
    await expect(service.startVerification('user-id')).rejects.toMatchObject({ status: 400 });
    expect(tx.emailVerificationToken.create).not.toHaveBeenCalled();
    expect(mail.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('atomically consumes a valid token, verifies the user and invalidates other links', async () => {
    await expect(service.verifyEmail({ token })).resolves.toEqual({ message: 'Email verified successfully.' });
    expect(tx.emailVerificationToken.updateMany.mock.calls[0]![0]).toMatchObject({ where: { tokenHash, usedAt: null, expiresAt: { gt: expect.any(Date) } } });
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'user-id' }, data: { emailVerifiedAt: expect.any(Date) } });
    expect(tx.emailVerificationToken.updateMany.mock.calls[1]![0]).toMatchObject({ where: { userId: 'user-id', usedAt: null } });
  });

  it.each(['expired', 'used'])('rejects a %s token without verifying the user', async () => {
    tx.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.verifyEmail({ token })).rejects.toMatchObject({ status: 400 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('rejects unknown tokens', async () => {
    tx.emailVerificationToken.findUnique.mockResolvedValue(null);
    await expect(service.verifyEmail({ token })).rejects.toMatchObject({ status: 400 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
