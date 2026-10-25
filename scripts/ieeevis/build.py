"""Builds the IEEE VIS 2026 map's data into public/data/ieeevis/.

    uv run --no-project python -I scripts/ieeevis/build.py <vis dir>

<vis dir> holds program.json, downloads/pdf_sizes.json, downloads/openalex.json and
downloads/pdfs/NN.pdf (needs pdftotext).

Writes structure.json (program metadata: committed) and texts.json (the papers' text:
gitignored, since the papers' copyright varies and the repository is public).

A square is a piece of about 250 words, cut at the sentence end nearest that length. A paper
with no text gets placeholder pieces, estimated from its kind; one with an abstract shows it as
its first piece. Section letters per piece: a abstract, i introduction, r related work,
m method, e evaluation, d discussion, c conclusion, f references, o other, x no text.
"""

import html
import json
import re
import subprocess
import sys
from pathlib import Path

PIECE_WORDS = 250
OUT = Path(__file__).resolve().parents[2] / 'public' / 'data' / 'ieeevis'
DAYS = ['Mon, Nov 9', 'Tue, Nov 10', 'Wed, Nov 11', 'Thu, Nov 12', 'Fri, Nov 13']
UNSCHEDULED = 'Not scheduled'


def estimate(kind: str) -> int:
    """Pieces in a paper of this kind. Full, journal, short, workshop and poster are measured
    from the papers we have; challenge entries, arts and talks are guesses."""
    if kind in ('TVCG Paper', 'CG&A Paper', 'Full VIS Paper'):
        return 52
    if kind == 'VIS Short Paper':
        return 20
    if kind.endswith('Workshop Paper'):
        return 28
    if kind == 'Poster':
        return 6
    if kind == 'VISions Talk':
        return 3
    return 12


# ---- Headings and sections ----------------------------------------------------------------

# The VIS template sets headings in small capitals, which come out as "I NTRODUCTION".
SMALL_CAPS = re.compile(r'\b([A-Z]) (?=[A-Z]{2})')
MINOR = {'a', 'an', 'and', 'of', 'the', 'in', 'on', 'for', 'to', 'with', 'by', 'at', 'from', 'vs'}
NUMBERED = re.compile(r'^(\d{1,2}|[IVX]{1,4})\.?\s+(\S.*)$')
NAMED = re.compile(
    r'^(Abstract|Introduction|Background|Related Work|Conclusions?|References|Discussion|'
    r'Acknowledg\w+|Limitations)\b',
    re.I,
)


def heading_of(line: str) -> str | None:
    """The top-level heading this line is, or None. Subsections (3.2) are not headings."""
    text = SMALL_CAPS.sub(r'\1', line.strip())
    if not text or len(text) > 70 or text[-1] in '.,;:' or '[' in text:
        return None
    m = NUMBERED.match(text)
    body = m.group(2) if m else text
    words = body.split()
    if not words or len(words) > 9 or not body[0].isalpha():
        return None
    letters = re.sub(r'[^A-Za-z]', '', body)
    allcaps = letters.isupper() and len(letters) >= 4
    titlecase = all(w[0].isupper() or w.lower() in MINOR for w in words if w[0].isalpha())
    if m:
        # "3 Gaussian blobs [30]" is a line of text; a heading is capitalized throughout.
        return body if allcaps or titlecase else None
    return body if allcaps or NAMED.match(body) else None


SECTION_KEYWORDS = [
    ('f', ('reference', 'bibliography')),
    ('o', ('acknowledg', 'appendix', 'supplement', 'ethic', 'funding', 'author contrib')),
    ('c', ('conclusion', 'future work', 'concluding')),
    ('d', ('discussion', 'limitation', 'implication', 'lessons')),
    ('i', ('introduction',)),
    ('r', ('related', 'background', 'prior work', 'previous work', 'literature', 'preliminar')),
    (
        'e',
        ('evaluation', 'result', 'experiment', 'study', 'findings', 'analysis', 'case',
         'interview', 'user ', 'performance', 'benchmark', 'survey', 'feedback'),
    ),
    (
        'm',
        ('method', 'design', 'approach', 'framework', 'system', 'technique', 'model',
         'implementation', 'algorithm', 'overview', 'tracking', 'setup', 'data'),
    ),
]


