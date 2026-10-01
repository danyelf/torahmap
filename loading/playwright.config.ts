import { defineConfig } from '@playwright/test';
import { LAUNCH_ARGS, SCREENS } from '../layout/screens.ts';

const PORT = Number(process.env.LOADING_PORT ?? 5198);

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results/loading',
  fullyParallel: true,
  workers: 4,
  // Every file crosses a throttled connection once a case lets it through.
  timeout: 180_000,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    launchOptions: { args: LAUNCH_ARGS },
  },
  // One desktop screen and one phone: this checks what loads when, not layout.
  projects: SCREENS.filter((s) => s.name === 'desktop' || s.name === 'phone').map((s) => ({
    name: s.name,
    use: s.use,
  })),
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
