---
id: tm-9mva
status: closed
priority: 2
type: bug
created: 2026-01-28
closed: 2026-01-28
---

# Hebrew search mode not persisted in URL on mode change

When user changes Hebrew search mode (substring/word/root) via radio buttons, the URL doesn't update with the hm parameter. The mode is only saved to URL on initial search. Need to call updateCallback() when radio button changes to trigger URL update.
