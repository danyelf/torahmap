---
id: tm-uem
status: closed
priority: 3
type: task
created: 2026-01-27
closed: 2026-01-27
---

# Refactor sidebar overlay-specific code into overlay methods

The sidebar.ts file has growing complexity with overlay-specific logic scattered throughout:
- Trop: highlightTropInText
- Search: highlightSearchTerms
- Commentary: category counts and link counts
- Text-dating: dating info with citation parsing

Refactor this so each overlay can provide:
1. formatVerseText(text: string): string | DocumentFragment - for Hebrew/English text formatting
2. getSidebarInfo(verse): string | HTMLElement - for overlay-info section
3. getLinkSubtitle(verse): string - for Sefaria link subtitle

This will centralize overlay-specific presentation logic within each overlay module and simplify sidebar.ts.
