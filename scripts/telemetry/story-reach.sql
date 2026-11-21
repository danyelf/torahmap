/* Events sent before 2026-09-27 have no story name; the tour was the only story then. */
/* A visit counts at every stop up to the furthest it reached, since a fast scroll skips stops without an event. */
SELECT if(story = '', 'tour', story) AS story, stop_number, SUM(w) AS visits
FROM (
  SELECT story, arrayJoin(range(1, toUInt32(furthest) + 1)) AS stop_number, w
  FROM (
    SELECT visit, story, max(stop_number) AS furthest, max(_sample_interval) AS w
    FROM (
      SELECT index1 AS visit, blob7 AS story, double1 AS stop_number, _sample_interval
      FROM torahmap_events
      WHERE blob1 = 'story_stop' AND {{SITE}}
    )
    GROUP BY visit, story
  )
)
GROUP BY story, stop_number
ORDER BY story, stop_number
