import fs from "fs";
import type { Collection } from "./contracts/document-store";
import { getDocumentStore } from "./storage/db";
import { DuplicateKeyError } from "./storage/errors";
import { hashPassword } from "./password";
import { dataPath } from "./paths";

export type UserRole = "admin" | "user";

export interface User {
  id: string;
  /** Display name; legacy accounts also sign in with it */
  name: string;
  /** "salt:hash" (scrypt); bare hex is a legacy unsalted sha256. Absent = sign-in by email code only */
  password?: string;
  role: UserRole;
  /** Bumped on role or password change to invalidate issued tokens */
  sessionVersion?: number;
  /** Unique, trimmed and lower-cased */
  email?: string;
  /** ISO date of the first successful email code for the current email */
  emailVerifiedAt?: string;
}

let seedChecked = false;

function withCurrentRole(user: User): User {
  // Retired roles (family, client) collapse into the plain user role
  return { ...user, role: user.role === "admin" ? "admin" : "user" };
}

/** The first access on an empty store creates the initial admin */
async function usersCollection(): Promise<Collection<User>> {
  const users = getDocumentStore().collection<User>("users", {
    indexes: [{ fields: ["email"], unique: true }],
  });
  if (seedChecked) return users;
  if ((await users.count()) === 0) {
    // A default admin next to real accounts would be an open door
    if (fs.existsSync(dataPath("users.json"))) {
      throw new Error("Legacy data layout in DATA_DIR: run scripts/migrate-legacy-layout.mjs first");
    }
    const adminPass = process.env.ADMIN_INIT_PASS || "admin123";
    try {
      await users.insert({
        id: "1",
        name: "Admin",
        password: hashPassword(adminPass),
        role: "admin",
        sessionVersion: 1,
      });
    } catch (err) {
      if (!(err instanceof DuplicateKeyError)) throw err;
    }
  }
  seedChecked = true;
  return users;
}

export async function getUsers(): Promise<User[]> {
  return (await (await usersCollection()).find()).map(withCurrentRole);
}

export async function findUserByName(name: string): Promise<User | undefined> {
  return (await getUsers()).find(
    (u) => u.name.toLowerCase() === name.toLowerCase()
  );
}

export async function findUserById(id: string): Promise<User | undefined> {
  const user = await (await usersCollection()).get(id);
  return user ? withCurrentRole(user) : undefined;
}

/** `email` must already be normalized */
export async function findUserByEmail(email: string): Promise<User | undefined> {
  const user = await (await usersCollection()).findOne({ email });
  return user ? withCurrentRole(user) : undefined;
}

/** Rejects with `DuplicateKeyError` when the id or the email is taken */
export async function createUser(user: User): Promise<User> {
  return (await usersCollection()).insert(user);
}

export async function updateUser(
  id: string,
  changes: Partial<Omit<User, "id">>,
  unset: Array<Exclude<keyof User, "id">> = []
): Promise<User | undefined> {
  const user = await (await usersCollection()).update(id, { set: changes, unset });
  return user ? withCurrentRole(user) : undefined;
}

export async function deleteUser(id: string): Promise<boolean> {
  return (await usersCollection()).delete(id);
}

/** Invalidate every token issued for this user; persist with `updateUser` */
export function bumpSessionVersion(user: User): void {
  user.sessionVersion = (user.sessionVersion ?? 1) + 1;
}

/** Set a new password and sign the user out everywhere else */
export async function setUserPassword(user: User, plain: string): Promise<User> {
  user.password = hashPassword(plain);
  bumpSessionVersion(user);
  await updateUser(user.id, { password: user.password, sessionVersion: user.sessionVersion });
  return user;
}
