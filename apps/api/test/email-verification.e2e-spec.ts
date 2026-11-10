import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailService } from '../src/auth/mail/mail.service.js';
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
  const resend = (credentials: { email: string; password: string }) => request(app.getHttpServer()).post('/api/auth/resend-verification').send(credentials);

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
    await resend(credentials).expect(400);
  });

  it('keeps a created account recoverable after delivery failure and checks credentials before resend', async () => {
    mail.sendVerificationEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    const { credentials, user } = await register();
    expect(user.verificationEmailSent).toBe(false);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(0);
    await resend({ email: credentials.email, password: 'wrong' }).expect(401);
    expect(mail.sendVerificationEmail).toHaveBeenCalledTimes(1);
    await resend({ email: credentials.email, password }).expect(200);
    await verify(lastToken()).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: credentials.email, password }).expect(200);
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

  it('serializes concurrent resends and invalidates all outstanding links after verification', async () => {
    const { user, credentials } = await register();
    const oldToken = lastToken();
    await resend({ email: credentials.email, password }).expect(429);
    await prisma.emailVerificationToken.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61000) } });
    const results = await Promise.all([resend({ email: credentials.email, password }), resend({ email: credentials.email, password })]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 429]);
    const newToken = lastToken();
    expect(newToken).not.toBe(oldToken);
    const verified = await Promise.all([verify(oldToken), verify(newToken)]);
    expect(verified.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 400]);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id, usedAt: null } })).toBe(0);
  });

  it('returns a retryable resend failure, and rejects suspended-account resends', async () => {
    mail.sendVerificationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    const { credentials, user } = await register();
    await resend({ email: credentials.email, password }).expect(503);
    expect(await prisma.emailVerificationToken.count({ where: { userId: user.id } })).toBe(0);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    await resend({ email: credentials.email, password }).expect(403);
  });

  it.skipIf(process.env.EMAIL_VERIFICATION_SMTP_TEST !== '1')('delivers a real verification email through local Mailpit and completes verification', async () => {
    const transport = new MailService();
    mail.sendVerificationEmail.mockImplementation((email, link) => transport.sendVerificationEmail(email, link));
    const { credentials, user } = await register();
    expect(user.verificationEmailSent).toBe(true);
    const search = new URL('http://127.0.0.1:8025/api/v1/search');
    search.searchParams.set('query', `to:${credentials.email}`);
    const searchResponse = await fetch(search, { signal: AbortSignal.timeout(5000) });
    expect(searchResponse.ok).toBe(true);
    const inbox = await searchResponse.json() as { messages: { ID: string; Subject: string }[] };
    const message = inbox.messages.find((item) => item.Subject === 'Verify your Younity email');
    expect(message).toBeDefined();
    const response = await fetch(`http://127.0.0.1:8025/api/v1/message/${message!.ID}`, { signal: AbortSignal.timeout(5000) });
    const content = await response.json() as { Text: string };
    expect(content.Text).toContain(`https://localhost:8443/verify-email?token=${lastToken()}`);
    expect(content.Text).toContain('expires in 10 minutes');
    await verify(lastToken()).expect(200);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: credentials.email, password }).expect(200);
  });
});
