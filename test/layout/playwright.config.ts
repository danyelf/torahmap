import { defineConfig } from '@playwright/test';
import { LAUNCH_ARGS, SCREENS, suitePort, webServer } from '../browser/screens.ts';

const PORT = await suitePort('LAYOUT_PORT');

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results',
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['./contactSheet.ts', { outputDir: '../../layout-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    // Transitions finish at once, so nothing is measured mid-animation.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { args: LAUNCH_ARGS },
  },
  projects: SCREENS.map((s) => ({
    name: s.name,
    use: s.use,
    testMatch: '*.spec.ts',
  })),
  webServer: webServer(PORT),
});
