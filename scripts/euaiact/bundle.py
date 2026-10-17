"""Write the AI Act's shipped data, public/data/euaiact/, from the parsed Act in experiments/eu-ai-act/.

    python3 -I scripts/euaiact/bundle.py

structure.json holds the layout's shape without any text; texts.json maps each square's id to its
text; refs.json lists who cites whom. Ids: Recital.12; an article unit as cited (6, 6(2), 5(1)(h));
an annex unit Annex.III.<part>.<n>.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'experiments' / 'eu-ai-act'
OUT = ROOT / 'public' / 'data' / 'euaiact'
# Chapters drawn as one column per section, being too long for one.
SPLIT = ('III', 'IX')


def leaves(item, uid):
    for p in item.get('points', []):
        pid = f"{uid}({p['label'].strip('()')})"
        yield p, pid
        yield from leaves(p, pid)


class Ordinal:
    """Annex paragraphs carry no labels the Act cites, so they are counted."""

    def __init__(self, prefix):
        self.prefix, self.n = prefix, 0

    def next(self):
        self.n += 1
        return f'{self.prefix}.{self.n}'


def group(p, uid, ordinal, texts):
    def cell(item, cited_as):
        cell_id = ordinal.next() if ordinal else cited_as
        texts[cell_id] = item['text']
        return {'id': cell_id, 'origin': item['origin']}

    if not p.get('points'):
        return {'kind': 'plain', 'cell': cell(p, uid)}
    lead = cell(p, uid) if p.get('text') else None
    return {'kind': 'list', 'lead': lead, 'points': [cell(q, qid) for q, qid in leaves(p, uid)]}


def article(a, texts):
    groups = []
    for p in a['paragraphs']:
        uid = f"{a['number']}({p['label']})" if p['label'] else a['number']
        groups.append(group(p, uid, None, texts))
    return {'number': a['number'], 'groups': groups}


def chapter(ch, texts):
    runs = [[article(a, texts) for a in s['articles']] for s in ch['sections']]
    if ch['number'] in SPLIT:
        columns = [{'label': f"Section {s['number']}", 'runs': [run]}
                   for s, run in zip(ch['sections'], runs)]
    else:
        columns = [{'label': None, 'runs': runs}]
    return {'number': ch['number'], 'columns': columns}


def annex(x, texts):
    blocks = []
    for i, part in enumerate(x['parts'], 1):
        ordinal = Ordinal(f"Annex.{x['number']}.{i}")
        blocks.append({'number': str(i),
                       'groups': [group(p, None, ordinal, texts) for p in part['paragraphs']]})
    return {'number': x['number'], 'blocks': blocks}


def main():
    act = json.loads((SOURCE / 'ai-act.json').read_text(encoding='utf-8'))
    refs = json.loads((SOURCE / 'refs.json').read_text(encoding='utf-8'))
    texts = {}
    for n, r in enumerate(act['recitals'], 1):
        assert r['number'] == str(n), f"recital {n} is numbered {r['number']}"
        texts[f'Recital.{n}'] = r['text']
    structure = {
        'recitals': len(act['recitals']),
        'chapters': [chapter(ch, texts) for ch in act['chapters']],
        'annexes': [annex(x, texts) for x in act['annexes']],
    }
    pairs = sorted({(r['from'], r['to']) for r in refs})
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (('structure', structure), ('texts', texts), ('refs', [list(p) for p in pairs])):
        text = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
        (OUT / f'{name}.json').write_text(text + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
