import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { VERIFICATION_TTL_MINUTES } from '../email-verification/settings.js';

@Injectable()
export class MailService {
  private readonly transporter = createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? '1025'),
    secure: false,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
  });

  async sendDecisionEmail(input: {
    recipient: string;
    status: string;
    reason: string;
    messageId: string;
  }): Promise<void> {
    const subjects: Record<string, string> = {
      APPROVED: 'Your Younity organization application was approved',
      REJECTED: 'Your Younity organization application was rejected',
      NEEDS_CHANGES:
        'Changes requested for your Younity organization application',
    };
    const subject = subjects[input.status];
    if (!subject) throw new Error('Unsupported application decision');
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'Younity <no-reply@younity.test>',
      to: input.recipient,
      subject,
      messageId: input.messageId,
      text: `${subject}.\n\nReviewer note:\n${input.reason}\n\nSign in to Younity to view your application.`,
    });
  }

  async sendVerificationEmail(email: string, link: string): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'Younity <no-reply@younity.test>',
      to: email,
      subject: 'Verify your Younity email',
      text: [
        'Welcome to Younity!',
        '',
        'Open the link to verify your email:',
        link,
        '',
        `This link expires in ${VERIFICATION_TTL_MINUTES} minutes.`,
        '',
        'If you did not create this account you can ignore this email',
      ].join('\n'),
    });
  }
}
