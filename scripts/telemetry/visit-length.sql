/* A visit's length is its longest visit_end; 0 means the page was never shown. A visit that sent no visit_end (its browser ran no pagehide) is not counted. */
SELECT device,
  sumIf(w, seconds = 0) AS never_shown,
  sumIf(w, seconds > 0 AND seconds < 5) AS under_5s,
  sumIf(w, seconds >= 5 AND seconds < 30) AS s5_to_30,
  sumIf(w, seconds >= 30 AND seconds < 120) AS s30_to_120,
  sumIf(w, seconds >= 120) AS over_120s
FROM (
  SELECT visit, device, max(visible_seconds) AS seconds, max(_sample_interval) AS w
  FROM (
    SELECT index1 AS visit, blob4 AS device, double1 AS visible_seconds, _sample_interval
    FROM torahmap_events
    WHERE blob1 = 'visit_end' AND {{SITE}}
  )
  GROUP BY visit, device
)
GROUP BY device
ORDER BY device
