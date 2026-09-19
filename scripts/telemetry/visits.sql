SELECT toStartOfDay(timestamp) AS day, blob2 AS driver, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'page_view' AND {{SITE}}
GROUP BY day, driver
ORDER BY day, driver
