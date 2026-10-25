// The IEEE VIS 2026 map: the app shell given the program.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { ieeevisText } from './text.ts';

// An event does not record which text's page sent it, so this page sends none.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(ieeevisText).catch((error) => reportError('main', error));
