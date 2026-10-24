# /// script
# dependencies = ["pymongo"]
# ///
"""Read the people Sefaria tags in the Talmud from its database dump, as plain JSON.

    uv run scripts/talmud/sefaria-dating-facts.py <dump dir> <facts.json>

<dump dir> holds topic_links.bson, topics.bson and time_period.bson, extracted from
dump_small.tar.gz (./dump/sefaria/). The rules that turn these facts into
public/data/talmud/dating.json are in dating.ts, which is tested; this script only reads.
"""

import json
import re
import sys
from pathlib import Path

import bson

REF = re.compile(r'^.+ \d+[ab]:\d+')


def rows(path):
    with open(path, 'rb') as f:
        yield from bson.decode_file_iter(f)


def title(topic, lang):
    for t in topic.get('titles', []):
        if t.get('lang') == lang and t.get('primary'):
            return t['text']
    return None


def main(dump, out):
    dump = Path(dump)
    mentions, candidates = [], {}
    for link in rows(dump / 'topic_links.bson'):
        kind = link.get('linkType')
        if kind == 'possibility-for' and link.get('class') == 'intraTopic':
            candidates.setdefault(link['toTopic'], []).append(link['fromTopic'])
        elif kind == 'mention' and link.get('class') == 'refTopic':
            ref, data = link.get('ref', ''), link.get('charLevelData') or {}
            if REF.match(ref):
                mentions.append(
                    {
                        'ref': ref,
                        'topic': link['toTopic'],
                        'language': data.get('language'),
                        'version': data.get('versionTitle'),
                        'start': data.get('startChar'),
                        'end': data.get('endChar'),
                    }
                )

    wanted = {m['topic'] for m in mentions} | {c for cs in candidates.values() for c in cs}
    topics = {}
    for topic in rows(dump / 'topics.bson'):
        if topic['slug'] in wanted:
            gen = ((topic.get('properties') or {}).get('generation') or {}).get('value')
            topics[topic['slug']] = {'en': title(topic, 'en'), 'he': title(topic, 'he'), 'generation': gen}

    periods = {}
    for p in rows(dump / 'time_period.bson'):
        names = {n['lang']: n['text'] for n in p.get('names', []) if n.get('primary')}
        periods[p['symbol']] = {'en': names.get('en'), 'from': p.get('start'), 'to': p.get('end')}

    Path(out).write_text(
        json.dumps(
            {'mentions': mentions, 'candidates': candidates, 'topics': topics, 'periods': periods},
            ensure_ascii=False,
        ),
        encoding='utf-8',
    )
    print(f'{len(mentions)} mentions, {len(topics)} topics')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
