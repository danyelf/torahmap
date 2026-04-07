---
id: tm-62nd
status: closed
priority: 2
type: bug
created: 2026-01-28
closed: 2026-02-03
---

# Root mode: צחק and יצחק don't match same verses

User searched 'צחק,יצחק' in root mode. Genesis 19:14 shows for one but not the other, even though both terms share lemma H6711 (the verb 'to laugh'). The verse contains 'כמצחק' (as mocking/joking) which should match both search terms since:
- צחק searches for lemmas: [H6712, H6711] (verb forms)
- יצחק searches for lemmas: [H3327, H6711] (Isaac name + verb)
Both include H6711, so both should match Genesis 19:14. Likely bug in searchByLemmas() or how lemma matching works.
