import { describe, it, expect, vi } from 'vitest';

async function overlays() {
  vi.resetModules();
  const { registerAllOverlays } = await import('../../../overlays/index');
  registerAllOverlays();
  const { getAllOverlays } = await import('../../../overlays/registry');
  return getAllOverlays();
}

describe('overlay descriptions', () => {
  it('gives every overlay a description of its own', async () => {
    const all = await overlays();
    for (const o of all) expect(o.description, o.name).toBeTruthy();
    expect(new Set(all.map((o) => o.description)).size).toBe(all.length);
  });
});
