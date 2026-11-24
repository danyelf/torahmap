"""One line per distinct name and current tag, from english-compare.json, for the review sheet."""
import json
import re
import sys
from collections import defaultdict

S = sys.argv[1]
rows = json.load(open(f'{S}/english-compare.json'))
topics = json.load(open(f'{S}/all-topics.json'))
cands = json.load(open(f'{S}/facts.json'))['candidates']

PREFIX = 'ולדכבמש'
TITLES = {'רב', 'רבי', 'רבן', 'מר'}


def aramaic(r):
    """The name as written, without a leading prefix letter or the words the report kept after it."""
    ws = re.sub(r'[?.,:;–—"]', ' ', r['text']).split()
    if r['kind'] == 'cut':
        # name, link word, then one word of father (two when the first is a title)
        for i, w in enumerate(ws):
            if w in ('בר', 'בן', 'בריה', 'ברבי', 'בת') and i > 0:
                n = 2 if i + 1 < len(ws) and (ws[i + 1] in TITLES or ws[i + 1][1:] in TITLES) else 1
                ws = ws[: i + 1 + n]
                break
    if ws and len(ws[0]) > 2 and ws[0][0] in PREFIX and (ws[0][1:] in TITLES or len(ws) > 1):
        bare = ws[0][1:]
        if bare in TITLES:
            ws[0] = bare
    return ' '.join(ws)


def person(slug):
    t = topics.get(slug)
    if not t:
        return slug
    gen = t.get('generation') or '/'.join(sorted({topics[c].get('generation') or '?' for c in cands.get(slug, []) if c in topics})) or ''
    return f"{t.get('en') or slug}" + (f' ({gen})' if gen else '')


groups = defaultdict(list)
for r in rows:
    en = r['note'].split('   ALSO')[0].split(' [')[0] if r['english'][0] in '13' else ''
    groups[(en or aramaic(r), r['topic'])].append(r)

out = []
for (name, topic), rs in groups.items():
    r = rs[0]
    out.append({
        'id': len(out) + 1,
        'english': name if r['english'][0] in '13' else '',
        'aramaic': aramaic(r),
        'count': len(rs),
        'kind': '/'.join(sorted({x['kind'] for x in rs})),
        'topic': topic,
        'taggedAs': person(topic),
        'second': r.get('second', ''),
        'suggest': ', '.join(r['full']),
        'group': '/'.join(sorted({x['group'][:1] for x in rs})),
        'eng': '/'.join(sorted({x['english'][:1] for x in rs})),
        'ref': r['ref'],
        'aramaicContext': r['aramaicContext'],
        'englishContext': r['englishContext'],
        'refs': '; '.join(sorted({x['ref'] for x in rs})),
    })
out.sort(key=lambda o: (-o['count'], o['english'] or o['aramaic']))
for i, o in enumerate(out):
    o['id'] = i + 1
json.dump(out, open(f'{S}/names.json', 'w'), ensure_ascii=False, indent=1)
print(len(out), 'names')
for o in out:
    print('\t'.join(str(o[k]) for k in ('id', 'count', 'kind', 'group', 'eng', 'english', 'aramaic', 'topic', 'taggedAs', 'second', 'suggest')))
