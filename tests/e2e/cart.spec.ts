import { test, expect } from '@playwright/test';
import { goToFirstProductPDP, addCurrentPdpToCart, assertAtLeastOneCartLine, readCartTotal } from './helpers/actions';
import { readCartCount } from './helpers/utils';

test.setTimeout(120_000);

test('Carrito: añadir producto y total con IVA > 0', async ({ page }) => {
  await goToFirstProductPDP(page);
  await addCurrentPdpToCart(page);
  await assertAtLeastOneCartLine(page);
  const total = await readCartTotal(page);
  expect(total).toBeGreaterThan(0);
});

test('Carrito: actualizar cantidad a 2 aumenta el total', async ({ page }) => {
  await goToFirstProductPDP(page);
  await addCurrentPdpToCart(page);
  await assertAtLeastOneCartLine(page);

  const total1 = await readCartTotal(page);

  const qtyInput = page.locator(
    'input[name*="qty"], input.quantity, .js-cart-line-product-quantity, .cart-line-product-quantity input'
  ).first();
  await qtyInput.waitFor({ state: 'visible' });
  await qtyInput.fill('2');
  await qtyInput.press('Enter').catch(() => {});
  await page.waitForLoadState('networkidle');

  const total2 = await readCartTotal(page);
  expect(total2).toBeGreaterThan(total1);
});

test('Carrito: persistencia después de refrescar', async ({ page }) => {
  await goToFirstProductPDP(page);
  await addCurrentPdpToCart(page);
  await assertAtLeastOneCartLine(page);
  const beforeRefreshCount = await readCartCount(page);

  await page.reload();
  await assertAtLeastOneCartLine(page);
  const afterRefreshCount = await readCartCount(page);

  expect(afterRefreshCount).toBeGreaterThanOrEqual(beforeRefreshCount);
});

test('Carrito: eliminar línea deja el carrito vacío', async ({ page }) => {
  await goToFirstProductPDP(page);
  await addCurrentPdpToCart(page);
  const cartLine = await assertAtLeastOneCartLine(page);

  const removeBtn = cartLine.first().locator(
    '.remove-from-cart, .cart-line-product-actions .remove-from-cart, .js-cart-line-product-remove, button[aria-label*="eliminar"], a[aria-label*="remove"]'
  );
  await removeBtn.first().click({ trial: false }).catch(async () => {
    await cartLine.first().locator('i[class*="trash"], svg[aria-label*="remove"]').first().click();
  });

  await expect(cartLine.first()).toHaveCount(0, { timeout: 15000 }).catch(async () => {
    await expect(cartLine).toBeHidden();
  });

  const count = await readCartCount(page);
  expect(count).toBe(0);
});
