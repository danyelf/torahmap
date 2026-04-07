---
id: tm-kww
status: closed
priority: 1
type: bug
created: 2026-01-27
closed: 2026-01-27
---

# Fix overlay leakage into sidebar

**Problem:** sidebar.ts directly imports and calls functions from individual overlay implementations (getSelectedTrop, highlightSearchTerms, getVerseLinkCount, etc.) and uses hardcoded overlay ID checks. This violates the overlay abstraction.

**Impact:**
- Overlays aren't truly pluggable/removable
- Adding new overlays requires modifying sidebar code
- Breaks the main selling point of the overlay system

**Solution:**
1. Extend Overlay interface with sidebar-specific methods:
   - renderSidebarInfo?(verse: VerseIdentity, isPinned: boolean): HTMLElement | string | null
   - highlightVerseText?(text: string, language: 'he' | 'en'): DocumentFragment | string
2. Remove all overlay-specific imports from sidebar.ts
3. Sidebar should only know about Overlay interface

**Files:**
- src/sidebar.ts (lines 6-9, 116, 145, 147, 155, 166)
- src/overlays/types.ts (extend interface)
- All overlay implementations
