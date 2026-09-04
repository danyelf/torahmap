import { describe, it, expect } from 'vitest';
import { assignGlobalSearchColors } from '../searchColors';
import type { StoryStop } from '../types';

describe('assignGlobalSearchColors', () => {
  it('assigns unique colors to each search term', () => {
    const stops: StoryStop[] = [
      { id: 'a', title: 'A', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'אברהם' } },
      { id: 'b', title: 'B', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'משה' } },
    ];
    const colors = assignGlobalSearchColors(stops);
    expect(colors.get('אברהם')).toBeDefined();
    expect(colors.get('משה')).toBeDefined();
    expect(colors.get('אברהם')).not.toEqual(colors.get('משה'));
  });

  it('same term in multiple stops gets same color', () => {
    const stops: StoryStop[] = [
      { id: 'a', title: 'A', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'אברהם' } },
      { id: 'b', title: 'B', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'search', overlayParams: { q: 'אברהם,משה' } },
    ];
    const colors = assignGlobalSearchColors(stops);
    expect(colors.get('אברהם')).toBeDefined();
    expect(colors.get('משה')).toBeDefined();
  });

  it('ignores non-search stops', () => {
    const stops: StoryStop[] = [
      { id: 'a', title: 'A', text: '', camera: { x: 0, y: 0, zoom: 1 }, overlay: 'haftarah' },
    ];
    const colors = assignGlobalSearchColors(stops);
    expect(colors.size).toBe(0);
  });
});
