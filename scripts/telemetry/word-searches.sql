SELECT blob1 AS event, blob5 AS word, blob6 AS choice_or_verse, SUM(_sample_interval) AS n
FROM torahmap_events
WHERE blob1 IN ('word_menu_open', 'word_search') AND timestamp > NOW() - INTERVAL '{{DAYS}}' DAY
GROUP BY event, word, choice_or_verse
ORDER BY n DESC
LIMIT 25
