# /// script
# dependencies = ["pymongo"]
# ///
"""Every topic's names, generation and era, from Sefaria's database dump, as plain JSON.

    uv run scripts/talmud/sefaria-all-names.py <topics.bson> <all-topics.json>

patronymic-report.ts reads the result.
"""
import json
import sys

import bson

out = {}
with open(sys.argv[1], 'rb') as f:
    for t in bson.decode_file_iter(f):
        props = t.get('properties') or {}
        out[t['slug']] = {
            'en': next((x['text'] for x in t.get('titles', []) if x.get('lang') == 'en' and x.get('primary')), None),
            'generation': (props.get('generation') or {}).get('value'),
            'era': (props.get('era') or {}).get('value'),
            'names': sorted({x['text'] for x in t.get('titles', []) if x.get('text')}),
        }
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False)
print(len(out), 'topics')
