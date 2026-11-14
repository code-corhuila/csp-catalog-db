## What changes and why
<!-- One paragraph. The reviewer reads this before the diff. -->


## User story (required)
<!-- Replace NN with the story issue of csp-docs. A base scaffold pull request (structure only) writes:
     "Not applicable: base scaffold, structure only". -->
Refs: code-corhuila/csp-docs#NN


## How it was tested
- Rebuild check (update, update again, rollback, update, validate):
- `db-ci.yml` result:


## Size
<!-- Run: git diff --numstat origin/develop...HEAD -->
Added: · Deleted: · Total:  (limit 400, excluding tests and generated files)


## Promotion trail (only for pull requests into `qa` or `main`)
<!-- List the original commits this pull request re-applies.
     Every commit must carry the line "(cherry picked from commit <sha>)". -->
-


## Checklist
- [ ] Meets the acceptance criteria of the user story (or is a base scaffold, not applicable)
- [ ] Local validation passes (changesets apply from an empty database)
- [ ] Under 400 changed lines, excluding tests and generated files
- [ ] Title follows Conventional Commits
- [ ] Only NEW changesets: no applied changeset was edited
- [ ] Every changeset declares its inline `rollback` and is idempotent by itself
- [ ] No credentials: roles are created without password
- [ ] Schema follows the data model of `csp-docs` and touches only the `catalog_db` database
- [ ] Into `qa` or `main`: every commit was re-applied with `git cherry-pick -x`
