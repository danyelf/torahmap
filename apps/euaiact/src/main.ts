// The AI Act map: the app shell given the Act.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { euaiactText } from './text.ts';

// This map sends no telemetry.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(euaiactText).catch((error) => reportError('main', error));
