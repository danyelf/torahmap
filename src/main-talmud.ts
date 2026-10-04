// The Talmud map, on the dev server only: the app shell given the Talmud.
import { createApp } from './main.ts';
import { reportError, reportUncaughtErrors } from './analytics.ts';
import { talmudText } from './talmud/text.ts';

reportUncaughtErrors();
createApp(talmudText).catch((error) => reportError('main', error));
