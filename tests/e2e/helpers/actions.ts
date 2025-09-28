// tests/e2e/helpers/actions.ts (modal-safe + assertAtLeastOneCartLine)
import { expect, type Page, type Locator } from '@playwright/test';

/* =========================
 * Selectores utilitarios
 * ========================= */
function addToCartBtn(page: Page): Locator {
  return page
    .getByRole('button', { name: /añadir al carrito|add to cart|comprar|buy/i })
    .or(page.locator('button[name="add"], button.add-to-cart, button[data-button-action="add-to-cart"], #add-to-cart'));
}

function goToCartCta(page: Page): Locator {
  return page
    .getByRole('link', { name: /ver carrito|ir a la cesta|carrito|checkout|proceder al pago|go to cart/i })
    .or(page.getByRole('button', { name: /checkout|proceder al pago/i }))
    .or(page.locator('a[href*="controller=cart"], a[href*="/cart"], button[href*="/cart"]'));
}

function cartCount(page: Page): Locator {
  return page.locator('.blockcart .cart-products-count, .js-cart-count, [data-cart-count]');
}

function cartModal(page: Page): Locator {
  // Prestashop clásico: #blockcart-modal
  return page.locator('#blockcart-modal, .modal[id*="blockcart"]');
}

function cartModalGoToCart(page: Page): Locator {
  const modal = cartModal(page);
  return modal
    .getByRole('link', { name: /ver carrito|carrito|checkout|proceder al pago|go to cart/i })
    .or(modal.locator('a[href*="controller=cart"], a[href*="/cart"]'))
    .first();
}

function cartModalClose(page: Page): Locator {
  const modal = cartModal(page);
  return modal.locator('button.close, [data-dismiss="modal"], .close, .modal-header button').first();
}

async function closeCookiesIfAny(page: Page) {
  const btn = page
    .getByRole('button', { name: /aceptar|entendido|accept|ok|got it|entendi/i })
    .or(page.locator('[id*="cookie"] button, .cookie-banner button'))
    .first();
  try {
    if (await btn.isVisible()) await btn.click({ trial: false });
  } catch {}
}

async function waitEnabledAndClick(el: Locator, timeout = 30_000) {
  await expect(el).toBeVisible({ timeout });
  await expect(el).toBeEnabled({ timeout });
  await el.click();
}

/* =========================
 * Navegaciones base
 * ========================= */

/** Va al Home (baseURL) y abre el primer producto visible (PDP). */
export async function goToPDP(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await closeCookiesIfAny(page);

  const firstCardLink = page.locator(
    '.product-miniature a.product-thumbnail, ' +
    '.js-product-miniature a, ' +
    'article.product a.thumbnail, ' +
    '.products a[href*="id_product"], ' +
    '.products .product a[href*="/"]'
  ).first();

  await expect(firstCardLink).toBeVisible({ timeout: 20_000 });
  await firstCardLink.click();
  await page.waitForLoadState('domcontentloaded');
}

/** Alias con el nombre exacto que usan tus specs. */
export const goToFirstProductPDP = goToPDP;

/** Si existe E2E_PRODUCT_URL válida, úsala; si no, cae a goToPDP(). */
export async function openPreferredPDP(page: Page) {
  const url = process.env.E2E_PRODUCT_URL;

  if (!url || /<slug|^$/.test(url)) {
    await goToPDP(page);
    return;
  }

  const resp = await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => null);
  await closeCookiesIfAny(page);

  if (!resp || resp.status() >= 400) {
    await goToPDP(page);
    return;
  }

  const btn = addToCartBtn(page).first();
  try {
    await expect(btn).toBeVisible({ timeout: 3000 });
  } catch {
    await goToPDP(page);
  }
}

/* =========================
 * PDP helpers
 * ========================= */

export async function selectAnyRequiredAttributesIfAny(page: Page) {
  const selects = page.locator('select[name*="group"], .product-variants select');
  const count = await selects.count().catch(() => 0);
  for (let i = 0; i < count; i++) {
    const s = selects.nth(i);
    const opts = s.locator('option');
    if (await opts.count() > 1) {
      await s.selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(150).catch(() => {});
    }
  }
}

export async function readPdpPrice(page: Page): Promise<number> {
  const priceLoc = page.locator(
    '.current-price .price, ' +
    '.product-prices .price, ' +
    '.product-price, ' +
    '.price'
  ).first();
  await expect(priceLoc).toBeVisible({ timeout: 10_000 });
  const txt = (await priceLoc.textContent()) ?? '0';
  const num = parseFloat(txt.replace(/[^\d.,]/g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

/* =========================
 * Flujos de carrito
 * ========================= */

async function goToCartFromModalOrHeader(page: Page) {
  const modal = cartModal(page).first();

  if (await modal.isVisible().catch(() => false)) {
    const linkInModal = cartModalGoToCart(page);
    if (await linkInModal.isVisible().catch(() => false)) {
      await linkInModal.click();
      return;
    }
    const close = cartModalClose(page);
    await close.click().catch(() => {});
    await expect(modal).toBeHidden({ timeout: 10_000 });
  }

  const cta = goToCartCta(page).first();
  try {
    await waitEnabledAndClick(cta, 30_000);
  } catch {
    await modal.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
    await waitEnabledAndClick(cta, 10_000);
  }
}

/** Añade al carrito desde PDP. Si no hay botón en 3s, abre otra PDP. */
export async function addCurrentPdpToCart(page: Page) {
  const btnProbe = addToCartBtn(page).first();
  try {
    await expect(btnProbe).toBeVisible({ timeout: 3000 });
  } catch {
    await goToPDP(page);
  }

  await selectAnyRequiredAttributesIfAny(page);

  const addBtn = addToCartBtn(page).first();
  await waitEnabledAndClick(addBtn, 30_000);

  const cnt = cartCount(page);
  await expect(cnt).toHaveText(/([1-9]\d*)/, { timeout: 30_000 });

  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/** Abre PDP (preferiblemente por E2E_PRODUCT_URL), añade y entra al carrito. */
export async function addOneProductAndOpenCart(page: Page) {
  await openPreferredPDP(page);
  await addCurrentPdpToCart(page);
  await goToCartFromModalOrHeader(page);

  await assertAtLeastOneCartLine(page);
}

/** Asegura que haya al menos una línea en el carrito (lo usan tus specs). */
export async function assertAtLeastOneCartLine(page: Page) {
  const line = page.locator('.cart-item, .cart__item, tr.cart_item, .cart-overview li, .cart-items .item').first();
  await expect(line).toBeVisible({ timeout: 20_000 });
}