def classify(heading: str, current: str) -> str:
    """The section a heading starts. One with no telling word continues the paper's own work
    (method or evaluation) and, straight after the introduction or related work, begins it."""
    h = re.sub(r'^(\d+|[ivx]+)\.?\s+', '', heading.lower())
    for letter, keys in SECTION_KEYWORDS:
        if any(k in h for k in keys):
            # After the references only an appendix-like heading counts: a capitalized line
            # inside the list is a title, not a heading.
            return letter if current not in ('f', 'o') or letter in ('f', 'o') else current
    if current in ('f', 'o'):
        return current
    return current if current in ('m', 'e') else 'm'


# ---- Reading a PDF ------------------------------------------------------------------------


def clean_lines(raw: str) -> list[str]:
    """Lines without page numbers or running headers (short lines repeated on every page)."""
    lines = [l.strip() for l in raw.replace('\f', '\n').split('\n')]
    counts: dict[str, int] = {}
    for s in lines:
        if 0 < len(s) < 80:
            counts[s] = counts.get(s, 0) + 1
    return [
        s
        for s in lines
        if not re.fullmatch(r'\d{1,3}', s) and not (len(s) < 80 and counts.get(s, 0) >= 4)
    ]


ABSTRACT_WORD = re.compile(r'^(A ?BSTRACT|Abstract)\b\W*')
FRONT_MATTER_LINE = re.compile(r'^(Index Terms|Keywords?|CCS Concepts)\b')


def words_with_sections(raw: str) -> list[tuple[str, str]]:
    """(word, section letter) across the paper, from its abstract on."""
    lines = clean_lines(raw)
    # Without an abstract, the text starts at its first heading, leaving the title page out.
    start = next(
        (i for i, l in enumerate(lines) if ABSTRACT_WORD.match(l)),
        next((i for i, l in enumerate(lines) if heading_of(l)), 0),
    )
    section = 'a'
    out: list[tuple[str, str]] = []
    for n, line in enumerate(lines[start:]):
        if n == 0:
            line = ABSTRACT_WORD.sub('', line)
        if not line or FRONT_MATTER_LINE.match(line):
            continue
        h = heading_of(line)
        if h:
            section = classify(h, section)
            continue
        out.extend((w, section) for w in line.split())
    return out


ABBREVIATIONS = {'al.', 'e.g.', 'i.e.', 'Fig.', 'Figs.', 'Sec.', 'Eq.', 'Tab.', 'vs.', 'cf.', 'etc.', 'No.'}


def ends_sentence(word: str, following: str | None) -> bool:
    if not re.search(r'[.!?][)\]"”]?$', word) or word in ABBREVIATIONS:
        return False
    if re.fullmatch(r'[A-Z]\.', word):
        return False
    return following is None or bool(re.match(r'^[A-Z0-9\[(“"]', following))


