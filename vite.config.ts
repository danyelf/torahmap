import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { fillPage } from '@torahmap/shell/app/page.ts';
import { TALMUD_PATH } from '@torahmap/talmud/page.ts';
import { pageAt } from './pages.ts';

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

// index.html is every text's page, filled from its copy by address (pages.ts).
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

const TEMPLATE = resolve(__dirname, 'index.html');
// No such file: talmudPlugin gives the build index.html under this name.
const TALMUD_PAGE = resolve(__dirname, `.${TALMUD_PATH}index.html`);

// The Talmud's page is index.html at its own address: the dev server serves
// it, sending /talmud, without the slash, there too, and a build reads it.
function talmudPlugin(): Plugin {
  return {
    name: 'talmud-address',
    resolveId: (id) => (id === TALMUD_PAGE ? id : null),
    load: (id) => (id === TALMUD_PAGE ? readFile(TEMPLATE, 'utf8') : null),
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
          const template = await readFile(TEMPLATE, 'utf8');
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

// What Cloudflare does not publish of the build: this file, and on the live site, which has no
// Talmud page, the Talmud's data.
function assetsIgnorePlugin(live: boolean): Plugin {
  return {
    name: 'assets-ignore',
    generateBundle() {
      const ignored = ['.assetsignore', ...(live ? ['data/talmud'] : [])];
      this.emitFile({
        type: 'asset',
        fileName: '.assetsignore',
        source: ignored.join('\n') + '\n',
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const branch = getGitBranch();
  const live = command === 'build' && branch === 'main';
  return {
    plugins: [storiesPlugin(), pagePlugin(), talmudPlugin(), assetsIgnorePlugin(live)],
    // Declared in packages/shell/src/env.d.ts.
    define: {
      __GIT_BRANCH__: JSON.stringify(branch),
      __LIVE__: JSON.stringify(live),
    },
    build: {
      // The dev server also serves the test harness, since it serves any HTML
      // file it is asked for. The live site has the Tanakh's page alone; every
      // other branch's preview has the Talmud's too.
      rollupOptions: {
        input: { main: TEMPLATE, ...(live ? {} : { talmud: TALMUD_PAGE }) },
      },
    },
  };
});
