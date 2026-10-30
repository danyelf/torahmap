import { describe, it, expect } from 'vitest';
import { createBackdrop } from '../src/backdrop.ts';

const field = {
  rect: { minX: -100, minY: 0, maxX: 300, maxY: 200 },
  centre: { x: 100, y: 50 },
  stops: ['red', 'green', 'blue'],
  opacity: 0.2,
};

describe('backdrop', () => {
  it('sits below what the parent already holds, hidden until shown', () => {
    const parent = document.createElement('div');
    const labels = document.createElement('div');
    parent.appendChild(labels);
    const backdrop = createBackdrop(parent);
    expect(parent.firstElementChild!.id).toBe('map-backdrop');
    const element = parent.querySelector<HTMLElement>('#map-backdrop > div')!;
    expect(element.hidden).toBe(true);
    backdrop.show(field);
    expect(element.hidden).toBe(false);
    backdrop.show(null);
    expect(element.hidden).toBe(true);
  });

  it('centres the gradient by fractions of its box and sizes the box by the zoom', () => {
    const parent = document.createElement('div');
    const backdrop = createBackdrop(parent);
    const element = parent.querySelector<HTMLElement>('#map-backdrop > div')!;
    backdrop.show(field);
    backdrop.place({ x: 10, y: 20 }, 2);
    expect(element.style.background).toContain('at 50% 25%');
    expect([element.style.left, element.style.width, element.style.height]).toEqual([
      '-200px',
      '800px',
      '400px',
    ]);
    expect(parent.querySelector<HTMLElement>('#map-backdrop')!.style.transform).toBe(
      'translate(20px, 40px)',
    );
  });
});
