SELECT double1 AS stop_number, blob6 AS stop_id, blob7 AS how, SUM(_sample_interval) AS exits
FROM torahmap_events
WHERE blob1 = 'story_exit' AND {{SITE}}
GROUP BY stop_number, stop_id, how
ORDER BY stop_number, how
