/* Visits that opened the menu, and of them those that never chose an item from it (a menu still open when the page left counts as abandoned). */
SELECT SUM(w) AS visits_that_opened_the_menu, sumIf(w, chosen = 0) AS never_chose_an_item
FROM (
  SELECT visit, countIf(state = 'open') AS opens,
    countIf(state = 'closed' AND item != '') AS chosen, max(_sample_interval) AS w
  FROM (
    SELECT index1 AS visit, blob6 AS state, blob7 AS item, _sample_interval
    FROM torahmap_events
    WHERE blob1 = 'menu' AND {{SITE}}
  )
  GROUP BY visit
)
WHERE opens > 0
