// The site a browser suite runs against: built once into a folder of its own and served from
// inside the Playwright runner, so it lives and dies with the run.
import { createServer, type Server } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PUBLIC = join(ROOT, 'public');

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/**
 * The file `path` names under the first of `roots` that has it, a folder meaning its
 * index.html. Nothing outside a root is ever named.
 */
export function fileFor(path: string, roots: readonly string[]): string | undefined {
  for (const root of roots) {
    const file = resolve(root, `.${normalize(decodeURIComponent(path))}`);
    if (file !== root && !file.startsWith(root + sep)) continue;
    const found =
      existsSync(file) && statSync(file).isDirectory() ? join(file, 'index.html') : file;
    if (existsSync(found) && statSync(found).isFile()) return found;
  }
  return undefined;
}

function serve(roots: readonly string[]): Server {
  return createServer((req, res) => {
    const [path, query] = (req.url ?? '/').split('?');
    // The built page reports its events here; the Worker answers in production.
    if (path === '/api/event') {
      req.resume();
      res.writeHead(204).end();
      return;
    }
    const file = fileFor(path, roots);
    if (file) {
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    } else if (!path.endsWith('/') && fileFor(`${path}/`, roots)) {
      // What the dev server and the Worker do for a page's address.
      res.writeHead(302, { Location: `${path}/${query === undefined ? '' : `?${query}`}` }).end();
    } else {
      res.writeHead(404).end();
    }
  });
}

/**
 * Builds the site as the repository's Vite config describes it and serves it on a free port,
 * with public/ (the data, 135 MB) read in place rather than copied. `stop` closes the server
 * and deletes the build.
 */
export async function startSite(): Promise<{ origin: string; stop: () => Promise<void> }> {
  const out = await mkdtemp(join(tmpdir(), 'torahmap-suite-'));
  let server: Server | undefined;
  const stop = async () => {
    server?.closeAllConnections();
    await new Promise((done) => (server ? server.close(done) : done(undefined)));
    await rm(out, { recursive: true, force: true });
  };
  try {
    await build({
      root: ROOT,
      logLevel: 'warn',
      build: { outDir: out, emptyOutDir: true, copyPublicDir: false },
    });
    server = serve([out, PUBLIC]);
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
  } catch (error) {
    await stop();
    throw error;
  }
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, stop };
}
