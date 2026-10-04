// The Tanakh map: the app shell given the Tanakh.
import { createApp } from './main.ts';
import { reportError, reportUncaughtErrors } from './analytics.ts';
import { tanakhText } from './tanakh/text.ts';

reportUncaughtErrors();
createApp(tanakhText).catch((error) => reportError('main', error));
