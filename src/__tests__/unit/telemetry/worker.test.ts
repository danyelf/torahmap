// @vitest-environment node
// Node, because happy-dom enforces the browser rule that a page cannot set Origin or User-Agent.
import { describe, expect, it, vi } from 'vitest';
import * as pageModule from '../../../worker/page.ts';
import worker from '../../../worker/index.ts';
import { columns, type DataPoint } from '../../../telemetry/schema.ts';

function env() {
  return {
    TORAHMAP_EVENTS: { writeDataPoint: vi.fn() },
    ASSETS: { fetch: vi.fn(async () => new Response('asset', { status: 404 })) },
  };
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request('https://torahmap.org/api/event', {
    method: 'POST',
    body,
    headers: {
      Origin: 'https://torahmap.org',
      'User-Agent': 'Mozilla/5.0 (iPhone) Mobile',
      ...headers,
    },
  });
}

const valid = JSON.stringify({
  event: 'story_exit',
  visit: 'v1',
  mode: 'story',
  fields: { stop_id: 'sinai', stop_number: 4, how: 'fold', story: 'tour' },
});

describe('telemetry worker', () => {
  it('writes an accepted event and answers 204', async () => {
    const e = env();
    const response = await worker.fetch(post(valid), e);
    expect(response.status).toBe(204);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['v1'],
      blobs: ['story_exit', 'story', '', 'mobile', 'torahmap.org', 'sinai', 'fold', 'tour'],
      doubles: [4],
    });
  });

  it("records an error's browser from the request, not from the page", async () => {
    const e = env();
    const body = JSON.stringify({
      event: 'error',
      visit: 'v1',
      mode: 'reader',
      fields: { source: 'main', message: 'boom', browser: 'made up' },
    });
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0';
    await worker.fetch(post(body, { 'User-Agent': userAgent }), e);
    const point: DataPoint = e.TORAHMAP_EVENTS.writeDataPoint.mock.calls[0][0];
    expect(point.blobs[columns('error').blobs.indexOf('browser')]).toBe('Firefox 131 Windows');
  });

  it('takes the host from the request URL when the Origin matches it', async () => {
    const e = env();
    const previewUrl = 'https://telemetry-torahmap.example.workers.dev/api/event';
    const request = new Request(previewUrl, {
      method: 'POST',
      body: valid,
      headers: {
        Origin: 'https://telemetry-torahmap.example.workers.dev',
        'User-Agent': 'Mozilla/5.0 (iPhone) Mobile',
      },
    });
    const response = await worker.fetch(request, e);
    expect(response.status).toBe(204);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['v1'],
      blobs: [
        'story_exit',
        'story',
        '',
        'mobile',
        'telemetry-torahmap.example.workers.dev',
        'sinai',
        'fold',
        'tour',
      ],
      doubles: [4],
    });
  });

  it('rejects a mismatched Origin in either direction', async () => {
    const e = env();
    const toSite = new Request('https://torahmap.org/api/event', {
      method: 'POST',
      body: valid,
      headers: { Origin: 'https://telemetry-torahmap.example.workers.dev' },
    });
    const toPreview = new Request('https://telemetry-torahmap.example.workers.dev/api/event', {
      method: 'POST',
      body: valid,
      headers: { Origin: 'https://torahmap.org' },
    });
    expect((await worker.fetch(toSite, e)).status).toBe(403);
    expect((await worker.fetch(toPreview, e)).status).toBe(403);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('ignores a host claimed in the payload', async () => {
    const e = env();
    const spoofed = JSON.stringify({
      event: 'story_exit',
      visit: 'v1',
      mode: 'story',
      host: 'evil.example',
      fields: { stop_id: 'sinai', stop_number: 4, how: 'fold', story: 'tour' },
    });
    const response = await worker.fetch(post(spoofed), e);
    expect(response.status).toBe(204);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['v1'],
      blobs: ['story_exit', 'story', '', 'mobile', 'torahmap.org', 'sinai', 'fold', 'tour'],
      doubles: [4],
    });
  });

  it('writes nothing for an oversized body, bad JSON or an unknown event', async () => {
    const e = env();
    expect((await worker.fetch(post('x'.repeat(3000)), e)).status).toBe(413);
    expect((await worker.fetch(post('{not json'), e)).status).toBe(400);
    expect(
      (await worker.fetch(post('{"event":"nope","visit":"v","mode":"story"}'), e)).status,
    ).toBe(400);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('rejects an oversized body by its Content-Length header, without reading it', async () => {
    const e = env();
    const response = await worker.fetch(post('x', { 'Content-Length': String(3000) }), e);
    expect(response.status).toBe(413);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('measures the body in bytes, not characters', async () => {
    const e = env();
    // Each 'א' is one UTF-16 code unit but two UTF-8 bytes, so this body is
    // under 2048 characters but over 2048 bytes.
    const body = JSON.stringify({
      event: 'story_return',
      visit: 'v1',
      mode: 'story',
      fields: { s: 'א'.repeat(1100) },
    });
    expect(body.length).toBeLessThan(2048);
    const response = await worker.fetch(post(body), e);
    expect(response.status).toBe(413);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('refuses a GET on the endpoint and hands other paths to the static assets', async () => {
    const e = env();
    expect((await worker.fetch(new Request('https://torahmap.org/api/event'), e)).status).toBe(405);
    await worker.fetch(new Request('https://torahmap.org/missing'), e);
    expect(e.ASSETS.fetch).toHaveBeenCalled();
  });
});

const slack = { 'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' };

function page(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh)', ...headers } });
}
function envWithIndex(
  html = '<title>Torahmap</title><meta property="og:title" content="Torahmap" /><meta property="og:url" content="https://torahmap.org/" />',
) {
  const e = env();
  e.ASSETS.fetch = vi.fn(
    async () => new Response(html, { headers: { 'Content-Type': 'text/html', ETag: '"static"' } }),
  );
  return e;
}

describe('the page at /', () => {
  it('names the link a chat app asked for', async () => {
    const response = await worker.fetch(
      page('https://torahmap.org/?verse=Genesis.12.1', slack),
      envWithIndex(),
    );
    const html = await response.text();
    expect(html).toContain('<title>Genesis 12:1 · Torahmap</title>');
    expect(html).toContain('content="Genesis 12:1 · Torahmap"');
    expect(response.headers.get('ETag')).toBeNull();
  });

  it('hands a browser the static page untouched', async () => {
    const e = envWithIndex();
    const response = await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1'), e);
    expect(response).toBe(await e.ASSETS.fetch.mock.results[0].value);
    expect(response.headers.get('ETag')).toBe('"static"');
    expect(await response.text()).toContain('<title>Torahmap</title>');
    expect(e.TORAHMAP_EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('points og:url at the link as the app reads it', async () => {
    const response = await worker.fetch(
      page('https://torahmap.org/?verse=Genesis.12.1&fbclid=abc&utm_source=x', slack),
      envWithIndex(),
    );
    expect(await response.text()).toContain(
      '<meta property="og:url" content="https://torahmap.org/?verse=Genesis.12.1" />',
    );
  });

  it('keeps a stop without a story in og:url', async () => {
    const response = await worker.fetch(
      page('https://torahmap.org/?stop=abraham_zoom', slack),
      envWithIndex(),
    );
    expect(await response.text()).toContain(
      '<meta property="og:url" content="https://torahmap.org/?stop=abraham_zoom" />',
    );
  });

  it('passes through anything but a 200 HTML page', async () => {
    const e = env();
    e.ASSETS.fetch = vi.fn(async () => new Response(null, { status: 304 }));
    const response = await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1', slack), e);
    expect(response.status).toBe(304);
  });

  it('leaves other paths to the static files', async () => {
    const e = envWithIndex();
    await worker.fetch(page('https://torahmap.org/og-image.jpg', slack), e);
    expect(e.ASSETS.fetch).toHaveBeenCalledOnce();
  });

  it('falls back to the page as fetched if naming the link throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rewriteSpy = vi.spyOn(pageModule, 'rewritePage').mockImplementation(() => {
      throw new Error('boom');
    });
    const html = '<title>Torahmap</title><meta property="og:title" content="Torahmap" />';
    const e = envWithIndex(html);
    const response = await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1', slack), e);
    expect(await response.text()).toBe(html);
    expect(consoleError).toHaveBeenCalled();
    const { blobs } = e.TORAHMAP_EVENTS.writeDataPoint.mock.calls
      .map(([point]) => point as DataPoint)
      .find((p) => p.indexes[0] === 'worker_error')!;
    const column = (name: string) => blobs[columns('worker_error').blobs.indexOf(name)];
    expect(column('source')).toBe('linkPage');
    expect(column('message')).toBe('Error: boom');
    rewriteSpy.mockRestore();
    consoleError.mockRestore();
  });
});

describe('link_preview', () => {
  it('records a chat app fetching a view', async () => {
    const e = envWithIndex();
    await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1', slack), e);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['link_preview'],
      blobs: ['link_preview', '', '', 'desktop', 'torahmap.org', 'slack', 'view'],
      doubles: [],
    });
  });

  it('records "nothing" for the bare page', async () => {
    const e = envWithIndex();
    await worker.fetch(page('https://torahmap.org/', slack), e);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['link_preview'],
      blobs: ['link_preview', '', '', 'desktop', 'torahmap.org', 'slack', 'nothing'],
      doubles: [],
    });
  });

  it('records "stop" for a story link', async () => {
    const e = envWithIndex();
    await worker.fetch(page('https://torahmap.org/?story=tour&stop=intro', slack), e);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['link_preview'],
      blobs: ['link_preview', '', '', 'desktop', 'torahmap.org', 'slack', 'stop'],
      doubles: [],
    });
  });

  it('writes nothing for an ordinary browser', async () => {
    const e = envWithIndex();
    await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1'), e);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).not.toHaveBeenCalled();
  });

  it('records the fetch whatever the static files answered', async () => {
    const e = env();
    e.ASSETS.fetch = vi.fn(async () => new Response(null, { status: 404 }));
    const response = await worker.fetch(page('https://torahmap.org/', slack), e);
    expect(response.status).toBe(404);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['link_preview'],
      blobs: ['link_preview', '', '', 'desktop', 'torahmap.org', 'slack', 'nothing'],
      doubles: [],
    });
  });

  it('serves the page even if recording throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = envWithIndex();
    e.TORAHMAP_EVENTS.writeDataPoint = vi.fn(() => {
      throw new Error('boom');
    });
    const response = await worker.fetch(page('https://torahmap.org/?verse=Genesis.12.1', slack), e);
    expect(response.status).toBe(200);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
