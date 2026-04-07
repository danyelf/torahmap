---
id: tm-kab
status: open
priority: 3
type: feature
created: 2026-01-27
---

# Add hover state for pinned verses

Show visual feedback when hovering over verses while one is already pinned.

Current state:
- Pinned verse shows outline/highlight
- Hovering over OTHER verses while pinned... unclear what happens
- No clear visual indication of "clicking here will replace the pin"

Expected behavior:
- When hovering over a different verse while one is pinned:
  - Show some hover feedback (different from pin highlight)
  - Indicate that clicking will unpin current & pin the hovered verse
- Make interaction model more discoverable

Current implementation questions:
- Does hover highlighting work when a verse is pinned?
- Is it visually distinct from the pin highlight?
- Should there be a cursor change (pointer)?

Potential solutions:
1. Add a secondary hover state color when pinned
2. Dim the current pin slightly while hovering elsewhere
3. Use different outline styles (pin = solid, hover = dashed?)
4. Add cursor: pointer on verses when pinned (implies clickable)

Goal: Make it obvious that you can click other verses to switch pins
