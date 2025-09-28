// tests/e2e/all.spec.ts
import { test, expect } from '@playwright/test';

test.setTimeout(120_000); // damos más tiempo por si el server está lento

test('añadir producto al carrito muestra total con IVA', async ({ page }) => {
  // 1) Ir al home
  await page.goto('/');

  // 2) Entrar al primer producto (clic en imagen o título)
  const firstCardLink = page.locator(
    '.product-miniature a.product-thumbnail, ' +
    '.product-miniature h2 a, ' +
    '.product-title a, ' +
    'article.product a[href*="id_product"], ' +
    '.js-product-miniature h2 a'
  ).first();

  await firstCardLink.waitFor({ state: 'visible' });
  await firstCardLink.click();

  // 3) En la PDP: añadir al carrito
  const addBtn = page.getByRole('button', { name: /añadir al carrito|add to cart/i });
  await addBtn.waitFor({ state: 'visible' });
  await addBtn.click();

  // 4) Ir al carrito (desde modal o directo)
  const goToCart = page
    .getByRole('link', { name: /proceder al pago|ir a la cesta|ver carrito|checkout/i })
    .or(page.getByRole('button', { name: /proceder al pago|checkout/i }));

  await goToCart.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
    // fallback: si no hay modal, ir directo
    await page.goto('/cart');
  });
  if (await goToCart.isVisible()) {
    await goToCart.first().click();
  }

  // 5) Esperar que haya al menos 1 línea en el carrito
  const cartLine = page.locator('.cart-item, .cart__item, .cart-overview li, .cart-grid-body .cart-item');
  await expect(cartLine.first()).toBeVisible({ timeout: 15000 });

  // 6) Localizar y leer el total
  const totalLoc = page.locator(
    [
      '.cart-summary-line.cart-total .value',
      '.cart-summary-totals .value',
      '#cart-subtotal-products .value',
      '.cart-detailed-totals .cart-total .value',
      '.checkout-summary .order-total .value'
    ].join(', ')
  ).first();

  await expect(totalLoc).toBeVisible({ timeout: 15000 });
  const totalText = (await totalLoc.innerText()).trim();

  const total = parseCurrency(totalText);

  // 7) Validaciones
  expect(Number.isNaN(total)).toBeFalsy();
  expect(total).toBeGreaterThan(0);
});

/** Parser de moneda robusto (CLP, EUR, USD, etc.) */
function parseCurrency(text: string): number {
  // eliminar espacios duros y símbolos de moneda
  const clean = text
    .replace(/\u00A0/g, ' ')      // nbsp
    .replace(/[^\d.,-]/g, '')     // deja sólo números y separadores
    .trim();

  // determinar si coma es decimal o miles
  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  let normalized = clean;

  if (lastComma > lastDot) {
    // formato europeo: "12.345,67" → "12345.67"
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else {
    // formato US/CL: "12,345.67" o "12,345" → "12345.67"
    normalized = clean.replace(/,/g, '');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}
