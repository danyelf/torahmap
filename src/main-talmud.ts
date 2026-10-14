// The Talmud map, on the dev server only: the app shell given the Talmud.
import { createApp } from '@torahmap/shell/main.ts';
import { reportError, reportUncaughtErrors } from '@torahmap/shell/analytics.ts';
import { talmudText } from './talmud/text.ts';

reportUncaughtErrors();
createApp(talmudText).catch((error) => reportError('main', error));
