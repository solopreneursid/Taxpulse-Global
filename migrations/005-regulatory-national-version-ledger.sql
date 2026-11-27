-- Extend the append-only rule ledger to effective-dated national and investment rules.
-- Apply after 004 with the preview publisher disabled. A conflicting historical
-- version ID must abort; this migration must never rewrite an existing definition.

-- Reinstall the guards from migrations 001-004 as well. Some existing preview
-- databases have the schema columns/tables but are missing the earlier triggers.
CREATE TRIGGER IF NOT EXISTS regulatory_head_monotonic
BEFORE UPDATE ON regulatory_head
WHEN NEW.sequence<=OLD.sequence
BEGIN SELECT RAISE(ABORT,'non-monotonic sequence'); END;

CREATE TRIGGER IF NOT EXISTS regulatory_ledger_no_update
BEFORE UPDATE ON regulatory_version_ledger
BEGIN SELECT RAISE(ABORT,'immutable version ledger'); END;

CREATE TRIGGER IF NOT EXISTS regulatory_ledger_no_delete
BEFORE DELETE ON regulatory_version_ledger
BEGIN SELECT RAISE(ABORT,'immutable version ledger'); END;

CREATE TRIGGER IF NOT EXISTS regulatory_snapshot_no_update
BEFORE UPDATE ON regulatory_snapshots
BEGIN SELECT RAISE(ABORT,'immutable snapshot archive'); END;

CREATE TRIGGER IF NOT EXISTS regulatory_snapshot_no_delete
BEFORE DELETE ON regulatory_snapshots
BEGIN SELECT RAISE(ABORT,'immutable snapshot archive'); END;

CREATE TRIGGER IF NOT EXISTS regulatory_head_review_required
BEFORE UPDATE ON regulatory_head
WHEN NEW.state='active'
BEGIN
 SELECT CASE WHEN NEW.review_record IS NULL
 OR json_extract(NEW.review_record,'$.review.payload.snapshotDigest') IS NOT NEW.digest
 OR json_extract(NEW.review_record,'$.review.payload.sequence') IS NOT NEW.sequence
 OR coalesce(length(json_extract(NEW.review_record,'$.review.signature')),0)<>128
 OR coalesce(length(json_extract(NEW.review_record,'$.publisherPublicKeyHex')),0)<>64
 OR coalesce(length(json_extract(NEW.review_record,'$.reviewerPublicKeyHex')),0)<>64
 OR json_extract(NEW.review_record,'$.publisherPublicKeyHex')=json_extract(NEW.review_record,'$.reviewerPublicKeyHex')
 THEN RAISE(ABORT,'missing or mismatched regulatory review record') END;
END;

CREATE TRIGGER IF NOT EXISTS regulatory_head_archive
AFTER UPDATE ON regulatory_head
BEGIN
 INSERT INTO regulatory_events(sequence,digest,state) VALUES(NEW.sequence,NEW.digest,NEW.state);
 INSERT INTO regulatory_snapshots(sequence,digest,envelope,published_at,review_record)
 SELECT NEW.sequence,NEW.digest,NEW.envelope,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.review_record
 WHERE NEW.state='active';
END;

-- Backfill national/investment rule definitions from the immutable archive.
-- The ledger_no_update trigger above makes a conflicting upsert abort rather
-- than replacing an existing historical definition.
INSERT INTO regulatory_version_ledger(version,definition,first_sequence)
SELECT version,definition,min(sequence)
FROM (
 SELECT
  json_extract(v.value,'$.version') AS version,
  json_object(
   'period',json(v.value),
   'parameters',json(json_extract(
    s.envelope,
    '$.payload.national.' ||
    CASE WHEN json_extract(v.value,'$.component')='investment-assessment'
      THEN 'investment.' ELSE 'national.' END ||
    json_extract(v.value,'$.jurisdiction')
   )),
   'sourceUrls',json(json_extract(
    s.envelope,
    '$.payload.national.sources.' || json_extract(v.value,'$.jurisdiction')
   ))
  ) AS definition,
  s.sequence
 FROM regulatory_snapshots AS s,
      json_each(s.envelope,'$.payload.national.effectivePeriods') AS v
)
GROUP BY version,definition
ON CONFLICT(version) DO UPDATE SET definition=excluded.definition
WHERE regulatory_version_ledger.definition<>excluded.definition;

