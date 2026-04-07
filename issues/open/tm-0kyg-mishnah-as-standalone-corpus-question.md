---
id: tm-0kyg
status: open
priority: 4
type: feature
created: 2026-04-06
---

# Mishnah-as-standalone-corpus question

The Mishnah exists independently of the Talmud: 6 sedarim, 63 tractates, ~4,000 mishnayot. The tm-7la prototype only handled the Bavli. Open question: should the standalone Mishnah be:

(a) A separate visualization with its own corpus toggle?
(b) An overlay on top of the Bavli showing "here's where each Mishnah lives"?
(c) Both?

Sefaria-Export has Mishnah Berakhot etc. as separate files (`gs://sefaria-export/json/Mishnah/...`) with `sectionNames: ["Chapter", "Mishnah"]` — much simpler structure than the Talmud (no daf/amud accident).

Discovered from tm-7la.
