import { test, expect, Page } from '@playwright/test';

async function ensureSearchInput(page: Page) {
  // Si el buscador está colapsado detrás de un botón (lupa), intenta abrirlo
  const togglers = page.locator(
    '[data-search-toggle], .js-open-search, button[aria-controls="search_widget"], #_desktop_search .search-widget > button, .header .search-button'
  );
  if (await togglers.first().isVisible().catch(() => false)) {
    await togglers.first().click().catch(() => {});
  }

  // Distintos patrones típicos de PrestaShop
  const candidates = [
    page.getByRole('searchbox'),
    page.locator('form[action*="search"] input[name="s"]'),
    page.locator('#search_widget input[name="s"]'),
    page.locator('input[type="search"]'),
    page.getByPlaceholder(/buscar|search/i),
    page.locator('#search_query_top'),
  ];

  for (const c of candidates) {
    if (await c.first().isVisible().catch(() => false)) return c.first();
  }
  await page
    .locator('form[action*="search"] input[name="s"], input[type="search"]')
    .first()
    .waitFor({ timeout: 10000 });
  return page
    .locator('form[action*="search"] input[name="s"], input[type="search"]')
    .first();
}

test('buscar un producto devuelve resultados', async ({ page }) => {
  await page.goto('/');

  // Cierra banner de cookies si aparece
  await page
    .getByRole('button', { name: /aceptar|accept|entendido|ok/i })
    .first()
    .click({ timeout: 2000 })
    .catch(() => {});

  const searchInput = await ensureSearchInput(page);
  await searchInput.fill('vino');
  await searchInput.press('Enter');

  const firstCard = page
    .locator('.product-miniature, article.product, .js-product-miniature')
    .first();
  await expect(firstCard).toBeVisible({ timeout: 15000 });
});

