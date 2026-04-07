---
id: tm-noz
status: closed
priority: 3
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Remove redundant utilities and fix type mismatches

**YAGNI Issue:**
- src/types.ts:187-189 - getVerseKeyFromVerse() adds minimal value, remove it
- Callers can use getVerseKey(v.book, v.chapter, v.verse) directly

**Type Mismatch:**
- src/overlays/commentary.ts:123 uses VerseLayout but interface expects VerseIdentity
- Change to use VerseIdentity for consistency

**Naming Inconsistency:**
- URL parameter uses 'cat' but code uses 'category'
- Document the choice (cat = concise for URLs, category = clear in code)
