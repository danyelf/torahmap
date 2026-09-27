import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify('test'),
    __SHOW_DRAFTS__: 'true',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'forks',
    maxWorkers: 4,
    minWorkers: 1,
    // Force cleanup on exit
    teardownTimeout: 5000,
  },
});
