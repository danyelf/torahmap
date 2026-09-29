// Draws a print from its input, as SVG in the page, where the real fonts can
// measure text. Playwright sends this function to the page as source text, so
// everything it uses is declared inside it.

import type { DrawResult, Key, ProofInput, SheetInput } from './types.ts';

export function draw(input: SheetInput | ProofInput): DrawResult {
  const NS = 'http://www.w3.org/2000/svg';
  const HEBREW = 'David Libre';
  const LATIN = 'Inter';
  // Hebrew beside English on one line, wrapped in right-to-left isolate marks
  // so its punctuation stays with it. A `direction` attribute on an SVG tspan
  // would move where the whole line is laid out instead.
  const rtl = (text: string) => `⁧${text}⁩`;
  const { paper, ink, inkSoft } = input.palette;

  function el(
    parent: Element,
    name: string,
    attrs: Record<string, string | number> = {},
    text?: string,
  ): Element {
    const e = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  // A test DOM may have no canvas; the estimate below stands in.
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = document.createElement('canvas').getContext('2d');
  } catch {
    ctx = null;
  }
  function measure(text: string, family: string, size: number, weight: number): number {
    if (!ctx) return text.length * size * 0.55;
    ctx.font = `${weight} ${size}px "${family}"`;
    return ctx.measureText(text).width;
  }

  // Clip a polygon to the half-plane a·x + b·y <= c.
  function clip(poly: number[][], a: number, b: number, c: number): number[][] {
    const out: number[][] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const pIn = a * p[0] + b * p[1] <= c;
      const qIn = a * q[0] + b * q[1] <= c;
      if (pIn) out.push(p);
      if (pIn !== qIn) {
        const t = (c - a * p[0] - b * p[1]) / (a * (q[0] - p[0]) + b * (q[1] - p[1]));
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }

  // Verses in map units. A split verse grows, and band k of n covers the part
  // of the square where (u + v) / 2 lies in [k/n, (k+1)/n), slid along the cut
  // as the site's shader slides it.
  function drawVerses(
    g: Element,
    verses: SheetInput['verses'],
    bandOffset: number,
    growth: number,
  ): void {
    for (const v of verses) {
      if (v.fills.length === 1) {
        el(g, 'rect', { x: v.x, y: v.y, width: v.side, height: v.side, fill: v.fills[0] });
        continue;
      }
      const x = v.x - growth;
      const y = v.y - growth;
      const side = v.side + 2 * growth;
      const n = v.fills.length;
      const square = [
        [x, y],
        [x + side, y],
        [x + side, y + side],
        [x, y + side],
      ];
      v.fills.forEach((fill, k) => {
        let band = clip(square, 1, 1, x + y + (2 * side * (k + 1)) / n);
        band = clip(band, -1, -1, -(x + y + (2 * side * k) / n));
        const slide = (k - (n - 1) / 2) * bandOffset * side;
        const points = band.map(([px, py]) => `${px + slide},${py - slide}`).join(' ');
        el(g, 'polygon', { points, fill });
      });
    }
  }

  function newPage(width: number, height: number): Element {
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    return el(document.body, 'svg', {
      xmlns: NS,
      width: `${width}pt`,
      height: `${height}pt`,
      viewBox: `0 0 ${width} ${height}`,
    });
  }

  if (input.kind === 'proof') {
    throw new Error('proof: Task 7');
  }

  const TRIM_W = 2592;
  const TRIM_H = 1728;
  const BLEED = 9;
  const SLUG = input.marks ? 36 : 0;
  const M = 108;
  const width = TRIM_W + 2 * (BLEED + SLUG);
  const height = TRIM_H + 2 * (BLEED + SLUG);
  const svg = newPage(width, height);
  const sheet = el(svg, 'g', { transform: `translate(${BLEED + SLUG},${BLEED + SLUG})` });
  el(sheet, 'rect', {
    x: -BLEED,
    y: -BLEED,
    width: TRIM_W + 2 * BLEED,
    height: TRIM_H + 2 * BLEED,
    fill: paper,
  });

  if (input.marks) {
    const LEN = 24;
    const attrs = { class: 'crop-mark', stroke: '#000', 'stroke-width': 0.25 };
    for (const cx of [0, TRIM_W]) {
      for (const cy of [0, TRIM_H]) {
        const dx = cx === 0 ? -1 : 1;
        const dy = cy === 0 ? -1 : 1;
        el(sheet, 'line', {
          ...attrs,
          x1: cx + dx * BLEED,
          x2: cx + dx * (BLEED + LEN),
          y1: cy,
          y2: cy,
        });
        el(sheet, 'line', {
          ...attrs,
          x1: cx,
          x2: cx,
          y1: cy + dy * BLEED,
          y2: cy + dy * (BLEED + LEN),
        });
      }
    }
  }

  const overflows: string[] = [];

  // The key, drawn with its top at the hairline; returns how tall it is.
  function drawKey(g: Element, key: Key): number {
    // A key with no title is rows alone, starting at the top.
    let top = 0;
    if (key.en) {
      const title = el(g, 'text', { y: 56, fill: ink });
      el(
        title,
        'tspan',
        { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 23 },
        rtl(key.he),
      );
      el(
        title,
        'tspan',
        { 'font-family': LATIN, 'font-weight': 600, 'font-size': 20, dx: 10 },
        key.en,
      );
      key.notes.forEach((note, i) =>
        el(
          g,
          'text',
          { y: 80 + i * 15, 'font-family': LATIN, 'font-size': 11, fill: inkSoft },
          note,
        ),
      );
      top = 80 + (key.notes.length - 1) * 15 + 27;
    }
    let x = 0;
    let bottom = top;
    key.columns.forEach((column, ci) => {
      // The occasion columns start 20 after the portion columns.
      if (ci > 0 && !column.heading && key.columns[ci - 1].heading) x += 20;
      let y = top;
      if (column.heading) {
        const h = el(g, 'text', { x, y, fill: ink });
        el(
          h,
          'tspan',
          { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 12.65 },
          rtl(column.heading.he),
        );
        el(
          h,
          'tspan',
          { 'font-family': LATIN, 'font-size': 11, dx: 5, fill: inkSoft },
          column.heading.en,
        );
        y += 8;
      }
      column.groups.forEach((group, gi) => {
        if (group.heading) {
          if (gi > 0) y += 21;
          el(
            g,
            'text',
            {
              x,
              y,
              'font-family': LATIN,
              'font-weight': 600,
              'font-size': 10,
              fill: inkSoft,
            },
            group.heading,
          );
        }
        for (const row of group.rows) {
          y += 15;
          el(g, 'rect', { x, y: y - 9, width: 9, height: 9, fill: row.swatch });
          const t = el(g, 'text', { x: x + 14, y, fill: ink });
          el(
            t,
            'tspan',
            { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 11.5 },
            rtl(row.he),
          );
          el(t, 'tspan', { 'font-family': LATIN, 'font-size': 10, dx: 4, fill: inkSoft }, row.en);
          if (row.note) {
            el(
              t,
              'tspan',
              { 'font-family': LATIN, 'font-size': 10, dx: 6, fill: inkSoft },
              row.note,
            );
          }
          const used =
            14 +
            measure(row.he, HEBREW, 11.5, 700) +
            4 +
            measure(row.en, LATIN, 10, 400) +
            (row.note ? 6 + measure(row.note, LATIN, 10, 400) : 0);
          if (used > column.width) overflows.push(row.en);
        }
      });
      bottom = Math.max(bottom, y);
      x += column.width;
    });
    return bottom + 6;
  }

  // Measure the key off-page first: its height decides how big the map can be.
  const probe = el(sheet, 'g', {});
  const keyHeight = drawKey(probe, input.key);
  probe.remove();
  overflows.length = 0;

  const minX = Math.min(...input.verses.map((v) => v.x));
  const minY = Math.min(...input.verses.map((v) => v.y));
  const mapW = Math.max(...input.verses.map((v) => v.x + v.side + 2)) - minX;
  const mapH = Math.max(...input.verses.map((v) => v.y + v.side + 2)) - minY;
  // A key placed under a book lives in the map's empty ground, so the map needs
  // no band below it and is centred on the sheet instead.
  const under = input.keyUnder ? input.books.find((b) => b.en === input.keyUnder) : undefined;
  if (input.keyUnder && !under)
    throw new Error(`No book named ${input.keyUnder} to set the key under.`);
  const band = under ? 0 : 50 + keyHeight;
  const scale = Math.min((TRIM_W - 2 * M - 50) / mapW, (TRIM_H - 2 * M - 34 - band) / mapH);
  const ox = (TRIM_W - mapW * scale - 50) / 2;
  const oy = M + 34 + (under ? (TRIM_H - 2 * M - 34 - mapH * scale) / 2 : 0);
  const map = el(sheet, 'g', {
    transform: `translate(${ox - minX * scale},${oy - minY * scale})`,
  });
  drawVerses(
    el(map, 'g', { class: 'verses', transform: `scale(${scale})` }),
    input.verses,
    input.bandOffset,
    input.growth,
  );

  for (const b of input.books) {
    const room = (b.maxX - b.minX) * scale;
    let heSize = 15;
    const t = el(map, 'text', {
      class: 'book-title',
      x: b.maxX * scale,
      y: b.minY * scale - 9,
      'text-anchor': 'end',
      fill: ink,
    });
    const he = el(
      t,
      'tspan',
      { 'font-family': HEBREW, 'font-weight': 700, 'font-size': heSize },
      rtl(b.he),
    );
    const en = el(
      t,
      'tspan',
      { 'font-family': LATIN, 'font-weight': 700, 'font-size': 13, dx: 5 },
      b.en,
    );
    if (measure(b.he, HEBREW, heSize, 700) + 5 + measure(b.en, LATIN, 13, 700) > room) {
      en.remove();
      while (measure(b.he, HEBREW, heSize, 700) > room && heSize > 9) heSize -= 0.5;
      he.setAttribute('font-size', String(heSize));
    }
  }

  for (const s of input.sections) {
    const t = el(map, 'text', {
      transform: `translate(${s.maxX * scale + 8},${s.minY * scale - 26}) rotate(90)`,
      fill: inkSoft,
    });
    el(t, 'tspan', { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 25.3 }, rtl(s.he));
    el(t, 'tspan', { 'font-family': LATIN, 'font-weight': 700, 'font-size': 22, dx: 8 }, s.en);
  }

  // The site's title artwork, recoloured for paper and without its shadow.
  const art = new DOMParser().parseFromString(input.logoSvg, 'image/svg+xml').documentElement;
  const box = art.getAttribute('viewBox')!.split(/\s+/).map(Number);
  const logoW = 929 * scale;
  const logo = el(map, 'g', {
    class: 'logo',
    transform:
      `translate(${((minX + input.torahMinX) / 2) * scale - logoW / 2},` +
      `${(input.torahTopY - 28) * scale}) scale(${logoW / box[2]})`,
    'font-family': HEBREW,
    'font-weight': 700,
  });
  const fills = [inkSoft, ink, inkSoft];
  [...art.querySelectorAll('text')].forEach((text, i) => {
    const copy = el(logo, 'text', {}, text.textContent ?? '');
    for (const a of ['x', 'y', 'text-anchor', 'font-size', 'letter-spacing']) {
      const v = text.getAttribute(a);
      if (v !== null) copy.setAttribute(a, v);
    }
    copy.setAttribute('fill', fills[i] ?? ink);
    if (text.getAttribute('font-family')?.startsWith('system-ui')) {
      copy.setAttribute('font-family', LATIN);
      copy.setAttribute('font-weight', '400');
    }
  });

  if (under) {
    drawKey(
      el(map, 'g', {
        class: 'key',
        transform: `translate(${under.minX * scale},${under.maxY * scale + 24})`,
      }),
      input.key,
    );
  } else {
    const hairlineY = oy + mapH * scale + 50;
    el(sheet, 'line', {
      x1: ox,
      x2: ox + mapW * scale + 50,
      y1: hairlineY,
      y2: hairlineY,
      stroke: inkSoft,
      'stroke-width': 0.75,
    });
    drawKey(
      el(sheet, 'g', { class: 'key', transform: `translate(${ox},${hairlineY})` }),
      input.key,
    );
  }

  el(
    sheet,
    'text',
    {
      x: TRIM_W - M,
      y: TRIM_H - 54,
      'text-anchor': 'end',
      'font-family': LATIN,
      'font-size': 9,
      fill: inkSoft,
    },
    input.credits,
  );

  return { svg: svg.outerHTML, width, height, scale, overflows };
}
