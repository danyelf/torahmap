import { defineConfig } from '@playwright/test';
import { DESKTOP_AND_PHONE, LAUNCH_ARGS, SCREENS } from '../browser/screens.ts';
import { ORIGIN_ENV } from '../browser/globalSetup.ts';

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/loading',
  fullyParallel: true,
  workers: 8,
  // Every data file crosses a throttled connection once a case lets it through.
  timeout: 180_000,
  expect: { timeout: 60_000 },
  globalSetup: '../browser/globalSetup.ts',
  reporter: [['list'], ['../browser/stopOnRefusal.ts']],
  use: {
    baseURL: process.env[ORIGIN_ENV],
    launchOptions: { args: LAUNCH_ARGS },
  },
  // One desktop screen and one phone: this checks what loads when, not layout.
  projects: SCREENS.filter((s) => DESKTOP_AND_PHONE.includes(s.name)).map((s) => ({
    name: s.name,
    use: s.use,
  })),
});
