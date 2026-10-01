SELECT device, SUM(_sample_interval) AS loads,
  quantileExactWeighted(0.5)(texts_kbps, _sample_interval) AS texts_kbps_p50,
  quantileExactWeighted(0.9)(texts_kbps, _sample_interval) AS texts_kbps_p90
FROM (
  SELECT blob4 AS device, double4 AS texts_kbps, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'load_timing' AND {{SITE}}
)
WHERE texts_kbps > 0
GROUP BY device
ORDER BY loads DESC
