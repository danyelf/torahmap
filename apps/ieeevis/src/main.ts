// The IEEE VIS 2026 map: the app shell given the program.
import { createApp } from '@torahmap/shell/main.ts';
import { reportError, reportUncaughtErrors } from '@torahmap/shell/analytics.ts';
import { ieeevisText } from './text.ts';

reportUncaughtErrors();
createApp(ieeevisText).catch((error) => reportError('main', error));
