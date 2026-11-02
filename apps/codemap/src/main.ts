// The code map: the app shell given the repository.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { codemapText } from './text.ts';

// An event does not record which text's page sent it, so this page sends none.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(codemapText).catch((error) => reportError('main', error));
