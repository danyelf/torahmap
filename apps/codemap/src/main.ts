// The code map: the app shell given the repository.
import { configureAnalytics, reportUncaughtErrors } from '@torahmap/shell/analytics.ts';

// An event does not record which text's page sent it, so this page sends none.
configureAnalytics({ enabled: false });
reportUncaughtErrors();
