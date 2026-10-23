SELECT typed, SUM(_sample_interval) AS misses
FROM (
  SELECT blob6 AS typed, blob7 AS ref, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'go_to' AND {{SITE}}
)
WHERE ref = ''
GROUP BY typed
ORDER BY misses DESC
LIMIT 25
