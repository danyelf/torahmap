SELECT blob6 AS book, blob7 AS overlay, SUM(_sample_interval) AS clicks
FROM torahmap_events
WHERE blob1 = 'sefaria_click' AND {{SITE}}
GROUP BY book, overlay
ORDER BY clicks DESC
