// Test environment setup, run before every test file.
//
// simple-keyboard (pulled in by the search overlay) bundles core-js, which
// installs its DOM-collection polyfills on import. One of them replaces
// NodeList.prototype.forEach with Array.prototype.forEach. That is fine in a
// browser, where a NodeList really is index-addressable, but happy-dom keeps
// its nodes behind an internal symbol and exposes indices through a Proxy, so
// the Array version reads nothing and quietly visits zero elements — while
// .length still reports the right number. Any test that walks a NodeList with
// forEach then passes or fails depending on whether something upstream of it
// happened to import the search overlay.
//
// Pin the environment's own implementations behind an accessor that ignores
// writes. core-js tries Object.defineProperty first, which throws on a
// non-configurable property, then falls back to plain assignment, which lands
// on the no-op setter instead of throwing.
function pinForEach(collection: { prototype: object } | undefined): void {
  if (!collection?.prototype) return;

  const descriptor = Object.getOwnPropertyDescriptor(
    collection.prototype,
    'forEach',
  );
  const original = descriptor?.value;
  if (typeof original !== 'function') return;

  Object.defineProperty(collection.prototype, 'forEach', {
    configurable: false,
    enumerable: false,
    get: () => original,
    set: () => {
      // Ignore polyfills; the environment's own implementation is correct here.
    },
  });
}

pinForEach(globalThis.NodeList);
pinForEach(globalThis.HTMLCollection);

// ---------------------------------------------------------------------------
// Serve data files from disk instead of over the network.
//
// The app fetches its data with a relative URL (`fetchData` in
// src/constants/app.ts asks for `/data/<file>`). happy-dom resolves relative
// URLs against the test environment's base, http://localhost:3000, so every
// test that initialises a data-loading overlay was making a real HTTP request
// to a dev server that is not running. Each one failed with ECONNREFUSED, the
// overlay's own try/catch swallowed it, and the test passed — while exercising
// the missing-data path rather than the real one, printing a stack trace per
// attempt, and quietly depending on nothing happening to listen on port 3000.
//
// Reading the file off disk makes those tests exercise real data and keeps the
// suite hermetic. Anything outside public/ returns 404 rather than reaching the
// network, so the failure path stays testable and no test can call out.
// Individual tests can still replace globalThis.fetch to simulate failures.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const fileCache = new Map<string, string | null>();

function readPublicFile(rawUrl: string): string | null {
  // Drop the origin and any query string, leaving a site-absolute path.
  const path = rawUrl.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0];
  if (fileCache.has(path)) return fileCache.get(path) ?? null;

  const resolved = normalize(join(publicDir, decodeURIComponent(path)));
  const contents =
    resolved.startsWith(publicDir) && existsSync(resolved)
      ? readFileSync(resolved, 'utf8')
      : null;

  fileCache.set(path, contents);
  return contents;
}

globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  const body = readPublicFile(url);
  if (body === null) {
    return new Response(null, { status: 404, statusText: 'Not Found' });
  }

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;
