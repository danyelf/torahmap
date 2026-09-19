SELECT double1 AS stop_number, blob6 AS stop_id, SUM(_sample_interval) AS visits
FROM torahmap_events
WHERE blob1 = 'story_stop' AND {{SITE}}
GROUP BY stop_number, stop_id
ORDER BY stop_number
