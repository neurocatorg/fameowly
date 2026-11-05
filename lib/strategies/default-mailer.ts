/**
 * Strategy: OSS mailer. SMTP through nodemailer when `SMTP_URL` and `MAIL_FROM`
 * are set; without them development prints messages to the server log and
 * production reports mail as unavailable.
 */

import nodemailer, { type Transporter } from "nodemailer";
import type { Mailer, MailMessage } from "../contracts";

export class DefaultMailer implements Mailer {
  private transport: Transporter | null = null;

  private smtpReady(): boolean {
    return Boolean(process.env.SMTP_URL && process.env.MAIL_FROM);
  }

  isConfigured(): boolean {
    return this.smtpReady() || process.env.NODE_ENV !== "production";
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.smtpReady()) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Mail is not configured: set SMTP_URL and MAIL_FROM");
      }
      console.log(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
      return;
    }

    this.transport ??= nodemailer.createTransport(process.env.SMTP_URL);
    await this.transport.sendMail({
      from: process.env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
