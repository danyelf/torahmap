/* Visits that searched three or more times, with the seconds from the first search to the last. */
SELECT visit, searches, seconds
FROM (
  SELECT visit, SUM(_sample_interval) AS searches,
    toUnixTimestamp(max(at)) - toUnixTimestamp(min(at)) AS seconds
  FROM (
    SELECT index1 AS visit, timestamp AS at, _sample_interval
    FROM torahmap_events
    WHERE blob1 = 'search_execute' AND {{SITE}}
  )
  GROUP BY visit
)
WHERE searches >= 3
ORDER BY searches DESC
LIMIT 50
