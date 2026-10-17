"""Parse the EU AI Act's XHTML into one JSON tree for exploration.

Reads the consolidated text (articles, annexes, amendment markers) and the
original Official Journal text (recitals, which consolidations leave out).

    python3 -I experiments/eu-ai-act/parse.py
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NS = '{http://www.w3.org/1999/xhtml}'


def tag(el):
    return el.tag.removeprefix(NS)


def cls(el):
    return el.get('class', '').split()


def text(el):
    return re.sub(r'\s+', ' ', ''.join(el.itertext())).strip()


def words(s):
    return len(s.split())


def load(path):
    src = Path(path).read_text(encoding='utf-8')
    src = re.sub(r'<!DOCTYPE[^>]*>', '', src)
    return ET.fromstring(src)


class Origin:
    """Where the text after a ▼B / ▼M1 marker comes from, and how: 'M1 replaced', 'M1 inserted'.

    A DELETED marker stands where removed text was; it is followed by another marker.
    """

    def __init__(self):
        self.current = 'B'
        self.deletions = 0

    def see(self, el):
        if tag(el) == 'p' and 'modref' in cls(el):
            m = re.search(r'▼\s*(\w+)', text(el))
            a = el.find(f'{NS}a')
            how = (a.get('title', '') if a is not None else '').partition(': ')[2].lower()
            if how == 'deleted':
                self.deletions += 1
            elif m:
                self.current = f'{m.group(1)} {how}'.strip()
            return True
        return False


def parse_list(container, origin):
    """A grid list item: label in column 1, body (text and nested lists) in column 2."""
    col1 = next(c for c in container if 'grid-list-column-1' in cls(c))
    col2 = next(c for c in container if 'grid-list-column-2' in cls(c))
    label = text(col1)
    item = {'label': label, 'origin': origin.current, 'text': '', 'points': []}
    parse_body(col2, item, origin)
    return item


def parse_body(el, item, origin):
    """Fill item['text'] and item['points'] from el's children."""
    parts = []
    for child in el:
        if origin.see(child):
            continue
        c = cls(child)
        if 'grid-container' in c:
            item['points'].append(parse_list(child, origin))
        elif 'inline-element' in c and tag(child) == 'div':
            parse_body(child, item, origin)
            continue
        elif tag(child) in ('p', 'div', 'table'):
            t = text(child)
            if t:
                if item['points']:
                    item['points'][-1].setdefault('after', []).append(t)
                else:
                    parts.append(t)
    if parts:
        item['text'] = (item['text'] + ' ' + ' '.join(parts)).strip()
    if not item['points']:
        del item['points']


def parse_article(div, origin):
    art = {
        'id': div.get('id'),
        'number': None,
        'title': None,
        'origin': origin.current,
        'paragraphs': [],
    }
    loose = {'label': '', 'origin': origin.current, 'text': '', 'points': []}
    for child in div:
        if origin.see(child):
            continue
        c = cls(child)
        if 'title-article-norm' in c:
            art['number'] = text(child).removeprefix('Article ').strip()
            art['origin'] = origin.current
        elif 'eli-title' in c:
            art['title'] = text(child)
        elif 'norm' in c and tag(child) == 'div' and child.find(f'{NS}span') is not None \
                and 'no-parag' in cls(child.find(f'{NS}span')):
            span = child.find(f'{NS}span')
            p = {'label': text(span).rstrip('.'), 'origin': origin.current, 'text': '', 'points': []}
            for sub in child:
                if sub is span:
                    continue
                if origin.see(sub):
                    continue
                if 'inline-element' in cls(sub):
                    if len(sub):
                        parse_body(sub, p, origin)
                    else:
                        p['text'] = text(sub)
                else:
                    t = text(sub)
                    if t:
                        p['text'] = (p['text'] + ' ' + t).strip()
            p.setdefault('points', [])
            if not p['points']:
                del p['points']
            art['paragraphs'].append(p)
        elif art['paragraphs']:
            # An unnumbered subparagraph after a numbered one belongs to it.
            t = text(child)
            if t:
                art['paragraphs'][-1].setdefault('after', []).append(t)
        else:
            # Unnumbered body: a definitions list, or plain subparagraphs.
            wrapper = ET.Element('div')
            wrapper.append(child)
            parse_body(wrapper, loose, origin)
            loose.setdefault('points', [])
    if loose.get('text') or loose.get('points'):
        if not loose.get('points'):
            loose.pop('points', None)
        art['paragraphs'].insert(0, loose)
    return art


