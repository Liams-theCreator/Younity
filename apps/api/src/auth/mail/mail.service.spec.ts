import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service.js';

vi.mock('nodemailer', () => ({ createTransport: vi.fn() }));
const sendMail = vi.fn().mockResolvedValue({});

beforeEach(() => {
  vi.stubEnv('SMTP_HOST', 'mailpit');
  vi.stubEnv('SMTP_PORT', '2525');
  vi.stubEnv('MAIL_FROM', 'Younity <no-reply@younity.test>');
  vi.mocked(createTransport).mockReturnValue({
    sendMail,
  } as unknown as ReturnType<typeof createTransport>);
});
afterEach(() => vi.unstubAllEnvs());

describe('MailService', () => {
  it('uses the configured SMTP host, port and sender', async () => {
    const service = new MailService();
    await service.sendVerificationEmail(
      'student@example.test',
      'https://localhost/verify-email?token=example',
    );
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'mailpit', port: 2525, secure: false }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Younity <no-reply@younity.test>',
        to: 'student@example.test',
        text: expect.stringContaining('This link expires in 10 minutes.'),
      }),
    );
  });
});

describe('organization decision emails', () => {
  it.each(['APPROVED', 'REJECTED', 'NEEDS_CHANGES'] as const)(
    'sends %s using the shared transport and stable message ID',
    async (status) => {
      sendMail.mockClear();
      const service = new MailService();
      await service.sendDecisionEmail({
        recipient: 'owner@example.test',
        status,
        reason: 'Reviewed documents',
        messageId: '<decision-fixture@younity.test>',
      });
      expect(sendMail).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          to: 'owner@example.test',
          messageId: '<decision-fixture@younity.test>',
          subject: expect.any(String),
          text: expect.stringContaining(
            '\n\nReviewer note:\nReviewed documents\n\n',
          ),
        }),
      );
    },
  );
  it('propagates delivery failures for durable dispatcher retry', async () => {
    sendMail.mockRejectedValueOnce(new Error('SMTP unavailable'));
    await expect(
      new MailService().sendDecisionEmail({
        recipient: 'owner@example.test',
        status: 'APPROVED',
        reason: 'ok',
        messageId: '<fixture@younity.test>',
      }),
    ).rejects.toThrow('SMTP unavailable');
  });
});
