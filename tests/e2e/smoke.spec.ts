import { test, expect } from '@playwright/test';
test('home carga y hay productos', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Entre|Tienda/i);
  await expect(page.locator('.product-miniature').first()).toBeVisible();
});
