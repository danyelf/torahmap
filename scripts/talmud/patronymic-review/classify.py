"""Sort the report's split pairs and cut-short tags by what Sefaria's own data says about them."""
import json
import re
import sys
from collections import Counter, defaultdict

S = sys.argv[1]
report = json.load(open(f'{S}/patronymic-report.json'))
topics = json.load(open(f'{S}/all-topics.json'))
facts = json.load(open(f'{S}/facts.json'))
family = json.load(open(f'{S}/family.json'))
cands = facts['candidates']

MARKS = re.compile('[֑-ׇ]')
TITLES = {'רב', 'רבי', "ר'", 'מר', 'רבן', 'רבה'} - {'רבה'}
LINKS = {'בר', 'בן', 'ברבי', 'בת', 'בריה'}
PREFIX = 'ולדכבמש'


def words(name):
    s = MARKS.sub('', name).replace('״', '"').replace('׳', "'")
    s = re.sub(r'[?.,:;–—\-]', ' ', s)
    s = s.replace('בריה ד', 'בר ').replace('ברה ד', 'בר ')
    out = []
    for i, w in enumerate(s.split()):
        # a prefix letter on a title or on the first word: לרבי, דרב, ורבי
        if len(w) > 2 and w[0] in PREFIX and w[1:] in TITLES:
            continue
        if w in TITLES:
            continue
        out.append('בר' if w in LINKS else w)
    return out


def key(name):
    return ' '.join(words(name))


def loose(k):
    """Spelling: final aleph or he, and the yod/vav fillers."""
    return ' '.join(re.sub('[אה]$', 'ה', w) for w in k.split())


def slugs(slug):
    return [slug, *cands.get(slug, [])]


def names(slug):
    return {loose(key(n)) for s in slugs(slug) for n in topics.get(s, {}).get('names', []) if re.search('[א-ת]', n)}


def fathers(slug):
    """What follows the first "bar" in each of the person's own names."""
    out = set()
    for n in names(slug):
        ws = n.split()
        if 'בר' in ws[1:]:
            i = ws.index('בר', 1)
            if i + 1 < len(ws):
                out.add(ws[i + 1])
    return out


def dated(slug):
    return any(topics.get(s, {}).get('generation') for s in slugs(slug))


child_of = defaultdict(set)
for l in family:
    if l['type'] == 'child-of':
        child_of[l['from']].add(l['to'])

by_full = defaultdict(set)
for slug, t in topics.items():
    for n in t['names']:
        if re.search('[א-ת]', n):
            k = loose(key(n))
            if ' בר ' in f' {k} ':
                by_full[k].add(slug)


def full_person(text_key):
    """People whose name is the text, or the text's start."""
    ws = text_key.split()
    hits = set()
    for n in range(len(ws), 2, -1):
        hits |= by_full.get(' '.join(ws[:n]), set())
        if hits:
            break
    return hits


def show(title, rows, n=8):
    print(f'\n## {title}: {len(rows)}')
    c = Counter(rows)
    for r, k in c.most_common(n):
        print(f'  {k:3d}  {r}')


ROWS = []
# ---- split pairs
groups = defaultdict(list)
for s in report['splits']:
    x, y = s['first'], s['second']
    tk = loose(key(s['text']))
    full = full_person(tk)
    xs, ys = set(slugs(x)), set(slugs(y))
    row = f"{s['text']}  [{x} + {y}]"
    if any(ys & child_of[a] for a in xs):
        g = 'A. Sefaria records first as child of second'
    elif full & xs:
        g = 'A2. first tag is already the full-name person'
    elif full:
        g = 'B. another person carries the full name'
        row += f"  -> {','.join(sorted(full))}"
    elif fathers(x) and not (fathers(x) & set(tk.split())):
        g = 'C. first person has a different father in his own names'
    else:
        g = f"D. nothing to go on; first {'dated' if dated(x) else 'undated'}, second {'dated' if dated(y) else 'undated'}"
    ROWS.append(dict(kind="split", group=g, ref=s["ref"], topic=x, second=y, text=s["text"], full=sorted(full)))
    groups[g].append(row)
print('# SPLIT PAIRS', len(report['splits']))
for g in sorted(groups):
    show(g, groups[g], 12)

# ---- cut-short tags
groups = defaultdict(list)
for c in report['cutShort']:
    t = c['topic']
    tk = loose(key(c['text']))
    ws = tk.split()
    row = f"{c['text']}  [{t}]"
    full = full_person(tk)
    own = [n for n in names(t) if ' בר ' in f' {n} ' and (tk == n or tk.startswith(n + ' '))]
    after = ws[ws.index('בר') + 1] if 'בר' in ws and ws.index('בר') + 1 < len(ws) else ''
    if after in ('אחתיה', 'אחתה', 'ברתיה', 'אחוה', 'אחיו', 'אחותו'):
        g = '0. not a patronymic ("son of his sister")'
    elif own or full & set(slugs(t)):
        g = 'A. the tagged person carries this patronymic'
    elif full:
        g = 'B. another person carries the full name'
        row += f"  -> {','.join(sorted(full))}"
    elif fathers(t) and after not in fathers(t):
        g = 'C. tagged person has a different father in his own names'
    else:
        g = f"D. nothing to go on; tagged person {'dated' if dated(t) else 'undated'}"
    ROWS.append(dict(kind="cut", group=g, ref=c["ref"], topic=t, text=c["text"], full=sorted(full)))
    groups[g].append(row)
print('\n\n# CUT-SHORT TAGS', len(report['cutShort']))
for g in sorted(groups):
    show(g, groups[g], 14)
json.dump(ROWS, open(f"{S}/rows.json", "w"), ensure_ascii=False)
