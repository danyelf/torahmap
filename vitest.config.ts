import { defineConfig } from 'vitest/config';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';

export default defineConfig({
  plugins: [storiesPlugin()],
  define: {
    __GIT_BRANCH__: JSON.stringify('test'),
    __LIVE__: 'false',
  },
  test: {
    include: [
      'apps/*/test/**/*.test.ts',
      'packages/*/test/**/*.test.ts',
      'test/**/*.test.ts',
      'video/**/*.test.ts',
      'scripts/print/**/*.test.ts',
    ],
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    pool: 'forks',
    maxWorkers: 4,
    minWorkers: 1,
    // Force cleanup on exit
    teardownTimeout: 5000,
  },
});
