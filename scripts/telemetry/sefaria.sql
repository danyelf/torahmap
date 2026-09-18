SELECT blob6 AS book, blob7 AS overlay, SUM(_sample_interval) AS clicks
FROM torahmap_events
WHERE blob1 = 'sefaria_click' AND blob5 = 'torahmap.org' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY book, overlay
ORDER BY clicks DESC
