SELECT blob1 AS event, blob6 AS source, blob7 AS message, SUM(_sample_interval) AS times
FROM torahmap_events
WHERE blob1 IN ('error', 'worker_error') AND {{SITE}}
GROUP BY event, source, message
ORDER BY times DESC
