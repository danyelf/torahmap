// @vitest-environment node
// Node, because happy-dom enforces the browser rule that a page cannot set Origin or User-Agent.
import { describe, expect, it, vi } from 'vitest';
import worker from '../../../worker/index.ts';

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
  fields: { stop_id: 'sinai', stop_number: 4 },
});

describe('telemetry worker', () => {
  it('writes an accepted event and answers 204', async () => {
    const e = env();
    const response = await worker.fetch(post(valid), e);
    expect(response.status).toBe(204);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['v1'],
      blobs: ['story_exit', 'story', '', 'mobile', 'torahmap.org', 'sinai'],
      doubles: [4],
    });
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
      fields: { stop_id: 'sinai', stop_number: 4 },
    });
    const response = await worker.fetch(post(spoofed), e);
    expect(response.status).toBe(204);
    expect(e.TORAHMAP_EVENTS.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['v1'],
      blobs: ['story_exit', 'story', '', 'mobile', 'torahmap.org', 'sinai'],
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
