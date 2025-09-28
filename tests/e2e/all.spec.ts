import { test, expect } from '@playwright/test';
import {
  addOneProductAndOpenCart,
  assertAtLeastOneCartLine,
} from './helpers/actions';

test('añadir producto al carrito muestra total con IVA', async ({ page }) => {
  // Usa el flujo robusto: abre PDP (tomando E2E_PRODUCT_URL si existe),
  // agrega al carrito y navega al carrito de forma segura (modal-safe).
  await addOneProductAndOpenCart(page);

  // Asegura que hay al menos una línea en el carrito
  await assertAtLeastOneCartLine(page);

  // Verifica que se muestre un total (con IVA) > 0
  const totalLoc = page
    .locator('#cart-subtotal-products .value, .cart-summary-line .value')
    .first();

  await expect(totalLoc).toBeVisible();

  const txt = (await totalLoc.textContent()) ?? '0';
  const num = parseFloat(txt.replace(/[^\d.,]/g, '').replace(',', '.'));
  expect(num).toBeGreaterThan(0);
});
