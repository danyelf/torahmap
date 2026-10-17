// The AI Act map: the app shell given the Act.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { euaiactText } from './text.ts';

// An event does not record which text's page sent it, so this page sends none.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(euaiactText).catch((error) => reportError('main', error));
