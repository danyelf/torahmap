// Draws a print from its input, as SVG in the page, where the real fonts can
// measure text. Playwright sends this function to the page as source text, so
// everything it uses is declared inside it.

import type { DrawResult, Key, ProofInput, SheetInput } from './types.ts';

export function draw(input: SheetInput | ProofInput): DrawResult {
  const NS = 'http://www.w3.org/2000/svg';
  const HEBREW = input.fonts.hebrew;
  const LATIN = input.fonts.latin;
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
    const W = 792;
    const H = 612;
    const P = 252; // each patch 3½ in square, at print scale
    const page = newPage(W, H);
    el(page, 'rect', { width: W, height: H, fill: paper });
    el(
      page,
      'text',
      { x: 36, y: 30, 'font-family': LATIN, 'font-size': 10, fill: ink },
      'Torahmap wall print · proof at full scale · colours as sent to the printer',
    );
    const defs = el(page, 'defs');
    input.patches.forEach((patch, i) => {
      const x = 36 + i * (P + 18);
      const y = 44;
      const g = el(page, 'g', { class: 'patch' });
      el(el(defs, 'clipPath', { id: `patch-${i}` }), 'rect', { x, y, width: P, height: P });
      const tx = x + P / 2 - patch.centre.x * input.scale;
      const ty = y + P / 2 - patch.centre.y * input.scale;
      drawVerses(
        el(el(g, 'g', { 'clip-path': `url(#patch-${i})` }), 'g', {
          class: 'verses',
          transform: `translate(${tx},${ty}) scale(${input.scale})`,
        }),
        patch.verses,
        input.bandOffset,
        input.growth,
      );
      el(g, 'rect', {
        x,
        y,
        width: P,
        height: P,
        fill: 'none',
        stroke: inkSoft,
        'stroke-width': 0.5,
      });
      el(
        g,
        'text',
        { x, y: y + P + 12, 'font-family': LATIN, 'font-size': 8, fill: inkSoft },
        patch.title,
      );
    });
    // The microtext patch, beside the others: the same verses three ways.
    const mt = input.microtext;
    const MX = 36 + input.patches.length * (P + 18);
    const MW = W - 36 - MX;
    const MH = 70;
    const VARIANTS: {
      name: string;
      square: boolean;
      word: (v: SheetInput['verses'][0]) => string;
    }[] = [
      { name: 'Letters in ink, on the colour', square: true, word: () => ink },
      { name: 'Letters in the colour, no square', square: false, word: (v) => v.fills[0] },
      { name: 'Letters in paper, out of the colour', square: true, word: () => paper },
    ];
    // Letters are drawn closer than the face sets them, and rows a letter's
    // height apart, so ascenders and descenders reach into the next row.
    const KERN = -0.08; // ems
    const BODY = (() => {
      if (!ctx) return 0.6;
      ctx.font = `700 100px "${HEBREW}"`;
      return ctx.measureText('ה').actualBoundingBoxAscent / 100;
    })();
    // A word broken into rows of nearly equal length, in the number of rows
    // that lets its letters be largest in a square of this side.
    const stack = (word: string, side: number) => {
      const letters = [...word];
      let best = { rows: [word], size: 0 };
      for (let n = 1; n <= letters.length; n++) {
        const rows = Array.from({ length: n }, (_, r) =>
          letters
            .slice(Math.round((r * letters.length) / n), Math.round(((r + 1) * letters.length) / n))
            .join(''),
        );
        const width = Math.max(
          ...rows.map(
            (row) => (measure(row, HEBREW, 100, 700) + KERN * 100 * (row.length - 1)) / 100,
          ),
        );
        const size = Math.min(side / width, side / (n * BODY));
        if (size > best.size) best = { rows, size };
      }
      return best;
    };
    const halfW = MW / 2 / input.scale;
    const halfH = MH / 2 / input.scale;
    const shown = mt.verses
      .map((v, i) => ({ v, word: mt.words[i] }))
      .filter(
        ({ v }) =>
          Math.abs(v.x - mt.centre.x) < halfW + v.side &&
          Math.abs(v.y - mt.centre.y) < halfH + v.side,
      );
    VARIANTS.forEach((variant, k) => {
      const y = 44 + k * (MH + 18);
      const g = el(page, 'g', { class: 'microtext' });
      el(el(defs, 'clipPath', { id: `microtext-${k}` }), 'rect', {
        x: MX,
        y,
        width: MW,
        height: MH,
      });
      const map = el(el(g, 'g', { 'clip-path': `url(#microtext-${k})` }), 'g', {
        transform:
          `translate(${MX + MW / 2 - mt.centre.x * input.scale},` +
          `${y + MH / 2 - mt.centre.y * input.scale}) scale(${input.scale})`,
      });
      if (variant.square) {
        drawVerses(
          el(map, 'g', { class: 'verses' }),
          shown.map(({ v }) => v),
          input.bandOffset,
          input.growth,
        );
      }
      for (const { v, word } of shown) {
        if (!word) continue;
        const block = stack(word, v.side);
        const g = el(map, 'g', {
          class: 'word',
          'text-anchor': 'middle',
          'font-family': HEBREW,
          'font-weight': 700,
          'font-size': block.size,
          'letter-spacing': KERN * block.size,
          fill: variant.word(v),
        });
        const top = v.y + (v.side - block.rows.length * BODY * block.size) / 2;
        block.rows.forEach((row, r) =>
          el(g, 'text', { x: v.x + v.side / 2, y: top + (r + 1) * BODY * block.size }, row),
        );
      }
      el(g, 'rect', {
        x: MX,
        y,
        width: MW,
        height: MH,
        fill: 'none',
        stroke: inkSoft,
        'stroke-width': 0.5,
      });
      el(
        g,
        'text',
        { x: MX, y: y + MH + 10, 'font-family': LATIN, 'font-size': 7, fill: inkSoft },
        `${mt.title} · ${variant.name}`,
      );
    });

    const COLS = 16;
    const CELL_W = (W - 72) / COLS;
    // A name too long for its cell loses letters to an ellipsis; the value,
    // which is what a printer is asked about, is always whole.
    const fit = (text: string, room: number) => {
      if (measure(text, LATIN, 5, 400) <= room) return text;
      let cut = text;
      while (cut.length > 1 && measure(`${cut}…`, LATIN, 5, 400) > room) cut = cut.slice(0, -1);
      return `${cut.trimEnd()}…`;
    };
    input.swatches.forEach((s, i) => {
      const x = 36 + (i % COLS) * CELL_W;
      const y = 44 + P + 30 + Math.floor(i / COLS) * 38;
      // Outlined, so the paper's own swatch shows against the paper.
      el(page, 'rect', {
        class: 'swatch',
        x,
        y,
        width: 16,
        height: 16,
        fill: s.fill,
        stroke: inkSoft,
        'stroke-width': 0.25,
      });
      const label = { x, 'font-family': LATIN, 'font-size': 5, fill: ink };
      el(page, 'text', { ...label, class: 'swatch-name', y: y + 23 }, fit(s.name, CELL_W - 3));
      el(page, 'text', { ...label, class: 'swatch-value', y: y + 29.5 }, s.value);
    });
    return { svg: page.outerHTML, width: W, height: H, scale: input.scale, overflows: [] };
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
        const k = key.scale ?? 1;
        for (const row of group.rows) {
          y += 15 * k;
          el(g, 'rect', { x, y: y - 9 * k, width: 9 * k, height: 9 * k, fill: row.swatch });
          const t = el(g, 'text', { x: x + 14 * k, y, fill: ink });
          el(
            t,
            'tspan',
            { 'font-family': HEBREW, 'font-weight': 700, 'font-size': 11.5 * k },
            rtl(row.he),
          );
          el(
            t,
            'tspan',
            { 'font-family': LATIN, 'font-size': 10 * k, dx: 4 * k, fill: inkSoft },
            row.en,
          );
          if (row.note) {
            el(
              t,
              'tspan',
              { 'font-family': LATIN, 'font-size': 10 * k, dx: 6 * k, fill: inkSoft },
              row.note,
            );
          }
          const used =
            (14 +
              measure(row.he, HEBREW, 11.5, 700) +
              4 +
              measure(row.en, LATIN, 10, 400) +
              (row.note ? 6 + measure(row.note, LATIN, 10, 400) : 0)) *
            k;
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
      copy.setAttribute('font-weight', '600');
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
