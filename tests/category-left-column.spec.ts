import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const HOME = '/';

test.describe('VINO (327): sidebar, facetas y slider', () => {
  test('Navegar por menú, detectar productos y filtros, clicar faceta y mover slider', async ({ page }) => {
    await page.goto(HOME, { waitUntil: 'domcontentloaded' });

    // 1) Encuentra el link real a VINO por href o texto
    //    - intenta href con '327-vino'
    //    - fallback: texto "VINO"
    const vinoByHref = page.locator('a[href*="327-vino"]').first();
    let vinoLink = vinoByHref;
    if (!(await vinoByHref.count())) {
      const vinoByText = page.locator('header a, nav a, .menu a', { hasText: /vino/i }).first();
      vinoLink = vinoByText;
    }
    await expect(vinoLink, 'No encontré el enlace VINO en el header/nav').toBeVisible();

    const [respCat] = await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      vinoLink.click()
    ]);

    // 2) Registra la URL final para confirmar ruta
    const current = page.url();
    console.log('[DEBUG] URL categoría:', current);

    // 3) Detecta contenedores de lista de productos (varios posibles según theme)
    const productContainers = page.locator([
      '#js-product-list',
      '.products',
      '.product_list',
      '#product-list',
      '.listing',
      '[data-product-list]',
      '.category-products'
    ].join(', '));

    // 4) Detecta un item de producto (varios posibles)
    const productItems = page.locator([
      '.product-miniature',
      '.products .product',
      '.product_list .product-container',
      '.listing .product',
      '[data-product-id]',
      'article.product'
    ].join(', '));

    // 5) Detecta filtros en desktop o móvil (varios posibles)
    const filtersDesktop = page.locator('.faceted-search, #search_filters, .js-search-filters, [data-search-url]');
    const leftDesktop    = page.locator('#left-column, .left-column, [id*="left"]');
    const mobileToggler  = page.locator('#search_filter_toggler, button[data-target="#search_filters"], button[aria-controls="search_filters"], button.js-open-search-filters');
    const mobilePanel    = page.locator('#search_filters, .js-search-filters, .filters-panel, [data-filters-panel]');

    // 6) Espera “algo de categoría”: contenedor de productos o header
    const anyHeader = page.locator('h1, .h1, #js-product-list-header, .page-header, .breadcrumb, .category-title');
    try {
      await expect(productContainers.or(anyHeader).first()).toBeVisible({ timeout: 8000 });
    } catch (e) {
      // Dump html para ajustar selectores
      const html = await page.content();
      fs.writeFileSync('test-results/last-category.html', html);
      console.log('[DEBUG] Dump HTML en test-results/last-category.html');
      throw e;
    }

    // 7) Confirma que hay productos visibles
    await expect(productItems.first(), 'No se detectan items de producto con los selectores genéricos').toBeVisible({ timeout: 8000 });

    // 8) Abre filtros si están colapsados (móvil)
    if (!(await filtersDesktop.first().isVisible()) && (await mobileToggler.isVisible())) {
      await mobileToggler.first().click();
      await expect(mobilePanel.first()).toBeVisible({ timeout: 5000 });
    }

    // 9) Click en primera faceta (checkbox/radio)
    const firstFacet = page.locator(
      '.faceted-search input[type="checkbox"], .faceted-search input[type="radio"], ' +
      '#search_filters input[type="checkbox"], #search_filters input[type="radio"], ' +
      '.js-search-filters input[type="checkbox"], .js-search-filters input[type="radio"]'
    ).first();

    if (await firstFacet.count()) {
      const before = await productItems.count();
      await firstFacet.check({ force: true });
      await page.waitForLoadState('networkidle');
      await expect(productItems.first()).toBeVisible();
      const after = await productItems.count();
      expect(after).toBeGreaterThan(0);
    } else {
      console.log('[WARN] No encontré facetas checkbox/radio para cliquear');
    }

    // 10) Mover slider de precio (noUiSlider / jQuery UI) si existe
    const priceHandle = page.locator(
      '#search_filters .noUi-handle, .js-search-filters .noUi-handle, ' +
      '#search_filters .ui-slider-handle, .js-search-filters .ui-slider-handle'
    ).last();

    if (await priceHandle.count()) {
      const box = await priceHandle.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 10 }); // arrastra ~60px izq
        await page.mouse.up();
        await page.waitForLoadState('networkidle');
        await expect(productItems.first()).toBeVisible();
      }
    } else {
      console.log('[WARN] No encontré slider de precio');
    }
  });
});
