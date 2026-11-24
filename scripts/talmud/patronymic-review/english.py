"""For each suspect Aramaic tag, what the English translation and its tags say in the same passage."""
import json
import re
import sys
from collections import Counter, defaultdict

S, DATA = sys.argv[1], sys.argv[2]
rows = json.load(open(f'{S}/rows.json'))
facts = json.load(open(f'{S}/facts.json'))
structure = json.load(open(f'{DATA}/structure.json'))
cands = facts['candidates']

refs = {r['ref'] for r in rows}
en = defaultdict(list)
he_topics = defaultdict(set)
for m in facts['mentions']:
    if m['ref'] not in refs:
        continue
    if m['language'] == 'en':
        en[m['ref']].append(m)
    else:
        he_topics[m['ref']].add(m['topic'])

REF = re.compile(r'^(.+) (\d+)([ab]):(\d+)$')
texts = {}


def english(ref):
    name, daf, amud, seg = REF.match(ref).groups()
    tr = next(t for t in structure['tractates'] if t['name'] == name)
    if name not in texts:
        texts[name] = json.load(open(f'{DATA}/english/{name}.json'))
    i = next(i for i, a in enumerate(tr['amudim']) if a['daf'] == int(daf) and a['amud'] == amud)
    t = texts[name]
    t = t['amudim'] if isinstance(t, dict) else t
    return re.sub(r'[*_]', '', t[i][int(seg) - 1])


def clean(s):
    return re.sub(r'<[^>]*>', '', s or '')


SON = r'(?:,? (?:bar|ben|bat|berabbi|son of|the son of|daughter of) )'
HAS_SON = re.compile(SON)
# the patronymic after a name: up to four capitalised words
TAIL = re.compile(r'^(' + SON + r'(?:(?:Rabbi|Rav|Rabban|Mar|the) )?[A-ZḤ][\w’\'-]*(?: (?:bar|ben) [A-ZḤ][\w’\'-]*)?)')


def same(a, b):
    return a == b or b in cands.get(a, []) or a in cands.get(b, [])


out = []
for r in rows:
    t = r['topic']
    text = english(r['ref'])
    mine = [m for m in en[r['ref']] if same(m['topic'], t)]
    whole = [clean(m['text']) for m in mine if HAS_SON.search(clean(m['text']))]
    short = []
    for m in mine:
        name = clean(m['text'])
        for hit in re.finditer(re.escape(name), text):
            tail = TAIL.match(text[hit.end():])
            if tail:
                short.append(name + tail.group(1))
    others = [
        (m['topic'], clean(m['text']))
        for m in en[r['ref']]
        if not same(m['topic'], t) and m['topic'] not in he_topics[r['ref']] and HAS_SON.search(clean(m['text']))
    ]
    if whole:
        verdict = '1. English tag covers the whole name, same person'
        note = whole[0]
    elif others and not short:
        verdict = '2. English tags a different full-name person the Aramaic lacks'
        note = '; '.join(f'{n} [{s}]' for s, n in others)
    elif short:
        verdict = '3. English is cut short the same way'
        note = short[0] + ('   ALSO ' + '; '.join(f'{n} [{s}]' for s, n in others) if others else '')
    elif mine:
        verdict = '4. English tags the person, no patronymic follows in the English'
        note = clean(mine[0]['text'])
    else:
        verdict = '5. English does not tag this person here'
        note = ''
    out.append({**r, 'english': verdict, 'note': note})

json.dump(out, open(f'{S}/english-compare.json', 'w'), ensure_ascii=False, indent=1)

for kind in ('split', 'cut'):
    print(f'\n\n===== {kind}')
    table = Counter((o['group'][:2], o['english'][:2]) for o in out if o['kind'] == kind)
    gs = sorted({g for g, _ in table})
    es = sorted({e for _, e in table})
    print('group  ' + '  '.join(f'{e:>4}' for e in es))
    for g in gs:
        print(f'{g:5}  ' + '  '.join(f'{table[(g, e)]:4d}' for e in es))
    for e in sorted({o['english'] for o in out if o['kind'] == kind}):
        sel = [o for o in out if o['kind'] == kind and o['english'] == e]
        print(f'\n## {e}: {len(sel)}')
        c = Counter(f"{o['group'][:2]} {o['text']} [{o['topic']}]  =>  {o['note']}" for o in sel)
        for line, n in c.most_common(18):
            print(f'  {n:3d}  {line}')
