// The Talmud map: the app shell given the Talmud.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { talmudText } from './text.ts';

// An event does not record which text's page sent it, so this page sends none.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(talmudText).catch((error) => reportError('main', error));
