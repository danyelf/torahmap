/* Visits that searched, and of them those that switched overlay between two searches. */
SELECT SUM(w) AS visits_that_searched, sumIf(w, switched_between) AS searched_switched_searched
FROM (
  SELECT w, arrayExists(o -> o > first_search AND o < last_search, switches) AS switched_between
  FROM (
    SELECT visit,
      minIf(sequence, event = 'search_execute') AS first_search,
      maxIf(sequence, event = 'search_execute') AS last_search,
      groupArrayIf(sequence, event = 'overlay_switch') AS switches,
      countIf(event = 'search_execute') AS searches,
      max(_sample_interval) AS w
    FROM (
      SELECT index1 AS visit, blob1 AS event, double20 AS sequence, _sample_interval
      FROM torahmap_events
      WHERE blob1 IN ('search_execute', 'overlay_switch') AND {{SITE}}
    )
    GROUP BY visit
  )
  WHERE searches > 0
)
