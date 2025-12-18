import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // browser: {
    //   provider: 'playwright', // or 'webdriverio'
    //   enabled: true,
    //   name: 'chromium', // browser name is required
    // },
    setupFiles: ['@vitest/web-worker'],
    include: ['src/**/*.spec.ts'],

    // environment: 'happy-dom',
    isolate: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    pool: 'threads',

    testTimeout: 10 * 60 * 1000,
  },
  // worker: {
  //   format: 'es',
  // },
  build: {
    sourcemap: true,
  },
})
