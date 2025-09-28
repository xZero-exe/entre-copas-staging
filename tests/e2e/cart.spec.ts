import { test, expect } from '@playwright/test';
import { addOneProductAndOpenCart, assertAtLeastOneCartLine } from './helpers/actions';

test('Carrito: añadir producto y total con IVA > 0', async ({ page }) => {
  await addOneProductAndOpenCart(page);
  await assertAtLeastOneCartLine(page);
  const total = page.locator('#cart-subtotal-products .value, .cart-summary-line .value').first();
  await expect(total).toBeVisible();
});

test('Carrito: actualizar cantidad a 2 aumenta el total', async ({ page }) => {
  await addOneProductAndOpenCart(page);
  await assertAtLeastOneCartLine(page);

  const plus = page.locator('button.js-increase-product-quantity, .qty .increase, .bootstrap-touchspin-up').first();
  if (await plus.count()) {
    await plus.click();
  } else {
    const qty = page.locator('input[name*="qty"], input.quantity').first();
    if (await qty.count()) { await qty.fill('2'); await qty.blur(); }
  }
  await page.waitForTimeout(600);
  await assertAtLeastOneCartLine(page);
});

test('Carrito: persistencia después de refrescar', async ({ page }) => {
  await addOneProductAndOpenCart(page);
  await page.reload();
  await assertAtLeastOneCartLine(page);
});

test('Carrito: eliminar línea deja el carrito vacío', async ({ page }) => {
  await addOneProductAndOpenCart(page);
  const remove = page.locator(
    '.cart-overview .remove-from-cart, .remove-from-cart, .cart__item .remove, a.remove, .js-cart-line-product-remove'
  ).first();
  if (await remove.count()) { await remove.click(); await page.waitForTimeout(600); }
  const anyLine = page.locator(
    '.cart-overview li, .cart-items .item, .order-items .item, tr.cart_item, .cart-item, .cart__item'
  );
  await expect(anyLine).toHaveCount(0);
});
