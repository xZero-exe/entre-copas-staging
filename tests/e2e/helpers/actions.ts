import { expect, Page } from '@playwright/test';

/** Si hay E2E_PRODUCT_URL usa esa PDP directa; si no, toma la primera desde el Home. */
export async function goToPDP(page: Page) {
  const direct = process.env.E2E_PRODUCT_URL;
  if (direct) {
    await page.goto(direct, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/product|\/\d+-|\.html/i);
    return;
  }
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const firstCardLink = page.locator(
    '.product-miniature a.product-thumbnail, ' +
    '.product-miniature h2 a, ' +
    '.js-product-miniature a.product-thumbnail, ' +
    'article.product a'
  ).first();
  await expect(firstCardLink, 'No encontré link a un PDP en el Home').toBeVisible();
  await firstCardLink.click();
  await expect(page).toHaveURL(/\/product|\/\d+-|\.html/i);
}

/** Agrega el producto actual al carrito (sin overlay). */
export async function addCurrentPdpToCart(page: Page) {
  // Si hay selectores de atributos, selecciona la primera opción válida
  const firstSelect = page.locator('select').first();
  if (await firstSelect.count()) {
    const opts = await firstSelect.locator('option:not([disabled])').count();
    if (opts) await firstSelect.selectOption({ index: 1 }).catch(() => {});
  }

  const addToCart = page.locator(
    '#add-to-cart, button.add-to-cart, [data-button-action="add-to-cart"], ' +
    'button[name="submit"].add-to-cart, button[type="submit"].add-to-cart, button[name="submit"]'
  ).first();

  await expect(addToCart, 'Botón "Agregar al carrito" no visible').toBeVisible();
  // Algunos themes lo habilitan tras cargar stock
  await page.waitForTimeout(300);
  await addToCart.click().catch(() => {}); // ignora overlay bloqueante

  // Señal rápida: badge/counter visible si existe
  const cartCount = page.locator('.blockcart .cart-products-count, .js-cart-count, [data-cart-count]');
  await cartCount.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
}

/** Verifica que exista al menos 1 línea en el carrito. */
export async function assertAtLeastOneCartLine(page: Page) {
  const anyLine = page.locator(
    '.cart-overview li, .cart-items .item, .order-items .item, tr.cart_item, .cart-item, .cart__item'
  ).first();
  await expect(anyLine, 'No hay líneas de carrito visibles').toBeVisible();
}

/** Flujo completo y robusto: PDP → add → /cart, con un reintento si calza vacío. */
export async function addOneProductAndOpenCart(page: Page) {
  await goToPDP(page);
  await addCurrentPdpToCart(page);
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });

  let ok = true;
  try { await assertAtLeastOneCartLine(page); } catch { ok = false; }

  if (!ok) {
    // Un reintento por si el primer click no agregó
    await goToPDP(page);
    await addCurrentPdpToCart(page);
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await assertAtLeastOneCartLine(page);
  }
}
