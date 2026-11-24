SELECT item, SUM(_sample_interval) AS closes
FROM (
  SELECT blob6 AS state, blob7 AS item, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'menu' AND {{SITE}}
)
WHERE state = 'closed'
GROUP BY item
ORDER BY closes DESC
