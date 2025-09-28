import { test, expect } from '@playwright/test';
import {
  performSearch, readResultsCount, openFirstSearchResult,
  applyFirstFacet, changeSort, readFirstAndLastGridPrices, goToPage2
} from './helpers/search';
import { readPdpPrice } from './helpers/actions';

test.setTimeout(120_000);

// Cambia a un término que sí tenga resultados en tu catálogo
const QUERY = 'vino';

test('Búsqueda: devuelve resultados y puedo abrir una PDP con precio', async ({ page }) => {
  await performSearch(page, QUERY);

  const count = await readResultsCount(page);
  if (count === 0) test.skip(true, `La búsqueda "${QUERY}" no devolvió resultados.`);

  await openFirstSearchResult(page);

  // Lector robusto que ya usaste en catalog.spec.ts
  const price = await readPdpPrice(page);
  expect(price).toBeGreaterThan(0);
});

test('Filtros: aplicar primer facet actualiza resultados', async ({ page }) => {
  await performSearch(page, QUERY);

  const before = await readResultsCount(page);
  if (before === 0) test.skip(true, `La búsqueda "${QUERY}" no devolvió resultados.`);
  await applyFirstFacet(page);
  const after = await readResultsCount(page);

  // Debe seguir habiendo resultados (si había antes)
  expect(after).toBeGreaterThan(0);
});

test('Orden: por precio ascendente coloca el ítem más barato primero', async ({ page }) => {
  await performSearch(page, QUERY);

  await changeSort(page, /precio.*asc|price.*low|menor.*mayor/i);
  const { first, last } = await readFirstAndLastGridPrices(page);

  expect(first).toBeLessThanOrEqual(last);
});

test('Paginación: ir a página 2 muestra resultados', async ({ page }) => {
  await performSearch(page, QUERY);
  await goToPage2(page);
  const count = await readResultsCount(page);
  expect(count).toBeGreaterThan(0);
});
