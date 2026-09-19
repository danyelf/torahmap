SELECT blob8 AS zoom_band, blob7 AS section, blob6 AS book, SUM(_sample_interval) AS views
FROM torahmap_events
WHERE blob1 = 'view_settled' AND {{SITE}}
GROUP BY zoom_band, section, book
ORDER BY zoom_band, views DESC
