/* Visits that searched, and of them those that switched overlay between their first and last search. Judged by each visit's first and last overlay switch, so a visit whose only switch in between has others outside the two searches is missed. */
SELECT SUM(w) AS visits_that_searched, sumIf(w, switched_between) AS searched_switched_searched
FROM (
  SELECT w,
    (first_switch > first_search AND first_switch < last_search)
      OR (last_switch > first_search AND last_switch < last_search) AS switched_between
  FROM (
    SELECT visit,
      min(if(event = 'search_execute', sequence, 1000000)) AS first_search,
      max(if(event = 'search_execute', sequence, 0)) AS last_search,
      min(if(event = 'overlay_switch', sequence, 1000000)) AS first_switch,
      max(if(event = 'overlay_switch', sequence, 0)) AS last_switch,
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
