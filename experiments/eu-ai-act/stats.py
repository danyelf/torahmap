"""Counts and sizes of the AI Act's candidate units, from ai-act.json.

    python3 -I experiments/eu-ai-act/stats.py
"""

import json
import statistics
from pathlib import Path
from collections import Counter


def words(s):
    return len((s or '').split())


def flatten(item):
    """Every point under item, at any depth."""
    for p in item.get('points', []):
        yield p
        yield from flatten(p)


def item_words(item):
    return words(item.get('text')) + sum(words(a) for a in item.get('after', [])) + sum(
        item_words(p) for p in item.get('points', []))


def describe(name, sizes):
    sizes = sorted(sizes)
    q = statistics.quantiles(sizes, n=20) if len(sizes) > 1 else sizes
    print(f'{name:<34} n={len(sizes):>5}  words: median {statistics.median(sizes):>5.0f}'
          f'  p5 {q[0]:>5.0f}  p95 {q[-1]:>6.0f}  max {sizes[-1]:>6}  total {sum(sizes):>6}')


def main():
    path = Path(__file__).parent / 'ai-act.json'
    act = json.load(open(path, encoding='utf-8'))
    articles = [a for ch in act['chapters'] for s in ch['sections'] for a in s['articles']]
    paragraphs = [p for a in articles for p in a['paragraphs']]
    leaves = []  # the smallest unit: a paragraph with no points, or a point with no sub-points
    for p in paragraphs:
        pts = [x for x in flatten(p) if not x.get('points')]
        leaves.extend(pts if pts else [p])
    annex_paragraphs = {a['number']: [p for part in a['parts'] for p in part['paragraphs']]
                        for a in act['annexes']}
    annex_leaves = []
    for p in (p for ps in annex_paragraphs.values() for p in ps):
        pts = [x for x in flatten(p) if not x.get('points')]
        annex_leaves.extend(pts if pts else [p])

    describe('recitals', [words(r['text']) for r in act['recitals']])
    describe('chapters', [sum(item_words(p) for s in ch['sections'] for a in s['articles']
                              for p in a['paragraphs']) for ch in act['chapters']])
    describe('articles', [sum(item_words(p) for p in a['paragraphs']) for a in articles])
    describe('paragraphs', [item_words(p) for p in paragraphs])
    describe('article leaves (paragraph or point)', [item_words(x) for x in leaves])
    describe('annexes', [sum(item_words(p) for p in ps) for ps in annex_paragraphs.values()])
    describe('annex leaves', [item_words(x) for x in annex_leaves])

    print('\nparagraphs per article:', Counter(len(a['paragraphs']) for a in articles).most_common())
    print('\norigin of articles:', Counter(a['origin'] for a in articles))
    print('origin of paragraphs:', Counter(p['origin'] for p in paragraphs))
    print('origin of article leaves:', Counter(x['origin'] for x in leaves))
    print('origin of annexes:', Counter(a['origin'] for a in act['annexes']))

    print('\nlongest articles:')
    for a in sorted(articles, key=lambda a: -sum(item_words(p) for p in a['paragraphs']))[:8]:
        print(f"  Art {a['number']:<4} {sum(item_words(p) for p in a['paragraphs']):>5}  {a['title']}")
    print('\narticles changed by M1 (any paragraph or point):')
    changed = [a for a in articles if not a['origin'].startswith('B') or any(
        not p['origin'].startswith('B') or any(not x['origin'].startswith('B') for x in flatten(p)) for p in a['paragraphs'])]
    print('  ' + ', '.join(a['number'] for a in changed))


if __name__ == '__main__':
    main()
