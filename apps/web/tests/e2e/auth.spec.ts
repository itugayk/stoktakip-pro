import { test, expect } from "@playwright/test";

test.describe("demo auth flow", () => {
  test("login form is reachable and submits in demo mode", async ({ page }) => {
    await page.goto("/login");

    // Form is rendered
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    // Pre-filled demo credentials should be present
    const emailValue = await page.locator("#email").inputValue();
    expect(emailValue).toBe("demo@demo.com");

    await page.locator("#login-btn").click();

    // Either navigates to dashboard or shows a toast; we'll wait for either.
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("invalid credentials show an error toast", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nobody@example.com");
    await page.locator("#password").fill("wrong-pass");
    await page.locator("#login-btn").click();

    // Sonner toast role=status
    await expect(page.getByRole("status").first()).toBeVisible({ timeout: 5_000 });
  });
});
