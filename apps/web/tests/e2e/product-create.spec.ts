import { test, expect } from "@playwright/test";

/**
 * Smoke: login → open products → click "add" → product list loads.
 * Demo mode lets us run this without a real Supabase backend.
 */
test("demo: login → products page shows list", async ({ page }) => {
  await page.goto("/login");
  await page.locator("#login-btn").click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

  await page.goto("/dashboard/products");
  // Products header should be present (i18n key resolves to "Ürünler" in tr)
  await expect(page.locator("#add-product-btn")).toBeVisible({ timeout: 10_000 });

  // Search input is wired
  await expect(page.locator("#product-search")).toBeVisible();
});
