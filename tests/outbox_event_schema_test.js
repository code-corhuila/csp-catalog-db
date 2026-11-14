// Checks the structure of catalog_db.outbox_event (ADR-019, HU-CATALOG-003): the validator accepts a
// valid event, rejects every invalid one, and the relay index and the 30-day TTL index exist.
// Run with: mongosh --quiet <uri>/catalog_db tests/outbox_event_schema_test.js
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

function validEvent(overrides) {
  return Object.assign({
    _id: "11111111-1111-4111-8111-111111111111",
    aggregate_type: "Showtime",
    aggregate_id: "22222222-2222-4222-8222-222222222222",
    event_type: "ShowtimePublished",
    payload: { showtime_id: "22222222-2222-4222-8222-222222222222", price_cents: NumberLong(1500) },
    created_at: new Date()
  }, overrides);
}

function accepts(name, doc) {
  try {
    db.outbox_event.insertOne(doc);
    db.outbox_event.deleteOne({ _id: doc._id });
    check(name, true);
  } catch (e) {
    check(name, false);
  }
}

function rejects(name, doc) {
  try {
    db.outbox_event.insertOne(doc);
    db.outbox_event.deleteOne({ _id: doc._id });
    check(name, false);
  } catch (e) {
    check(name, e.code === 121);
  }
}

const info = db.getCollectionInfos({ name: "outbox_event" })[0];
check("outbox_event collection exists", info !== undefined);
check("validationLevel is strict", info !== undefined && info.options.validationLevel === "strict");
check("validationAction is error", info !== undefined && info.options.validationAction === "error");

if (info !== undefined) {
  accepts("accepts a valid event", validEvent({}));
  rejects("rejects an unknown event type", validEvent({ event_type: "ShowtimeDeleted" }));
  rejects("rejects an unknown aggregate type", validEvent({ aggregate_type: "Movie" }));
  rejects("rejects a payload that is not an object", validEvent({ payload: "text" }));
  rejects("rejects an undeclared field", validEvent({ published: false }));
  rejects("rejects a missing creation date", (() => {
    const doc = validEvent({});
    delete doc.created_at;
    return doc;
  })());
  rejects("rejects an identifier that is not a UUID", validEvent({ _id: "not-a-uuid" }));
}

const indexes = info === undefined ? [] : db.outbox_event.getIndexes();
const relay = indexes.find(i => i.name === "idx_outbox_event_created_at_id");
const ttl = indexes.find(i => i.name === "idx_outbox_event_created_at_ttl");
check("index idx_outbox_event_created_at_id exists", relay !== undefined);
check("the relay index is on created_at then _id",
  relay !== undefined && JSON.stringify(relay.key) === JSON.stringify({ created_at: 1, _id: 1 }));
check("the relay index is not a TTL index", relay !== undefined && relay.expireAfterSeconds === undefined);
check("index idx_outbox_event_created_at_ttl exists", ttl !== undefined);
check("the TTL index is on created_at", ttl !== undefined && JSON.stringify(ttl.key) === JSON.stringify({ created_at: 1 }));
check("the TTL index expires events after 30 days", ttl !== undefined && ttl.expireAfterSeconds === 2592000);

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
