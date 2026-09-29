import { generateStories, MARKDOWN_DIR } from './generate.mjs';

/** Keeps src/generated.ts in step with the Markdown, at startup and on every edit. */
export function storiesPlugin() {
  return {
    name: 'torahmap-stories',
    config() {
      generateStories();
    },
    configureServer(server) {
      server.watcher.add(MARKDOWN_DIR);
      server.watcher.on('all', (_event, file) => {
        if (file.startsWith(MARKDOWN_DIR) && file.endsWith('.md')) generateStories();
      });
    },
  };
}
