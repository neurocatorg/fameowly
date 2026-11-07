import { NextRequest, NextResponse } from "next/server";
import { authorize, createSession, findUserByName, setSessionCookie, updateUser } from "@/lib/auth";
import { readBody } from "@/lib/sign-in/http";

const MAX_NAME_LENGTH = 64;

/** PATCH /api/profile { name } — rename yourself; names stay unique, legacy accounts sign in with them */
export async function PATCH(request: NextRequest) {
  const user = await authorize(request.cookies.get("session")?.value);
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await readBody(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Имя — от 1 до ${MAX_NAME_LENGTH} символов` }, { status: 400 });
  }
  const holder = await findUserByName(name);
  if (holder && holder.id !== user.id) {
    return NextResponse.json({ error: "Это имя уже занято" }, { status: 409 });
  }

  const updated = await updateUser(user.id, { name });
  if (!updated) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  // The session carries the name
  await setSessionCookie(await createSession(updated));
  return NextResponse.json({ name: updated.name });
}
