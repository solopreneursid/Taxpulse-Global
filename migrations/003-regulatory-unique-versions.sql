-- Reject duplicate explicit version IDs within one snapshot before the ledger can
-- silently discard them via INSERT OR IGNORE. Existing snapshots must be checked
-- by the release operator before applying this migration.
CREATE TRIGGER IF NOT EXISTS regulatory_snapshot_unique_versions
BEFORE INSERT ON regulatory_snapshots
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT version FROM (
   SELECT json_extract(value,'$.version') AS version FROM json_each(NEW.envelope,'$.payload.regional.versions')
   UNION ALL SELECT json_extract(value,'$.version') FROM json_each(NEW.envelope,'$.payload.indiaSalary.versions')
   UNION ALL SELECT json_extract(value,'$.version') FROM json_each(NEW.envelope,'$.payload.payroll.versions')
  ) GROUP BY version HAVING count(*) > 1 OR version IS NULL
 ) THEN RAISE(ABORT,'duplicate or missing snapshot version') END;
END;
