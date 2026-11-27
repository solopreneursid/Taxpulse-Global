-- Extend the append-only rule ledger to effective-dated national and investment rules.
-- Apply after 004 with the publisher disabled. Inspect any conflicting historical
-- version IDs before applying: a conflict intentionally aborts the migration.

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