DROP TRIGGER IF EXISTS regulatory_snapshot_unique_versions;
CREATE TRIGGER regulatory_snapshot_unique_versions
BEFORE INSERT ON regulatory_snapshots
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT version FROM (
   SELECT json_extract(value,'$.version') AS version
    FROM json_each(NEW.envelope,'$.payload.regional.versions')
   UNION ALL SELECT json_extract(value,'$.version')
    FROM json_each(NEW.envelope,'$.payload.indiaSalary.versions')
   UNION ALL SELECT json_extract(value,'$.version')
    FROM json_each(NEW.envelope,'$.payload.payroll.versions')
   UNION ALL SELECT json_extract(value,'$.version')
    FROM json_each(NEW.envelope,'$.payload.national.effectivePeriods')
  ) GROUP BY version HAVING count(*)>1 OR version IS NULL
 ) THEN RAISE(ABORT,'duplicate or missing snapshot version') END;
END;

DROP TRIGGER IF EXISTS regulatory_versions_immutable;
CREATE TRIGGER regulatory_versions_immutable
BEFORE INSERT ON regulatory_snapshots
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT incoming.version
  FROM (
   SELECT json_extract(value,'$.version') AS version,json(value) AS definition
    FROM json_each(NEW.envelope,'$.payload.regional.versions')
   UNION ALL SELECT json_extract(value,'$.version'),json(value)
    FROM json_each(NEW.envelope,'$.payload.indiaSalary.versions')
   UNION ALL SELECT json_extract(value,'$.version'),json(value)
    FROM json_each(NEW.envelope,'$.payload.payroll.versions')
   UNION ALL
   SELECT
    json_extract(v.value,'$.version'),
    json_object(
     'period',json(v.value),
     'parameters',json(json_extract(
      NEW.envelope,
      '$.payload.national.' ||
      CASE WHEN json_extract(v.value,'$.component')='investment-assessment'
       THEN 'investment.' ELSE 'national.' END ||
      json_extract(v.value,'$.jurisdiction')
     )),
     'sourceUrls',json(json_extract(
      NEW.envelope,
      '$.payload.national.sources.' || json_extract(v.value,'$.jurisdiction')
     ))
    )
   FROM json_each(NEW.envelope,'$.payload.national.effectivePeriods') AS v
  ) AS incoming
  JOIN regulatory_version_ledger AS l ON l.version=incoming.version
  WHERE l.definition<>incoming.definition
 ) THEN RAISE(ABORT,'immutable historical version changed') END;
END;

DROP TRIGGER IF EXISTS regulatory_versions_record;
CREATE TRIGGER regulatory_versions_record
AFTER INSERT ON regulatory_snapshots
BEGIN
 INSERT OR IGNORE INTO regulatory_version_ledger(version,definition,first_sequence)
 SELECT version,definition,NEW.sequence
 FROM (
  SELECT json_extract(value,'$.version') AS version,json(value) AS definition
   FROM json_each(NEW.envelope,'$.payload.regional.versions')
  UNION ALL SELECT json_extract(value,'$.version'),json(value)
   FROM json_each(NEW.envelope,'$.payload.indiaSalary.versions')
  UNION ALL SELECT json_extract(value,'$.version'),json(value)
   FROM json_each(NEW.envelope,'$.payload.payroll.versions')
  UNION ALL
  SELECT
   json_extract(v.value,'$.version'),
   json_object(
    'period',json(v.value),
    'parameters',json(json_extract(
     NEW.envelope,
     '$.payload.national.' ||
     CASE WHEN json_extract(v.value,'$.component')='investment-assessment'
      THEN 'investment.' ELSE 'national.' END ||
     json_extract(v.value,'$.jurisdiction')
    )),
    'sourceUrls',json(json_extract(
     NEW.envelope,
     '$.payload.national.sources.' || json_extract(v.value,'$.jurisdiction')
    ))
   )
  FROM json_each(NEW.envelope,'$.payload.national.effectivePeriods') AS v
 );
END;
