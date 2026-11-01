SELECT blob6 AS overlay, blob8 AS how, SUM(_sample_interval) AS picks
FROM torahmap_events
WHERE blob1 = 'overlay_pick' AND {{SITE}}
GROUP BY overlay, how
ORDER BY overlay, picks DESC
