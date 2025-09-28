import { test, expect } from '@playwright/test';
import { goToFirstProductPDP, readPdpPrice } from './helpers/actions';

test.setTimeout(120_000);

test('PDP carga desde Home y muestra precio', async ({ page }) => {
  await goToFirstProductPDP(page);
  const price = await readPdpPrice(page);
  expect(price).toBeGreaterThan(0);

  const breadcrumb = page.locator('.breadcrumb, nav[aria-label="breadcrumb"]').first();
  await expect(breadcrumb).toBeVisible();
});
