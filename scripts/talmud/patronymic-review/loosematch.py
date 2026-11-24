"""For names with no exact Sefaria match, look for a person whose Hebrew name agrees once the vowel letters are dropped."""
import json
import re
import sys
from collections import defaultdict

S = sys.argv[1]
names = json.load(open(f'{S}/names.json'))
topics = json.load(open(f'{S}/all-topics.json'))

MARKS = re.compile('[֑-ׇ]')
TITLES = {'רב', 'רבי', "ר'", 'מר', 'רבן'}
LINKS = {'בר', 'בן', 'ברבי', 'בת', 'בריה', 'בירבי', 'בי'}


def skeleton(name):
    s = MARKS.sub('', name)
    s = re.sub(r'[?.,:;–—"\'()\[\]-]', ' ', s).replace('בריה ד', 'בר ')
    out = []
    for w in s.split():
        if w in TITLES or (len(w) > 2 and w[0] in 'ולדכבמש' and w[1:] in TITLES):
            continue
        if w in LINKS:
            out.append('בר')
            continue
        out.append(w[0] + re.sub('[ויאה]', '', w[1:]))
    return ' '.join(out)


by = defaultdict(set)
for slug, t in topics.items():
    for n in t['names']:
        if re.search('[א-ת]', n):
            k = skeleton(n)
            if ' בר ' in f' {k} ':
                by[k].add(slug)

found = {}
for o in names:
    k = skeleton(o['aramaic'])
    hits = by.get(k, set()) - {o['topic']}
    if hits:
        found[o['id']] = sorted(hits)
        if set(found[o['id']]) != set(filter(None, o['suggest'].split(', '))):
            print(o['id'], o['aramaic'], '|', o['topic'], '->', ', '.join(f"{h} ({topics[h].get('en')}, {topics[h].get('generation')})" for h in found[o['id']]))
json.dump(found, open(f'{S}/loose.json', 'w'), ensure_ascii=False)
