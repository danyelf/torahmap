"""Looks the VIS program's papers up on arXiv by title, and fetches the matches.

    uv run --no-project python -I scripts/ieeevis/arxiv.py lookup <vis dir>
    uv run --no-project python -I scripts/ieeevis/arxiv.py fetch <vis dir> pdf|source

<vis dir> holds program.json. Every response is cached under <vis dir>/arxiv/, so a rerun
fetches nothing twice. Requests go out at most one every 3 seconds, as arXiv asks.

lookup writes <vis dir>/arxiv/matches.json: for each program paper index, the accepted arXiv
entry, and the rejected near-misses with their title similarity and author overlap.
"""

import difflib
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

AGENT = 'torahmap-vis-map/0.1 (research spike; danyel-claude@users.noreply.github.com)'
PAUSE = 3.1
KINDS = ('Full VIS Paper', 'VIS Short Paper', 'TVCG Paper', 'CG&A Paper')
SIMILAR = 0.92  # title similarity to accept, after normalising
NEAR = 0.6  # similarity worth recording as a rejected near-miss

_last = 0.0


def get(url: str, cache: Path) -> bytes:
    """The response for `url`, from the cache if it was fetched before."""
    path = cache / hashlib.sha1(url.encode()).hexdigest()
    if path.exists():
        return path.read_bytes()
    global _last
    time.sleep(max(0.0, _last + PAUSE - time.time()))
    request = urllib.request.Request(url, headers={'User-Agent': AGENT})
    for attempt in range(3):
        try:
            _last = time.time()
            data = urllib.request.urlopen(request, timeout=60).read()
            break
        except Exception as e:  # noqa: BLE001
            print('retry', url, e, flush=True)
            time.sleep(60 * (attempt + 1))
    else:
        raise RuntimeError(url)
    path.write_bytes(data)
    return data


def norm(s: str) -> str:
    s = html.unescape(s).lower().replace('&', ' and ')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def last_names(authors: list[str]) -> set[str]:
    return {norm(a).split(' ')[-1] for a in authors if norm(a)}


def entries(feed: str) -> list[dict]:
    out = []
    for ent in re.findall(r'<entry>(.*?)</entry>', feed, re.S):
        id_ = re.search(r'<id>(.*?)</id>', ent)
        title = re.search(r'<title>(.*?)</title>', ent, re.S)
        if not id_ or not title:
            continue
        out.append(
            {
                'id': id_.group(1),
                'title': re.sub(r'\s+', ' ', html.unescape(title.group(1))),
                'authors': [html.unescape(a) for a in re.findall(r'<name>(.*?)</name>', ent)],
            }
        )
    return out


def lookup(vis: Path) -> None:
    program = json.loads((vis / 'program.json').read_text())
    cache = vis / 'arxiv' / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    result: dict[str, dict] = {}
    todo = [
        (i, p)
        for i, p in enumerate(program)
        if html.unescape(p['kind']) in KINDS or p['kind'].endswith('Workshop Paper')
    ]
    print(len(todo), 'titles to look up', flush=True)
    for n, (i, p) in enumerate(todo):
        title = html.unescape(p['title'])
        words = re.sub(r'[^A-Za-z0-9 ]+', ' ', title).split()
        query = 'ti:"' + ' '.join(words) + '"'
        url = 'https://export.arxiv.org/api/query?max_results=5&search_query=' + urllib.parse.quote(query)
        found = entries(get(url, cache).decode())
        mine = last_names(p['authors'])
        accepted, rejected = None, []
        for e in found:
            sim = difflib.SequenceMatcher(None, norm(title), norm(e['title'])).ratio()
            theirs = last_names(e['authors'])
            overlap = len(mine & theirs) / max(1, len(mine))
            row = {'arxiv': e['id'], 'title': e['title'], 'similarity': round(sim, 3), 'author_overlap': round(overlap, 2)}
            if sim >= SIMILAR and overlap >= 0.5 and accepted is None:
                accepted = row
            elif sim >= NEAR:
                rejected.append(row)
        result[str(i)] = {'title': title, 'kind': p['kind'], 'accepted': accepted, 'rejected': rejected}
        if n % 25 == 0:
            print(n, '/', len(todo), sum(1 for r in result.values() if r['accepted']), 'accepted', flush=True)
            (vis / 'arxiv' / 'matches.json').write_text(json.dumps(result, indent=1))
    (vis / 'arxiv' / 'matches.json').write_text(json.dumps(result, indent=1))
    print('done', sum(1 for r in result.values() if r['accepted']), 'accepted of', len(result))


def arxiv_id(url: str) -> str:
    return re.sub(r'^.*/abs/', '', url)


def fetch(vis: Path, what: str) -> None:
    matches = json.loads((vis / 'arxiv' / 'matches.json').read_text())
    cache = vis / 'arxiv' / 'cache'
    out = vis / 'arxiv' / what
    out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
    for i, m in matches.items():
        if not m['accepted'] or (only and i not in only):
            continue
        aid = arxiv_id(m['accepted']['arxiv'])
        base = re.sub(r'v\d+$', '', aid).replace('/', '_')
        target = out / (f'{i}.pdf' if what == 'pdf' else f'{i}.src')
        if target.exists():
            continue
        url = f'https://arxiv.org/{"pdf" if what == "pdf" else "e-print"}/{re.sub(r"v\d+$", "", aid)}'
        target.write_bytes(get(url, cache))
        print('fetched', i, base, target.stat().st_size, flush=True)


if __name__ == '__main__':
    cmd, vis = sys.argv[1], Path(sys.argv[2])
    lookup(vis) if cmd == 'lookup' else fetch(vis, sys.argv[3])
