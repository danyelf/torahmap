import { describe, expect, it } from 'vitest';
import { draw } from '../draw.ts';
import type { ProofInput, SheetInput } from '../types.ts';

const LOGO =
  '<svg viewBox="0 0 453.19 157.3"><filter id="f"/><g filter="url(#f)" font-family="David Libre, system-ui, sans-serif">' +
  '<text x="453.19" y="27">מפת התנ״ך</text><text x="0" y="103.81">Torahmap</text>' +
  '<text x="0" y="151.61" font-family="system-ui, sans-serif">tagline</text></g></svg>';

function input(over: Partial<SheetInput> = {}): SheetInput {
  return {
    kind: 'sheet',
    palette: { paper: '#f3ecdc', ink: '#3a2e24', inkSoft: '#7a6a58' },
    fonts: { hebrew: 'Test Hebrew', latin: 'Test Latin' },
    verses: [
      { x: 0, y: 0, side: 4, fills: ['#111111'] },
      { x: 6, y: 0, side: 4, fills: ['#aa0000', '#00aa00'] },
      { x: 12, y: 0, side: 4, fills: ['#aa0000', '#00aa00', '#0000aa'] },
      { x: 3000, y: 1400, side: 4, fills: ['#111111'] },
    ],
    books: [
      { he: 'בראשית', en: 'Genesis', minX: 0, maxX: 300, minY: 0, maxY: 200 },
      { he: 'עובדיה', en: 'Obadiah', minX: 400, maxX: 412, minY: 0, maxY: 40 },
    ],
    sections: [{ he: 'תורה', en: 'Five Books', maxX: 3006, minY: 0 }],
    torahMinX: 0,
    torahTopY: 0,
    logoSvg: LOGO,
    key: {
      he: 'מפתח',
      en: 'Key',
      notes: ['A note.'],
      columns: [
        {
          width: 170,
          groups: [{ rows: [{ swatch: '#aa0000', he: 'בראשית', en: 'Bereshit' }] }],
        },
      ],
    },
    credits: 'credits',
    bandOffset: 0.08,
    growth: 0.75,
    marks: false,
    ...over,
  };
}

const svgOf = (result: ReturnType<typeof draw>) =>
  new DOMParser().parseFromString(result.svg, 'image/svg+xml').documentElement;

