import { defineConfig } from '@playwright/test';

const rawBase =
  process.env.E2E_BASE_URL ||
  process.env.BASE_URL ||
  'http://localhost:8080';

const baseURL = rawBase.replace(/\/+$/, '');

export default defineConfig({
  use: {
    baseURL,
    headless: true,
    actionTimeout: 30_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 1,
});
