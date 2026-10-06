import { defineConfig } from '@playwright/test';

// Starts the real API (against a fresh MySQL database) and the Vite dev server, then drives the UI.
// E2E_MYSQL points at a MySQL server; each run gets its own database.
const mysql = process.env.E2E_MYSQL || 'server=127.0.0.1;port=3306;user=root;password=test';
process.env.E2E_DB ||= `alkara_e2e_${Date.now()}`;

export const ADMIN = { username: 'admin', password: 'E2E-Admin-Pass-1' };

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    timezoneId: 'Asia/Riyadh',
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'dotnet run --project ../api/api.csproj --no-launch-profile --urls http://localhost:5144',
      url: 'http://localhost:5144/api/Trips',
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        ConnectionStrings__DefaultConnection: `${mysql};database=${process.env.E2E_DB};charset=utf8mb4`,
        JwtSettings__Secret: 'e2e-secret-0123456789abcdef0123456789abcdef',
        InitialAdmin__Username: ADMIN.username,
        InitialAdmin__Password: ADMIN.password,
        Sms__Provider: 'Mock',
        RateLimiting__LoginPerMinute: '100',
      },
    },
    {
      command: 'npm --prefix ../frontend run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
