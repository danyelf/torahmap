import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { storiesPlugin } from '@torahmap/stories/vite-plugin';
import { fillPage } from '@torahmap/shell/app/page.ts';
import { TALMUD_PATH } from '@torahmap/talmud/page.ts';
import { EUAIACT_PATH } from '@torahmap/euaiact/page.ts';
import { builtPages, isLiveBuild, unpublished, type BuiltPage } from './build.ts';

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

// pages.ts reaches the stories, which storiesPlugin writes once Vite has started, so it is
// imported then, and by URL: esbuild bundles a path into the config, importing it at once.
const PAGES = pathToFileURL(resolve(__dirname, 'pages.ts')).href;
const pageAt = async (path: string) =>
  ((await import(PAGES)) as typeof import('./pages.ts')).pageAt(path);

// index.html is every text's page, filled from its copy by address (pages.ts).
// Runs first, so Vite sees the filled-in entry script.
function pagePlugin(): Plugin {
  return {
    name: 'page',
    transformIndexHtml: {
      order: 'pre',
      handler: async (html, { path }) => {
        const { copy, entry } = await pageAt(path);
        return fillPage(html, copy, entry);
      },
    },
  };
}

const TEMPLATE = resolve(__dirname, 'index.html');
type ExtraPage = Exclude<BuiltPage, 'main'>;
const PAGE_PATHS: Record<ExtraPage, string> = { talmud: TALMUD_PATH, euaiact: EUAIACT_PATH };
const htmlPath = (page: ExtraPage) => `${PAGE_PATHS[page]}index.html`;
// No such file: pageAddressPlugin gives the build index.html under this name.
const htmlFile = (page: ExtraPage) => resolve(__dirname, `.${htmlPath(page)}`);
const PAGE_FILES: Record<BuiltPage, string> = {
  main: TEMPLATE,
  talmud: htmlFile('talmud'),
  euaiact: htmlFile('euaiact'),
};

// A page beside the Tanakh's is index.html at its own address: the dev server
// serves it, sending the address without its slash there too, and a build reads it.
function pageAddressPlugin(page: ExtraPage): Plugin {
  const address = PAGE_PATHS[page];
  const file = htmlFile(page);
  return {
    name: `${page}-address`,
    resolveId: (id) => (id === file ? id : null),
    load: (id) => (id === file ? readFile(TEMPLATE, 'utf8') : null),
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [path, query] = (req.url ?? '').split('?');
        if (`${path}/` === address) {
          res.writeHead(302, {
            Location: `${address}${query === undefined ? '' : `?${query}`}`,
          });
          res.end();
          return;
        }
        if ((await pageAt(path)).path !== address) return next();
        try {
          const template = await readFile(TEMPLATE, 'utf8');
          const html = await server.transformIndexHtml(htmlPath(page), template, req.originalUrl);
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

export default defineConfig(({ command, mode }) => {
  const branch = getGitBranch();
  const live = mode === 'production' && isLiveBuild(command, branch);
  return {
    plugins: [
      storiesPlugin(),
      pagePlugin(),
      pageAddressPlugin('talmud'),
      pageAddressPlugin('euaiact'),
      assetsIgnorePlugin(live),
    ],
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
