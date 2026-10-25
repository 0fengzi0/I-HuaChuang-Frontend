import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 45_000,
  expect: {
    timeout: 6_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5180/I-HuaChuang-Frontend/app/',
    channel: 'msedge',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: {
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'mobile',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: {
        viewport: { width: 1024, height: 768 },
      },
    },
  ],
  webServer: {
    command: 'npm run dev -- --mode pages --port 5180',
    url: 'http://127.0.0.1:5180/I-HuaChuang-Frontend/app/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
