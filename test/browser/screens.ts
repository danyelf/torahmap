import { devices, type PlaywrightTestProject } from '@playwright/test';

/** Headless Chromium has no WebGL2 without software rendering. */
export const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

// packages/shell/src/styles/phone.css decides which width is a phone; the tablet here gets
// the desktop layout.
export const SCREENS: { name: string; use: PlaywrightTestProject['use'] }[] = [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  // Playwright's iPhone 13 is 390×664: the part of the screen Safari leaves the page.
  { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
];

/** One screen of each layout, for a check whose result the screen's size does not change. */
export const DESKTOP_AND_PHONE = ['desktop', 'phone'];

/** The tablet besides: the desktop layout on a touch screen, whose controls differ. */
export const DESKTOP_TABLET_AND_PHONE = ['desktop', 'tablet', 'phone'];

/** A suite's own dev server, from the repository's root. */
export const webServer = (port: number) => ({
  command: `npx vite --port ${port} --strictPort`,
  cwd: '../..',
  url: `http://localhost:${port}/`,
  reuseExistingServer: false,
  timeout: 60_000,
});
