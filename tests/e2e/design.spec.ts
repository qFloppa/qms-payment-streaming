import { expect, test } from "@playwright/test";

test("illustrative preview pauses, resumes, finishes, and replays without a wallet", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const amount = page.getByTestId("preview-amount");
  const elapsed = page.getByLabel("Preview elapsed time");
  await expect(page.getByRole("button", { name: "Pause preview", exact: true })).toBeVisible();
  await page.clock.runFor(1000);
  const progressing = Number(await amount.textContent());
  expect(progressing).toBeGreaterThan(0.5);
  await page.getByRole("button", { name: "Pause preview", exact: true }).click();
  const paused = await amount.textContent();
  await page.clock.runFor(3000);
  await expect(amount).toHaveText(paused!);
  await page.getByRole("button", { name: "Resume preview", exact: true }).click();
  await page.clock.runFor(20000);
  await expect(amount).toHaveText("0.75000");
  await expect(elapsed).toHaveText("1:00");
  await page.getByRole("button", { name: "Replay preview", exact: true }).click();
  await expect(amount).toHaveText("0.50000");
  await expect(page.getByRole("button", { name: "Pause preview", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("reduced motion starts the illustrative preview paused and still permits playback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/");
  const amount = page.getByTestId("preview-amount");
  await expect(page.getByRole("button", { name: "Resume preview", exact: true })).toBeVisible();
  await page.clock.runFor(3000);
  await expect(amount).toHaveText("0.50000");
  await page.getByRole("button", { name: "Resume preview", exact: true }).click();
  await page.clock.runFor(1000);
  expect(Number(await amount.textContent())).toBeGreaterThan(0.5);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("button", { name: "Resume preview", exact: true })).toBeVisible();
});

test("preview suspends while offscreen and resumes without counting invisible time", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.clock.install();
  await page.goto("/");
  const preview = page.getByRole("region", { name: "Illustrative stream preview" });
  const amount = page.getByTestId("preview-amount");
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(preview).not.toBeInViewport();
  await expect(preview).toHaveAttribute("data-playing", "false");
  await page.clock.runFor(250);
  const paused = await amount.textContent();
  await page.clock.runFor(10000);
  await expect(amount).toHaveText(paused!);
  await preview.scrollIntoViewIfNeeded();
  await expect(preview).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(1000);
  expect(Number(await amount.textContent())).toBeGreaterThan(Number(paused));
  expect(Number(await amount.textContent())).toBeLessThan(Number(paused) + 0.04);
});

test("preview suspends in a hidden tab and keeps the payment accounting consistent", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  const preview = page.getByRole("region", { name: "Illustrative stream preview" });
  const amount = page.getByTestId("preview-amount");
  await expect(preview).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(2000);
  // Supply the browser visibility signal without relying on headless tab scheduling.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(preview).toHaveAttribute("data-playing", "false");
  const paused = await amount.textContent();
  await page.clock.runFor(60000);
  await expect(amount).toHaveText(paused!);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(preview).toHaveAttribute("data-playing", "true");
  await page.clock.runFor(1000);
  expect(Number(await amount.textContent())).toBeGreaterThan(Number(paused));
  expect(Number(await amount.textContent())).toBeLessThan(Number(paused) + 0.04);
  const balances = await preview.locator("dd").allTextContents();
  expect(balances.reduce((total, value) => total + Number(value), 0)).toBeCloseTo(1, 5);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
