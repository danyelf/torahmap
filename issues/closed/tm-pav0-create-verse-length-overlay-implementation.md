---
id: tm-pav0
status: closed
priority: 2
type: task
created: 2026-01-28
closed: 2026-01-28
---

# Create verse-length overlay implementation

Implement src/overlays/verse-length.ts with:
- configure() function that accepts VerseTexts
- Build wordCount cache (Map<verseKey, number>)
- Calculate min/max word counts for scaling
- getVerseColor() using logarithmic scale and cool-to-warm gradient (blue→cyan→green→yellow→orange→red)
- renderLegend() showing gradient bar and word count range
- getHoverInfo() returning word count
- renderSidebarInfo() showing word count in sidebar
