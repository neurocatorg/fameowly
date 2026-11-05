import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, openPasswordForm } from "./helpers/auth";
import { MAIL_SOURCE, adminApi, mailMark, readMailedCode, uniqueEmail } from "./helpers/mail";

// Needs a separate server (own DATA_DIR) and a way to read mail, e.g.
//   E2E_BASE_URL=http://localhost:3040 E2E_SERVER_LOG=/tmp/server.log   (dev server, mail printed to its log)
//   E2E_BASE_URL=http://localhost:3040 E2E_MAILPIT_URL=http://127.0.0.1:8025   (SMTP into Mailpit)
test.skip(!MAIL_SOURCE || !process.env.E2E_BASE_URL, "needs E2E_BASE_URL and E2E_SERVER_LOG or E2E_MAILPIT_URL");

async function createUser(baseURL: string, email: string, password?: string) {
  const api = await adminApi(baseURL);
  const res = await api.post("/api/users", { data: { name: email, email, password, role: "user" } });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
}

async function requestCodeInUi(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Прислать код" }).click();
  await expect(page.getByRole("heading", { name: "Код ушёл на почту" })).toBeVisible();
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel("Код из письма").fill(code);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("/");
}

test("a user added by the admin signs in by code, resend waits 45 s, signs in again", async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  const email = uniqueEmail("login", info.project.name);
  await createUser(baseURL!, email);

  let since = mailMark();
  await requestCodeInUi(page, email);
  await enterCode(page, await readMailedCode(email, since));

  const early = await page.request.post("/api/auth/email/start", { data: { email } });
  expect(early.status()).toBe(429);
  expect((await early.json()).retryAfter).toBeGreaterThan(0);

  await page.context().clearCookies();
  await page.waitForTimeout(46_000);
  since = mailMark();
  await requestCodeInUi(page, email);
  await enterCode(page, await readMailedCode(email, since));
});

test("five wrong codes burn the code", async ({ page, baseURL }, info) => {
  const email = uniqueEmail("wrong", info.project.name);
  await createUser(baseURL!, email);

  const since = mailMark();
  expect((await page.request.post("/api/auth/email/start", { data: { email } })).ok()).toBeTruthy();
  const code = await readMailedCode(email, since);
  const wrong = code === "00000000" ? "11111111" : "00000000";

  for (let i = 0; i < 5; i++) {
    const res = await page.request.post("/api/auth/email/verify", { data: { email, code: wrong } });
    expect(res.status()).toBe(400);
  }
  const right = await page.request.post("/api/auth/email/verify", { data: { email, code } });
  expect(right.status()).toBe(400);
});

test("password reset by code signs in and replaces the old password", async ({ page, baseURL }, info) => {
  const email = uniqueEmail("reset", info.project.name);
  await createUser(baseURL!, email, "old-pass-1");

  await openPasswordForm(page);
  await page.getByRole("button", { name: "Забыли пароль?" }).click();
  await page.getByLabel("Email").fill(email);
  const since = mailMark();
  await page.getByRole("button", { name: "Прислать код" }).click();
  await page.getByLabel("Код из письма").fill(await readMailedCode(email, since));
  await page.getByLabel("Новый пароль").fill("new-pass-2");
  await page.getByRole("button", { name: "Сохранить и войти" }).click();
  await page.waitForURL("/");

  const old = await page.request.post("/api/auth/login", { data: { name: email, password: "old-pass-1" } });
  expect(old.status()).toBe(401);
  const fresh = await page.request.post("/api/auth/login", { data: { name: email, password: "new-pass-2" } });
  expect(fresh.ok()).toBeTruthy();
});

test("legacy sign-in by name and password still works", async ({ page }) => {
  await loginAsAdmin(page);
});

test("an unknown email gets the same answers and never gets an account", async ({ page, baseURL }, info) => {
  const known = uniqueEmail("known", info.project.name);
  const unknown = uniqueEmail("unknown", info.project.name);
  await createUser(baseURL!, known);

  const start = (email: string) => page.request.post("/api/auth/email/start", { data: { email } });
  const [a, b] = [await start(known), await start(unknown)];
  expect(a.status()).toBe(b.status());
  expect(await a.json()).toEqual(await b.json());
  const [c, d] = [await start(known), await start(unknown)];
  expect([c.status(), d.status()]).toEqual([429, 429]);

  const verify = (email: string) =>
    page.request.post("/api/auth/email/verify", { data: { email, code: "12345678" } });
  const [wrongKnown, wrongUnknown] = [await verify(known), await verify(unknown)];
  expect(wrongUnknown.status()).toBe(wrongKnown.status());
  expect(await wrongUnknown.json()).toEqual(await wrongKnown.json());

  const admin = await adminApi(baseURL!);
  const users: Array<{ email?: string }> = (await (await admin.get("/api/users")).json()).users;
  expect(users.some((u) => u.email === unknown)).toBe(false);
  await admin.dispose();
});
