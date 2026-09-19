SELECT blob1 AS event, blob6 AS word, blob7 AS choice_or_verse, SUM(_sample_interval) AS n
FROM torahmap_events
WHERE blob1 IN ('word_menu_open', 'word_search') AND {{SITE}}
GROUP BY event, word, choice_or_verse
ORDER BY n DESC
LIMIT 25
