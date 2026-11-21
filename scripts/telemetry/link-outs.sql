SELECT blob7 AS area, blob8 AS overlay, SUM(_sample_interval) AS clicks
FROM torahmap_events
WHERE blob1 = 'link_out' AND {{SITE}}
GROUP BY area, overlay
ORDER BY clicks DESC
