# Changelog

All notable changes to this repository are recorded here, one entry per change, in the pull request that
introduces it.

## [Unreleased]

## [3.0.0] - 2026-10-21

HU-CATALOG-001 and the base scaffold of the database promoted from `qa` to `main`.

### Added
- `movies` collection with its `$jsonSchema` validator (`strict`, `error`, `additionalProperties: false`) and the
  index `idx_movies_publication_status_deleted_at` (HU-CATALOG-001).
- `tests/movies_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.
- `idempotency_key` collection with its validator and the TTL index `idx_idempotency_key_created_at` (7 days), for the
  `Idempotency-Key` of the movie writes (ADR-037, HU-CATALOG-001).
- `tests/idempotency_key_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.

### Changed
- The `movies` validator accepts `cast` (array of strings, at most 50) through the `collMod` changeset
  `movies-003-validator-add-cast`, as the catalog data model already lists it (HU-CATALOG-001).
