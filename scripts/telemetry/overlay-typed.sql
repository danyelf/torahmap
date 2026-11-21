SELECT overlay, typed, pick, SUM(_sample_interval) AS picks
FROM (
  SELECT blob6 AS overlay, blob7 AS pick, blob8 AS how, blob9 AS typed, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'overlay_pick' AND {{SITE}}
)
WHERE how = 'typed'
GROUP BY overlay, typed, pick
ORDER BY picks DESC
LIMIT 100
