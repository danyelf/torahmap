/* Each visit's events in the order they happened, with the first thing each one names. Add AND index1 = '<visit id>' to the inner WHERE to follow one visit. */
SELECT visit, sequence, event, detail
FROM (
  SELECT index1 AS visit, double20 AS sequence, blob1 AS event, blob6 AS detail
  FROM torahmap_events
  WHERE blob1 IN ('page_view', 'story_stop', 'story_exit', 'story_return', 'view_settled',
    'overlay_switch', 'overlay_pick', 'search_execute', 'square_click', 'go_to', 'word_menu_open',
    'word_search', 'link_out', 'share', 'menu', 'error', 'load_timing', 'webgl_missing') AND {{SITE}}
)
ORDER BY visit, sequence
LIMIT 300
