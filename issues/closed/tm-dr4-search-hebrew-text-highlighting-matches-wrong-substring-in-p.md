---
id: tm-dr4
status: closed
priority: 2
type: bug
created: 2026-01-12
closed: 2026-01-13
---

# Search: Hebrew text highlighting matches wrong substring in preview

In the search results preview dropdown, Hebrew text highlighting is matching incorrect substrings. Example: searching for 'כׇּנְיָ֔הוּ' highlights 'כִּ֣י' instead in Jeremiah 22:24. Likely an issue with nikkud-insensitive matching or substring positioning in the Hebrew highlight logic.
