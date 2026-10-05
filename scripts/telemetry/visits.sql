SELECT toStartOfDay(timestamp) AS day, blob2 AS mode, blob4 AS device, blob10 AS visited,
  SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'page_view' AND {{SITE}}
GROUP BY day, mode, device, visited
ORDER BY day, mode, device, visited
