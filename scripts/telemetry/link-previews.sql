SELECT blob6 AS fetcher, blob7 AS what, SUM(_sample_interval) AS previews
FROM torahmap_events
WHERE blob1 = 'link_preview' AND {{SITE}}
GROUP BY fetcher, what
ORDER BY previews DESC
