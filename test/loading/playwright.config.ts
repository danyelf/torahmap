import { defineConfig } from '@playwright/test';
import { DESKTOP_AND_PHONE, LAUNCH_ARGS, SCREENS, webServer } from '../browser/screens.ts';

const PORT = Number(process.env.LOADING_PORT ?? 5198);

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/loading',
  fullyParallel: true,
  workers: 8,
  // Every data file crosses a throttled connection once a case lets it through.
  timeout: 180_000,
  expect: { timeout: 60_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    launchOptions: { args: LAUNCH_ARGS },
  },
  // One desktop screen and one phone: this checks what loads when, not layout.
  projects: SCREENS.filter((s) => DESKTOP_AND_PHONE.includes(s.name)).map((s) => ({
    name: s.name,
    use: s.use,
  })),
  webServer: webServer(PORT),
});
