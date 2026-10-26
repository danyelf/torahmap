import { defineConfig } from '@playwright/test';
import { LAUNCH_ARGS, SCREENS } from '../browser/screens.ts';
import { ORIGIN_ENV } from '../browser/globalSetup.ts';

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results',
  fullyParallel: true,
  workers: 4,
  globalSetup: '../browser/globalSetup.ts',
  reporter: [
    ['list'],
    ['../browser/stopOnRefusal.ts'],
    ['./contactSheet.ts', { outputDir: '../../layout-report' }],
  ],
  use: {
    // Set by globalSetup, so only the workers see it.
    baseURL: process.env[ORIGIN_ENV],
    // Transitions finish at once, so nothing is measured mid-animation.
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: { args: LAUNCH_ARGS },
  },
  projects: SCREENS.map((s) => ({
    name: s.name,
    use: s.use,
    testMatch: '*.spec.ts',
  })),
});
