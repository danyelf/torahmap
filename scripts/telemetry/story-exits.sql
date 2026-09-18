SELECT double1 AS stop_number, blob6 AS stop, SUM(_sample_interval) AS exits
FROM torahmap_events
WHERE blob1 = 'story_exit' AND blob5 = 'torahmap.org' AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY stop_number, stop
ORDER BY stop_number
