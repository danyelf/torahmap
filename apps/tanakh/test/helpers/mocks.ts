// Mock implementations for testing
import { vi } from 'vitest';
import { STRUCTURE_FILE, TEXTS_FILE } from '../../src/verseTexts.ts';

export function mockWindowLocation(url: string = 'http://localhost:5173/') {
  const urlObj = new URL(url);

  delete (window as any).location;
  (window as any).location = {
    href: urlObj.href,
    protocol: urlObj.protocol,
    host: urlObj.host,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    hash: urlObj.hash,
    origin: urlObj.origin,
  };
}

// Installs history.pushState/replaceState mocks that also update the mocked
// window.location, the way a real browser would, and keeps a chronological
// log of the resulting URLs — replaceState overwrites the most recent entry
// rather than adding one, matching real navigation semantics.
export function mockHistory(initialUrl: string = 'http://localhost:5173/') {
  mockWindowLocation(initialUrl);

  const historyStates: string[] = [];

  function resolve(url: string | URL): string {
    const urlString = typeof url === 'string' ? url : url.toString();
    return urlString.startsWith('http') ? urlString : `http://localhost:5173${urlString}`;
  }

  const pushState = vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
    if (url) {
      historyStates.push(String(url));
      mockWindowLocation(resolve(url));
    }
  });

  const replaceState = vi.fn((_state: unknown, _title: string, url?: string | URL | null) => {
    if (url) {
      if (historyStates.length > 0) {
        historyStates[historyStates.length - 1] = String(url);
      } else {
        historyStates.push(String(url));
      }
      mockWindowLocation(resolve(url));
    }
  });

  globalThis.history = { pushState, replaceState } as unknown as History;

  return { pushState, replaceState, historyStates };
}

// A response entry is normally just the JSON body a URL should resolve to
// (200, ok: true). Wrap it in mockFetchStatus() when a test needs a specific
// status code instead, such as a 404 or 500 error path.
class MockResponseStatus {
  constructor(
    public status: number,
    public body: unknown = null,
  ) {}
}

export function mockFetchStatus(status: number, body: unknown = null): MockResponseStatus {
  return new MockResponseStatus(status, body);
}

// Installs a fetch mock keyed by URL and returns it, so callers can still
// assert on calls or layer one-off overrides with mockResolvedValueOnce /
// mockRejectedValueOnce for behavior a static URL map can't express (a
// rejected fetch, a response whose .json() itself rejects).
export function mockFetch(responses: Record<string, unknown> = {}) {
  const defaultResponses: Record<string, unknown> = {
    [`/data/${STRUCTURE_FILE}`]: { books: [] },
    [`/data/${TEXTS_FILE}`]: {},
    ...responses,
  };

  const fetchMock = vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const entry = defaultResponses[urlString];

    if (entry instanceof MockResponseStatus) {
      const { status, body } = entry;
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response);
    }

    return Promise.resolve({
      ok: !!entry,
      status: entry ? 200 : 404,
      json: () => Promise.resolve(entry),
      text: () => Promise.resolve(JSON.stringify(entry)),
    } as Response);
  });

  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

export function restoreAllMocks() {
  vi.restoreAllMocks();
}
