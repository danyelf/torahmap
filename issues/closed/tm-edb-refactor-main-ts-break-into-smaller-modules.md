---
id: tm-edb
status: closed
priority: 2
type: chore
created: 2026-01-26
closed: 2026-01-26
---

# Refactor main.ts - break into smaller modules

The main() function is 741 lines, handling data loading, WebGL init, event listeners, state management, and URL sync. This violates single responsibility principle and makes testing difficult.

File: src/main.ts lines 121-862
Impact: Hard to maintain, test, and debug
Fix: Split into separate modules for initialization, events, state, rendering
