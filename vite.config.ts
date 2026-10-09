import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { fillPage } from './src/app/page.ts';
import { TALMUD_PATH, pageAt } from './src/pages.ts';

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

// index.html is every text's page, filled from its copy by address (src/pages.ts).
// Runs first, so Vite sees the filled-in entry script.
function pagePlugin(): Plugin {
  return {
    name: 'page',
    transformIndexHtml: {
      order: 'pre',
      handler: (html, { path }) => {
        const { copy, entry } = pageAt(path);
        return fillPage(html, copy, entry);
      },
    },
  };
}

// The dev server serves the Talmud's page from index.html; /talmud, without the slash, goes there too.
function talmudPlugin(): Plugin {
  return {
    name: 'talmud-address',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [path, query] = (req.url ?? '').split('?');
        if (`${path}/` === TALMUD_PATH) {
          res.writeHead(302, {
            Location: `${TALMUD_PATH}${query === undefined ? '' : `?${query}`}`,
          });
          res.end();
          return;
        }
        if (pageAt(path).path !== TALMUD_PATH) return next();
        try {
          const template = await readFile(resolve(__dirname, 'index.html'), 'utf8');
          const page = `${TALMUD_PATH}index.html`;
          const html = await server.transformIndexHtml(page, template, req.originalUrl);
          res.setHeader('Content-Type', 'text/html');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(html);
        } catch (error) {
          next(error);
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
