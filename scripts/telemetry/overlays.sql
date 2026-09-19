SELECT blob2 AS mode, blob6 AS overlay, SUM(_sample_interval) AS switches
FROM torahmap_events
WHERE blob1 = 'overlay_switch' AND {{SITE}}
GROUP BY mode, overlay
ORDER BY switches DESC
