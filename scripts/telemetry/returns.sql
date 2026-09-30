SELECT blob10 AS visited, SUM(_sample_interval) AS views
FROM torahmap_events
WHERE blob1 = 'page_view' AND {{SITE}}
GROUP BY visited
ORDER BY views DESC
