# Changelog

All notable changes to this repository are recorded here, one entry per change, in the pull request that
introduces it.

## [Unreleased]

### Added
- `movies` collection with its `$jsonSchema` validator (`strict`, `error`, `additionalProperties: false`) and the
  index `idx_movies_publication_status_deleted_at` (HU-CATALOG-001).
- `tests/movies_schema_test.js`, run by `db-ci.yml` after the rebuild cycle.
