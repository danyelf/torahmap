SELECT term, language, search_mode, SUM(_sample_interval) AS searches
FROM (
  SELECT blob6 AS term, blob7 AS language, blob8 AS search_mode, double1 AS result_count,
    _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'search_execute' AND {{SITE}}
)
WHERE result_count = 0
GROUP BY term, language, search_mode
ORDER BY searches DESC
LIMIT 25
