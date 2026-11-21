/* Events sent before 2026-09-27 have no story name; the tour was the only story then. */
/* A visit counts once at each stop, whatever the page sends. */
SELECT if(story = '', 'tour', story) AS story, stop_number, stop_id, SUM(w) AS visits
FROM (
  SELECT index1 AS visit, blob7 AS story, double1 AS stop_number, blob6 AS stop_id,
    max(_sample_interval) AS w
  FROM torahmap_events
  WHERE blob1 = 'story_stop' AND {{SITE}}
  GROUP BY visit, story, stop_number, stop_id
)
GROUP BY story, stop_number, stop_id
ORDER BY story, stop_number
