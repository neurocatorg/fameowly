import { Page } from "@playwright/test";

/** Opens the password form; the email code form comes first when mail is configured */
export async function openPasswordForm(page: Page) {
  await page.goto("/login");
  const passwordLink = page.getByRole("button", { name: "Войти по паролю" });
  const loginField = page.getByPlaceholder("Имя или email");
  await passwordLink.or(loginField).first().waitFor();
  if (await passwordLink.isVisible()) await passwordLink.click();
}

/**
 * Logs in as the Admin user via the login page.
 * Admin has password "admin123" (ADMIN_INIT_PASS default)
 */
export async function loginAsAdmin(page: Page) {
  await openPasswordForm(page);
  await page.getByPlaceholder("Имя или email").fill("Admin");
  await page.getByPlaceholder("••••••••").fill("admin123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL("/", { timeout: 10_000 });
}
