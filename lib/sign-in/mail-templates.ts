import type { MailMessage } from "../contracts";
import { formatCode, type CodePurpose } from "./auth-codes";
import { CODE_TTL_SECONDS } from "./limits";

const COPY: Record<CodePurpose, { subject: string; lead: string }> = {
  login: { subject: "Код для входа в FaMeowly", lead: "Код для входа" },
  reset_password: { subject: "Восстановление пароля FaMeowly", lead: "Код для смены пароля" },
  verify_email: { subject: "Подтверждение email в FaMeowly", lead: "Код подтверждения" },
};

export function codeMessage(purpose: CodePurpose, to: string, code: string): MailMessage {
  const { subject, lead } = COPY[purpose];
  const shown = formatCode(code);
  const minutes = CODE_TTL_SECONDS / 60;
  const footer = "Если вы ничего не запрашивали, просто удалите это письмо.";

  return {
    to,
    subject,
    text: `${lead}: ${shown}\n\nКод действует ${minutes} минут.\n${footer}\n`,
    html:
      `<div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#222">` +
      `<p>${lead}:</p>` +
      `<p style="font-size:28px;font-weight:bold;letter-spacing:4px;margin:16px 0">${shown}</p>` +
      `<p>Код действует ${minutes} минут.</p>` +
      `<p style="color:#777;font-size:13px">${footer}</p></div>`,
  };
}
