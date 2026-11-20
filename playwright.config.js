import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 12_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    colorScheme: "light",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", testIgnore: /mobile\.spec\.js/, use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", testIgnore: /mobile\.spec\.js/, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testIgnore: /mobile\.spec\.js/, use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", testMatch: /mobile\.spec\.js/, use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", testMatch: /mobile\.spec\.js/, use: { ...devices["iPhone 13"] } }
  ],
  webServer: {
    command: "node scripts/serve.mjs",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 30_000
  }
});
