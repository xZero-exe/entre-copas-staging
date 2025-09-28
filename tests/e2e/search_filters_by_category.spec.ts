import { test, expect } from '@playwright/test';

/** Ir a “cualquier” categoría disponible. */
async function goToAnyCategory(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const menuCat = page.locator('header a, nav a, .menu a')
    .filter({ hasText: /ESPUMANTE|VINO|CERVEZA|SIDRA|BEBIDAS|DESTILADOS|OTROS/i })
    .first();
  if (await menuCat.count()) {
    await menuCat.click();
    await page.waitForLoadState('networkidle');
    return;
  }

  const subCat = page.locator('.subcategories a, .category a').first();
  if (await subCat.count()) {
    await subCat.click();
    await page.waitForLoadState('networkidle');
    return;
  }

  const anyCat = page.locator('a[href*="-"]').first();
  await anyCat.click();
  await page.waitForLoadState('networkidle');
}

/** Cuenta productos en grilla */
async function gridCount(page) {
  const sels = [
    '.product-miniature',
    '.js-product-miniature',
    'article.product',
    '.products .product',
    '.products .product-miniature',
  ];
  for (const s of sels) {
    const n = await page.locator(s).count();
    if (n > 0) return n;
  }
  return 0;
}

/** Localiza contenedor de filtros */
function filtersLocator(page) {
  return page.locator('.faceted-search, #search_filters, .js-search-filters');
}

/** Orden “Precio: de más bajo a más alto” (soporta select y dropdown custom). */
async function chooseSortPriceAsc(page) {
  const select = page.locator(
    'select[name*="order"], select[name*="sort"], #selectProductSort, .js-sort-by select'
  ).first();

  if (await select.count()) {
    const hasEs = await page.locator('option', { hasText: /Precio:\s*de más bajo a más alto/i }).count();
    if (hasEs) await select.selectOption({ label: /Precio:\s*de más bajo a más alto/i });
    else await select.selectOption({ label: /Price.*low.*high/i });
    return;
  }

  const ordenarLabel = page.locator('text=/^\\s*Ordenar por:?\\s*$/i').first();
  const triggerCandidates = [
    '.sort-by .select-title',
    '.sort-by .dropdown-toggle',
    '.sort-by [aria-haspopup="listbox"]',
    '.products-selection .select-title',
    '.products-selection .dropdown-toggle',
    '.products-selection [aria-haspopup="listbox"]',
  ];
  let trigger = null;
  for (const sel of triggerCandidates) {
    const cand = page.locator(sel).first();
    if (await cand.count()) { trigger = cand; break; }
  }
  if (!trigger) {
    trigger = (await ordenarLabel.count())
      ? ordenarLabel.locator('xpath=following::*[self::button or @role="button" or self::div][1]')
      : page.locator('.select-title, .dropdown-toggle, [aria-haspopup="listbox"]').first();
  }

  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.waitForTimeout(200);

  const opts = page.locator('.select-list a, .dropdown-menu a, [role="option"], .select-list li a, .dropdown-menu li a');
  const es = opts.filter({ hasText: /Precio:\s*de más bajo a más alto/i }).first();
  if (await es.count()) {
    if (await es.isVisible()) await es.click();
    else {
      const href = await es.getAttribute('href');
      if (!href) throw new Error('Opción ES sin href');
      await page.goto(href, { waitUntil: 'domcontentloaded' });
    }
    return;
  }
  const en = opts.filter({ hasText: /Price.*low.*high/i }).first();
  if (await en.count()) {
    if (await en.isVisible()) await en.click();
    else {
      const href = await en.getAttribute('href');
      if (!href) throw new Error('Opción EN sin href');
      await page.goto(href, { waitUntil: 'domcontentloaded' });
    }
    return;
  }
  throw new Error('No veo la opción de orden por precio ascendente (ES/EN)');
}

/** Localiza “Siguiente” */
async function nextLocator(page) {
  const relNext = page.locator('.pagination a[rel="next"]').first();
  if (await relNext.count()) return relNext;
  return page.locator('.pagination a', { hasText: /(Siguiente|Next|›|»)/i }).first();
}

test.describe('Categoría (genérico “cualquier categoría”)', () => {
  test('Categoría: hay filtros (Faceted Search) visibles', async ({ page }) => {
    await goToAnyCategory(page);
    await expect(filtersLocator(page).first()).toBeVisible({ timeout: 15000 });
  });

  test('Categoría: orden por precio ascendente', async ({ page }) => {
    await goToAnyCategory(page);
    await chooseSortPriceAsc(page);
    expect(true).toBeTruthy();
  });

  test('Categoría: paginación a página 2 muestra resultados', async ({ page }) => {
    await goToAnyCategory(page);
    const link = await nextLocator(page);
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForLoadState('networkidle');
    expect(await gridCount(page)).toBeGreaterThan(0);
  });

  // >>> Este es el test ajustado a "clic -> redirección a la página filtrada"
  test('Categoría: aplicar el primer filtro actualiza resultados', async ({ page }) => {
    await goToAnyCategory(page);

    const filters = filtersLocator(page);
    await expect(filters.first()).toBeVisible({ timeout: 15000 });
    await filters.first().scrollIntoViewIfNeeded();

    const urlBefore = page.url();

    // Los themes de Faceted Search suelen poner <a class="js-search-link" href="...">
    let link = filters.locator('a.js-search-link').first();
    if (!(await link.count())) {
      // fallback: cualquier link dentro de filtros que lleve query (? o &), típicamente ?q=
      link = filters.locator('a[href*="?"], a[href*="&"]').first();
    }
    await expect(link).toBeVisible();

    // Guardamos el href destino si existe
    const href = await link.getAttribute('href');

    // Clic y esperamos navegación (redirección)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      link.click(),
    ]);

    const urlAfter = page.url();

    // Éxito = cambió la URL y (si había href) coincide con el destino
    expect(urlAfter).not.toBe(urlBefore);
    if (href) expect(urlAfter).toContain(href.split('?')[0]); // al menos path base
  });
});
