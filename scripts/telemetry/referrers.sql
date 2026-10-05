SELECT blob7 AS referrer, SUM(_sample_interval) AS views
FROM torahmap_events
WHERE blob1 = 'page_view' AND {{SITE}}
GROUP BY referrer
ORDER BY views DESC
