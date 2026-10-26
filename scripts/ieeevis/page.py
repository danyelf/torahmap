"""Fetches web pages politely, cached on disk.

    uv run --no-project python -I scripts/ieeevis/page.py <vis dir> <url>...

Each page is saved under <vis dir>/workshops/cache/ and printed as text with its links
("text <url>") after it. A rerun fetches nothing twice; requests to the same host go out at
most one every 3 seconds. Every fetch is appended to <vis dir>/workshops/requests.log.
"""

import hashlib
import html
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

AGENT = 'torahmap-vis-map/0.1 (research spike; danyel-claude@users.noreply.github.com)'
PAUSE = 3.1
_last: dict[str, float] = {}


def fetch(vis: Path, url: str) -> str:
    cache = vis / 'workshops' / 'cache'
    cache.mkdir(parents=True, exist_ok=True)
    path = cache / hashlib.sha1(url.encode()).hexdigest()
    if path.exists():
        return path.read_text(errors='replace')
    host = urllib.parse.urlparse(url).netloc
    time.sleep(max(0.0, _last.get(host, 0) + PAUSE - time.time()))
    _last[host] = time.time()
    try:
        body = urllib.request.urlopen(
            urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=30
        ).read().decode('utf-8', 'replace')
        status = 'ok'
    except Exception as e:  # noqa: BLE001
        body, status = '', f'error {e}'
    path.write_text(body)
    with (vis / 'workshops' / 'requests.log').open('a') as log:
        log.write(f'{status}\t{url}\n')
    return body


def text_and_links(page: str, base: str) -> tuple[str, list[tuple[str, str]]]:
    links = [
        (re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t))).strip(),
         urllib.parse.urljoin(base, html.unescape(h)))
        for h, t in re.findall(r'<a\b[^>]*?href="([^"]*)"[^>]*>(.*?)</a>', page, re.S)
    ]
    body = re.sub(r'<(script|style)\b.*?</\1>', ' ', page, flags=re.S)
    text = html.unescape(re.sub(r'<[^>]+>', '\n', body))
    return re.sub(r'\n\s*\n+', '\n', text), links


if __name__ == '__main__':
    vis = Path(sys.argv[1])
    for u in sys.argv[2:]:
        t, ls = text_and_links(fetch(vis, u), u)
        print('=====', u)
        print(t)
        print('--- links')
        for name, href in ls:
            print(name, href)
