import { describe, expect, it } from 'vitest';
import { STRUCTURE_FILE } from '../src/data.ts';
import { lineId } from '../src/ids.ts';
import { computeCodeLayout } from '../src/layout.ts';
import { codemapText } from '../src/text.ts';
import { fixtureStructure } from './helpers/fixture.ts';

describe('the popup', () => {
  const view = codemapText.open(new Map([[STRUCTURE_FILE, fixtureStructure]]));
  const popup = (path: string, line: number) => {
    const item = computeCodeLayout(fixtureStructure).items.find(
      (i) => i.id === lineId(path, line),
    )!;
    return view.popupText(item, new Map(), null);
  };

  it('shows when the line last changed', () => {
    expect(popup('src/main.ts', 3).refDetail?.textContent).toContain('2025-10-09');
  });

  it('shows nothing for a deleted file’s stub', () => {
    expect(popup('src/old.ts', 1).refDetail).toBeUndefined();
  });
});
