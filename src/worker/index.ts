// The site's Worker. It owns /api/event, which writes one Analytics Engine
// data point, and the page at /, which it names for the link that was asked
// for; every other path is served as a static file.

import { MAX_BODY_BYTES, toDataPoint, type DataPoint } from '../telemetry/schema.ts';
import { readLink, describeLink } from '@torahmap/link';
import { overlayParamSpecs } from '@torahmap/overlay-catalog';
import { LINK_NAMES } from '../linkNames.ts';
import { rewritePage } from './page.ts';

interface EventsDataset {
  writeDataPoint(point: DataPoint): void;
}

export interface Env {
  TORAHMAP_EVENTS: EventsDataset;
  ASSETS: { fetch(request: Request): Promise<Response> };
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

  // Cloudflare attaches `cf` to incoming requests; the DOM Request type has no such field.
  const country = (request as unknown as { cf?: { country?: string } }).cf?.country ?? '';
  const device = /Mobi|Android/i.test(request.headers.get('User-Agent') ?? '')
    ? 'mobile'
    : 'desktop';
  const point = toDataPoint(payload, { country, device, host: url.hostname });
  if (!point) return new Response(null, { status: 400 });

  env.TORAHMAP_EVENTS.writeDataPoint(point);
  return new Response(null, { status: 204 });
}

async function linkPage(request: Request, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get('Content-Type') ?? '';
  if (response.status !== 200 || !contentType.startsWith('text/html')) return response;

  const url = new URL(request.url);
  const { title, description } = describeLink(readLink(url.search, overlayParamSpecs), LINK_NAMES);
  const body = rewritePage(await response.text(), { title, description, url: request.url });

  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('ETag');
  return new Response(body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/event') return handleEvent(request, env);
    if (url.pathname === '/' && request.method === 'GET') return linkPage(request, env);
    return env.ASSETS.fetch(request);
  },
};
