import { describe, expect, it } from 'vitest';
import { timeSlotsOf, type Day, type Paper, type Structure } from '../src/data.ts';
import { computeLayout, pieceId } from '../src/layout.ts';

const paper = (index: number, pieces: string): Paper => ({
  index,
  title: `Paper ${index}`,
  authors: [],
  kind: 'Full VIS Paper',
  when: '',
  pieces,
});

const day: Day = {
  name: 'Mon',
  sessions: [
    { name: 'A', start: '08:00', papers: [paper(0, 'aiem')] },
    { name: 'B', start: '08:00', papers: [paper(1, 'ai')] },
    { name: 'C', start: '10:00', papers: [paper(2, 'x')] },
    { name: 'D', start: '', papers: [paper(3, 'aiemcf')] },
  ],
};
const structure: Structure = {
  days: [
    day,
    { name: 'Tue', sessions: [{ name: 'E', start: '08:00', papers: [paper(4, 'aiem')] }] },
  ],
};

describe('time slots', () => {
  it('group the sessions of a day that start together, in program order', () => {
    expect(timeSlotsOf(day).map((slot) => [slot.start, slot.sessions.map((s) => s.name)])).toEqual([
      ['08:00', ['A', 'B']],
      ['10:00', ['C']],
      ['', ['D']],
    ]);
  });
});

describe('the layout', () => {
  const laid = computeLayout(structure);

  it('gives each time slot of each day a panel, one below the next', () => {
    expect(laid.panels).toHaveLength(4);
    const [first, second, third] = laid.panels;
    expect(second.minY).toBeGreaterThan(first.maxY);
    expect(third.minY).toBeGreaterThan(second.maxY);
  });

  it('keeps a session’s squares inside its slot’s panel', () => {
    const byId = new Map(laid.items.map((item) => [item.id, item]));
    const [first, second] = laid.panels;
    for (const id of [pieceId(0, 0), pieceId(1, 1)]) {
      const item = byId.get(id)!;
      expect(item.y).toBeGreaterThanOrEqual(first.minY);
      expect(item.y + item.size).toBeLessThanOrEqual(first.maxY);
    }
    expect(byId.get(pieceId(2, 0))!.y).toBeGreaterThanOrEqual(second.minY);
  });

  it('puts the days side by side', () => {
    const [monday, tuesday] = [laid.panels[0], laid.panels[3]];
    expect(tuesday.minX).toBeGreaterThanOrEqual(monday.maxX);
  });

  it('has one square for each piece of each paper, every id different', () => {
    expect(laid.items).toHaveLength(4 + 2 + 1 + 6 + 4);
    expect(new Set(laid.items.map((item) => item.id)).size).toBe(laid.items.length);
  });
});
