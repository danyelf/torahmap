// The IEEE VIS 2026 map: the app shell given the program.
import { createApp } from '@torahmap/shell/main.ts';
import { reportError, reportUncaughtErrors } from '@torahmap/shell/analytics.ts';
import { ieeevisText } from './text.ts';

// Its events carry the page in their host column (apps/worker/src/index.ts).
reportUncaughtErrors();
createApp(ieeevisText).catch((error) => reportError('main', error));
