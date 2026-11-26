-- Append-only identity ledger across all published snapshots, including superseded versions.
-- Apply after 001. Existing archive records must be inspected before migration.
CREATE TABLE IF NOT EXISTS regulatory_version_ledger (
 version TEXT PRIMARY KEY NOT NULL,
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 first_sequence INTEGER NOT NULL REFERENCES regulatory_snapshots(sequence)
);
-- Backfill directly from immutable archive; D1 disallows TEMP tables.
-- An attempted conflicting update aborts the entire backfill statement.
CREATE TRIGGER IF NOT EXISTS regulatory_ledger_no_update BEFORE UPDATE ON regulatory_version_ledger
BEGIN SELECT RAISE(ABORT,'immutable version ledger'); END;
INSERT INTO regulatory_version_ledger(version,definition,first_sequence)
SELECT version,definition,min(sequence) FROM (
 SELECT json_extract(v.value,'$.version') version,json(v.value) definition,s.sequence FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.regional.versions') v
 UNION ALL SELECT json_extract(v.value,'$.version'),json(v.value),s.sequence FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.indiaSalary.versions') v
 UNION ALL SELECT json_extract(v.value,'$.version'),json(v.value),s.sequence FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.payroll.versions') v
) GROUP BY version,definition
ON CONFLICT(version) DO UPDATE SET definition=excluded.definition
WHERE regulatory_version_ledger.definition<>excluded.definition;
CREATE TRIGGER IF NOT EXISTS regulatory_versions_immutable
BEFORE INSERT ON regulatory_snapshots
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM (SELECT json_extract(value,'$.version') AS version,json(value) AS definition FROM json_each(NEW.envelope,'$.payload.regional.versions')
 UNION ALL SELECT json_extract(value,'$.version'),json(value) FROM json_each(NEW.envelope,'$.payload.indiaSalary.versions')
 UNION ALL SELECT json_extract(value,'$.version'),json(value) FROM json_each(NEW.envelope,'$.payload.payroll.versions')) AS incoming JOIN regulatory_version_ledger l ON l.version=incoming.version WHERE l.definition<>incoming.definition) THEN RAISE(ABORT,'immutable historical version changed') END;
END;
CREATE TRIGGER IF NOT EXISTS regulatory_versions_record
AFTER INSERT ON regulatory_snapshots
BEGIN
 INSERT OR IGNORE INTO regulatory_version_ledger(version,definition,first_sequence)
 SELECT version,definition,NEW.sequence FROM (SELECT json_extract(value,'$.version') AS version,json(value) AS definition FROM json_each(NEW.envelope,'$.payload.regional.versions')
 UNION ALL SELECT json_extract(value,'$.version'),json(value) FROM json_each(NEW.envelope,'$.payload.indiaSalary.versions')
 UNION ALL SELECT json_extract(value,'$.version'),json(value) FROM json_each(NEW.envelope,'$.payload.payroll.versions'));
END;
CREATE TRIGGER IF NOT EXISTS regulatory_ledger_no_update BEFORE UPDATE ON regulatory_version_ledger
BEGIN SELECT RAISE(ABORT,'immutable version ledger'); END;
CREATE TRIGGER IF NOT EXISTS regulatory_ledger_no_delete BEFORE DELETE ON regulatory_version_ledger
BEGIN SELECT RAISE(ABORT,'immutable version ledger'); END;
CREATE TRIGGER IF NOT EXISTS regulatory_snapshot_no_update BEFORE UPDATE ON regulatory_snapshots
BEGIN SELECT RAISE(ABORT,'immutable snapshot archive'); END;
CREATE TRIGGER IF NOT EXISTS regulatory_snapshot_no_delete BEFORE DELETE ON regulatory_snapshots
BEGIN SELECT RAISE(ABORT,'immutable snapshot archive'); END;
