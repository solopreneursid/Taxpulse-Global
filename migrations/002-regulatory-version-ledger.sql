-- Append-only identity ledger across all published snapshots, including superseded versions.
-- Apply after 001. Existing archive records must be inspected before migration.
CREATE TABLE IF NOT EXISTS regulatory_version_ledger (
 version TEXT PRIMARY KEY NOT NULL,
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 first_sequence INTEGER NOT NULL REFERENCES regulatory_snapshots(sequence)
);
-- Backfill old archive records conservatively, rejecting a prior conflicting definition.
CREATE TEMP TABLE IF NOT EXISTS regulatory_ledger_backfill (
 version TEXT PRIMARY KEY NOT NULL,
 definition TEXT NOT NULL CHECK(json_valid(definition)),
 first_sequence INTEGER NOT NULL
);
DELETE FROM regulatory_ledger_backfill;
INSERT OR IGNORE INTO regulatory_ledger_backfill(version,definition,first_sequence)
SELECT json_extract(v.value,'$.version'),json(v.value),s.sequence
FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.regional.versions') v
UNION ALL SELECT json_extract(v.value,'$.version'),json(v.value),s.sequence
FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.indiaSalary.versions') v
UNION ALL SELECT json_extract(v.value,'$.version'),json(v.value),s.sequence
FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.payroll.versions') v
ORDER BY 3;
-- Fail on inconsistent archival history instead of accepting the first occurrence.
CREATE TEMP TABLE IF NOT EXISTS regulatory_ledger_guard(ok INTEGER CHECK(ok=1));
DELETE FROM regulatory_ledger_guard;
INSERT INTO regulatory_ledger_guard(ok)
SELECT CASE WHEN EXISTS (
 SELECT 1 FROM (
 SELECT json_extract(v.value,'$.version') version,json(v.value) definition FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.regional.versions') v
 UNION ALL SELECT json_extract(v.value,'$.version'),json(v.value) FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.indiaSalary.versions') v
 UNION ALL SELECT json_extract(v.value,'$.version'),json(v.value) FROM regulatory_snapshots s,json_each(s.envelope,'$.payload.payroll.versions') v
 ) records JOIN regulatory_ledger_backfill b ON b.version=records.version WHERE b.definition<>records.definition
) THEN 0 ELSE 1 END;
INSERT OR IGNORE INTO regulatory_version_ledger SELECT version,definition,first_sequence FROM regulatory_ledger_backfill;
DROP TABLE regulatory_ledger_guard;
DROP TABLE regulatory_ledger_backfill;
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
