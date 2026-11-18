import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Development adapter: prints the message to the server log. Refused in production by env validation. */
class ConsoleEmailSender implements EmailSender {
  readonly name = 'console';
  async send(m: EmailMessage): Promise<void> {
    logger.info({ to: m.to, subject: m.subject }, `[DEV EMAIL — not delivered]\n${m.text}`);
  }
}

/** Test adapter: keeps messages in memory so tests can read verification/reset links. */
export class MemoryEmailSender implements EmailSender {
  readonly name = 'memory';
  readonly outbox: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<void> {
    this.outbox.push(m);
  }
  clear(): void {
    this.outbox.length = 0;
  }
}

/** Real delivery through any SMTP provider. */
class SmtpEmailSender implements EmailSender {
  readonly name = 'smtp';
  private transporter: Transporter;
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: env.SMTP_SECURE ?? false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }
  async send(m: EmailMessage): Promise<void> {
    await this.transporter.sendMail({ from: env.EMAIL_FROM, ...m });
  }
}

function createSender(): EmailSender {
  switch (env.EMAIL_PROVIDER) {
    case 'smtp':
      return new SmtpEmailSender();
    case 'memory':
      return new MemoryEmailSender();
    default:
      return new ConsoleEmailSender();
  }
}

export const emailSender: EmailSender = createSender();

/** Sends without letting delivery failures break the user-facing request. */
export async function sendEmailSafely(message: EmailMessage): Promise<boolean> {
  try {
    await emailSender.send(message);
    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, 'Email delivery failed');
    return false;
  }
}
