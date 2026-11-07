import { test, expect, type Page } from "@playwright/test";
import { MAIL_SOURCE, adminApi, mailMark, readMailedCode, uniqueEmail } from "./helpers/mail";

// Same setup as email-auth.spec.ts: a separate server (own DATA_DIR) and a way to read mail
test.skip(!MAIL_SOURCE || !process.env.E2E_BASE_URL, "needs E2E_BASE_URL and E2E_SERVER_LOG or E2E_MAILPIT_URL");

async function createUser(baseURL: string, user: { name: string; email?: string; password?: string }) {
  const api = await adminApi(baseURL);
  const res = await api.post("/api/users", { data: { ...user, role: "user" } });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
}

async function signIn(page: Page, name: string, password: string) {
  expect((await page.request.post("/api/auth/login", { data: { name, password } })).ok()).toBeTruthy();
}

async function openProfile(page: Page) {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
}

test("a legacy account without email binds one and then signs in by code", async ({ page, baseURL }, info) => {
  test.setTimeout(120_000);
  const name = `legacy-${info.project.name.replace(/\W/g, "")}-${Date.now()}`;
  const email = uniqueEmail("bind", info.project.name);
  await createUser(baseURL!, { name, password: "legacy-pass" });
  await signIn(page, name, "legacy-pass");

  await openProfile(page);
  const section = page.getByTestId("profile-email");
  await expect(section).toContainText("Не привязан");
  await section.getByRole("button", { name: "Привязать email" }).click();
  await section.getByLabel("Адрес, на который придёт код").fill(email);
  let since = mailMark();
  await section.getByRole("button", { name: "Прислать код" }).click();
  await section.getByLabel("Код из письма").fill(await readMailedCode(email, since));
  await section.getByRole("button", { name: "Подтвердить" }).click();
  await expect(section).toContainText(`${email} · подтверждён`);

  await page.context().clearCookies();
  // The binding code started the resend cooldown of this address
  await page.waitForTimeout(46_000);
  since = mailMark();
  expect((await page.request.post("/api/auth/email/start", { data: { email } })).ok()).toBeTruthy();
  const verify = await page.request.post("/api/auth/email/verify", {
    data: { email, code: await readMailedCode(email, since) },
  });
  expect((await verify.json()).user.name).toBe(name);
});

test("an address of another account is refused only after a correct code", async ({ page, baseURL }, info) => {
  const taken = uniqueEmail("taken", info.project.name);
  const mine = uniqueEmail("mine", info.project.name);
  await createUser(baseURL!, { name: taken, email: taken });
  await createUser(baseURL!, { name: mine, email: mine, password: "mine-pass" });
  await signIn(page, mine, "mine-pass");

  const wrong = await page.request.post("/api/profile/email/verify", { data: { email: taken, code: "12345678" } });
  expect(wrong.status()).toBe(400);

  const since = mailMark();
  expect((await page.request.post("/api/profile/email/start", { data: { email: taken } })).ok()).toBeTruthy();
  const right = await page.request.post("/api/profile/email/verify", {
    data: { email: taken, code: await readMailedCode(taken, since) },
  });
  expect(right.status()).toBe(409);
});

test("rename keeps names unique", async ({ page, baseURL }, info) => {
  const email = uniqueEmail("rename", info.project.name);
  await createUser(baseURL!, { name: email, email, password: "rename-pass" });
  await signIn(page, email, "rename-pass");

  await openProfile(page);
  const section = page.getByTestId("profile-name");
  await section.getByLabel("Как к вам обращаться").fill("Admin");
  await section.getByRole("button", { name: "Сохранить" }).click();
  await expect(section).toContainText("Это имя уже занято");

  const fresh = `Кот ${info.project.name} ${Date.now()}`;
  await section.getByLabel("Как к вам обращаться").fill(fresh);
  await section.getByRole("button", { name: "Сохранить" }).click();
  await expect(section).toContainText("Сохранено");
  expect((await (await page.request.get("/api/auth/me")).json()).user.name).toBe(fresh);
});

test("a code-only account sets a first password without proof", async ({ page, baseURL }, info) => {
  const email = uniqueEmail("first", info.project.name);
  await createUser(baseURL!, { name: email, email });
  const since = mailMark();
  await page.request.post("/api/auth/email/start", { data: { email } });
  await page.request.post("/api/auth/email/verify", { data: { email, code: await readMailedCode(email, since) } });

  await openProfile(page);
  const section = page.getByTestId("profile-password");
  await expect(section).toContainText("Пароль не задан");
  await section.getByRole("button", { name: "Задать пароль" }).click();
  await section.getByLabel("Новый пароль").fill("first-pass");
  await section.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(section).toContainText("Пароль сохранён");
  expect((await page.request.post("/api/auth/login", { data: { name: email, password: "first-pass" } })).ok()).toBeTruthy();
});

test("a password is changed by the current one or by a mailed code", async ({ page, baseURL }, info) => {
  const email = uniqueEmail("pass", info.project.name);
  await createUser(baseURL!, { name: email, email, password: "first-pass" });
  await signIn(page, email, "first-pass");

  await openProfile(page);
  const section = page.getByTestId("profile-password");
  await section.getByRole("button", { name: "Сменить пароль" }).click();
  await section.getByLabel("Текущий пароль").fill("wrong-pass");
  await section.getByLabel("Новый пароль").fill("second-pass");
  await section.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(section).toContainText("Текущий пароль неверен");
  await section.getByLabel("Текущий пароль").fill("first-pass");
  await section.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(section).toContainText("Пароль сохранён");

  await section.getByRole("button", { name: "Сменить пароль" }).click();
  const since = mailMark();
  await section.getByRole("button", { name: /Не помню/ }).click();
  await section.getByLabel("Код из письма").fill(await readMailedCode(email, since));
  await section.getByLabel("Новый пароль").fill("third-pass");
  await section.getByRole("button", { name: "Сохранить пароль" }).click();
  await expect(section).toContainText("Пароль сохранён");

  const old = await page.request.post("/api/auth/login", { data: { name: email, password: "second-pass" } });
  expect(old.status()).toBe(401);
  const fresh = await page.request.post("/api/auth/login", { data: { name: email, password: "third-pass" } });
  expect(fresh.ok()).toBeTruthy();
});
