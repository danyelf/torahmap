// The colour testbed: the app shell given a made-up text of swatches.
import { createApp } from '@torahmap/shell/main.ts';
import {
  configureAnalytics,
  reportError,
  reportUncaughtErrors,
} from '@torahmap/shell/analytics.ts';
import { colortestbedText } from './text.ts';

configureAnalytics({ enabled: false });
reportUncaughtErrors();
createApp(colortestbedText).catch((error) => reportError('main', error));
