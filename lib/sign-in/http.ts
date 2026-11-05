import { NextResponse } from "next/server";
import { createSession, setSessionCookie, type User } from "../auth";

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

export async function signedIn(user: User): Promise<NextResponse> {
  await setSessionCookie(await createSession(user));
  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, role: user.role },
  });
}
