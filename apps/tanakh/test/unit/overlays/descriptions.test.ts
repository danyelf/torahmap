import { describe, it, expect, vi } from 'vitest';

async function overlays() {
  vi.resetModules();
  const { registerAllOverlays } = await import('../../../src/overlays/index');
  registerAllOverlays();
  const { getAllOverlays } = await import('../../../src/overlays/registry');
  return getAllOverlays();
}

describe('overlay descriptions', () => {
  it('gives search and every overlay a description of its own', async () => {
    const { searchTool } = await import('../../../src/search/index');
    const all = [searchTool, ...(await overlays())];
    for (const o of all) expect(o.description, o.name).toBeTruthy();
    expect(new Set(all.map((o) => o.description)).size).toBe(all.length);
  });
});
