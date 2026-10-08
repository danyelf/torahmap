SELECT blob7 AS area, blob8 AS overlay, SUM(_sample_interval) AS clicks
FROM torahmap_events
WHERE blob1 = 'sefaria_open' AND {{SITE}}
GROUP BY area, overlay
ORDER BY clicks DESC
