// The site's Worker. It owns /api/event, which writes one Analytics Engine
// data point, and the page at /, which it names for the link that was asked
// for; every other path is served as a static file.

import {
  MAX_BODY_BYTES,
  toDataPoint,
  workerDataPoint,
  type DataPoint,
} from '../telemetry/schema.ts';
import { readLink, describeLink, linkKind } from '@torahmap/link';
import { overlayParamSpecs } from '@torahmap/overlay-catalog';
import { LINK_NAMES } from '../linkNames.ts';
import { rewritePage } from './page.ts';
import { previewFetcher } from './fetchers.ts';

interface EventsDataset {
  writeDataPoint(point: DataPoint): void;
}

export interface Env {
  TORAHMAP_EVENTS: EventsDataset;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

// Cloudflare attaches `cf` to incoming requests; the DOM Request type has no such field.
function requestContext(
  request: Request,
  url: URL,
): { country: string; device: string; host: string } {
  const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? '';
  const device = /Mobi|Android/i.test(request.headers.get('User-Agent') ?? '')
    ? 'mobile'
    : 'desktop';
  return { country, device, host: url.hostname };
}

async function handleEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin) return new Response(null, { status: 403 });

  // Reject by the declared size before reading the body, so an oversized
  // request never has to be buffered in full. The header can be absent or
  // wrong, so the byte count below still checks what was actually sent.
  const contentLength = Number(request.headers.get('Content-Length'));
  if (contentLength > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }

  const point = toDataPoint(payload, requestContext(request, url));
  if (!point) return new Response(null, { status: 400 });

  env.TORAHMAP_EVENTS.writeDataPoint(point);
  return new Response(null, { status: 204 });
}

/** Writes the link_preview event, if a chat app's fetcher asked for this page. Never throws. */
function recordPreviewFetch(request: Request, url: URL, env: Env): void {
  const fetcher = previewFetcher(request.headers.get('User-Agent') ?? '');
  if (!fetcher) return;
  try {
    const what = linkKind(readLink(url.search, overlayParamSpecs));
    const point = workerDataPoint('link_preview', { fetcher, what }, requestContext(request, url));
    env.TORAHMAP_EVENTS.writeDataPoint(point);
  } catch (error) {
    console.error('recordPreviewFetch: failed to record the preview fetch', error);
  }
}

async function linkPage(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const url = new URL(request.url);

  // Recorded whatever the static files answered — a chat app's fetcher asked
  // for the page whether or not it turned out to be one.
  recordPreviewFetch(request, url, env);

  const contentType = response.headers.get('Content-Type') ?? '';
  if (response.status !== 200 || !contentType.startsWith('text/html')) return response;

  const html = await response.text();
  // A broken link (a malformed query string, an index.html the rewrite can no
  // longer match) should serve the page as fetched, not fail outright.
  try {
    const { title, description } = describeLink(
      readLink(url.search, overlayParamSpecs),
      LINK_NAMES,
    );
    const body = rewritePage(html, { title, description, url: request.url });

    const headers = new Headers(response.headers);
    headers.delete('Content-Length');
    headers.delete('ETag');
    return new Response(body, { status: response.status, headers });
  } catch (error) {
    console.error('linkPage: falling back to the page as fetched', error);
    return new Response(html, { status: response.status, headers: response.headers });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/event') return handleEvent(request, env);
    if (url.pathname === '/' && request.method === 'GET') return linkPage(request, env);
    return env.ASSETS.fetch(request);
  },
};
