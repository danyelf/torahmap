import { describe, expect, it } from 'vitest';
import type { Color } from '@torahmap/utils';
import { baseColor } from '../src/baseColor.ts';
import { LINE_KINDS, type CodeStructure, type LineKind } from '../src/data.ts';
import { lineId } from '../src/ids.ts';
import { computeCodeLayout, type CodeItem } from '../src/layout.ts';
import { churnOverlay, type ChurnSettings } from '../src/overlays/churn.ts';
import { FILE_KINDS, fileKindOf, fileTypeOverlay } from '../src/overlays/fileType.ts';
import { KIND_COLORS, lineKindOverlay } from '../src/overlays/lineKind.ts';
import {
  ADDED,
  CHANGED,
  REMOVED,
  pullRequestOverlay,
  type PullRequestSettings,
} from '../src/overlays/pullRequest.ts';
import { fixtureStructure } from './helpers/fixture.ts';

const NO_FOCUS = { hovered: null, pinned: null };

const itemAt = (path: string, line: number) =>
  computeCodeLayout(fixtureStructure).items.find((i) => i.id === lineId(path, line))!;

function prColours(settings: PullRequestSettings, structure: CodeStructure = fixtureStructure) {
  const items = computeCodeLayout(structure).items;
  const colours = pullRequestOverlay.colorsFor({
    items,
    settings,
    data: { structure },
    focus: NO_FOCUS,
  });
  return (path: string, line: number) =>
    colours[items.findIndex((i) => i.id === lineId(path, line))];
}

describe('the pull request overlay', () => {
  const all = prColours({ commit: null });

  it('marks added lines green, changed lines amber and leaves the rest alone', () => {
    expect(all('src/main.ts', 3)).toEqual(ADDED);
    expect(all('src/util.ts', 2)).toEqual(ADDED);
    expect(all('src/main.ts', 1)).toBeNull();
    expect(all('src/main.ts', 5)).toBeNull();
  });

  it('splits the line below a removal, red beside its own colour', () => {
    expect(all('src/main.ts', 2)).toEqual([REMOVED, baseColor(itemAt('src/main.ts', 2))]);
    expect(all('src/main.ts', 4)).toEqual([REMOVED, CHANGED]);
  });

  it('marks a removal at the end of a file on its last line', () => {
    const file = fixtureStructure.files[0];
    const ending: CodeStructure = {
      ...fixtureStructure,
      files: [{ ...file, pr: { marks: '......', deletedBefore: [7] } }],
    };
    expect(prColours({ commit: null }, ending)('src/main.ts', 6)).toEqual([
      REMOVED,
      baseColor(itemAt('src/main.ts', 6)),
    ]);
  });

  it('draws a deleted file red, in the commit that deleted it and no other', () => {
    expect(all('src/old.ts', 1)).toEqual(REMOVED);
    expect(prColours({ commit: 2 })('src/old.ts', 1)).toEqual(REMOVED);
    expect(prColours({ commit: 1 })('src/old.ts', 1)).toBeNull();
  });

  it('shows one commit’s marks alone', () => {
    const second = prColours({ commit: 2 });
    expect(second('src/main.ts', 3)).toBeNull();
    expect(second('src/main.ts', 2)).toBeNull();
    expect(second('src/main.ts', 4)).toEqual([REMOVED, CHANGED]);
    expect(second('src/util.ts', 2)).toEqual(ADDED);
    expect(prColours({ commit: 1 })('src/main.ts', 3)).toEqual(ADDED);
  });

  it('treats a commit past the last as all commits', () => {
    const beyond = prColours({ commit: 99 });
    expect(beyond('src/main.ts', 3)).toEqual(ADDED);
    expect(beyond('src/old.ts', 1)).toEqual(REMOVED);
  });

  it('reads its commit from a link and writes it back, all commits leaving it out', () => {
    const { settingsFromUrl, settingsToUrl } = pullRequestOverlay;
    expect(settingsFromUrl!({}, [])).toEqual({ commit: null });
    expect(settingsFromUrl!({ commit: '2' }, [])).toEqual({ commit: 2 });
    expect(settingsFromUrl!({ commit: 'x' }, [])).toEqual({ commit: null });
    expect(settingsToUrl!({ commit: 2 })).toEqual({ commit: '2' });
    expect(settingsToUrl!({ commit: null })).toEqual({});
  });
});

