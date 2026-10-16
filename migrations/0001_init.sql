-- Only disposable UUIDs and a timestamp, never student data.
CREATE TABLE IF NOT EXISTS probes (
  id TEXT PRIMARY KEY CHECK(length(id) = 36),
  marker TEXT NOT NULL CHECK(length(marker) = 36),
  created_at INTEGER NOT NULL
);
-- A singleton counter caps lifetime writes to this disposable test database.
CREATE TABLE IF NOT EXISTS budget (id INTEGER PRIMARY KEY CHECK(id = 1), used INTEGER NOT NULL);
INSERT OR IGNORE INTO budget (id, used) VALUES (1, 0);
CREATE TRIGGER IF NOT EXISTS probes_cap BEFORE INSERT ON probes
BEGIN
  SELECT CASE WHEN (SELECT used FROM budget WHERE id = 1) >= 500
    THEN RAISE(ABORT, 'probe_budget_exhausted') END;
END;
CREATE TRIGGER IF NOT EXISTS probes_count AFTER INSERT ON probes
BEGIN
  UPDATE budget SET used = used + 1 WHERE id = 1;
END;
