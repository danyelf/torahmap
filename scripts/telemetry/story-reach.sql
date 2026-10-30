/* Events sent before 2026-09-27 have no story name; the tour was the only story then. */
SELECT if(story = '', 'tour', story) AS story, stop_number, stop_id, SUM(_sample_interval) AS visits
FROM (
  SELECT blob7 AS story, double1 AS stop_number, blob6 AS stop_id, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'story_stop' AND {{SITE}}
)
GROUP BY story, stop_number, stop_id
ORDER BY story, stop_number
