SELECT blob5 AS book, blob6 AS overlay, SUM(_sample_interval) AS clicks
FROM torahmap_events
WHERE blob1 = 'sefaria_click' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY book, overlay
ORDER BY clicks DESC
