import { randomUUID, createHash } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailService } from '../src/auth/mail/mail.service.js';
import { RESEND_REQUEST_LIMIT } from '../src/auth/guards/resend-rate-limit.guard.js';
import { configureApplication } from '../src/config/application.js';
import { validateEnvironment } from '../src/config/environment.js';

const password = 'Verification-password-2026!';
const mail = { sendVerificationEmail: vi.fn() };
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

describe('registration and email verification with PostgreSQL', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  const ids: string[] = [];
  const previousOrigin = process.env.FRONTEND_ORIGIN;

  const input = () => ({ firstName: 'Email', lastName: 'Verification', email: `verification-${randomUUID()}@example.test`, password });
  async function register() {
    const credentials = input();
    const response = await request(app.getHttpServer()).post('/api/auth/register/student').send(credentials).expect(201);
    ids.push(response.body.id);
    return { credentials, user: response.body };
  }
  function lastToken() {
    return new URL(mail.sendVerificationEmail.mock.calls.at(-1)![1]).searchParams.get('token')!;
  }
  const verify = (token: string) => request(app.getHttpServer()).post('/api/email-verification/verify-email').send({ token });
  const resend = (credentials: { email: string }) => request(app.getHttpServer()).post('/api/auth/resend-verification').send({ email: credentials.email });
  const status = (recoveryToken: string) => request(app.getHttpServer()).post('/api/email-verification/recovery-status').send({ recoveryToken });
  const retry = (recoveryToken: string) => request(app.getHttpServer()).post('/api/email-verification/retry').send({ recoveryToken });

  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !decodeURIComponent(new URL(url).pathname).endsWith('_test')) throw new Error('Use a dedicated TEST_DATABASE_URL ending in _test');
    process.env.DATABASE_URL = url;
    process.env.FRONTEND_ORIGIN = 'https://localhost:8443';
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MailService).useValue(mail).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureApplication(app, validateEnvironment());
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });
  beforeEach(() => { mail.sendVerificationEmail.mockReset().mockResolvedValue(undefined); });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.emailVerificationToken.deleteMany({ where: { userId: { in: ids } } });
        await prisma.organization.deleteMany({ where: { ownerId: { in: ids } } });
        await prisma.studentProfile.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      if (app) await app.close();
      if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
      else process.env.FRONTEND_ORIGIN = previousOrigin;
    }
  });

  it.each(['student', 'organizer'])('requires email verification before %s login and existing-cookie access', async (role) => {
    const data = { ...input(), ...(role === 'organizer' ? { organizationName: 'Verification Club', type: 'STUDENT_CLUB', representativeFullName: 'Email Verification', academicPosition: 'Coordinator', phoneNumber: '+212612345678' } : {}) };
    const created = await request(app.getHttpServer()).post(`/api/auth/register/${role}`).send(data).expect(201);
    ids.push(created.body.id);
    expect(created.body.verificationEmailSent).toBe(true);
    expect(created.body.passwordHash).toBeUndefined();
    const credentials = { email: data.email, password };
    const denied = await request(app.getHttpServer()).post('/api/auth/login').send(credentials).expect(403);
    expect(denied.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(denied.headers['set-cookie']).toBeUndefined();
    const cookie = `access_token=${await jwt.signAsync({ sub: created.body.id })}`;
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(403);
    const token = lastToken();
    const saved = await prisma.emailVerificationToken.findUniqueOrThrow({ where: { tokenHash: hash(token) } });
    expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBeGreaterThan(590000);
    expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBeLessThanOrEqual(600000);
    await verify(token).expect(200);
    await verify(token).expect(400);
    const login = await request(app.getHttpServer()).post('/api/auth/login').send(credentials).expect(200);
    expect(login.headers['set-cookie']).toBeDefined();
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.status).toBe(role === 'organizer' ? 'PENDING' : 'ACTIVE');
    if (role === 'organizer') expect(me.body.organization.verificationStatus).toBe('PENDING');
    await resend(credentials).expect(200);
  });

  it('returns the stored expiry privately, suppresses resends for the whole link lifetime and serializes two tabs at expiry', async () => {
    const { credentials, user } = await register();
    const recoveryToken = user.verificationRecoveryToken;
    const oldToken = lastToken();
    const saved = await prisma.emailVerificationToken.findUniqueOrThrow({ where: { tokenHash: hash(oldToken) } });
    expect(user.verificationExpiresAt).toBe(saved.expiresAt.toISOString());
    const expected = { verified: false, unavailable: false, expiresAt: saved.expiresAt.toISOString() };
    expect((await status(recoveryToken).expect(200)).body).toEqual(expected);
    // More than the retired 60-second cooldown has elapsed, but the link is live.
    await prisma.emailVerificationToken.update({ where: { id: saved.id }, data: { createdAt: new Date(Date.now() - 61000) } });
    await resend(credentials).set('X-Forwarded-For', '192.0.2.31').expect(200);
    expect((await retry(recoveryToken).expect(200)).body).toEqual({ ...expected, deliveryFailed: false });
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);

    // A controlled database fixture crosses the deadline without a real wait.
    await prisma.emailVerificationToken.update({ where: { id: saved.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    const tabs = await Promise.all([retry(recoveryToken), retry(recoveryToken)]);
    expect(tabs.map((tab) => tab.status)).toEqual([200, 200]);
    expect(tabs[0]!.body).toEqual(tabs[1]!.body);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(2);
    const active = await prisma.emailVerificationToken.findMany({ where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } } });
    expect(active).toHaveLength(1);
    expect(tabs[0]!.body.expiresAt).toBe(active[0]!.expiresAt.toISOString());
    await verify(oldToken).expect(400);
    const verified = await Promise.all([verify(lastToken()), verify(lastToken())]);
    expect(verified.map((result) => result.status).sort((a, b) => a - b)).toEqual([200, 400]);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
    expect((await status(recoveryToken).expect(200)).body).toEqual({ verified: true, unavailable: false, expiresAt: null });
    expect((await retry(recoveryToken).expect(200)).body.verified).toBe(true);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(2);
  });

  it('allows immediate scoped retry after delivery failure without creating another account', async () => {
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const { credentials, user } = await register();
    expect(user.verificationExpiresAt).toBeNull();
    expect(user.verificationEmailSent).toBe(false);
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP unavailable again'));
    expect((await retry(user.verificationRecoveryToken).expect(200)).body).toEqual({ verified: false, unavailable: false, expiresAt: null, deliveryFailed: true });
    const sent = await retry(user.verificationRecoveryToken).expect(200);
    expect(sent.body.deliveryFailed).toBe(false);
    expect(Date.parse(sent.body.expiresAt)).toBeGreaterThan(Date.now());
    expect((await status(user.verificationRecoveryToken).expect(200)).body.expiresAt).toBe(sent.body.expiresAt);
    expect(await prisma.user.count({ where: { email: credentials.email } })).toBe(1);
    await verify(lastToken()).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: credentials.email, password }).expect(200);
  });

  it('rejects user IDs, email overrides, login tokens and forged/expired recovery capabilities as private ownership proof', async () => {
    const { user, credentials } = await register();
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    for (const path of ['recovery-status', 'retry']) {
      await request(app.getHttpServer()).post(`/api/email-verification/${path}`).send({ userId: user.id }).expect(400);
      await request(app.getHttpServer()).post(`/api/email-verification/${path}`).send({ recoveryToken: user.verificationRecoveryToken, email: 'override@example.test' }).expect(400);
      await request(app.getHttpServer()).post(`/api/email-verification/${path}`).send({ recoveryToken: await jwt.signAsync({ sub: user.id }) }).expect(401);
      await request(app.getHttpServer()).post(`/api/email-verification/${path}`).send({ recoveryToken: await jwt.signAsync({ userId: user.id }, { audience: 'email-verification-recovery', expiresIn: -1 }) }).expect(401);
      const fake = user.verificationRecoveryToken.split('.');
      fake[2] = 'a'.repeat(43);
      await request(app.getHttpServer()).post(`/api/email-verification/${path}`).send({ recoveryToken: fake.join('.') }).expect(401);
    }
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', `access_token=${user.verificationRecoveryToken}`).expect(401);
    await request(app.getHttpServer()).post('/api/auth/resend-verification').set('X-Forwarded-For', '192.0.2.32').send({ email: credentials.email, userId: user.id }).expect(400);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toBe(before.email);
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.emailVerifiedAt).toBeNull();
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects expired, unknown and malformed tokens without verifying an account', async () => {
    const { user } = await register();
    const token = lastToken();
    await prisma.emailVerificationToken.update({ where: { tokenHash: hash(token) }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await verify(token).expect(400);
    await verify('f'.repeat(64)).expect(400);
    await verify('bad').expect(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
  });

  it('returns the same response for unknown, verified, suspended, cooling-down and failed-delivery addresses', async () => {
    const expected = { message: 'If this address belongs to an account awaiting verification, check your inbox.' };
    const { credentials, user } = await register();
    expect((await resend(credentials).expect(200)).body).toEqual(expected);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    expect((await resend({ email: `unknown-${randomUUID()}@example.test` }).expect(200)).body).toEqual(expected);
    await verify(lastToken()).expect(200);
    expect((await resend(credentials).expect(200)).body).toEqual(expected);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED', emailVerifiedAt: null } });
    expect((await resend(credentials).expect(200)).body).toEqual(expected);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'ACTIVE' } });
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    expect((await resend(credentials).expect(200)).body).toEqual(expected);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
    // Failed delivery does not use up the account cooldown.
    expect((await resend({ email: ` ${credentials.email.toUpperCase()} ` }).expect(200)).body).toEqual(expected);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(3);
    await verify(lastToken()).expect(200);
  });

  it('validates an email-only DTO while keeping password validation on login', async () => {
    for (const body of [{}, { email: 'bad' }, { email: 123 }, { email: 'a'.repeat(256) + '@example.test' }, { email: 'student@example.test', password }, { email: 'student@example.test', userId: randomUUID() }]) {
      await request(app.getHttpServer()).post('/api/auth/resend-verification').send(body).expect(400);
    }
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'student@example.test' }).expect(400);
    const docs = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(docs.body.components.schemas.ResendVerificationDto.required).toEqual(['email']);
    expect(Object.keys(docs.body.components.schemas.ResendVerificationDto.properties)).toEqual(['email']);
  });

  it('rate limits public requests independently of address existence', async () => {
    for (let i = 0; i < RESEND_REQUEST_LIMIT; i++) {
      await request(app.getHttpServer()).post('/api/auth/resend-verification').set('X-Forwarded-For', '192.0.2.8').send({ email: `unknown-${i}@example.test` }).expect(200);
    }
    const response = await request(app.getHttpServer()).post('/api/auth/resend-verification').set('X-Forwarded-For', '192.0.2.8').send({ email: 'another@example.test' }).expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.skipIf(process.env.EMAIL_VERIFICATION_SMTP_TEST !== '1')('delivers only to the corrected registered email after a public typo request, preserving credentials', async () => {
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error('Initial SMTP failure'));
    const { credentials, user } = await register();
    expect(user.verificationEmailSent).toBe(false);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const typo = `typo-${randomUUID()}@example.test`;
    const transport = new MailService();
    mail.sendVerificationEmail.mockImplementation((email, link) => transport.sendVerificationEmail(email, link));
    const first = await resend({ email: typo }).set('X-Forwarded-For', '192.0.2.33').expect(200);
    const second = await resend({ email: ` ${credentials.email.toUpperCase()} ` }).set('X-Forwarded-For', '192.0.2.33').expect(200);
    expect(second.body).toEqual(first.body);
    expect(Object.keys(second.body)).toEqual(['message']);
    expect(mail.sendVerificationEmail).toHaveBeenLastCalledWith(before.email, expect.any(String));
    const search = async (email: string) => {
      const url = new URL('http://127.0.0.1:8025/api/v1/search');
      url.searchParams.set('query', `to:${email}`);
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      expect(response.ok).toBe(true);
      return response.json() as Promise<{ messages: { ID: string }[] }>;
    };
    expect((await search(typo)).messages).toHaveLength(0);
    const inbox = await search(before.email);
    expect(inbox.messages).toHaveLength(1);
    const response = await fetch(`http://127.0.0.1:8025/api/v1/message/${inbox.messages[0]!.ID}`, { signal: AbortSignal.timeout(5000) });
    const content = await response.json() as { Text: string };
    expect(content.Text).toContain(`https://localhost:8443/verify-email?token=${lastToken()}`);
    expect(content.Text).toContain('expires in 10 minutes');
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.email).toBe(before.email);
    expect(after.passwordHash).toBe(before.passwordHash);
    await verify(lastToken()).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: credentials.email, password }).expect(200);
  });
});
