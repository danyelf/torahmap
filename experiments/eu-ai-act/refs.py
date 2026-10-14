"""Find the AI Act's references to its own articles and annexes, and resolve each to a unit.

Writes refs.json beside this file: one {from, to, text} per reference, where `from` and `to`
are unit ids like '6', '6(2)', '5(1)(h)' or 'Annex III'. Prints how many resolved.

    python3 -I experiments/eu-ai-act/refs.py
"""

import json
import re
from collections import Counter
from pathlib import Path

HERE = Path(__file__).parent

# A reference that continues "of Regulation (EU) 2016/679" and the like points outside the Act.
EXTERNAL = re.compile(r'\s*(?:,\s*(?:first|second|third|fourth|fifth)\s+subparagraph,?\s*)?'
                      r',?\s*(?:of|to)\s+(?:Regulation|Directive|Decision|the Charter|that Regulation|'
                      r'that Directive|the Treaty|Protocol|Implementing|Delegated|Council|Recommendation|the Annex to)'
                      r'|\s*(?:TFEU|TEU)\b')
NUM = r'\d+[a-z]?'
PARA = r'\((\d+[a-z]?)\)'
POINT = r'points?\s+\(([a-z]+|\d+)\)'
SUBPARA = r'(?:,?\s*(?:first|second|third|fourth|fifth)\s+subparagraph)?'

# "Article 5(1), first subparagraph, point (h)" / "Article 6(2)" / "Article 3, point (14)"
ARTICLE = re.compile(rf'Article\s+({NUM})(?:{PARA})?{SUBPARA}(?:,?\s*{POINT})?')
# "Articles 102 to 112" / "Articles 8, 9 and 10" / "Articles 16 and 17"
ARTICLES = re.compile(rf'Articles\s+({NUM}(?:{PARA})?(?:\s*(?:,|and|or|to)\s*{NUM}(?:{PARA})?)+)')
# "point (a) of paragraph 1 of Article 10" and "paragraph 3 of Article 6"
OF_ARTICLE = re.compile(rf'(?:{POINT}\s+of\s+)?paragraph\s+({NUM}){SUBPARA}\s+of\s+Article\s+({NUM})')
# Relative to the article it sits in: "paragraph 1", "paragraphs 2 and 3", "paragraph 1, point (a)"
PARAGRAPH = re.compile(rf'paragraphs?\s+({NUM}(?:\s*(?:,|and|or|to)\s*{NUM})*)(?:{SUBPARA},?\s*{POINT})?')
ANNEX = re.compile(r'Annex(?:es)?\s+([IVX]+)((?:\s*(?:,|and|or|to)\s*[IVX]+\b)*)')


def units(act):
    """Every addressable unit, in reading order: (id, text, article number, origin)."""
    out = []

    def walk(item, uid, art):
        out.append((uid, ' '.join([item.get('text') or '', *item.get('after', [])]), art))
        for p in item.get('points', []):
            walk(p, f"{uid}({p['label'].strip('()')})", art)

    for ch in act['chapters']:
        for s in ch['sections']:
            for a in s['articles']:
                out.append((a['number'], '', a['number']))
                for p in a['paragraphs']:
                    walk(p, f"{a['number']}({p['label']})" if p['label'] else a['number'], a['number'])
    for anx in act['annexes']:
        out.append((f"Annex {anx['number']}", '', None))
    return out


def find(text, art, order):
    """(target id, matched text) for each reference in text, written inside article art."""
    hits, taken = [], []

    def free(m):
        return not any(m.start() < e and s < m.end() for s, e in taken)

    def add(m, targets):
        taken.append(m.span())
        hits.extend((t, m.group(0)) for t in targets)

    def external(m):
        return EXTERNAL.match(text, m.end()) is not None

    for m in OF_ARTICLE.finditer(text):
        if not external(m):
            point, para, a = m.groups()
            add(m, [f'{a}({para})' + (f'({point})' if point else '')])
    for m in ARTICLES.finditer(text):
        if free(m) and not external(m):
            add(m, expand(m.group(1), order))
    for m in ARTICLE.finditer(text):
        if free(m) and not external(m):
            a, para, point = m.groups()
            add(m, [a + (f'({para})' if para else '') + (f'({point})' if point else '')])
    for m in PARAGRAPH.finditer(text):
        if free(m) and art and not external(m):
            nums = re.findall(NUM, m.group(1))
            if ' to ' in m.group(1) and len(nums) == 2:
                nums = [str(n) for n in range(int(nums[0]), int(nums[1]) + 1)]
            point = m.group(2)
            add(m, [f'{art}({n})' + (f'({point})' if point else '') for n in nums])
    for m in ANNEX.finditer(text):
        if free(m) and not external(m):
            add(m, [f'Annex {n}' for n in [m.group(1), *re.findall(r'[IVX]+', m.group(2))]])
    return hits


def expand(listing, order):
    """'102 to 112' → every article between, in the Act's order (so 4a and 75a-d count)."""
    parts = re.split(r'\s*(,|and|or|to)\s*', listing)
    out, prev_to = [], False
    for p in parts:
        if p in (',', 'and', 'or'):
            continue
        if p == 'to':
            prev_to = True
            continue
        if prev_to and out:
            a, b = out[-1].split('(')[0], p.split('(')[0]
            if a in order and b in order:
                out += order[order.index(a) + 1:order.index(b) + 1]
            prev_to = False
        else:
            out.append(p)
    return out


def resolve(target, ids):
    """The most precise existing unit for target, and whether it matched exactly."""
    if target in ids:
        return target, True
    t = target
    while '(' in t:
        t = t[:t.rfind('(')]
        if t in ids:
            return t, False
    return None, False


def main():
    act = json.loads((HERE / 'ai-act.json').read_text(encoding='utf-8'))
    us = units(act)
    ids = {u[0] for u in us}
    order = [a['number'] for ch in act['chapters'] for s in ch['sections'] for a in s['articles']]

    refs, outcome, unresolved = [], Counter(), Counter()
    for uid, text, art in us:
        for target, matched in find(text, art, order):
            to, exact = resolve(target, ids)
            if to is None:
                outcome['unresolved'] += 1
                unresolved[f'{target}  ← {uid}: "{matched}"'] += 1
                continue
            precision = 'annex' if to.startswith('Annex') else (
                'point' if to.count('(') >= 2 else 'paragraph' if '(' in to else 'article')
            outcome[f"{precision}{'' if exact else ' (coarsened)'}"] += 1
            if to.split('(')[0] != uid.split('(')[0] or '(' in to:
                refs.append({'from': uid, 'to': to, 'text': matched})
    (HERE / 'refs.json').write_text(json.dumps(refs, ensure_ascii=False, indent=1), encoding='utf-8')

    total = sum(outcome.values())
    print(f'{total} references found')
    for k, v in outcome.most_common():
        print(f'  {k:<24} {v:>4}  {v / total:.0%}')
    print('\nunresolved:')
    for k, v in unresolved.most_common(15):
        print(f'  {v}× {k}')


if __name__ == '__main__':
    main()
