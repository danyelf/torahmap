SELECT blob6 AS stop_id, blob7 AS how, SUM(_sample_interval) AS returns
FROM torahmap_events
WHERE blob1 = 'story_return' AND {{SITE}}
GROUP BY stop_id, how
ORDER BY returns DESC
