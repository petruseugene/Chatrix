import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { AppConfig } from '../config/config.schema';

@Injectable()
export class MailService {
  constructor(private config: ConfigService<AppConfig, true>) {}

  async sendPasswordReset(email: string, rawToken: string): Promise<void> {
    const origin = this.config.get('CORS_ORIGIN', { infer: true });
    const resetUrl = `${origin}/reset-password?token=${rawToken}`;

    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      console.log(`[MailService] Password reset for ${email}: ${resetUrl}`);
      return;
    }

    const transporter = this.getTransporter();
    await transporter.sendMail({
      from: this.config.get('SMTP_FROM', { infer: true }),
      to: email,
      subject: 'Chatrix — Password Reset',
      text: `Reset your password: ${resetUrl} (expires in 1 hour)`,
      html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a> (expires in 1 hour)</p>`,
    });
  }

  private getTransporter(): nodemailer.Transporter {
    return nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', { infer: true }),
      port: this.config.get('SMTP_PORT', { infer: true }),
      auth: {
        user: this.config.get('SMTP_USER', { infer: true }),
        pass: this.config.get('SMTP_PASS', { infer: true }),
      },
    });
  }
}
