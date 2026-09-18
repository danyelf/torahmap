SELECT blob5 AS term, blob6 AS language, blob7 AS search_mode, SUM(_sample_interval) AS searches
FROM torahmap_events
WHERE blob1 = 'search_execute' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY term, language, search_mode
ORDER BY searches DESC
LIMIT 25
