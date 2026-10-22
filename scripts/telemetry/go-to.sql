SELECT blob7 AS ref, blob8 AS area, blob6 AS typed, SUM(_sample_interval) AS goes
FROM torahmap_events
WHERE blob1 = 'go_to' AND {{SITE}}
GROUP BY ref, area, typed
ORDER BY goes DESC
LIMIT 25
