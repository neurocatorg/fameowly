import { NextRequest, NextResponse } from "next/server";
import {
  authorizeAdmin,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  hashPassword,
  bumpSessionVersion,
} from "@/lib/auth";
import type { User, UserRole } from "@/lib/auth";
import { initializeContainer, container } from "@/lib/plugin-loader";
import { DuplicateKeyError } from "@/lib/storage/errors";
import { normalizeEmail } from "@/lib/sign-in/email";

initializeContainer();

const COOKIE_NAME = "session";
const ROLES: UserRole[] = ["admin", "user"];

const forbidden = () => NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
const badEmail = () => NextResponse.json({ error: "Некорректный email" }, { status: 400 });
const emailTaken = () => NextResponse.json({ error: "Этот email уже занят" }, { status: 409 });

function adminToken(request: NextRequest): string | undefined {
  return request.cookies.get(COOKIE_NAME)?.value;
}

function publicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    email: u.email,
    emailVerified: Boolean(u.emailVerifiedAt),
    hasPassword: Boolean(u.password),
  };
}

function isEmailConflict(err: unknown): boolean {
  return err instanceof DuplicateKeyError && err.fields.includes("email");
}

/** Empty string = no email; undefined = invalid */
function parseEmail(value: unknown): string | null | undefined {
  if (typeof value !== "string" || value.trim() === "") return null;
  return normalizeEmail(value) ?? undefined;
}

// Get all users (admin only)
export async function GET(request: NextRequest) {
  const admin = await authorizeAdmin(adminToken(request));
  if (!admin) return forbidden();

  return NextResponse.json({ users: (await getUsers()).map(publicUser) });
}

// Add a new user (admin only); without a password the user signs in by email code
export async function POST(request: NextRequest) {
  const admin = await authorizeAdmin(adminToken(request));
  if (!admin) return forbidden();

  const { name: rawName, email: rawEmail, password, role } = await request.json();
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const email = parseEmail(rawEmail);
  if (email === undefined) return badEmail();
  if (!name || (!password && !email)) {
    return NextResponse.json(
      { error: "Укажите имя и пароль или email" },
      { status: 400 }
    );
  }

  const users = await getUsers();
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json(
      { error: "Пользователь с таким именем уже существует" },
      { status: 409 }
    );
  }

  const newUser: User = {
    id: String(Date.now()),
    name,
    ...(email ? { email } : {}),
    ...(password ? { password: hashPassword(password) } : {}),
    role: ROLES.includes(role) ? role : "user",
    sessionVersion: 1,
  };

  try {
    await createUser(newUser);
  } catch (err) {
    if (isEmailConflict(err)) return emailTaken();
    throw err;
  }

  await container.get("userLifecycle").onUserCreated?.(
    { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    { source: "admin" },
  );

  return NextResponse.json({ user: publicUser(newUser) });
}

// Delete user (admin only)
export async function DELETE(request: NextRequest) {
  const admin = await authorizeAdmin(adminToken(request));
  if (!admin) return forbidden();

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json(
      { error: "ID пользователя обязателен" },
      { status: 400 }
    );
  }

  if (id === admin.id) {
    return NextResponse.json(
      { error: "Нельзя удалить самого себя" },
      { status: 400 }
    );
  }

  if (!(await deleteUser(id))) {
    return NextResponse.json(
      { error: "Пользователь не найден" },
      { status: 404 }
    );
  }

  await container.get("userLifecycle").onUserDeleted(id);

  return NextResponse.json({ success: true });
}

/**
 * Update a user (admin only): reset the password, change the role or the email.
 * A password or role change invalidates the user's existing sessions.
 */
export async function PATCH(request: NextRequest) {
  const admin = await authorizeAdmin(adminToken(request));
  if (!admin) return forbidden();

  const body = await request.json();
  const { id, newPassword, role } = body;
  const emailGiven = "email" in body;
  if (!id || (!newPassword && !role && !emailGiven)) {
    return NextResponse.json(
      { error: "Нужен новый пароль, роль или email" },
      { status: 400 }
    );
  }
  const email = emailGiven ? parseEmail(body.email) : null;
  if (email === undefined) return badEmail();

  const users = await getUsers();
  const user = users.find((u) => u.id === id);
  if (!user) {
    return NextResponse.json(
      { error: "Пользователь не найден" },
      { status: 404 }
    );
  }

  if (role && role !== user.role) {
    if (!ROLES.includes(role)) {
      return NextResponse.json({ error: "Неизвестная роль" }, { status: 400 });
    }
    if (user.id === admin.id) {
      return NextResponse.json(
        { error: "Нельзя изменить собственную роль" },
        { status: 400 }
      );
    }
    const lastAdmin =
      user.role === "admin" &&
      role !== "admin" &&
      users.filter((u) => u.role === "admin").length === 1;
    if (lastAdmin) {
      return NextResponse.json(
        { error: "В системе должен остаться хотя бы один админ" },
        { status: 400 }
      );
    }
    user.role = role;
    bumpSessionVersion(user);
  }

  if (newPassword) {
    user.password = hashPassword(newPassword);
    bumpSessionVersion(user);
  }

  const changes: Partial<User> = { role: user.role, sessionVersion: user.sessionVersion };
  if (user.password) changes.password = user.password;
  const unset: Array<"email" | "emailVerifiedAt"> = [];
  if (emailGiven && email !== (user.email ?? null)) {
    // A new address is unconfirmed until its first code sign-in
    unset.push("emailVerifiedAt");
    if (email) changes.email = email;
    else unset.push("email");
  }

  let updated: User | undefined;
  try {
    updated = await updateUser(user.id, changes, unset);
  } catch (err) {
    if (isEmailConflict(err)) return emailTaken();
    throw err;
  }

  return NextResponse.json({ user: publicUser(updated ?? user) });
}
