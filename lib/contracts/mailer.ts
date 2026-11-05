/**
 * Contract: outgoing mail (login codes, password recovery, plugin notifications).
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  /** False when mail cannot be delivered; the login page then hides email sign-in */
  isConfigured(): boolean;
  send(message: MailMessage): Promise<void>;
}
