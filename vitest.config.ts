import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: 'playwright', // or 'webdriverio'
      enabled: false,
      name: 'chromium', // browser name is required
    },
    testTimeout: 1_200_000,
  },
  build: {
    sourcemap: true,
  },
})