describe('draw', () => {
  it('makes a 36 × 24 inch page with ⅛ inch of bleed on every side', () => {
    const result = draw(input());
    expect(result.width).toBe(2592 + 18);
    expect(result.height).toBe(1728 + 18);
  });

  it('adds a slug with eight crop marks only when asked', () => {
    expect(svgOf(draw(input())).querySelectorAll('.crop-mark')).toHaveLength(0);
    const marked = draw(input({ marks: true }));
    expect(marked.width).toBe(2592 + 18 + 72);
    expect(svgOf(marked).querySelectorAll('.crop-mark')).toHaveLength(8);
  });

  it('draws one band per colour of a split verse, each slid along the cut', () => {
    const svg = svgOf(draw(input()));
    const bands = [...svg.querySelectorAll('.verses polygon')];
    expect(bands).toHaveLength(5);
    // The two-colour verse grows 0.75 on every side, to a side of 5.5 from
    // (5.25, -0.75). Its first band is the triangle above the cut, slid by
    // -0.5 * 0.08 * 5.5 = -0.22 along (+1, -1).
    const first = bands[0]
      .getAttribute('points')!
      .split(' ')
      .map((p) => p.split(',').map(Number));
    expect(first).toEqual(
      expect.arrayContaining([
        [expect.closeTo(5.25 - 0.22, 5), expect.closeTo(-0.75 + 0.22, 5)],
        [expect.closeTo(10.75 - 0.22, 5), expect.closeTo(-0.75 + 0.22, 5)],
        [expect.closeTo(5.25 - 0.22, 5), expect.closeTo(4.75 + 0.22, 5)],
      ]),
    );
  });

  it('drops the English, then shrinks the Hebrew, of a title too wide for its book', () => {
    const svg = svgOf(draw(input()));
    const [wide, narrow] = [...svg.querySelectorAll('.book-title')];
    expect(wide.textContent).toContain('Genesis');
    expect(narrow.textContent).not.toContain('Obadiah');
    const size = Number(narrow.querySelector('tspan')!.getAttribute('font-size'));
    expect(size).toBeLessThan(15);
    expect(size).toBeGreaterThanOrEqual(9);
  });

  it('reports a key entry wider than its column', () => {
    const long = input({
      key: {
        ...input().key,
        columns: [
          {
            width: 60,
            groups: [
              {
                rows: [
                  {
                    swatch: '#aa0000',
                    he: 'שבת חול המועד פסח',
                    en: 'Passover, Intermediate Sabbath',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(draw(long).overflows).toEqual(['Passover, Intermediate Sabbath']);
    expect(draw(input()).overflows).toEqual([]);
  });

  it('sets every Hebrew run right to left, apart from the English beside it', () => {
    // Otherwise a trailing geresh, as in יום א׳, lands on the English side of the run.
    const svg = svgOf(draw(input()));
    const hebrew = [...svg.querySelectorAll('tspan')].filter((t) =>
      /[֐-׿]/.test(t.textContent ?? ''),
    );
    expect(hebrew.length).toBeGreaterThan(0);
    // Right-to-left isolate marks in the text: a `direction` attribute on an
    // SVG tspan would move where the whole line is laid out.
    for (const t of hebrew) {
      expect(t.textContent!.startsWith('⁧')).toBe(true);
      expect(t.textContent!.endsWith('⁩')).toBe(true);
    }
  });

  it('sets a key of names alone beneath the book it is placed under, with no rule', () => {
    const names = input({
      key: { ...input().key, he: '', en: '', notes: [] },
      keyUnder: 'Genesis',
    });
    const result = draw(names);
    const svg = svgOf(result);
    expect(svg.querySelectorAll('line')).toHaveLength(0);
    expect(svg.textContent).not.toContain('A note.');
    // Genesis ends at map y 200; the key's first row sits below it.
    const genesis = [...svg.querySelectorAll('.book-title')].find((t) =>
      t.textContent!.includes('Genesis'),
    )!;
    const key = svg.querySelector('.key')!;
    const keyY = Number(key.getAttribute('transform')!.match(/,\s*([-\d.]+)\)/)![1]);
    const titleY = Number(genesis.getAttribute('y'));
    expect(keyY).toBeGreaterThan(titleY + 200 * result.scale);
  });

  it('sets a key larger by its scale, the English still regular', () => {
    const big = input({ key: { ...input().key, scale: 2 } });
    const svg = svgOf(draw(big));
    const row = [...svg.querySelectorAll('.key text')].find((t) =>
      t.textContent!.includes('Bereshit'),
    )!;
    const [he, en] = [...row.querySelectorAll('tspan')];
    expect(Number(he.getAttribute('font-size'))).toBe(23);
    expect(Number(en.getAttribute('font-size'))).toBe(20);
    expect(en.getAttribute('font-weight') ?? '400').toBe('400');
  });

  it('sets the logo’s tagline in Inter semibold', () => {
    const svg = svgOf(draw(input()));
    const tagline = [...svg.querySelectorAll('.logo text')].find(
      (t) => t.textContent === 'tagline',
    )!;
    expect(tagline.getAttribute('font-family')).toBe('Test Latin');
    expect(tagline.getAttribute('font-weight')).toBe('600');
  });

  it('sets text only in the faces its input names', () => {
    const svg = svgOf(draw(input()));
    const families = new Set(
      [...svg.querySelectorAll('[font-family]')].map((e) => e.getAttribute('font-family')),
    );
    expect([...families].sort()).toEqual(['Test Hebrew', 'Test Latin']);
  });

  it('takes the logo from the site’s artwork, without its shadow', () => {
    const svg = svgOf(draw(input()));
    expect(svg.querySelector('.logo')!.textContent).toContain('Torahmap');
    expect(svg.querySelector('.logo [filter]')).toBeNull();
  });
});

describe('draw, proof', () => {
  const proof: ProofInput = {
    kind: 'proof',
    palette: { paper: '#f3ecdc', ink: '#3a2e24', inkSoft: '#7a6a58' },
    fonts: { hebrew: 'Test Hebrew', latin: 'Test Latin' },
    scale: 0.7,
    patches: [
      {
        title: 'A',
        verses: [{ x: 100, y: 100, side: 4, fills: ['#aa0000'] }],
        centre: { x: 100, y: 100 },
      },
      {
        title: 'B',
        verses: [{ x: 100, y: 100, side: 4, fills: ['#00aa00'] }],
        centre: { x: 100, y: 100 },
      },
    ],
    microtext: {
      title: 'C',
      verses: [
        { x: 100, y: 100, side: 4, fills: ['#0000aa'] },
        { x: 3000, y: 3000, side: 4, fills: ['#0000aa'] },
      ],
      words: ['בראשית', 'ויאמר'],
      centre: { x: 100, y: 100 },
    },
    swatches: [
      { fill: '#aa0000', name: 'red', value: '#aa0000' },
      { fill: '#00aa00', name: 'Passover, Intermediate Sabbath', value: '#00aa00' },
    ],
    bandOffset: 0.08,
    growth: 0.75,
  };

  it('makes a letter page, landscape', () => {
    const result = draw(proof);
    expect([result.width, result.height]).toEqual([792, 612]);
  });

  it('draws each patch at the sheets’ scale, and labels every swatch', () => {
    const svg = svgOf(draw(proof));
    const patches = [...svg.querySelectorAll('.patch .verses')];
    expect(patches).toHaveLength(2);
    for (const p of patches) expect(p.getAttribute('transform')).toContain('scale(0.7)');
    expect(svg.querySelectorAll('.swatch')).toHaveLength(2);
    expect(svg.textContent).toContain('#00aa00');
  });

  it('draws the microtext patch three ways, with only the words that fall inside it', () => {
    const svg = svgOf(draw(proof));
    const strips = [...svg.querySelectorAll('.microtext')];
    expect(strips).toHaveLength(3);
    for (const s of strips) {
      expect([...s.querySelectorAll('.word')].map((t) => t.textContent)).toEqual(['בראשית']);
    }
    expect(strips.map((s) => s.querySelectorAll('.verses rect').length)).toEqual([1, 0, 1]);
  });

  it('shortens a swatch name too long for its cell, and keeps its value whole', () => {
    const svg = svgOf(draw(proof));
    const names = [...svg.querySelectorAll('.swatch-name')].map((t) => t.textContent);
    expect(names[0]).toBe('red');
    expect(names[1]!.endsWith('…')).toBe(true);
    expect(names[1]!.length).toBeLessThan('Passover, Intermediate Sabbath'.length);
    const values = [...svg.querySelectorAll('.swatch-value')].map((t) => t.textContent);
    expect(values).toEqual(['#aa0000', '#00aa00']);
  });
});
