// The site's Worker. Static files are served before this runs; the only route
// it owns is /api/event, which writes one Analytics Engine data point.

import { MAX_BODY_BYTES, toDataPoint, type DataPoint } from '../telemetry/schema.ts';

interface EventsDataset {
  writeDataPoint(point: DataPoint): void;
}

export interface Env {
  EVENTS: EventsDataset;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const SITE_ORIGIN = 'https://torahmap.org';

async function handleEvent(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (request.headers.get('Origin') !== SITE_ORIGIN) return new Response(null, { status: 403 });

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

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
  const point = toDataPoint(payload, { country, device });
  if (!point) return new Response(null, { status: 400 });

  env.EVENTS.writeDataPoint(point);
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === '/api/event') return handleEvent(request, env);
    return env.ASSETS.fetch(request);
  },
};
