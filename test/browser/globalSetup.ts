// Both suites' globalSetup: starts the site and tells the workers where it is.
import { startSite } from './site.ts';

export const ORIGIN_ENV = 'SUITE_ORIGIN';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const { origin, stop } = await startSite();
  process.env[ORIGIN_ENV] = origin;
  return stop;
}
