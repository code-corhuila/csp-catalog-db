// Checks the structure of catalog_db.idempotency_key (ADR-037): the validator accepts a valid key,
// rejects every invalid one, a key cannot be written twice, and the TTL index exists with its name
// and its 7-day expiry. Run with: mongosh --quiet <uri>/catalog_db tests/idempotency_key_schema_test.js
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

function validKey(overrides) {
  return Object.assign({
    _id: "synthetic-key-0001",
    operation: "CREATE_MOVIE",
    request_hash: "a".repeat(64),
    resource_id: "11111111-1111-4111-8111-111111111111",
    created_at: new Date()
  }, overrides);
}

function accepts(name, doc) {
  try {
    db.idempotency_key.insertOne(doc);
    db.idempotency_key.deleteOne({ _id: doc._id });
    check(name, true);
  } catch (e) {
    check(name, false);
  }
}

function rejects(name, doc) {
  try {
    db.idempotency_key.insertOne(doc);
    db.idempotency_key.deleteOne({ _id: doc._id });
    check(name, false);
  } catch (e) {
    check(name, e.code === 121);
  }
}

const info = db.getCollectionInfos({ name: "idempotency_key" })[0];
check("idempotency_key collection exists", info !== undefined);
check("validationLevel is strict", info !== undefined && info.options.validationLevel === "strict");
check("validationAction is error", info !== undefined && info.options.validationAction === "error");

if (info !== undefined) {
  accepts("accepts a valid key", validKey({}));
  accepts("accepts each operation", validKey({ operation: "ARCHIVE_MOVIE" }));
  rejects("rejects a key shorter than 8 characters", validKey({ _id: "short" }));
  rejects("rejects a key longer than 128 characters", validKey({ _id: "k".repeat(129) }));
  rejects("rejects an operation outside the enum", validKey({ operation: "DELETE_MOVIE" }));
  rejects("rejects a request hash that is not SHA-256 hex", validKey({ request_hash: "not-a-hash" }));
  rejects("rejects a resource id that is not a UUID", validKey({ resource_id: "not-a-uuid" }));
  rejects("rejects an undeclared field", validKey({ response_body: "{}" }));
  rejects("rejects a missing request hash", (() => {
    const doc = validKey({});
    delete doc.request_hash;
    return doc;
  })());
  rejects("rejects a missing creation date", (() => {
    const doc = validKey({});
    delete doc.created_at;
    return doc;
  })());

  const first = validKey({ _id: "synthetic-key-dup1" });
  db.idempotency_key.insertOne(first);
  let duplicateCode = null;
  try {
    db.idempotency_key.insertOne(first);
  } catch (e) {
    duplicateCode = e.code;
  }
  db.idempotency_key.deleteOne({ _id: first._id });
  check("rejects a second write of the same key (duplicate _id)", duplicateCode === 11000);
}

const ttl = info === undefined
  ? undefined
  : db.idempotency_key.getIndexes().find(i => i.name === "idx_idempotency_key_created_at");
check("index idx_idempotency_key_created_at exists", ttl !== undefined);
check("the index expires keys after 7 days", ttl !== undefined && ttl.expireAfterSeconds === 604800);
check("the index is on created_at", ttl !== undefined && JSON.stringify(ttl.key) === JSON.stringify({ created_at: 1 }));

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
