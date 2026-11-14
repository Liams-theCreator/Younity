import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service.js';

vi.mock('nodemailer', () => ({ createTransport: vi.fn() }));
const sendMail = vi.fn().mockResolvedValue({});

beforeEach(() => {
  vi.stubEnv('SMTP_HOST', 'mailpit');
  vi.stubEnv('SMTP_PORT', '2525');
  vi.stubEnv('MAIL_FROM', 'Younity <no-reply@younity.test>');
  vi.mocked(createTransport).mockReturnValue({ sendMail } as unknown as ReturnType<typeof createTransport>);
});
afterEach(() => vi.unstubAllEnvs());

describe('MailService', () => {
  it('uses the configured SMTP host, port and sender', async () => {
    const service = new MailService();
    await service.sendVerificationEmail('student@example.test', 'https://localhost/verify-email?token=example');
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({ host: 'mailpit', port: 2525, secure: false }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'Younity <no-reply@younity.test>', to: 'student@example.test', text: expect.stringContaining('This link expires in 10 minutes.') }));
  });
});
