---
id: tm-4eb9
status: closed
priority: 2
type: bug
created: 2026-02-03
closed: 2026-02-03
---

# Verse numbering mismatch between morphhb and Sefaria

morphhb and Sefaria use different verse numbering for some chapters (e.g. II Samuel 19). This causes lemma search to hit the wrong verse text — the verse-lemmas.json key maps to a different verse than the Sefaria text data. Result: search finds the verse as a hit but can't highlight anything because the word isn't in the displayed text. Likely affects multiple chapters across Tanakh where Hebrew/English verse numbering diverges.
