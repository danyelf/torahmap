---
id: tm-764m
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-27
---

# Update search() to support Hebrew mode parameter

Update search() signature to accept hebrewMode: 'substring' | 'word' | 'root'. Add branching logic to call appropriate search method based on mode. Default to 'substring' for backward compatibility.
