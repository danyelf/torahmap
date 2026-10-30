// @vitest-environment node
// What the dev server sends for each text's address.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { resolve } from 'node:path';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TALMUD_PAGE, TALMUD_PATH } from '@torahmap/talmud/page.ts';
import { EUAIACT_PAGE, EUAIACT_PATH } from '@torahmap/euaiact/page.ts';

let server: ViteDevServer;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    configFile: resolve(__dirname, '../vite.config.ts'),
    server: { port: 0, strictPort: false, hmr: false },
    logLevel: 'silent',
  });
  await server.listen();
  origin = `http://localhost:${(server.httpServer!.address() as AddressInfo).port}`;
}, 60_000);

afterAll(() => server?.close());

/** Not fetch, which test/setup.ts answers from disk. */
function get(address: string): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((done, failed) => {
    request(`${origin}${address}`, (response) => {
      let body = '';
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () =>
        done({ status: response.statusCode!, location: response.headers.location, body }),
      );
    })
      .on('error', failed)
      .end();
  });
}

describe.each([
  { path: TALMUD_PATH, page: TALMUD_PAGE, link: 'at=Berakhot.2a.1' },
  { path: EUAIACT_PATH, page: EUAIACT_PAGE, link: 'at=6(2)' },
])('$path', ({ path, page, link }) => {
  it('is filled with its own copy, at every address of the page', async () => {
    for (const address of [path, `${path}index.html`, `${path}?${link}`]) {
      const html = (await get(address)).body;
      expect(html).toContain(`<title>${page.name}</title>`);
      expect(html).toContain(`content="${page.tagline}"`);
    }
  });

  it('without its slash, sends the reader to the page, keeping the link', async () => {
    const response = await get(`${path.slice(0, -1)}?${link}`);
    expect(response.status).toBe(302);
    expect(response.location).toBe(`${path}?${link}`);
  });
});
