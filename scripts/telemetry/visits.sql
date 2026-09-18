SELECT toStartOfDay(timestamp) AS day, blob2 AS opened_in, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'page_view' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY day, opened_in
ORDER BY day, opened_in
