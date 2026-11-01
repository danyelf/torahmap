SELECT blob6 AS overlay, blob7 AS pick, blob8 AS how, SUM(_sample_interval) AS picks
FROM torahmap_events
WHERE blob1 = 'overlay_pick' AND {{SITE}}
GROUP BY overlay, pick, how
ORDER BY picks DESC
LIMIT 100
