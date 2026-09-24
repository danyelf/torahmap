import { devices, type Project } from '@playwright/test';

// The phone layout starts at max-width 768px (src/styles/right-panel.css), so
// the tablet gets the desktop layout.
export const SCREENS: { name: string; use: Project['use'] }[] = [
  { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop', use: { viewport: { width: 1280, height: 720 } } },
  { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
  // Playwright's iPhone 13 is 390×664: the part of the screen Safari leaves the page.
  { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
];
