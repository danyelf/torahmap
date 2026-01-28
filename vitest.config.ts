import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify('test'),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    // Limit worker pool to prevent zombie processes
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
        singleFork: false,
      },
    },
    // Force cleanup on exit
    teardownTimeout: 5000,
  },
});
