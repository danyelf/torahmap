# /// script
# dependencies = ["pymongo"]
# ///
"""Count the kinds of topic-to-topic link in Sefaria's dump, and save the family ones."""
import json
import sys
from collections import Counter

import bson

kinds = Counter()
family = []
sample = {}
with open(sys.argv[1], 'rb') as f:
    for link in bson.decode_file_iter(f):
        if link.get('class') != 'intraTopic':
            continue
        t = link.get('linkType')
        kinds[t] += 1
        sample.setdefault(t, {k: str(v) for k, v in link.items()})
        if t in ('child-of', 'parent-of', 'sibling-of', 'grandchild-of', 'descendant-of'):
            family.append({'type': t, 'from': link.get('fromTopic'), 'to': link.get('toTopic')})
for t, n in kinds.most_common():
    print(n, t)
print(json.dumps(sample.get('child-of'), ensure_ascii=False))
with open(sys.argv[2], 'w', encoding='utf-8') as f:
    json.dump(family, f, ensure_ascii=False)
