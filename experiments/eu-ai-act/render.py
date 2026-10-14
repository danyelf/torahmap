"""Draw the AI Act map as SVG: recitals, then articles, then annexes.

    python3 -I experiments/eu-ai-act/render.py out.svg              # coloured by amendment
    python3 -I experiments/eu-ai-act/render.py out.svg --focus 6    # what Article 6 cites, and what cites it

Articles stand in chapter columns, eight squares wide; Chapters III and IX split into one column
per section. A square is a plain paragraph, a list's lead-in, or one point. Plain paragraphs
flow along a line; a list starts a new line with its lead-in, its points wrapped beneath.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
S = 6
W = 8
ARTICLE_GAP = 1 * S
SECTION_GAP = 3 * S
SPLIT_GAP = 2 * S
CHAPTER_GAP = 6 * S
LAYER_GAP = 12 * S
SPLIT = ('III', 'IX')
RECITALS_PER_LINE = 50

AMENDED = {'B': '#9aa3ad', 'M1 inserted': '#e8833a', 'M1 replaced': '#e6c229'}
AMENDED_LEAD = {'B': '#4f5963', 'M1 inserted': '#b85a17', 'M1 replaced': '#b39410'}
ANNEX, ANNEX_LEAD = '#5b8fc9', '#2a5a92'
RECITAL = '#b9a27a'
QUIET, FOCUS, CITES, CITED_BY = '#dcdfe3', '#1f2933', '#1b9e77', '#c2257a'


def leaves(item, uid):
    for p in item.get('points', []):
        pid = f"{uid}({p['label'].strip('()')})"
        yield p, pid
        yield from leaves(p, pid)


def block(paragraphs, article):
    """(col, row, item, uid, is_lead) for one article or annex part, and its height in rows."""
    cells, row, col = [], 0, 0
    for p in paragraphs:
        uid = f"{article}({p['label']})" if p['label'] and article else article
        if not p.get('points'):
            if col >= W:
                row, col = row + 1, 0
            cells.append((col, row, p, uid, False))
            col += 1
            continue
        if col:
            row, col = row + 1, 0
        if p.get('text'):
            cells.append((0, row, p, uid, True))
            row += 1
        pts = list(leaves(p, uid))
        for i, (q, qid) in enumerate(pts):
            cells.append((1 + i % (W - 1), row + i // (W - 1), q, qid, False))
        row += (len(pts) - 1) // (W - 1) + 1
    return cells, row + (1 if col else 0)


class Map:
    def __init__(self, color):
        self.color = color  # (kind, item, uid, is_lead, owner) -> fill
        self.rects, self.labels = [], []

    def column(self, blocks, x0, y0, kind, breaks=()):
        y = y0
        for i, (owner, paragraphs) in enumerate(blocks):
            if i in breaks:
                y += SECTION_GAP
            cells, rows = block(paragraphs, owner if kind == 'article' else None)
            for c, r, item, uid, lead in cells:
                self.rects.append((x0 + c * S, y + r * S, 1,
                                   self.color(kind, item, uid or owner, lead, owner)))
            y += rows * S + ARTICLE_GAP
        return y

    def label(self, x, y, t, size=9, fill='#222'):
        self.labels.append((x, y, t, size, fill))

    def svg(self):
        w = max(r[0] + r[2] * S for r in self.rects) + 40
        h = max(r[1] for r in self.rects) + 40
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}">',
               f'<rect width="{w}" height="{h}" fill="#fbfaf7"/>', '<g transform="translate(20,20)">']
        out += [f'<rect x="{x}" y="{y}" width="{n * S - 1}" height="{S - 1}" fill="{c}"/>'
                for x, y, n, c in self.rects]
        out += [f'<text x="{x}" y="{y}" font-family="Helvetica" font-size="{z}" fill="{c}">{t}</text>'
                for x, y, t, z, c in self.labels]
        out.append('</g></svg>')
        return '\n'.join(out)


def articles(m, act, y0):
    x, bottom = 0, y0
    for ch in act['chapters']:
        m.label(x, y0 - 4, f"Ch {ch['number']}")
        if ch['number'] in SPLIT:
            for s in ch['sections']:
                m.label(x, y0 + 8, f"§{s['number']}", 7, '#888')
                bottom = max(bottom, m.column([(a['number'], a['paragraphs']) for a in s['articles']],
                                              x, y0 + 14, 'article'))
                x += W * S + SPLIT_GAP
            x += CHAPTER_GAP - SPLIT_GAP
        else:
            arts, breaks = [], set()
            for i, s in enumerate(ch['sections']):
                if i:
                    breaks.add(len(arts))
                arts += [(a['number'], a['paragraphs']) for a in s['articles']]
            bottom = max(bottom, m.column(arts, x, y0 + 4, 'article', breaks))
            x += W * S + CHAPTER_GAP
    return bottom


def annexes(m, act, y0):
    x = 0
    for anx in act['annexes']:
        m.label(x, y0 - 4, f"Annex {anx['number']}", 8, ANNEX_LEAD)
        name = f"Annex {anx['number']}"
        m.column([(name, p['paragraphs']) for p in anx['parts']], x, y0 + 4, 'annex')
        x += W * S + CHAPTER_GAP


def recitals(m, act, y0, fill):
    n = len(act['recitals'])
    m.label(0, y0 - 4, f'Recitals (1–{n})', 9, '#8a7449')
    for i in range(n):
        m.rects.append(((i % RECITALS_PER_LINE) * 2 * S, y0 + 4 + (i // RECITALS_PER_LINE) * S, 2, fill))
    return y0 + 4 + ((n - 1) // RECITALS_PER_LINE + 1) * S


def amendment_colors(kind, item, uid, lead, owner):
    if kind == 'annex':
        return ANNEX_LEAD if lead else ANNEX
    return (AMENDED_LEAD if lead else AMENDED)[item['origin']]


def focus_colors(article, refs):
    """Colour the focus article, the units it cites, and the units that cite it."""
    def inside(uid, target):
        return uid == target or uid.startswith(target + '(')

    def mine(uid):
        return uid.split('(')[0] == article

    cites = {r['to'] for r in refs if mine(r['from']) and not mine(r['to'])}
    cited_by = {r['from'] for r in refs if mine(r['to']) and not mine(r['from'])}

    def color(kind, item, uid, lead, owner):
        if kind == 'annex':
            return CITES if owner in cites else QUIET
        if mine(uid):
            return FOCUS
        if any(inside(uid, t) for t in cites):
            return CITES
        if any(inside(uid, f) or inside(f, uid) and lead for f in cited_by):
            return CITED_BY
        return QUIET
    return color


def main(out, focus=None):
    act = json.loads((HERE / 'ai-act.json').read_text(encoding='utf-8'))
    if focus:
        refs = json.loads((HERE / 'refs.json').read_text(encoding='utf-8'))
        m, recital_fill = Map(focus_colors(focus, refs)), QUIET
    else:
        m, recital_fill = Map(amendment_colors), RECITAL
    y = recitals(m, act, 12, recital_fill) + LAYER_GAP
    y = articles(m, act, y)
    annexes(m, act, y + LAYER_GAP)
    Path(out).write_text(m.svg(), encoding='utf-8')


if __name__ == '__main__':
    args = sys.argv[1:]
    main(args[0], args[2] if len(args) > 2 and args[1] == '--focus' else None)
