# csp-catalog-db

> catalog bounded context: database (collections, validators, indexes, roles, migrations)

Part of the **Cinesync Platform** distributed system — team `cinesync-platform`, Group 1.
Governance and documentation live in [`csp-docs`](https://github.com/code-corhuila/csp-docs).

## Purpose

This repository is the **only owner of the `catalog_db` database** of the Cinesync Platform: its collections,
validators, indexes, seeds and roles. `csp-catalog-api` consumes the database and never versions it. A migration of
catalog that lives anywhere else is a serious fault (Norma 5.2.1).

The repository currently holds the **base scaffold only**: the layout, the empty changelogs and the rebuild
verification. The collections of catalog are added later, each with its own changeset and inline reversion.

## Stack

| Item | Decision | Record |
|---|---|---|
| Engine | MongoDB 7, database `catalog_db`, single-node replica set | [ADR-016](https://github.com/code-corhuila/csp-docs/blob/main/05-architecture/decisions/records/ADR-016-catalog-java-mongodb-liquibase.md) |
| Migration tool | Liquibase 4.29 with the MongoDB extension (`liquibase-mongodb` and the `mongodb` driver) | [ADR-016](https://github.com/code-corhuila/csp-docs/blob/main/05-architecture/decisions/records/ADR-016-catalog-java-mongodb-liquibase.md) |
| Document structure | `$jsonSchema` validator per collection, `strict` and `error` | [ADR-016](https://github.com/code-corhuila/csp-docs/blob/main/05-architecture/decisions/records/ADR-016-catalog-java-mongodb-liquibase.md) |
| Control collections | `databasechangelog_catalog` and `databasechangeloglock_catalog` | [ADR-016](https://github.com/code-corhuila/csp-docs/blob/main/05-architecture/decisions/records/ADR-016-catalog-java-mongodb-liquibase.md) |
| Policy | Migrations live only in each `-db` | [`migration-strategy.md`](https://github.com/code-corhuila/csp-docs/blob/main/06-data/migration-strategy.md) |

The single MongoDB instance and its volume are defined in `csp-infra-mongo` (Annex J). This repository defines
**no database service and no volume**: it provides only the migration executor.

## Related repositories

| Repository | Relation |
|---|---|
| `csp-catalog-api` | Connects to `catalog_db`; runs no migration |
| `csp-catalog-portal` | Consumes the catalog through the API; never connects to this database |
| `csp-infra-mongo` | Defines the instance, creates the login users from secrets and composes the executor |
| `csp-docs` | Governance, data model, contracts and ADRs |

## Layout

```
changelog/changelog-master.yaml   single entry point: includes 01_ddl, 02_dml and 03_dcl in order
01_ddl/                           00_collections, 01_validators, 02_indexes, 03_views (one changelog.yaml each)
02_dml/                           00_inserts, 01_updates, 02_deletes, 03_upserts, 04_patches
03_dcl/                           00_roles
deploy/compose.yml                the migration executor catalog-db-migrate (no database service)
deploy/liquibase.Dockerfile       Liquibase 4.29 with the MongoDB extension and driver
.github/workflows/db-ci.yml       rebuilds the database from an empty MongoDB on every pull request
```

Every folder has a `changelog.yaml` and each family has an aggregator `changelog.yaml` that includes its children in
order. There is no `04_tcl/` and no `05_rollbacks/`: MongoDB has no foreign keys and each changeset declares its own
reversion. A changeset that is already applied is never edited; a change is a new changeset.

## Run the executor

The instance belongs to `csp-infra-mongo`, which also composes this file. To run the executor alone, start that
instance on the `platform` network and, from this repository:

```bash
cp .env.example .env     # and set the real values; never commit .env
docker compose -f deploy/compose.yml --env-file .env --profile tooling run --rm catalog-db-migrate                  # update
docker compose -f deploy/compose.yml --env-file .env --profile tooling run --rm catalog-db-migrate status --verbose  # pending changesets
docker compose -f deploy/compose.yml --env-file .env --profile tooling run --rm catalog-db-migrate history           # applied changesets
docker compose -f deploy/compose.yml --env-file .env --profile tooling run --rm catalog-db-migrate validate          # checksums
```

A second `update` applies nothing (`Run: 0`): that is the proof that the changesets are incremental.

## Reversion

Each changeset declares its inverse inline (`dropCollection`, `dropIndex`, ...) in its `rollback` block, so no
mirror scripts exist. To undo the last N applied changesets:

```bash
docker compose -f deploy/compose.yml --env-file .env --profile tooling run --rm catalog-db-migrate rollback-count N
```

`db-ci.yml` runs the full cycle: update, update again (zero applied), `rollback-count` of every applied changeset,
check that no application collection remains, update and `validate`. In production a correction is a new forward
changeset.

## Branching

Three permanent branches. **None of them accepts a direct commit** — you enter through a child
branch and leave through a Pull Request.

```
develop  <--PR--  feat/... fix/... chore/...
qa       <--PR--  qa/...
main     <--PR--  release/...  hotfix/...
```

Promotion happens **by re-application** (`git cherry-pick -x`), never by merging one permanent
branch into another: `merge develop -> qa` and `merge qa -> main` do not exist in this model.

`main` requires **1 approval from `ariel5253`**. On `develop` and `qa` the team sets its own review
rule.

Full policy: `00-governance/branching-policy.md` in `csp-docs`.

## Pull Requests and commits

- Commits follow Conventional Commits: `<type>(<scope>): <description>`, in English, lowercase and imperative.
- A Pull Request has at most **400 changed lines** (additions plus deletions) and one logical goal.
- Every Pull Request targets the permanent branch that matches its prefix, according to the diagram above.