def parse_annex(div, origin):
    """An annex is parts (split at its headings), each a list of paragraphs like an article's."""
    anx = {'id': div.get('id'), 'number': None, 'title': None, 'origin': origin.current, 'parts': []}
    part = None

    def new_part(title):
        nonlocal part
        part = {'title': title, 'paragraphs': []}
        anx['parts'].append(part)

    def plain(t):
        return {'label': '', 'origin': origin.current, 'text': t}

    def walk(el):
        for child in el:
            if origin.see(child):
                continue
            c = cls(child)
            t = text(child)
            if 'title-annex-1' in c and anx['number'] is None:
                anx['number'] = t.removeprefix('ANNEX ').strip()
                anx['origin'] = origin.current
            elif 'title-annex-1' in c or 'title-annex-2' in c:
                anx['title'] = t
            elif 'title-gr-seq-level-1' in c:
                if part and not part['paragraphs'] and part['title']:
                    part['title'] += ' — ' + t  # 'Section 1' then its name, as two lines
                else:
                    new_part(t)
            elif t:
                if part is None:
                    new_part(None)
                _place(child, c, t)

    def _place(child, c, t):
        paras = part['paragraphs']
        if 'title-gr-seq-level-2' in c:
            paras.append({'label': '', 'origin': origin.current, 'text': t, 'points': []})
        elif 'grid-container' in c:
            paras.append(parse_list(child, origin))
        elif 'centered' in c:
            rows = [r for r in child.iter(f'{NS}tr') if r.find(f'{NS}td') is not None
                    and r.find(f'{NS}td').get('style', '').find('bold') < 0]
            pts = [{'label': '', 'origin': origin.current, 'text': text(r)} for r in rows]
            if paras and 'points' in paras[-1] and not paras[-1]['points']:
                paras[-1]['points'] = pts
            else:
                paras.append({'label': '', 'origin': origin.current, 'text': '', 'points': pts})
        elif tag(child) == 'div' and (child.find(f'.//{NS}div') is not None or
                                      child.find(f'{NS}p') is not None and len(child) > 1):
            walk(child)
        elif 'list' in c and paras:
            paras[-1].setdefault('after', []).append(t)
        elif t:
            paras.append(plain(t))

    walk(div)
    for p in anx['parts']:
        for q in p['paragraphs']:
            if 'points' in q and not q['points']:
                del q['points']
    return anx


def parse_consolidated(root):
    origin = Origin()
    chapters, annexes = [], []
    chapter = section = None

    def walk(el):
        nonlocal chapter, section
        for child in el:
            if origin.see(child):
                continue
            i = child.get('id', '')
            if re.fullmatch(r'cpt_[IVXL]+', i):
                heads = [text(p) for p in child if 'title-division-1' in cls(p) or 'title-division-2' in cls(p)]
                chapter = {'id': i, 'number': heads[0].removeprefix('CHAPTER ').strip(),
                           'title': heads[1] if len(heads) > 1 else None, 'sections': []}
                section = {'id': None, 'number': None, 'title': None, 'articles': []}
                chapter['sections'].append(section)
                chapters.append(chapter)
                walk(child)
            elif re.fullmatch(r'cpt_[IVXL]+\.sct_\d+', i):
                heads = [text(p) for p in child if 'title-division-1' in cls(p) or 'title-division-2' in cls(p)]
                section = {'id': i, 'number': heads[0].removeprefix('SECTION ').strip(),
                           'title': heads[1] if len(heads) > 1 else None, 'articles': []}
                chapter['sections'].append(section)
                walk(child)
            elif re.fullmatch(r'art_\w+', i):
                section['articles'].append(parse_article(child, origin))
            elif re.fullmatch(r'anx_[IVXL]+', i):
                annexes.append(parse_annex(child, origin))
            elif tag(child) in ('div', 'body'):
                walk(child)

    walk(root.find(f'{NS}body'))
    for ch in chapters:
        ch['sections'] = [s for s in ch['sections'] if s['articles'] or s['id']]
    return chapters, annexes


def parse_recitals(root):
    recitals = []
    for div in root.iter(f'{NS}div'):
        i = div.get('id', '')
        if re.fullmatch(r'rct_\d+', i):
            t = text(div)
            m = re.match(r'\((\d+)\)\s*(.*)', t)
            recitals.append({'id': i, 'number': m.group(1), 'text': m.group(2)})
    return recitals


def main():
    folder = Path(__file__).parent
    chapters, annexes = parse_consolidated(load(folder / 'downloads' / '02024R1689-20260727.xhtml'))
    recitals = parse_recitals(load(folder / 'downloads' / '32024R1689-original.xhtml'))
    out = {
        'source': {
            'consolidated': 'CELEX 02024R1689-20260727',
            'recitals': 'CELEX 32024R1689 (Official Journal, 12 July 2024)',
            'origins': {'B': 'Regulation (EU) 2024/1689', 'M1': 'Regulation (EU) 2026/1744'},
        },
        'recitals': recitals,
        'chapters': chapters,
        'annexes': annexes,
    }
    (folder / 'ai-act.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
