import { defineConfig } from 'vitest/config';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';

export default defineConfig({
  plugins: [storiesPlugin()],
  define: {
    __GIT_BRANCH__: JSON.stringify('test'),
    __SHOW_DRAFTS__: 'true',
  },
  test: {
    include: ['src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'forks',
    maxWorkers: 4,
    minWorkers: 1,
    // Force cleanup on exit
    teardownTimeout: 5000,
  },
});
