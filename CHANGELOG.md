# Changelog

All notable changes to this repository are recorded here, one entry per change, in the pull request that
introduces it.

## [Unreleased]

## [3.0.0] - 2026-10-21

HU-CATALOG-001, HU-CATALOG-002, HU-CATALOG-003, HU-CATALOG-004, HU-CATALOG-006, the `catalog_writer` role of the API login (technical task `chore(grants)`) and the base scaffold of the database promoted from `qa` to `main`.

### Added
- `tests/catalog_app_privileges_test.js`, run by `db-ci.yml` as `catalog_app` after the migration (TD-042, ADR-049): the API login reads and writes the
  collections and cannot create an index, a user or a role, drop a collection or read another database.
- Role `catalog_writer` (`find`, `insert`, `update` and `remove` on the collections of `catalog_db`, no inherited roles, no password)
  and its grant to the login user `catalog_app` of the API, in `03_dcl/00_roles` (`catalog-roles-003` and `-004`), with
  `tests/catalog_writer_role_test.js` run by `db-ci.yml`. The user `catalog_app` is not created here: `csp-infra-mongo`
  creates it before the migration. The API needs no other privilege: it creates no collection, index or user.
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
- Role `catalog_outbox_reader` (only `find` on `catalog_db.outbox_event`, no inherited roles) and its grant to
  `worker_app`, through the changesets `catalog-roles-001-create-outbox-reader` and
  `catalog-roles-002-grant-outbox-reader-to-worker-app`, for the outbox relay of `csp-worker` (HU-CATALOG-003, ADR-019,
  ADR-039).
- `tests/outbox_reader_role_test.js`, run by `db-ci.yml` after the rebuild cycle.
- Indexes of the movie search of the public route `GET /billboard/movies` (HU-CATALOG-006, ADR-044): the text index
  `idx_movies_title_synopsis_text` on `title` and `synopsis` (`default_language: none`, so no stemming) through the changeset
  `movies-004-index-title-synopsis-text`, and `idx_movies_publication_status_genres` on `publication_status` and `genres`
  through `movies-005-index-publication-status-genres`; `tests/movies_schema_test.js` checks both indexes and that the
  text, genre and duration queries of the search return the expected movies and use them.

### Changed
- `db-ci.yml` uses the same MongoDB as `csp-infra-mongo` (7.0.14 with authentication, key file and replica set of one node), creates the logins `catalog_migrator`,
  `catalog_app` and `worker_app`, and applies the changelog with the executor as `catalog_migrator` instead of an unauthenticated server (TD-042).
- The executor image is fixed: Liquibase 4.29.2, `liquibase-mongodb` 4.29.1 and the Java driver 3.12.14 (TD-043, Annex G).
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
