import { test } from '@playwright/test';

async function count(page, sel: string) {
  const n = await page.locator(sel).count().catch(() => 0);
  console.log(`[DEBUG] count("${sel}") = ${n}`);
}

async function dumpFirstAttr(page, sel: string, attr: string) {
  const el = page.locator(sel).first();
  if (await el.count() === 0) { console.log(`[DEBUG] first("${sel}") = <none>`); return; }
  const v = await el.getAttribute(attr).catch(() => null);
  console.log(`[DEBUG] first("${sel}").getAttribute("${attr}") = ${v}`);
}

async function dumpText(page, sel: string) {
  const el = page.locator(sel).first();
  if (await el.count() === 0) { console.log(`[DEBUG] text("${sel}") = <none>`); return; }
  const v = await el.innerText().catch(() => '');
  console.log(`[DEBUG] text("${sel}") = ${v.slice(0,200).replace(/\s+/g,' ').trim()}…`);
}

test('DEBUG: detect selectors Home / Search / Cart', async ({ page }) => {
  // HOME
  await page.goto('/');
  console.log('=== HOME ===');
  for (const sel of [
    '.product-miniature', 'article.product', '.js-product-miniature',
    'a.product-title', 'h2 a', 'a[href*="id_product"]',
    '[data-button-action="add-to-cart"]', '.blockcart .cart-products-count, .js-cart-count, [data-cart-count]'
  ]) await count(page, sel);

  await dumpFirstAttr(page, 'a[href*="id_product"]', 'href');
  await dumpText(page, '.blockcart, .cart, .header [class*="cart"]');

  // SEARCH (vino)
  await page.goto('/search?controller=search&s=vino');
  console.log('=== SEARCH ===');
  for (const sel of [
    '.product-miniature', 'article.product', '.js-product-miniature',
    'a.product-title', 'h2 a', 'a[href*="id_product"]',
    '[data-button-action="add-to-cart"]'
  ]) await count(page, sel);

  // CART (página estándar)
  await page.goto('/index.php?controller=cart');
  console.log('=== CART ===');
  for (const sel of [
    '.cart-item', '.cart__item', 'tr.cart_item', '.cart-overview li', '.cart-items .item', '.order-items .item',
    '.cart-summary .cart-total .value', '#cart-subtotal-products .value', '.cart-summary-line .value', '[data-testid="cart-total"]', '#total_price, #cart-total, .order-total .value, .order-total .price'
  ]) await count(page, sel);

  await dumpText(page, '.cart-summary, .order-summary, #cart, #content');
});
