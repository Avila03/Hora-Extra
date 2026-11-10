// Testes de ponta a ponta da interface do Hora Extra.
// Uso: HE_BASE_URL=http://localhost:3000 HE_OWNER_EMAIL=... HE_COLLAB_EMAIL=... HE_VIEWER_EMAIL=... HE_PASSWORD=... npx playwright test
// As contas precisam existir e estar confirmadas no Supabase; o espaço de teste é criado e excluído pela própria suíte.
import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {timeout: 15_000},
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.HE_BASE_URL || 'http://localhost:3000',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 900}}},
  ],
});
