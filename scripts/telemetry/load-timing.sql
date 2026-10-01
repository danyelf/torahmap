SELECT device, SUM(_sample_interval) AS loads,
  sumIf(_sample_interval, texts_kbps = 0) AS loads_without_speed,
  quantileExactWeighted(0.5)(first_frame, _sample_interval) AS first_frame_p50,
  quantileExactWeighted(0.9)(first_frame, _sample_interval) AS first_frame_p90,
  quantileExactWeighted(0.5)(texts_in, _sample_interval) AS texts_in_p50,
  quantileExactWeighted(0.9)(texts_in, _sample_interval) AS texts_in_p90,
  quantileExactWeighted(0.5)(search_ready, _sample_interval) AS search_ready_p50,
  quantileExactWeighted(0.9)(search_ready, _sample_interval) AS search_ready_p90
FROM (
  SELECT blob4 AS device, double1 AS first_frame, double2 AS texts_in, double3 AS search_ready,
    double4 AS texts_kbps, _sample_interval
  FROM torahmap_events
  WHERE blob1 = 'load_timing' AND {{SITE}}
)
GROUP BY device
ORDER BY loads DESC
