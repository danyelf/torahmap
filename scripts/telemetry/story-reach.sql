/* Events sent before 2026-09-27 have no story name; the tour was the only story then. */
/* Each visit counts once, at the furthest stop it reached; a fast scroll skips stops without an event. Visits that reached stop N are the sum of this column from N down the page. */
SELECT if(story = '', 'tour', story) AS story, furthest_stop, SUM(w) AS visits
FROM (
  SELECT visit, story, max(stop_number) AS furthest_stop, max(_sample_interval) AS w
  FROM (
    SELECT index1 AS visit, blob7 AS story, double1 AS stop_number, _sample_interval
    FROM torahmap_events
    WHERE blob1 = 'story_stop' AND {{SITE}}
  )
  GROUP BY visit, story
)
GROUP BY story, furthest_stop
ORDER BY story, furthest_stop
