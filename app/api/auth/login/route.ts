import { NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/sign-in/client-ip";
import { readBody, signInError, signedIn } from "@/lib/sign-in/http";
import { signInWithPassword } from "@/lib/sign-in/password-sign-in";

/** POST /api/auth/login { name, password } — `name` is a display name or an email */
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request);
    const login = typeof body.name === "string" ? body.name : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!login.trim() || !password) {
      return NextResponse.json({ error: "Логин и пароль обязательны" }, { status: 400 });
    }

    const result = await signInWithPassword(login, password, clientIp(request.headers));
    if ("error" in result) {
      if (result.error === "limited") return signInError("limited");
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }
    return signedIn(result.user);
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
