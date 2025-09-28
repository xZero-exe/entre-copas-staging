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

  const link = page.locator(
    '.product-miniature a.product-thumbnail, ' +
    '.product-miniature h2 a, ' +
    '.js-product-miniature a.product-thumbnail, ' +
    'article.product a'
  ).first();

  await expect(link, 'No encontré link a un PDP en el Home').toBeVisible();

  // ⚠️ Evita popups/target=_blank: navega con href + goto
  const href = await link.getAttribute('href');
  expect(href, 'El card de producto no tiene href').toBeTruthy();
  const url = href!.startsWith('http') ? href! : new URL(href!, page.url()).toString();

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/product|\/\d+-|\.html/i);
}

/** Agrega el producto actual al carrito (sin overlay). */
export async function addCurrentPdpToCart(page: Page) {
  // Si hay selectores de atributos, selecciona primera opción válida
  const firstSelect = page.locator('select').first();
  if (await firstSelect.count()) {
    const opts = await firstSelect.locator('option:not([disabled])').count();
    if (opts) {
      await firstSelect.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }

  const addToCart = page.locator(
    '#add-to-cart, button.add-to-cart, [data-button-action="add-to-cart"], ' +
    'button[name="submit"].add-to-cart, button[type="submit"].add-to-cart, button[name="submit"]'
  ).first();

  await addToCart.scrollIntoViewIfNeeded().catch(() => {});
  await expect(addToCart, 'Botón "Agregar al carrito" no visible').toBeVisible({ timeout: 5000 });
  await expect(addToCart, 'Botón "Agregar al carrito" deshabilitado').toBeEnabled({ timeout: 5000 }).catch(() => {});
  await addToCart.click({ trial: true }).catch(() => {});
  await addToCart.click();

  // Señal rápida de cambio de carrito (si existe)
  const cartCount = page.locator('.blockcart .cart-products-count, .js-cart-count, [data-cart-count]');
  if (await cartCount.count()) {
    await cartCount.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
  } else {
    await page.waitForTimeout(400);
  }
}

/** Verifica que exista al menos 1 línea en el carrito. */
export async function assertAtLeastOneCartLine(page: Page) {
  const anyLine = page.locator(
    '.cart-overview li, .cart-items .item, .order-items .item, tr.cart_item, .cart-item, .cart__item'
  );
  await expect(anyLine.first(), 'No hay líneas de carrito visibles').toBeVisible({ timeout: 5000 });
}

/** Flujo robusto: PDP → add → /cart, con un reintento si quedó vacío. */
export async function addOneProductAndOpenCart(page: Page) {
  await goToPDP(page);
  await addCurrentPdpToCart(page);
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });

  try {
    await assertAtLeastOneCartLine(page);
  } catch {
    await goToPDP(page);
    await addCurrentPdpToCart(page);
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await assertAtLeastOneCartLine(page);
  }
}
