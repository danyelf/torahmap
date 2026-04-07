---
id: tm-1qi
status: closed
priority: 2
type: task
created: 2026-01-26
closed: 2026-01-25
---

# Refactor main.ts to use new modules

Update src/main.ts to import and use all extracted modules. Replace inline code with module function calls. Update all event handlers. Main function should reduce from 741 to ~400 lines. All 831 existing tests must still pass.
