import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { devices, type PlaywrightTestProject } from '@playwright/test';
import { OWNER_PID_ENV } from './owner.ts';

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

/**
 * The port in `envName`, else a free one, written there: Playwright loads its config again
 * in every worker, which inherits the environment.
 */
export async function suitePort(envName: string): Promise<number> {
  if (process.env[envName]) return Number(process.env[envName]);
  const probe = createServer();
  await new Promise<void>((done) => probe.listen(0, done));
  const { port } = probe.address() as AddressInfo;
  await new Promise((done) => probe.close(done));
  process.env[envName] = String(port);
  return port;
}

/** A suite's own dev server, from the repository's root. */
export const webServer = (port: number) => ({
  command: `npx vite --port ${port} --strictPort`,
  cwd: '../..',
  url: `http://localhost:${port}/`,
  reuseExistingServer: false,
  timeout: 60_000,
  env: { [OWNER_PID_ENV]: String(process.pid) },
});