def cut_pieces(words: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """(text, section) pieces of about PIECE_WORDS, each cut at the sentence end nearest that
    length. A piece's section is the one most of its words are in."""
    n = len(words)
    cuts = [
        i + 1
        for i, (w, _) in enumerate(words)
        if ends_sentence(w, words[i + 1][0] if i + 1 < n else None)
    ]
    pieces = []
    start = 0
    while start < n:
        target = start + PIECE_WORDS
        if target >= n:
            end = n
        else:
            near = [c for c in cuts if start + PIECE_WORDS // 2 < c < start + 2 * PIECE_WORDS]
            end = min(near, key=lambda c: abs(c - target)) if near else target
        chunk = words[start:end]
        tally: dict[str, int] = {}
        for _, s in chunk:
            tally[s] = tally.get(s, 0) + 1
        pieces.append((' '.join(w for w, _ in chunk), max(tally, key=lambda s: tally[s])))
        start = end
    return pieces


def read_pdf(pdf: Path) -> list[tuple[str, str]]:
    raw = subprocess.run(
        ['pdftotext', str(pdf), '-'], capture_output=True, text=True, check=True
    ).stdout
    return cut_pieces(words_with_sections(re.sub(r'(\w)-\n(\w)', r'\1\2', raw)))


# ---- The program --------------------------------------------------------------------------


def abstract_of(work: dict | None) -> str | None:
    index = (work or {}).get('abstract_inverted_index')
    if not index:
        return None
    at = {p: word for word, places in index.items() for p in places}
    return ' '.join(at[p] for p in sorted(at))


def main(vis: Path) -> None:
    program = json.loads((vis / 'program.json').read_text())
    for p in program:
        for key in ('kind', 'title', 'session', 'when'):
            if p.get(key):
                p[key] = html.unescape(p[key])
        p['authors'] = [html.unescape(a) for a in p.get('authors') or []]

    pdf_of: dict[int, Path] = {}
    for n, s in enumerate(json.loads((vis / 'downloads' / 'pdf_sizes.json').read_text())):
        title = html.unescape(s['title'])
        hits = [i for i, p in enumerate(program) if p['title'].startswith(title)]
        assert len(hits) == 1, (title, hits)
        pdf_of[hits[0]] = vis / 'downloads' / 'pdfs' / f'{n:02d}.pdf'

    abstracts: dict[int, str] = {}
    for entry in json.loads((vis / 'downloads' / 'openalex.json').read_text()):
        text = abstract_of(entry.get('work'))
        if text and html.unescape(program[entry['i']]['title']) == html.unescape(entry['title']):
            abstracts[entry['i']] = text

    texts: dict[str, str] = {}
    papers: dict[int, dict] = {}
    for i, p in enumerate(program):
        if i in pdf_of:
            pieces = read_pdf(pdf_of[i])
            for n, (text, _) in enumerate(pieces):
                texts[f'{i}.{n}'] = text
            letters = ''.join(s for _, s in pieces)
        else:
            letters = 'x' * estimate(p['kind'])
            if i in abstracts:
                texts[f'{i}.0'] = abstracts[i]
                letters = 'a' + letters[1:]
        papers[i] = {
            'index': i,
            'title': p['title'],
            'authors': p['authors'],
            'kind': p['kind'],
            'when': p['when'] or '',
            'pieces': letters,
        }

    # Day, then session in time order, then the session's papers in time order.
    by_day: dict[str, dict[str, list[tuple[str, int]]]] = {}
    for i, p in enumerate(program):
        if p['when']:
            day, time = p['when'].rsplit(', ', 1)
            session = p['session']
        else:
            day, time, session = UNSCHEDULED, '', p['kind']
        by_day.setdefault(day, {}).setdefault(session, []).append((time, i))
    days = []
    for day in DAYS + [UNSCHEDULED]:
        ordered = sorted(
            by_day.get(day, {}).items(), key=lambda kv: (min(t for t, _ in kv[1]), kv[0])
        )
        sessions = [
            {'name': name, 'papers': [papers[i] for _, i in sorted(items)]}
            for name, items in ordered
        ]
        days.append({'name': day, 'sessions': sessions})

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'structure.json').write_text(json.dumps({'days': days}, ensure_ascii=False))
    (OUT / 'texts.json').write_text(json.dumps(texts, ensure_ascii=False))
    total = sum(len(p['pieces']) for p in papers.values())
    placeholders = sum(p['pieces'].count('x') for p in papers.values())
    print(f'{total} squares: {total - placeholders} with text, {placeholders} placeholders')
    for i in sorted(pdf_of):
        print(i, papers[i]['pieces'])


if __name__ == '__main__':
    main(Path(sys.argv[1]))
