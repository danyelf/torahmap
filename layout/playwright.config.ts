import { defineConfig } from '@playwright/test';
import { LAUNCH_ARGS, SCREENS } from './screens.ts';

const PORT = Number(process.env.LAYOUT_PORT ?? 5199);

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['./contactSheet.ts', { outputDir: '../layout-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Transitions finish at once, so nothing is measured mid-animation.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { args: LAUNCH_ARGS },
  },
  projects: [
    // Pure checks, no page. The web server still starts: it is shared by every project.
    { name: 'rules', testMatch: ['geometry.spec.ts', 'known.spec.ts'] },
    ...SCREENS.map((s) => ({ name: s.name, use: s.use, testMatch: 'app.spec.ts' })),
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
