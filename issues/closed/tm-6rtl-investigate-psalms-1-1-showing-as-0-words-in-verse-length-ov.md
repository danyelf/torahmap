---
id: tm-6rtl
status: closed
priority: 2
type: bug
created: 2026-01-30
closed: 2026-02-02
---

# Investigate: Psalms 1:1 showing as 0 words in verse-length overlay

The verse-length overlay is showing Psalms 1:1 as 0 words. Need to investigate:

1. Is the verse text data missing/empty for Psalms 1:1?
2. Is the word counting logic incorrectly handling this verse?
3. Check data/all-texts.json for Psalms 1:1 Hebrew text
4. Check if the countHebrewWords function is being called correctly

Note: In tests, we intentionally set Psalms 1:1 to empty string as an edge case test, but the actual runtime data should have the real verse text.
