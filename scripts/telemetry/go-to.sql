SELECT ref, area, typed, SUM(_sample_interval) AS goes
FROM (
  SELECT blob6 AS typed, blob7 AS ref, blob8 AS area, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'go_to' AND {{SITE}}
)
WHERE ref != ''
GROUP BY ref, area, typed
ORDER BY goes DESC
LIMIT 25
