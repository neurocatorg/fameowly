import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { findUserById, type User, type UserRole } from "./user-store";

export { hashPassword, isLegacyHash, verifyPassword, MIN_PASSWORD_LENGTH } from "./password";
export {
  getUsers,
  findUserByName,
  findUserById,
  findUserByEmail,
  createUser,
  updateUser,
  deleteUser,
  bumpSessionVersion,
  setUserPassword,
} from "./user-store";
export type { User, UserRole } from "./user-store";

export interface SessionPayload {
  userId: string;
  name: string;
  role: UserRole;
  sessionVersion?: number;
}

const JWT_SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me-please-32chars"
);
const COOKIE_NAME = "session";

export async function createSession(user: User): Promise<string> {
  const token = await new SignJWT({
    userId: user.id,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion ?? 1,
  } satisfies SessionPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(JWT_SECRET_KEY);
  return token;
}

/**
 * Resolve a token to the stored user.
 *
 * The JWT lives for a week, so its role is only a hint: a demoted admin would
 * keep admin rights until the token expires. Every privileged path must go
 * through here, which re-reads the user and rejects superseded sessions.
 */
export async function authorize(token: string | undefined): Promise<User | null> {
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user) return null;
  if ((user.sessionVersion ?? 1) !== (session.sessionVersion ?? 1)) return null;

  return user;
}

/** Same as `authorize`, but also requires the admin role */
export async function authorizeAdmin(token: string | undefined): Promise<User | null> {
  const user = await authorize(token);
  return user?.role === "admin" ? user : null;
}

export async function verifySession(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function deleteSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
