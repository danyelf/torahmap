SELECT blob6 AS term, blob7 AS language, blob8 AS search_mode, SUM(_sample_interval) AS searches
FROM torahmap_events
WHERE blob1 = 'search_execute' AND blob5 = 'torahmap.org' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY term, language, search_mode
ORDER BY searches DESC
LIMIT 25
