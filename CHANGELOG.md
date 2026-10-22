# Changelog

All notable changes to this repository are recorded here, one entry per change, in the pull request that
introduces it.

## [Unreleased]

### Added
- `movies` collection with its `$jsonSchema` validator (`strict`, `error`, `additionalProperties: false`) and the
  index `idx_movies_publication_status_deleted_at` (HU-CATALOG-001).
- `tests/movies_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.
- `idempotency_key` collection with its validator and the TTL index `idx_idempotency_key_created_at` (7 days), for the
  `Idempotency-Key` of the movie writes (ADR-037, HU-CATALOG-001).
- `tests/idempotency_key_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.
- `rooms` collection with its `$jsonSchema` validator (`strict`, `error`, `additionalProperties: false`, embedded seats
  of at most 500 items) and the unique index `idx_rooms_name` (HU-CATALOG-002).
- `tests/rooms_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.
- `showtimes` collection with its validator (`strict`, `error`, `additionalProperties: false`, `price_cents` as `long`,
  and `ends_at` greater than `starts_at` through `$expr`) and the indexes `idx_showtimes_movie_id_starts_at` and
  `idx_showtimes_room_id_starts_at` (HU-CATALOG-003).
- `outbox_event` collection with its validator, the relay index `idx_outbox_event_created_at_id` and the TTL index
  `idx_outbox_event_created_at_ttl` (30 days), for the transactional outbox of ADR-019 (HU-CATALOG-003).
- `tests/showtimes_schema_test.js` and `tests/outbox_event_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.
- Index `idx_showtimes_status_starts_at` on `showtimes` (`status`, `starts_at`), which answers the public billboard query
  (scheduled showtimes in a start window, ordered by start), with its schema test checks (HU-CATALOG-004).
- Note: the read-only role `catalog_outbox_reader` is not created here; the executor cannot create roles, so it is a
  follow-up for `csp-infra-mongo`.

### Changed
- The `movies` validator accepts `cast` (array of strings, at most 50) through the `collMod` changeset
  `movies-003-validator-add-cast`, as the catalog data model already lists it (HU-CATALOG-001).
- The `idempotency_key` validator accepts the operations `CREATE_ROOM`, `UPDATE_ROOM` and `ARCHIVE_ROOM` through the
  `collMod` changeset `idempotency-key-003-validator-room-operations`, for the `Idempotency-Key` of the room writes
  (ADR-037, HU-CATALOG-002).
- The `rooms` validator accepts the optional `schedule_version` (int, minimum 0), the counter the API increments in the
  transaction that schedules a showtime, through the `collMod` changeset `rooms-003-validator-add-schedule-version`
  (HU-CATALOG-003).
- The `idempotency_key` validator accepts the operations `CREATE_SHOWTIME`, `UPDATE_SHOWTIME` and `CANCEL_SHOWTIME`
  through the `collMod` changeset `idempotency-key-004-validator-showtime-operations` (ADR-037, HU-CATALOG-003).
