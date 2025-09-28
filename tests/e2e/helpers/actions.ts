// tests/e2e/helpers/actions.ts
import { Page, expect } from '@playwright/test';
import { parseCurrency } from './utils';

export async function goToFirstProductPDP(page: Page) {
  await page.goto('/');
  const firstCardLink = page.locator(
    '.product-miniature a.product-thumbnail, ' +
    '.product-miniature h2 a, ' +
    '.product-title a, ' +
    'article.product a[href*="id_product"], ' +
    '.js-product-miniature h2 a'
  ).first();

  await firstCardLink.waitFor({ state: 'visible' });
  await firstCardLink.click();
  await expect(page).toHaveURL(/(id_product|\/\w.*)/);
}

/** Si hay variantes (selects), elige la primera opción válida en cada uno. */
export async function ensureVariantSelected(page: Page) {
  const selects = page.locator('.product-variants select, select[name*="group"], select[name*="combination"]');
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const sel = selects.nth(i);
    await sel.waitFor({ state: 'visible' });
    const options = sel.locator('option:not([disabled])');
    const nOptions = await options.count();
    for (let j = 0; j < nOptions; j++) {
      const value = await options.nth(j).getAttribute('value');
      if (value && value.trim() !== '') {
        await sel.selectOption(value);
        break;
      }
    }
  }
}

/** Lee el precio en PDP desde múltiples selectores; si no hay, intenta meta[itemprop=price]. */
export async function readPdpPrice(page: Page): Promise<number> {
  // Intenta cerrar banner de cookies si tapa la info
  const cookieBtn = page.getByRole('button', { name: /aceptar|accept|entendido|ok/i }).first();
  if (await cookieBtn.isVisible().catch(() => false)) {
    await cookieBtn.click().catch(() => {});
  }

  // Algunos temas no muestran precio hasta elegir variante
  await ensureVariantSelected(page).catch(() => {});

  const candidates = [
    '.current-price [itemprop="price"]',
    '.current-price .price',
    '.product-prices .price',
    '.product-price .price',
    '.product-information .price',
    '#our_price_display',
    '[data-product-price]',
    '.price[itemprop="price"]',
    '.price-current',
    '.current-price-value'
  ].join(', ');

  const priceLoc = page.locator(candidates).first();
  if (await priceLoc.count()) {
    // espera un poquito por si recalcula tras variante
    await priceLoc.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    const text = (await priceLoc.textContent())?.trim() ?? '';
    const n = parseCurrency(text);
    if (Number.isFinite(n) && n > 0) return n;
  }

  // Fallback: meta itemprop=price
  const meta = page.locator('meta[itemprop="price"][content], span[itemprop="price"][content]').first();
  if (await meta.count()) {
    const content = (await meta.getAttribute('content')) ?? '';
    const n = Number(content.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return n;
  }

  throw new Error('No pude localizar un precio en la PDP con los selectores conocidos.');
}

export async function addCurrentPdpToCart(page: Page) {
  const addBtn = page.getByRole('button', { name: /añadir al carrito|add to cart/i });
  await addBtn.waitFor({ state: 'visible' });
  await addBtn.click();

  const goToCart = page
    .getByRole('link', { name: /proceder al pago|ir a la cesta|ver carrito|checkout/i })
    .or(page.getByRole('button', { name: /proceder al pago|checkout/i }));

  await goToCart.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
    await page.goto('/cart');
  });
  if (await goToCart.isVisible()) await goToCart.first().click();
}

export async function assertAtLeastOneCartLine(page: Page) {
  const cartLine = page.locator('.cart-item, .cart__item, .cart-overview li, .cart-grid-body .cart-item');
  await expect(cartLine.first()).toBeVisible({ timeout: 15000 });
  return cartLine;
}

export async function readCartTotal(page: Page) {
  const selectors = [
    '.cart-summary-line.cart-total .value',
    '.cart-summary-totals .value',
    '#cart-subtotal-products .value',
    '.cart-detailed-totals .cart-total .value',
    '.checkout-summary .order-total .value',
  ].join(', ');
  const loc = page.locator(selectors).first();
  await expect(loc).toBeVisible({ timeout: 15000 });
  const raw = (await loc.textContent())?.trim() ?? '';
  const n = parseCurrency(raw);
  if (!Number.isFinite(n)) throw new Error(`No pude parsear total desde: "${raw}"`);
  return n;
}
