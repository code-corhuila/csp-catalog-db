// Checks what the login of the API can and cannot do (ADR-049, TD-042). Run it WITH THE CREDENTIALS OF catalog_app, after the
// migration: it holds only the role catalog_writer, so it reads and writes the collections of catalog_db and cannot create
// indexes, drop collections or manage roles and users, nor read another database.
// Run with: mongosh --quiet -u catalog_app -p <password> --authenticationDatabase catalog_db <uri>/catalog_db tests/catalog_app_privileges_test.js
// Exits non-zero on any failure and prints the totals, so "0 checks" cannot pass as OK.

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed += 1;
    print(`PASS ${name}`);
  } else {
    failed += 1;
    print(`FAIL ${name}`);
  }
}

function works(name, action) {
  try {
    action();
    check(name, true);
  } catch (error) {
    check(name, false);
  }
}

function isRefused(name, action) {
  try {
    action();
    check(name, false);
  } catch (error) {
    check(name, true);
  }
}

works("it reads movies", () => db.movies.find().limit(1).toArray());
works("it updates the documents of showtimes", () => db.showtimes.updateMany({ _id: "no-such-showtime" }, { $set: { probe: 1 } }));
works("it removes documents of idempotency_key", () => db.idempotency_key.deleteMany({ _id: "no-such-key" }));
works("it reads outbox_event", () => db.outbox_event.find().limit(1).toArray());

isRefused("it cannot create an index", () => db.movies.createIndex({ probe: 1 }));
isRefused("it cannot create a user", () => db.createUser({ user: "probe", pwd: "x", roles: [] }));
isRefused("it cannot create a role", () => db.createRole({ role: "probe", privileges: [], roles: [] }));
isRefused("it cannot read another database", () => db.getSiblingDB("admin").getCollection("system.users").find().toArray());
isRefused("it cannot drop a collection", () => db.movies.drop());

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
