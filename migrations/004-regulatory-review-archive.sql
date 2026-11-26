-- Apply once after 003, with the publisher disabled. Legacy snapshots retain NULL.
ALTER TABLE regulatory_head ADD COLUMN review_record TEXT CHECK(review_record IS NULL OR (json_valid(review_record) AND length(review_record)<=8192));
ALTER TABLE regulatory_snapshots ADD COLUMN review_record TEXT CHECK(review_record IS NULL OR (json_valid(review_record) AND length(review_record)<=8192));
CREATE TRIGGER regulatory_head_review_required BEFORE UPDATE ON regulatory_head
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
DROP TRIGGER regulatory_head_archive;
CREATE TRIGGER regulatory_head_archive AFTER UPDATE ON regulatory_head
BEGIN
 INSERT INTO regulatory_events(sequence,digest,state) VALUES(NEW.sequence,NEW.digest,NEW.state);
 INSERT INTO regulatory_snapshots(sequence,digest,envelope,published_at,review_record)
 SELECT NEW.sequence,NEW.digest,NEW.envelope,strftime('%Y-%m-%dT%H:%M:%fZ','now'),NEW.review_record WHERE NEW.state='active';
END;
