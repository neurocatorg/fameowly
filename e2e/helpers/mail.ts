import fs from "fs";
import { expect, request, type APIRequestContext } from "@playwright/test";

/** Where mailed codes are read from: a dev server log, or a Mailpit catching SMTP */
const SERVER_LOG = process.env.E2E_SERVER_LOG;
const MAILPIT_URL = process.env.E2E_MAILPIT_URL;
export const MAIL_SOURCE = SERVER_LOG || MAILPIT_URL;

/** Position after which new mail is looked for */
export function mailMark(): number {
  return SERVER_LOG ? fs.statSync(SERVER_LOG).size : Date.now() - 1000;
}

const CODE_RE = /(\d{4}) (\d{4})/;

async function codeFromLog(email: string, since: number): Promise<string | null> {
  const log = fs.readFileSync(SERVER_LOG as string, "utf-8").slice(since);
  const at = log.lastIndexOf(`[mail] to=${email} `);
  const match = at >= 0 ? CODE_RE.exec(log.slice(at)) : null;
  return match ? match[1] + match[2] : null;
}

async function codeFromMailpit(email: string, since: number): Promise<string | null> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
  const { messages = [] } = (await res.json()) as { messages?: Array<{ Created: string; Snippet: string }> };
  const fresh = messages.find((m) => Date.parse(m.Created) >= since);
  const match = fresh ? CODE_RE.exec(fresh.Snippet) : null;
  return match ? match[1] + match[2] : null;
}

/** Latest code mailed to `email` after `mailMark()` */
export async function readMailedCode(email: string, since: number): Promise<string> {
  let code: string | null = null;
  await expect
    .poll(async () => {
      code = SERVER_LOG ? await codeFromLog(email, since) : await codeFromMailpit(email, since);
      return code;
    }, { timeout: 10_000 })
    .not.toBeNull();
  return code as unknown as string;
}

/** API context signed in as the default admin */
export async function adminApi(baseURL: string): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL });
  const res = await api.post("/api/auth/login", { data: { name: "Admin", password: "admin123" } });
  expect(res.ok()).toBeTruthy();
  return api;
}

/** Unique address per test and browser project, so per-email limits never collide */
export function uniqueEmail(tag: string, project: string): string {
  const slug = `${tag}-${project}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `${slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")}@example.com`;
}
