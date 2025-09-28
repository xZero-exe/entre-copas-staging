import { expect, Page } from '@playwright/test';

/** Navega al primer PDP disponible desde el home. */
export async function goToFirstProductPDP(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Busca enlaces típicos de card (PrestaShop themes)
  const firstCardLink = page.locator(
    '.product-miniature a.product-thumbnail, ' +
    '.product-miniature h2 a, ' +
    '.js-product-miniature a.product-thumbnail, ' +
    'article.product a'
  ).first();

  await expect(firstCardLink, 'No encontré link a un PDP en el Home').toBeVisible();
  await firstCardLink.click({ trial: true }).catch(() => {}); // trial para comprobar visibilidad
  await firstCardLink.click();
  await expect(page).toHaveURL(/\/(product|[a-z-]*\d+|[a-z-]+\/\d+-)/i);
}

/** Agrega el producto actual al carrito. No depende de overlays. */
export async function addCurrentPdpToCart(page: Page) {
  // Distintos selectores de "Agregar al carrito"
  const addToCart = page.locator(
    '#add-to-cart, button.add-to-cart, [data-button-action="add-to-cart"], ' +
    'button[name="submit"], button[type="submit"].add-to-cart'
  ).first();

  // Si hay combinaciones/atributos, intenta seleccionar la primera opción válida
  const firstSelect = page.locator('select').first();
  if (await firstSelect.count()) {
    const hasOptions = await firstSelect.locator('option:not([disabled])').count();
    if (hasOptions) await firstSelect.selectOption({ index: 1 }).catch(() => {});
  }

  // Asegura que el botón esté habilitado y visible
  await expect(addToCart, 'Botón "Agregar al carrito" no visible en PDP').toBeVisible();
  await addToCart.waitFor({ state: 'visible' });
  // A veces el theme deshabilita hasta cargar stock
  await page.waitForTimeout(300);
  await addToCart.click();

  // Espera indicador rápido de que el cart cambió: badge/counter
  const cartCount = page.locator('.blockcart .cart-products-count, .js-cart-count, [data-cart-count]');
  await cartCount.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
}

/** Verifica que exista al menos 1 línea en el carrito. */
export async function assertAtLeastOneCartLine(page: Page) {
  const anyLine = page.locator(
    '.cart-overview li, .cart-items .item, .order-items .item, tr.cart_item, .cart-item, .cart__item'
  ).first();
  await expect(anyLine, 'No hay líneas de carrito visibles').toBeVisible();
}

/** Flujo completo robusto: PDP → add → CART (sin depender del botón/overlay). */
export async function addOneProductAndOpenCart(page: Page) {
  await goToFirstProductPDP(page);
  await addCurrentPdpToCart(page);

  // Ir SIEMPRE directo al carrito
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });

  // Si no hay línea, reintenta una vez (el click pudo no haber agregado)
  let ok = true;
  try {
    await assertAtLeastOneCartLine(page);
  } catch {
    ok = false;
  }
  if (!ok) {
    await goToFirstProductPDP(page);
    await addCurrentPdpToCart(page);
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await assertAtLeastOneCartLine(page);
  }
}
