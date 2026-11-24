"""Add the words either side of each name, in the Aramaic and in the English, to english-compare.json."""
import json
import re
import sys
from collections import Counter

S, DATA = sys.argv[1], sys.argv[2]
WORDS = 7
rows = json.load(open(f'{S}/english-compare.json'))
structure = json.load(open(f'{DATA}/structure.json'))

MARKS = re.compile('[֑-ׇ]')
REF = re.compile(r'^(.+) (\d+)([ab]):(\d+)$')
files = {}


def segment(folder, ref):
    name, daf, amud, seg = REF.match(ref).groups()
    if (folder, name) not in files:
        t = json.load(open(f'{DATA}/{folder}/{name}.json'))
        files[(folder, name)] = t['amudim'] if isinstance(t, dict) else t
    tr = next(t for t in structure['tractates'] if t['name'] == name)
    i = next(i for i, a in enumerate(tr['amudim']) if a['daf'] == int(daf) and a['amud'] == amud)
    return files[(folder, name)][i][int(seg) - 1]


def around(line, name, nth):
    """The nth place the name stands in the line, in brackets, with the words either side."""
    hits = [m.start() for m in re.finditer(re.escape(name), line)]
    if not hits:
        return None
    at = hits[min(nth, len(hits) - 1)]
    before = line[:at].split()[-WORDS:]
    after = line[at + len(name):].split()[:WORDS]
    return ' '.join([*before, f'[{name}]', *after])


seen = Counter()
missing = 0
for r in rows:
    nth = seen[(r['ref'], r['text'])]
    seen[(r['ref'], r['text'])] += 1

    he = MARKS.sub('', segment('texts', r['ref'])).replace('״', '"').replace('׳', "'")
    he = ' '.join(he.split())
    r['aramaicContext'] = around(he, ' '.join(r['text'].split()), nth)

    en = ' '.join(re.sub(r'[*_]', '', segment('english', r['ref'])).split())
    name = r['note'].split('   ALSO')[0].split(' [')[0]
    nth_en = seen[(r["ref"], "en", name)]
    seen[(r["ref"], "en", name)] += 1
    r["englishContext"] = around(en, name, nth_en) if name else None
    missing += r['aramaicContext'] is None

json.dump(rows, open(f'{S}/english-compare.json', 'w'), ensure_ascii=False, indent=1)
print(len(rows), 'rows;', missing, 'without Aramaic context;', sum(r['englishContext'] is None for r in rows), 'without English context')
