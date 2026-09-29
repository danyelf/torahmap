/* overlay is blank whenever the shared link left it out: every story-stop
   share, and a view left on the default overlay. Blank means "not stated",
   not "no overlay". */
SELECT blob6 AS how, blob7 AS what, blob10 AS overlay, SUM(_sample_interval) AS shares
FROM torahmap_events
WHERE blob1 = 'share' AND {{SITE}}
GROUP BY how, what, overlay
ORDER BY shares DESC
