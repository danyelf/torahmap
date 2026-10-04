import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { fillSiteTags } from '@torahmap/site';

// Get the current git branch name
function getGitBranch(): string {
  // Set by Cloudflare builds, whose checkout need not be on a named branch.
  if (process.env.WORKERS_CI_BRANCH) return process.env.WORKERS_CI_BRANCH;
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

// index.html names and describes the site in the words the tab title and link previews use.
function sitePlugin(): Plugin {
  return {
    name: 'site-name',
    transformIndexHtml: fillSiteTags,
  };
}

export default defineConfig(({ command }) => {
  const branch = getGitBranch();
  return {
    plugins: [storiesPlugin(), sitePlugin()],
    // Declared in src/env.d.ts.
    define: {
      __GIT_BRANCH__: JSON.stringify(branch),
      __LIVE__: JSON.stringify(command === 'build' && branch === 'main'),
    },
    build: {
      // The dev server also serves the test harness, since it serves any HTML
      // file it is asked for.
      rollupOptions: {
        input: { main: resolve(__dirname, 'index.html') },
      },
    },
  };
});
