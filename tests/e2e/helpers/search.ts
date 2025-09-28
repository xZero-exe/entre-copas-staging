// tests/e2e/helpers/search.ts
import { Page, expect, test } from '@playwright/test';
import { parseCurrency } from './utils';

/** Cierra banners de cookies si bloquean UI (best-effort). */
export async function dismissCookies(page: Page) {
  const candidates = [
    page.getByRole('button', { name: /aceptar|accept|entendido|ok|de acuerdo/i }),
    page.locator('[id*="cookie"] [role="button"]'),
    page.locator('button[aria-label*="accept"], button[aria-label*="Aceptar"]'),
  ];
  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) {
      await c.click().catch(() => {});
      break;
    }
  }
}

/** Ejecuta una búsqueda desde el header. */
export async function performSearch(page: Page, q: string) {
  await page.goto('/');
  await dismissCookies(page);

  const input = page.locator(
    '#search_widget input[name="s"], ' +
    'form[action*="search"] input[type="text"], ' +
    'input[placeholder*="Buscar"], input[placeholder*="Search"]'
  ).first();

  await input.waitFor({ state: 'visible' });
  await input.fill(q);

  await Promise.race([
    input.press('Enter').catch(() => {}),
    page.getByRole('button', { name: /buscar|search/i }).click().catch(() => {})
  ]);

  // Esperar contenedor de resultados o mensaje vacío
  const grid = page.locator('.products, .product_list, .js-product-list').first();
  const empty = page.locator('.no-results, .alert-warning, .alert').filter({ hasText: /no.*result|sin resultados/i });
  await Promise.race([
    grid.waitFor({ state: 'visible' }).catch(() => {}),
    empty.waitFor({ state: 'visible' }).catch(() => {})
  ]);
}

/** Cuenta productos visibles en la grilla de resultados. */
export async function readResultsCount(page: Page): Promise<number> {
  const items = page.locator('.product-miniature, article.product, .js-product-miniature');
  const n = await items.count();
  if (n > 0) return n;

  // Fallback: "X productos"
  const totalText = await page.locator('.total-products, .products-selection .total-products').first().textContent().catch(() => null);
  const digits = totalText?.replace(/[^\d]/g, '') ?? '';
  return digits ? Number(digits) : 0;
}

/** ¿Hay filtros (facetas) disponibles? */
export async function hasFacets(page: Page): Promise<boolean> {
  const container = page.locator('.faceted-search, #search_filters, .js-search-filters');
  return (await container.count()) > 0 && (await container.isVisible().catch(() => false));
}

/** ¿Hay control de orden disponible? */
export async function hasSortControl(page: Page): Promise<boolean> {
  const sortSelect = page.locator('select[name*="order"], select[name*="sort"], .js-sort-by');
  if (await sortSelect.count()) return true;
  // Menú alternativo
  const menu = page.getByRole('button', { name: /ordenar|sort/i });
  return await menu.isVisible().catch(() => false);
}

/** ¿Hay paginación con página 2? */
export async function hasPage2(page: Page): Promise<boolean> {
  const link = page.locator('.pagination a', { hasText: /^2$/ });
  return (await link.count()) > 0;
}

/** Abre la PDP del primer resultado. */
export async function openFirstSearchResult(page: Page) {
  const firstLink = page.locator(
    '.product-miniature a.product-thumbnail, .product-miniature h2 a, .product-title a, article.product a'
  ).first();
  await firstLink.waitFor({ state: 'visible' });
  await firstLink.click();
}

/** Extrae precios de tarjetas en la grilla (primer y último). */
export async function readFirstAndLastGridPrices(page: Page): Promise<{ first: number, last: number }> {
  const priceSel = [
    '.product-miniature .price',
    '.product-price .price',
    '[itemprop="price"]',
    '.price'
  ].join(', ');

  const cards = page.locator('.product-miniature, article.product, .js-product-miniature');
  const count = await cards.count();
  if (count < 2) throw new Error( 'No hay suficientes resultados para verificar ordenación (se requieren ≥ 2).');

  const firstText = (await cards.nth(0).locator(priceSel).first().textContent().catch(() => ''))?.trim() ?? '';
  const lastText  = (await cards.nth(count - 1).locator(priceSel).first().textContent().catch(() => ''))?.trim() ?? '';

  const first = parseCurrency(firstText);
  const last  = parseCurrency(lastText);

  if (!Number.isFinite(first) || !Number.isFinite(last)) {
    throw new Error( `No pude leer precios de la grilla: "${firstText}" / "${lastText}"`);
  }
  return { first, last };
}

/** Aplica el primer facet disponible (si existe), o hace skip si no hay. */
export async function applyFirstFacet(page: Page) {
  if (!(await hasFacets(page))) throw new Error( 'No hay filtros/facetas disponibles en la búsqueda actual.');
  const facetCheckbox = page.locator(
    '.faceted-search input[type="checkbox"]:not(:disabled), ' +
    '#search_filters input[type="checkbox"]:not(:disabled), ' +
    '.js-search-filters input[type="checkbox"]:not(:disabled)'
  ).first();

  await facetCheckbox.waitFor({ state: 'visible' });
  await facetCheckbox.check().catch(async () => { await facetCheckbox.click(); });
  await page.waitForLoadState('networkidle');
}

/** Cambia orden; hace skip si no hay control de orden. */
export async function changeSort(page: Page, labelRegex: RegExp) {
  if (!(await hasSortControl(page))) throw new Error( 'No hay control de orden disponible.');

  const sortSelect = page.locator('select[name*="order"], select[name*="sort"], .js-sort-by');
  if (await sortSelect.count()) {
    await sortSelect.waitFor({ state: 'visible' });
    const options = sortSelect.locator('option');
    const n = await options.count();
    for (let i = 0; i < n; i++) {
      const text = (await options.nth(i).textContent() ?? '').trim();
      if (labelRegex.test(text)) {
        const value = await options.nth(i).getAttribute('value');
        if (value) {
          await sortSelect.selectOption(value);
          await page.waitForLoadState('networkidle');
          return;
        }
      }
    }
  }

  // Fallback: menú de orden
  const menu = page.getByRole('button', { name: /ordenar|sort/i }).first();
  if (await menu.isVisible().catch(() => false)) {
    await menu.click();
    const item = page.getByRole('menuitem', { name: labelRegex }).first();
    if (await item.isVisible().catch(() => false)) {
      await item.click();
      await page.waitForLoadState('networkidle');
      return;
    }
  }
  throw new Error( `No encontré opción de orden que coincida con ${labelRegex}`);
}

/** Ir a página 2 si existe; si no, skip. */
export async function goToPage2(page: Page) {
  await expect(page.locator('.pagination')).toBeVisible();
  const link = page.locator('.pagination a', { hasText: /^2$/ }).first();
  await link.waitFor({ state: 'visible' });
  await link.click();
  await page.waitForLoadState('networkidle');
}
