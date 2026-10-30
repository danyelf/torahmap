// The VIS map's page, at /ieeevis/.
import { test } from '../browser/fakeMap.ts';
import { IEEEVIS_STATES } from './app.ts';
import { testStates } from './check.ts';
import { standInTexts } from './visTexts.ts';
import { IEEEVIS_PATH } from '@torahmap/ieeevis/page.ts';
import { TEXTS_FILE } from '@torahmap/ieeevis/data.ts';

const texts = JSON.stringify(standInTexts());

test.beforeEach(async ({ page }) => {
  await page.route(`**/data/${TEXTS_FILE}`, (route) =>
    route.fulfill({ contentType: 'application/json', body: texts }),
  );
});

testStates(IEEEVIS_STATES, IEEEVIS_PATH);
