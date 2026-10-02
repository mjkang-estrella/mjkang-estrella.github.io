-- Only daily totals. No raw event, request, visitor, session, IP or timestamp columns.
CREATE TABLE IF NOT EXISTS daily_counts (
    day TEXT NOT NULL,
    event TEXT NOT NULL,
    page TEXT NOT NULL,
    target TEXT NOT NULL DEFAULT '',
    context TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    PRIMARY KEY (day, event, page, target, context)
) WITHOUT ROWID;
