"""Write the review sheet as CSV: one line per name, with the first-pass call beside it."""
import csv
import json
import sys
from pathlib import Path

S = sys.argv[1]
names = json.load(open(f'{S}/names.json'))
topics = json.load(open(f'{S}/all-topics.json'))

CALL = {
    'R': 'Right',
    'O': 'Other person',
    'N': 'Other person, not in Sefaria',
    'X': 'Not a patronymic',
    'U': 'Cannot say',
}
calls = {}
for line in open(Path(__file__).parent / 'verdicts.txt'):
    if line.startswith('#') or not line.strip():
        continue
    i, call, person, sure, note = line.rstrip('\n').split('|', 4)
    calls[int(i)] = (call, person, sure, note)


def person(slug):
    t = topics.get(slug)
    if not t:
        raise SystemExit(f'no such person: {slug}')
    label = t.get('en') or slug
    return f"{label} ({t['generation']})" if t.get('generation') else label


rows = []
for o in names:
    if o['id'] in calls:
        call, slug, sure, note = calls[o['id']]
    elif o['group'] == 'A':
        call, slug, sure, note = 'R', '', 'sure', ''
    else:
        raise SystemExit(f"no call for {o['id']} {o['aramaic']}")
    rows.append({
        'order': (0 if sure == 'unsure' else 1 if call in 'ON' else 2, -o['count']),
        '#': o['id'],
        'Aramaic': o['aramaic'],
        'English': o['english'],
        'Passages': o['count'],
        'Tagged now': o['taggedAs'],
        "Claude's call": CALL[call],
        'Suggested person': person(slug) if slug else '',
        'Sure?': sure,
        "Claude's note": note,
        'Your decision': '',
        'Your person or note': '',
        'Example': o['ref'],
        'Aramaic context': o['aramaicContext'],
        'English context': o['englishContext'] or '',
        'Sefaria': 'https://www.sefaria.org/' + o['ref'].replace(' ', '_').replace(':', '.'),
        'Tag id': o['topic'],
        'Suggested id': slug,
        "Father's tag": o['second'],
        'Every passage': o['refs'],
    })
rows.sort(key=lambda r: r.pop('order'))
with open(f'{S}/patronymic-review.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0]))
    w.writeheader()
    w.writerows(rows)

from collections import Counter

print(len(rows), 'lines')
for (c, s), n in sorted(Counter((r["Claude's call"], r['Sure?']) for r in rows).items()):
    print(f'{n:4d}  {c}, {s}')
print(sum(r['Passages'] for r in rows), 'passages')
