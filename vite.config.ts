import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { SITE_NAME, TAGLINE } from '@torahmap/link';

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
    transformIndexHtml: (html) =>
      html.replaceAll('%SITE_NAME%', SITE_NAME).replaceAll('%TAGLINE%', TAGLINE),
  };
}

export default defineConfig(({ command }) => ({
  plugins: [storiesPlugin(), sitePlugin()],
  define: {
    __GIT_BRANCH__: JSON.stringify(getGitBranch()),
    // Draft stories show on the dev server and on every branch's preview; the
    // build of main is the live site, which leaves them out.
    __SHOW_DRAFTS__: JSON.stringify(command === 'serve' || getGitBranch() !== 'main'),
  },
  build: {
    // Only the Tanakh map is published. The dev server still serves talmud.html
    // and the test harness, since it serves any HTML file it is asked for.
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
    },
  },
}));
