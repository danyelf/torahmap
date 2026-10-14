import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { fillPage } from '@torahmap/shell/app/page.ts';
import { TALMUD_PATH } from '@torahmap/talmud/page.ts';
import { builtPages, isLiveBuild, unpublished, type BuiltPage } from './build.ts';
import { pageAt } from './pages.ts';

// Get the current git branch name
function getGitBranch(): string {
  // Set by Cloudflare builds, whose checkout need not be on a named branch. Without it, a build
  // of main could read its branch as HEAD and publish what only previews may.
  if (process.env.WORKERS_CI_BRANCH) return process.env.WORKERS_CI_BRANCH;
  if (process.env.WORKERS_CI) throw new Error('A Cloudflare build without WORKERS_CI_BRANCH');
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
const TALMUD_HTML_PATH = `${TALMUD_PATH}index.html`;
// No such file: talmudPlugin gives the build index.html under this name.
const TALMUD_HTML = resolve(__dirname, `.${TALMUD_HTML_PATH}`);
const PAGE_FILES: Record<BuiltPage, string> = { main: TEMPLATE, talmud: TALMUD_HTML };

// The Talmud's page is index.html at its own address: the dev server serves
// it, sending /talmud, without the slash, there too, and a build reads it.
function talmudPlugin(): Plugin {
  return {
    name: 'talmud-address',
    resolveId: (id) => (id === TALMUD_HTML ? id : null),
    load: (id) => (id === TALMUD_HTML ? readFile(TEMPLATE, 'utf8') : null),
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
          const html = await server.transformIndexHtml(TALMUD_HTML_PATH, template, req.originalUrl);
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

// Cloudflare does not publish these (build.ts).
function assetsIgnorePlugin(live: boolean): Plugin {
  return {
    name: 'assets-ignore',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '.assetsignore',
        source: unpublished(live).join('\n') + '\n',
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const branch = getGitBranch();
  const live = isLiveBuild(command, branch);
  return {
    plugins: [storiesPlugin(), pagePlugin(), talmudPlugin(), assetsIgnorePlugin(live)],
    // Declared in packages/shell/src/env.d.ts.
    define: {
      __GIT_BRANCH__: JSON.stringify(branch),
      __LIVE__: JSON.stringify(live),
    },
    build: {
      // The dev server also serves the test harness, since it serves any HTML
      // file it is asked for.
      rollupOptions: {
        input: Object.fromEntries(builtPages(live).map((page) => [page, PAGE_FILES[page]])),
      },
    },
  };
});
