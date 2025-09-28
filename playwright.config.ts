import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,    // runners de CI son más lentos/variables
  use: {
    baseURL: process.env.BASE_URL ?? 'http://56.125.190.223:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  // Si apuntas a servidor externo con BASE_URL, NO levantes webServer
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run start', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
