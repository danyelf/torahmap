---
id: tm-b0m
status: closed
priority: 2
type: chore
created: 2026-01-26
closed: 2026-01-26
---

# Refactor verse identity: abstract [book, chapter, verse] comparisons and clarify Verse vs VerseState ownership

The current codebase has multiple locations where we compare verses by checking book === book && chapter === chapter && verse === verse (e.g., in computeVerseStates for isHovered and isPinned). This is error-prone and repetitive.

Design questions to resolve:
1. Should we have a verseId/verseKey abstraction for identity comparisons?
   - Already have getVerseKey() in types.ts, but not consistently used
   - Could make Verse.id a required field?

2. What's the right data model split between Verse and VerseState?
   - Verse: immutable layout/position data (book, chapter, verse, x, y, size)
   - VerseState: mutable rendering state (color, hover, pinned)
   - Current Verse.color field overlaps with VerseState.baseColor

3. Should baseColor stay as Color | Color[] in VerseState?
   - It's already an array type to support stipple rendering
   - Is this the right abstraction?

Related code locations:
- src/types.ts:20-29 (Verse interface)
- src/types.ts:37-44 (VerseState interface)
- src/types.ts:83-89 (getVerseKey helpers - already exist!)
- src/main.ts:196-220 (computeVerseStates with repeated comparisons)

Consider:
- Making verse identity comparisons use getVerseKey() consistently
- Moving Verse.color to be exclusively managed through VerseState
- Possibly adding a Verse.id field populated at layout time
