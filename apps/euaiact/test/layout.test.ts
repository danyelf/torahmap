// apps/euaiact/test/layout.test.ts
import { indexItems, SQUARE_GAP } from '@torahmap/engine';
import { describe, expect, it } from 'vitest';
import { computeActLayout } from '../src/layout.ts';
import {
  ARTICLE_NUMBER,
  ARTICLE_NUMBER_ZOOM,
  COLUMN_WIDTH,
  POSITION_JITTER,
  SQUARE_SIZE,
} from '../src/constants.ts';
import { actFixture } from './helpers/actFixture.ts';

const order = { recital: 0, article: 1, annex: 2 } as const;
const laid = computeActLayout(actFixture);
const at = (id: string) => laid.items.find((i) => i.id === id)!;

describe('the Act’s layout', () => {
  it('holds every square once, recitals then articles then annexes', () => {
    expect(() => indexItems(laid.items)).not.toThrow();
    const layers = laid.items.map((i) => i.layer);
    expect(layers).toEqual([...layers].sort((a, b) => order[a] - order[b]));
    expect(laid.items.filter((i) => i.layer === 'recital')).toHaveLength(3);
    expect(laid.items.filter((i) => i.layer === 'annex')).toHaveLength(2);
  });

  it('draws a recital twice as wide as it is tall', () => {
    const r = at('Recital.1');
    expect(r.width).toBe(2 * SQUARE_SIZE);
    expect(r.size).toBe(SQUARE_SIZE);
    expect(at('Recital.2').x).toBe(r.x + 2 * SQUARE_SIZE);
  });

  it('keeps every square inside the bounds', () => {
    for (const i of laid.items) {
      expect(i.x + (i.width ?? i.size)).toBeLessThanOrEqual(laid.bounds.width);
      expect(i.y + i.size).toBeLessThanOrEqual(laid.bounds.height);
      expect(i.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('flows plain paragraphs along a line and starts a list on its own', () => {
    expect(at('1(2)').y).toBe(at('1(1)').y);
    expect(at('1(2)').x).toBe(at('1(1)').x + SQUARE_SIZE);
    expect(at('1(3)').y).toBeGreaterThan(at('1(2)').y);
  });

  it('puts a list’s points under its lead-in, indented one column', () => {
    const lead = at('1(3)');
    expect(lead.lead).toBe(true);
    expect(at('1(3)(a)').x).toBe(lead.x + SQUARE_SIZE);
    expect(at('1(3)(a)').y).toBe(lead.y + SQUARE_SIZE);
    expect(at('1(3)(b)').x).toBe(at('1(3)(a)').x + SQUARE_SIZE);
  });

  it('wraps a column after eight squares', () => {
    const wide = computeActLayout({
      ...actFixture,
      chapters: [
        {
          number: 'I',
          columns: [
            {
              label: null,
              runs: [
                [
                  {
                    number: '1',
                    groups: Array.from({ length: COLUMN_WIDTH + 1 }, (_, i) => ({
                      kind: 'plain' as const,
                      cell: { id: `1(${i + 1})`, origin: 'B' as const },
                    })),
                  },
                ],
              ],
            },
          ],
        },
      ],
    });
    const last = wide.items.find((i) => i.id === `1(${COLUMN_WIDTH + 1})`)!;
    const first = wide.items.find((i) => i.id === '1(1)')!;
    expect(last.x).toBe(first.x);
    expect(last.y).toBe(first.y + SQUARE_SIZE);
  });

  it('puts a split chapter’s sections in columns side by side, and a plain chapter in one', () => {
    expect(at('7').x).toBeGreaterThan(at('6').x + COLUMN_WIDTH * SQUARE_SIZE - 1);
    expect(at('7').y).toBe(at('6').y);
    expect(at('2').x).toBe(at('1(1)').x);
    expect(at('2').y).toBeGreaterThan(at('1(3)(c)').y);
  });

  it('stands the layers one over the next', () => {
    const bottom = (layer: string) =>
      Math.max(...laid.items.filter((i) => i.layer === layer).map((i) => i.y + i.size));
    const top = (layer: string) =>
      Math.min(...laid.items.filter((i) => i.layer === layer).map((i) => i.y));
    expect(top('article')).toBeGreaterThan(bottom('recital'));
    expect(top('annex')).toBeGreaterThan(bottom('article'));
  });

  it('boxes each chapter and annex for its label, with the layer it belongs to', () => {
    expect(laid.books.map((b) => [b.name, b.section])).toEqual([
      ['Recitals', 'Recitals'],
      ['Ch. I', 'Articles'],
      ['Ch. III', 'Articles'],
      ['Annex I', 'Annexes'],
    ]);
    const three = laid.books.find((b) => b.name === 'Ch. III')!;
    expect(three.minX).toBe(at('6').x);
    expect(three.maxX).toBeGreaterThanOrEqual(at('7').x + COLUMN_WIDTH * SQUARE_SIZE - 1);
  });

  it('numbers each article above its first square, at its column’s left edge', () => {
    const firsts = ['1(1)', '2', '6', '7'].map(at);
    expect(laid.articles.map((a) => a.number)).toEqual(['1', '2', '6', '7']);
    laid.articles.forEach((a, i) => {
      expect(a.x).toBe(firsts[i].x);
      expect(a.y).toBeLessThan(firsts[i].y);
    });
  });

  it('keeps each article number a pixel clear of every square, from its zoom', () => {
    const { fontSize, offset } = ARTICLE_NUMBER;
    const slack = 1e-9;
    for (const zoom of [ARTICLE_NUMBER_ZOOM, 4]) {
      const px = 1 / zoom;
      for (const a of laid.articles) {
        const bottom = a.y - offset * px;
        const top = bottom - fontSize * px;
        const column = laid.items.filter(
          (s) => s.layer === 'article' && s.x >= a.x && s.x < a.x + COLUMN_WIDTH * SQUARE_SIZE,
        );
        for (const s of column) {
          const squareTop = s.y - POSITION_JITTER;
          const squareBottom = s.y + s.size - SQUARE_GAP + POSITION_JITTER;
          if (squareTop > a.y - slack) expect(bottom + px).toBeLessThanOrEqual(squareTop + slack);
          else expect(top - px).toBeGreaterThanOrEqual(squareBottom - slack);
        }
      }
    }
  });

  it('nudges each square by an amount its id fixes', () => {
    const again = computeActLayout(actFixture);
    for (const item of laid.items) {
      expect(Math.abs(item.jitter!.x)).toBeLessThanOrEqual(POSITION_JITTER);
      expect(Math.abs(item.jitter!.y)).toBeLessThanOrEqual(POSITION_JITTER);
      expect(again.items.find((i) => i.id === item.id)!.jitter).toEqual(item.jitter);
    }
    expect(new Set(laid.items.map((i) => i.jitter!.x)).size).toBeGreaterThan(1);
  });
});
