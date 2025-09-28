import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  timeout: 60_000,               // 60s por test (en vez de 120s)
  expect: { timeout: 5_000 },    // asserts más rápidos
  retries: 0,                    // evita doble ejecución que alarga el run
  fullyParallel: true,
  use: {
    baseURL: BASE_URL,
    headless: true,
    // En CI desactiva videos/trace para más velocidad
    trace: process.env.CI ? 'off' : 'on-first-retry',
    video: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: process.env.CI ? 'off' : 'only-on-failure',
  },
  // Si hay BASE_URL (staging/EC2), NO levantes server local
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run preview -- --host 0.0.0.0 --port 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
