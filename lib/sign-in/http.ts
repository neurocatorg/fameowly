import { NextResponse, after } from "next/server";
import type { MailMessage } from "../contracts";
import { createSession, setSessionCookie, type User } from "../auth";
import { container, initializeContainer } from "../plugin-loader";

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const ERRORS = {
  email: [400, "Проверьте адрес почты"],
  code: [400, "Неверный код или срок его действия истёк. Запросите новый."],
  limited: [429, "Слишком много попыток. Попробуйте позже."],
  unavailable: [503, "Вход по почте не настроен"],
} as const;

export function signInError(kind: keyof typeof ERRORS): NextResponse {
  const [status, error] = ERRORS[kind];
  return NextResponse.json({ error }, { status });
}

export function cooldownError(retryAfter: number): NextResponse {
  return NextResponse.json(
    { error: `Отправить код снова можно через ${retryAfter} с`, retryAfter },
    { status: 429 },
  );
}

/** Never awaited in the response, so its timing reveals nothing */
export function mailAfterResponse(mail: MailMessage): void {
  initializeContainer();
  const mailer = container.get("mailer");
  after(() =>
    mailer.send(mail).catch((err: unknown) => {
      console.error("[mail] send failed:", err instanceof Error ? err.message : err);
    }),
  );
}

export async function signedIn(user: User): Promise<NextResponse> {
  await setSessionCookie(await createSession(user));
  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role },
  });
}
