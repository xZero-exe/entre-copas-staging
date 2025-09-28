// tests/e2e/helpers/utils.ts
import { Page, expect } from '@playwright/test';

export function parseCurrency(text: string): number {
  const clean = text
    .replace(/\u00A0/g, ' ')
    .replace(/[^\d.,-]/g, '')
    .trim();

  const lastComma = clean.lastIndexOf(',');
  const lastDot = clean.lastIndexOf('.');
  let normalized = clean;

  if (lastComma > lastDot) {
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = clean.replace(/,/g, '');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

export async function readMoney(page: Page, locatorSelector: string): Promise<number> {
  const loc = page.locator(locatorSelector).first();
  await expect(loc).toBeVisible({ timeout: 15000 });
  const text = (await loc.innerText()).trim();
  const n = parseCurrency(text);
  if (Number.isNaN(n)) throw new Error(`No pude parsear monto desde: "${text}"`);
  return n;
}

export async function readCartCount(page: Page): Promise<number> {
  const countLoc = page.locator('.blockcart .cart-products-count, .js-cart-count, [data-cart-count]').first();
  if (await countLoc.count() === 0) return 0;
  const raw = (await countLoc.textContent())?.trim() ?? '0';
  const digits = raw.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}
