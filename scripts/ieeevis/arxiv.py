"""Looks the VIS program's papers up on arXiv by title, and fetches the matches.

    uv run --no-project python -I scripts/ieeevis/arxiv.py lookup <vis dir> [batches]
    uv run --no-project python -I scripts/ieeevis/arxiv.py fetch <vis dir> pdf|source

<vis dir> holds program.json. Every response is cached under <vis dir>/arxiv/, so a rerun
fetches nothing twice. Requests go out one at a time, searches 10 seconds apart (arXiv's
terms of use ask for at least 3) and downloads 2 minutes apart. Downloads 10 s apart were
refused at the third; 2 minutes apart, at the 22nd, after about 150 MB in 42 minutes. The
first refused or failed request stops the run, saving a refusal's headers and body under
<vis dir>/arxiv/refusals/: arXiv may block a client that keeps asking after a refusal.

lookup keeps <vis dir>/arxiv/matches.json: for each program paper index, its status ('to
search', 'searched' or 'failed') and, once searched, the accepted arXiv entry and the rejected
near-misses with their title similarity and author overlap. A rerun searches only what is not
yet 'searched', BATCH titles to a request; `batches` caps how many requests it sends.
"""

import difflib
import hashlib
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

AGENT = 'torahmap-vis-map/0.1 (research spike; danyel-claude@users.noreply.github.com)'
PAUSE = 10
FETCH_PAUSE = 120
KINDS = ('Full VIS Paper', 'VIS Short Paper', 'TVCG Paper', 'CG&A Paper')
SIMILAR = 0.92  # title similarity to accept, after normalising
NEAR = 0.6  # similarity worth recording as a rejected near-miss
BATCH = 20  # titles joined with OR into one search
BATCH_RESULTS = 200

_last = 0.0


def get(url: str, cache: Path, pause: float = PAUSE) -> bytes:
    """The response for `url`, from the cache if it was fetched before."""
    path = cache / hashlib.sha1(url.encode()).hexdigest()
    if path.exists():
        return path.read_bytes()
    global _last
    time.sleep(max(0.0, _last + pause - time.time()))
    request = urllib.request.Request(url, headers={'User-Agent': AGENT})
    _last = time.time()
    try:
        data = urllib.request.urlopen(request, timeout=240).read()
    except urllib.error.HTTPError as e:
        # The headers may say when to come back (Retry-After) and the body what the limit is.
        refused = cache.parent / 'refusals' / f'{time.strftime("%Y%m%dT%H%M%S")}.txt'
        refused.parent.mkdir(exist_ok=True)
        refused.write_text(f'{url}\n{e.code} {e.reason}\n\n{e.headers}\n{e.read().decode(errors="replace")}')
        print('refusal saved to', refused, flush=True)
        raise
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


def candidates(program: list[dict]) -> list[tuple[int, dict]]:
    return [
        (i, p)
        for i, p in enumerate(program)
        if html.unescape(p['kind']) in KINDS or p['kind'].endswith('Workshop Paper')
    ]


def judge(p: dict, found: list[dict]) -> dict:
    """The accepted arXiv entry among `found` for program paper `p`, and the rejected near-misses."""
    title = html.unescape(p['title'])
    mine = last_names(p['authors'])
    accepted, rejected = None, []
    for e in found:
        sim = difflib.SequenceMatcher(None, norm(title), norm(e['title'])).ratio()
        overlap = len(mine & last_names(e['authors'])) / max(1, len(mine))
        row = {'arxiv': e['id'], 'title': e['title'], 'similarity': round(sim, 3), 'author_overlap': round(overlap, 2)}
        if sim >= SIMILAR and overlap >= 0.5 and accepted is None:
            accepted = row
        elif sim >= NEAR:
            rejected.append(row)
    return {'title': title, 'kind': p['kind'], 'accepted': accepted, 'rejected': rejected}


def phrase(p: dict) -> str:
    words = re.sub(r'[^A-Za-z0-9 ]+', ' ', html.unescape(p['title'])).split()
    return 'ti:"' + ' '.join(words) + '"'


def lookup(vis: Path, batches: int | None) -> None:
    """Searches arXiv for the program papers' titles not yet searched, stopping at the first failure."""
    program = json.loads((vis / 'program.json').read_text())
    cache = vis / 'arxiv' / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    out = vis / 'arxiv' / 'matches.json'
    result: dict[str, dict] = json.loads(out.read_text()) if out.exists() else {}
    papers = candidates(program)
    for i, p in papers:
        result.setdefault(str(i), {'title': html.unescape(p['title']), 'kind': p['kind'], 'status': 'to search'})
    left = [(i, p) for i, p in papers if result[str(i)]['status'] != 'searched']
    groups = [left[k : k + BATCH] for k in range(0, len(left), BATCH)][:batches]
    print(len(left), 'titles to search;', len(groups), 'requests this run', flush=True)
    for group in groups:
        query = ' OR '.join(phrase(p) for _, p in group)
        url = f'https://export.arxiv.org/api/query?max_results={BATCH_RESULTS}&search_query=' + urllib.parse.quote(query)
        try:
            found = entries(get(url, cache).decode())
        except Exception as e:  # noqa: BLE001
            for i, _ in group:
                result[str(i)]['status'] = 'failed'
            out.write_text(json.dumps(result, indent=1))
            sys.exit(f'stopped: arXiv request failed ({e}); {len(group)} titles marked failed')
        full = len(found) == BATCH_RESULTS
        for i, p in group:
            judged = judge(p, found)
            # A full page may have cut off this title's match, so an unmatched title waits for a rerun.
            if judged['accepted'] or not full:
                result[str(i)] = {**judged, 'status': 'searched'}
        out.write_text(json.dumps(result, indent=1))
        matched = sum(1 for i, _ in group if result[str(i)].get('accepted'))
        print(len(group), 'titles,', len(found), 'results,', matched, 'matched' + (' (page full)' if full else ''), flush=True)
    status = [r['status'] for r in result.values()]
    print({s: status.count(s) for s in sorted(set(status))}, sum(1 for r in result.values() if r.get('accepted')), 'matched')


def arxiv_id(url: str) -> str:
    return re.sub(r'^.*/abs/', '', url)


def fetch(vis: Path, what: str) -> None:
    matches = json.loads((vis / 'arxiv' / 'matches.json').read_text())
    cache = vis / 'arxiv' / 'cache'
    out = vis / 'arxiv' / what
    out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[4].split(',')) if len(sys.argv) > 4 else None
    for i, m in matches.items():
        if not m.get('accepted') or (only and i not in only):
            continue
        aid = arxiv_id(m['accepted']['arxiv'])
        base = re.sub(r'v\d+$', '', aid).replace('/', '_')
        target = out / (f'{i}.pdf' if what == 'pdf' else f'{i}.src')
        if target.exists():
            continue
        url = f'https://export.arxiv.org/{"pdf" if what == "pdf" else "e-print"}/{re.sub(r"v\d+$", "", aid)}'
        target.write_bytes(get(url, cache, FETCH_PAUSE))
        print(time.strftime('%H:%M:%S'), 'fetched', i, base, target.stat().st_size, flush=True)


if __name__ == '__main__':
    cmd, vis = sys.argv[1], Path(sys.argv[2])
    if cmd == 'lookup':
        lookup(vis, int(sys.argv[3]) if len(sys.argv) > 3 else None)
    else:
        fetch(vis, sys.argv[3])
