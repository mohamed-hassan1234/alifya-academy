import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-secret-test-secret-test-secret-123',
      EMAIL_PROVIDER: 'memory',
      WEB_ORIGINS: 'http://localhost:5173',
      APP_URL: 'http://localhost:5173',
      STORAGE_DIR: './.test-storage',
    },
  },
});
