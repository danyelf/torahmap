SELECT blob7 AS zoom_band, blob6 AS section, blob5 AS book, SUM(_sample_interval) AS views
FROM torahmap_events
WHERE blob1 = 'view_settled' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY zoom_band, section, book
ORDER BY zoom_band, views DESC
