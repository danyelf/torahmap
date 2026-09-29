SELECT toStartOfDay(timestamp) AS day, blob4 AS device, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'webgl_missing' AND {{SITE}}
GROUP BY day, device
ORDER BY day, device
