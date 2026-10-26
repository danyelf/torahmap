"""Writes <vis dir>/ledger.csv, one row per program paper, from what the searches have recorded.

    uv run --no-project python -I scripts/ieeevis/ledger.py <vis dir>

Reads program.json, arxiv/matches.json (arxiv.py lookup) and, when present, workshops/found.json
(paper index -> {page, url, similarity, note}: a paper found on a workshop's own page).
Run it after each stage; it only reads.
"""

import csv
import html
import json
import sys
from pathlib import Path

SEARCHED = ('Full VIS Paper', 'VIS Short Paper', 'TVCG Paper', 'CG&A Paper')
COLUMNS = [
    'index', 'type', 'title', 'arxiv_title_search', 'arxiv_author_search', 'workshop_page',
    'other', 'text_url', 'title_similarity', 'authors_in_common', 'note',
]


def load(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def main(vis: Path) -> None:
    program = json.loads((vis / 'program.json').read_text())
    arxiv = load(vis / 'arxiv' / 'matches.json')
    found = load(vis / 'workshops' / 'found.json')
    listed = load(vis / 'workshops' / 'listed.json')
    rows = []
    for i, p in enumerate(program):
        kind = html.unescape(p['kind'])
        row: dict[str, str | float] = dict.fromkeys(COLUMNS, '')
        row.update(index=str(i), type=kind, title=html.unescape(p['title']))
        workshop = kind.endswith('Workshop Paper')
        a = arxiv.get(str(i))
        w = found.get(str(i))
        if kind not in SEARCHED and not workshop:
            row.update(
                arxiv_title_search='skipped by type', workshop_page='skipped by type',
                note='skipped by type',
            )
        else:
            row['arxiv_author_search'] = 'not done'
            if a is None:
                row['arxiv_title_search'] = 'not yet searched'
            elif a['accepted']:
                acc = a['accepted']
                row.update(
                    arxiv_title_search='found', text_url=acc['arxiv'],
                    title_similarity=acc['similarity'], authors_in_common=acc['author_overlap'],
                )
            elif a['rejected']:
                best = max(a['rejected'], key=lambda r: r['similarity'])
                row.update(
                    arxiv_title_search='near miss',
                    title_similarity=best['similarity'], authors_in_common=best['author_overlap'],
                    note=f'rejected: {best["arxiv"]} "{best["title"]}"',
                )
            else:
                row['arxiv_title_search'] = 'not found'
            if workshop:
                row['workshop_page'] = (
                    f'linked: {w["page"]}' if w
                    else f'listed, no link: {listed[str(i)]}' if str(i) in listed
                    else 'looked, not listed' if found or listed else 'not yet searched'
                )
                if w and not row['text_url']:
                    row.update(
                        text_url=w['url'], title_similarity=w.get('similarity', ''),
                        note=w.get('note', ''),
                    )
            else:
                row['workshop_page'] = 'n/a'
        rows.append(row)
    with (vis / 'ledger.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
    print(len(rows), 'rows')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
