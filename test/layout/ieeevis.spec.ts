// The VIS map's page, at /ieeevis/.
import { IEEEVIS_STATES } from './app.ts';
import { testStates } from './check.ts';
import { IEEEVIS_PATH } from '@torahmap/ieeevis/page.ts';

testStates(IEEEVIS_STATES, IEEEVIS_PATH);
