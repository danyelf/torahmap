/* Events sent before 2026-09-27 have no story name; the tour was the only story then. */
SELECT if(story = '', 'tour', story) AS story, stop_number, stop_id, how, SUM(_sample_interval) AS exits
FROM (
  SELECT blob8 AS story, double1 AS stop_number, blob6 AS stop_id, blob7 AS how, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'story_exit' AND {{SITE}}
)
GROUP BY story, stop_number, stop_id, how
ORDER BY story, stop_number, how
