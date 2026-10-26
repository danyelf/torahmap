"""Finds the program's workshop papers on the workshops' own pages.

    uv run --no-project python -I scripts/ieeevis/workshops.py <vis dir>

Reads the pages page.py cached (listed in <vis dir>/workshops/pages.json: workshop kind ->
[page urls]) and writes <vis dir>/workshops/found.json (paper index -> the page it was found on,
the link to its text and the title similarity) and <vis dir>/workshops.csv (one row per workshop).
A paper counts as linked when a link's text matches its title at SIMILAR or better; as listed
when its title appears in a page's text without a link.
"""

import csv
import difflib
import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from page import fetch, text_and_links  # noqa: E402

SIMILAR = 0.92


def norm(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', html.unescape(s).lower().replace('&', ' and ')).strip()


def main(vis: Path) -> None:
    program = json.loads((vis / 'program.json').read_text())
    pages = json.loads((vis / 'workshops' / 'pages.json').read_text())
    found: dict[str, dict] = {}
    listed_all: dict[str, str] = {}
    rows = []
    for kind, urls in pages.items():
        papers = [(i, html.unescape(p['title'])) for i, p in enumerate(program) if p['kind'] == kind]
        linked: set[int] = set()
        listed: set[int] = set()
        for url in urls:
            text, links = text_and_links(fetch(vis, url), url)
            flat = norm(text)
            anchors = [(norm(t), h) for t, h in links if t]
            for i, title in papers:
                if norm(title) in flat:
                    listed.add(i)
                    listed_all.setdefault(str(i), url)
                best = max(
                    ((difflib.SequenceMatcher(None, norm(title), t).ratio(), h) for t, h in anchors),
                    default=(0.0, ''),
                )
                if best[0] >= SIMILAR and i not in linked and not best[1].startswith(url + '#'):
                    linked.add(i)
                    found[str(i)] = {
                        'page': url,
                        'url': best[1],
                        'similarity': round(best[0], 3),
                        'note': f'linked from {url}',
                    }
        rows.append(
            {
                'workshop': kind.removesuffix(' Workshop Paper'),
                'pages': ' '.join(urls),
                'papers_in_program': len(papers),
                'listed_on_pages': len(listed | linked),
                'linked': len(linked),
                'with_text': '',
            }
        )
    (vis / 'workshops' / 'found.json').write_text(json.dumps(found, indent=1))
    (vis / 'workshops' / 'listed.json').write_text(json.dumps(listed_all, indent=1))
    with (vis / 'workshops.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    for r in rows:
        print(r['workshop'], r['papers_in_program'], r['listed_on_pages'], r['linked'])


if __name__ == '__main__':
    main(Path(sys.argv[1]))
