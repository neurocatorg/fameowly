import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

const MOBILE = { width: 375, height: 667 };
const MOBILE_TALL = { width: 390, height: 844 };
/** A 375x667 phone with the keyboard up, as Android reports it (layout viewport shrinks) */
const MOBILE_KEYBOARD = { width: 375, height: 360 };
const DESKTOP = { width: 1280, height: 900 };

const LONG_LINE = "Расскажи подробно, как устроен фотосинтез у растений";
const MANY_LINES = Array.from({ length: 40 }, (_, i) => `строка ${i + 1}`).join("\n");

const island = (page: Page) => page.getByTestId("chat-input-island");
const input = (page: Page) => page.getByTestId("prompt-input");

async function box(page: Page, testId: string) {
  return (await page.getByTestId(testId).boundingBox())!;
}

for (const viewport of [MOBILE, MOBILE_TALL, DESKTOP]) {
  test.describe(`Prompt island ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("one row while the text fits, two rows when it does not, back when cleared", async ({ page }) => {
      await expect(island(page)).toHaveAttribute("data-layout", "compact");

      await input(page).fill("Привет");
      await expect(island(page)).toHaveAttribute("data-layout", "compact");

      await input(page).fill(LONG_LINE.repeat(viewport === DESKTOP ? 4 : 1));
      await expect(island(page)).toHaveAttribute("data-layout", "expanded");
      const text = await box(page, "prompt-input");
      const send = await box(page, "prompt-submit");
      expect(send.y).toBeGreaterThanOrEqual(text.y + text.height);
      await expect(input(page)).toBeFocused();

      await input(page).fill("");
      await expect(island(page)).toHaveAttribute("data-layout", "compact");

      await input(page).fill("a\nb");
      await expect(island(page)).toHaveAttribute("data-layout", "expanded");
    });

    test("the switch point is the same in both directions", async ({ page }) => {
      await input(page).focus();
      let length = 0;
      while ((await island(page).getAttribute("data-layout")) === "compact") {
        await page.keyboard.type("ж");
        length += 1;
        expect(length).toBeLessThan(400);
      }
      await page.keyboard.press("Backspace");
      await expect(island(page)).toHaveAttribute("data-layout", "compact");
      await page.keyboard.type("ж");
      await expect(island(page)).toHaveAttribute("data-layout", "expanded");
    });

    test("long text stops growing at 200 px", async ({ page }) => {
      await input(page).fill(MANY_LINES);
      const height = (await box(page, "prompt-input")).height;
      expect(Math.round(height)).toBe(200);
    });
  });
}

test.describe("Prompt island with the keyboard up", () => {
  test.use({ viewport: MOBILE_KEYBOARD });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("text takes ~30% of the visible height; header, chips and some feed stay visible", async ({ page }) => {
    await input(page).fill(MANY_LINES);
    const text = await box(page, "prompt-input");
    expect(text.height).toBeLessThanOrEqual(MOBILE_KEYBOARD.height * 0.3 + 1);

    const header = await box(page, "app-header");
    expect(header.y).toBeGreaterThanOrEqual(0);
    const chips = await box(page, "mode-panel");
    // Some of the feed stays visible between the header and the chips
    expect(chips.y - (header.y + header.height)).toBeGreaterThan(40);
    const form = await island(page).boundingBox();
    expect(form!.y + form!.height).toBeLessThanOrEqual(MOBILE_KEYBOARD.height);
  });
});

test.describe("Image mode options", () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/?mode=image");
  });

  test("format and quality are chips above the island", async ({ page }) => {
    const imageIsland = page.getByTestId("image-input-island");
    await expect(imageIsland).toBeVisible();
    const panel = await box(page, "image-options-panel");
    const form = (await imageIsland.boundingBox())!;
    expect(panel.y + panel.height).toBeLessThanOrEqual(form.y + 1);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(MOBILE.width);

    const textarea = page.getByTestId("prompt-input");
    await textarea.focus();
    await page.getByTestId("aspect-picker").click();
    const sheet = page.getByTestId("aspect-picker-sheet");
    await expect(sheet).toBeVisible();
    await page.getByTestId("aspect-picker-option-9:16").click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId("aspect-picker")).toContainText("9:16");
    await expect(textarea).toBeFocused();

    await page.getByTestId("resolution-picker").click();
    await page.getByTestId("resolution-picker-option-2K").click();
    await expect(page.getByTestId("resolution-picker")).toContainText("2K");
  });

  test("Enter adds a line instead of generating", async ({ page }) => {
    const textarea = page.getByTestId("prompt-input");
    await textarea.fill("кот");
    await textarea.press("Enter");
    await expect(textarea).toHaveValue("кот\n");
    await expect(page.getByTestId("image-input-island")).toHaveAttribute("data-layout", "expanded");
  });
});
