import { Injectable } from '@nestjs/common';
import { createTransport } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter = createTransport({
    host: process.env.SMPT_HOST ?? 'localhost',
    port: Number(process.env.SMPT_PORT ?? '1025'),
    secure: false,
  });

  async sendVerificationEmail(email: string, link: string): Promise<void> {
    await this.transporter.sendMail({
      from: process.env.MAIL_FORM ?? 'Younity <no-reply@gmail.text>',
      to: email,
      subject: 'Verify your Younity email',
      text: [
        'Welcome to Younity!',
        '',
        'Open the link to verify your email:',
        link,
        '',
        'This link expires in 10 minutes.',
        '',
        'If you did not create this account you can ignore this email',
      ].join('\n'),
    });
  }
}
