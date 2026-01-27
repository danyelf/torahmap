import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __GIT_BRANCH__: JSON.stringify('test'),
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
  },
});
