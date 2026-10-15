// The Tanakh map: the app shell given the Tanakh.
import { createApp } from '@torahmap/shell/main.ts';
import { reportError, reportUncaughtErrors } from '@torahmap/shell/analytics.ts';
import { tanakhText } from './text.ts';

reportUncaughtErrors();
createApp(tanakhText).catch((error) => reportError('main', error));
