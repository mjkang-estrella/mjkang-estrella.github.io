-- UTC calendar days: today and the preceding 29 days. Counts are not people.
SELECT event, page, target, context, SUM(count) AS total
FROM daily_counts
WHERE day >= date('now', '-29 days') AND day <= date('now')
GROUP BY event, page, target, context
ORDER BY event, total DESC;
