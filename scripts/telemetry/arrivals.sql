SELECT blob9 AS arrived_with, SUM(_sample_interval) AS views
FROM torahmap_events
WHERE blob1 = 'page_view' AND {{SITE}}
GROUP BY arrived_with
ORDER BY views DESC
