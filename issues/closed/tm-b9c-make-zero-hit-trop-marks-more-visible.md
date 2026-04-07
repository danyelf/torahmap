---
id: tm-b9c
status: closed
priority: 3
type: feature
created: 2026-01-27
closed: 2026-01-27
---

# Make zero-hit trop marks more visible

Improve visibility of verses without the selected trop mark.

Current state:
- When a trop mark is selected, matching verses are highlighted
- Verses WITHOUT the mark are dimmed significantly
- May be too dark/invisible, making it hard to see the overall text

Problem:
- Zero-hit verses become nearly invisible
- Difficult to maintain spatial awareness of the text
- Heatmap shows "where it is" but obscures "where it isn't"

Potential solutions:
1. Adjust dim factor to keep zero-hit verses more visible
2. Use a different visual encoding (opacity vs brightness)
3. Add a subtle background color instead of dimming
4. Make dimming less aggressive overall

Need to balance:
- Highlighting matching verses (good signal)
- Not losing context of non-matching verses (spatial awareness)
- Maintaining readability of the overall map

Related code:
- Trop overlay color logic
- HIGHLIGHT_CONSTANTS.DIM_FACTOR