const brightness = (c: Color | Color[] | null) => (c as Color).reduce((a, b) => a + b, 0);

describe('the churn overlay', () => {
  const items = computeCodeLayout(fixtureStructure).items;
  const colours = (measure: ChurnSettings['measure']) => {
    const c = churnOverlay.colorsFor({
      items,
      settings: { measure },
      data: { structure: fixtureStructure },
      focus: NO_FOCUS,
    });
    return (line: number) => c[items.findIndex((i) => i.id === lineId('src/main.ts', line))];
  };

  it('draws a line changed once darker than one changed five times', () => {
    const often = colours('often');
    expect(brightness(often(1))).toBeLessThan(brightness(often(3)));
  });

  it('draws an older line darker than a newer one', () => {
    const recent = colours('recent');
    expect(brightness(recent(1))).toBeLessThan(brightness(recent(3)));
  });

  it('reads its measure from a link', () => {
    expect(churnOverlay.settingsFromUrl!({ measure: 'often' }, [])).toEqual({ measure: 'often' });
    expect(churnOverlay.settingsToUrl!({ measure: 'often' })).toEqual({ measure: 'often' });
  });
});

describe('the line type overlay', () => {
  it('gives each kind its own colour', () => {
    const kinds = Object.keys(LINE_KINDS) as LineKind[];
    const items = kinds.map((kind, i): CodeItem => ({
      id: lineId('a.ts', i + 1),
      x: 0,
      y: 0,
      size: 6,
      file: 0,
      line: i + 1,
      kind,
      deletedFile: false,
    }));
    const colours = lineKindOverlay.colorsFor({
      items,
      settings: undefined,
      data: undefined,
      focus: NO_FOCUS,
    });
    expect(colours).toEqual(kinds.map((k) => KIND_COLORS[k]));
    expect(new Set(colours.map(String)).size).toBe(kinds.length);
  });
});

describe('the file type overlay', () => {
  const kindNamed = (name: string) => FILE_KINDS.findIndex((k) => k.name === name);

  it('knows a file’s kind by its ending', () => {
    expect(fileKindOf('apps/a/src/main.ts')).toBe(kindNamed('Code'));
    expect(fileKindOf('README.md')).toBe(kindNamed('Prose'));
    expect(fileKindOf('scripts/run.py')).toBe(kindNamed('Scripts'));
    expect(fileKindOf('index.html')).toBe(kindNamed('Styles and pages'));
    expect(fileKindOf('data/x.json')).toBe(kindNamed('Data and settings'));
  });

  it('counts a git hook as a script, and other files with no ending as data', () => {
    expect(fileKindOf('.githooks/pre-commit')).toBe(kindNamed('Scripts'));
    expect(fileKindOf('LICENSE')).toBe(kindNamed('Data and settings'));
    expect(fileKindOf('.gitignore')).toBe(kindNamed('Data and settings'));
  });

  it('colours every line of a file by its kind', () => {
    const structure: CodeStructure = {
      ...fixtureStructure,
      files: [
        { ...fixtureStructure.files[0], path: 'notes.md' },
        ...fixtureStructure.files.slice(1),
      ],
    };
    const items = computeCodeLayout(structure).items;
    const colours = fileTypeOverlay.colorsFor({
      items,
      settings: undefined,
      data: { structure },
      focus: NO_FOCUS,
    });
    items.forEach((item, i) =>
      expect(colours[i]).toEqual(
        FILE_KINDS[item.file === 0 ? kindNamed('Prose') : kindNamed('Code')].color,
      ),
    );
  });

  it('gives each kind its own colour', () => {
    expect(new Set(FILE_KINDS.map((k) => String(k.color))).size).toBe(FILE_KINDS.length);
  });
});
