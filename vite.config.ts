import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { fillPage } from './src/app/page.ts';
import { tanakhSite } from './src/tanakh/site.ts';
import { talmudSite } from './src/talmud/site.ts';

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

const TALMUD = '/talmud/';

// index.html is every text's page, filled from its site: the Tanakh's at /,
// the Talmud's at /talmud/. Before Vite reads the page, so it finds the entry script.
function pagePlugin(): Plugin {
  return {
    name: 'page',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, { path }) =>
        path.startsWith(TALMUD)
          ? fillPage(html, talmudSite, '/src/main-talmud.ts')
          : fillPage(html, tanakhSite, '/src/main-tanakh.ts'),
    },
  };
}

// The dev server serves the Talmud at /talmud/; /talmud, without the slash, goes there too.
function talmudPlugin(): Plugin {
  return {
    name: 'talmud-address',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [path, query] = (req.url ?? '').split('?');
        if (path === '/talmud') {
          res.writeHead(302, { Location: `${TALMUD}${query === undefined ? '' : `?${query}`}` });
          res.end();
        } else if (path === TALMUD || path === `${TALMUD}index.html`) {
          const template = await readFile(resolve(__dirname, 'index.html'), 'utf8');
          res.setHeader('Content-Type', 'text/html');
          res.end(await server.transformIndexHtml(req.url ?? TALMUD, template));
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const branch = getGitBranch();
  return {
    plugins: [storiesPlugin(), pagePlugin(), talmudPlugin()],
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
