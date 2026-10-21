// Checks the structure of catalog_db.rooms the way the service will meet it (HU-CATALOG-002):
// the validator accepts a valid room, rejects every invalid one, the name is unique, and the
// named index exists. Run with: mongosh --quiet <uri>/catalog_db tests/rooms_schema_test.js
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

function seat(overrides) {
  return Object.assign({
    seat_number: "A1",
    row: "A",
    column: NumberInt(1),
    type: "STANDARD"
  }, overrides);
}

function validRoom(overrides) {
  const now = new Date();
  return Object.assign({
    _id: "11111111-1111-4111-8111-111111111111",
    name: "Synthetic Room 1",
    capacity: NumberInt(2),
    seats: [seat({}), seat({ seat_number: "A2", column: NumberInt(2), type: "VIP" })],
    created_at: now,
    updated_at: now,
    deleted_at: null
  }, overrides);
}

function accepts(name, doc) {
  try {
    db.rooms.insertOne(doc);
    db.rooms.deleteOne({ _id: doc._id });
    check(name, true);
  } catch (e) {
    check(name, false);
  }
}

function rejects(name, doc) {
  try {
    db.rooms.insertOne(doc);
    db.rooms.deleteOne({ _id: doc._id });
    check(name, false);
  } catch (e) {
    check(name, e.code === 121);
  }
}

function without(field) {
  const doc = validRoom({});
  delete doc[field];
  return doc;
}

const info = db.getCollectionInfos({ name: "rooms" })[0];
check("rooms collection exists", info !== undefined);
check("validationLevel is strict", info !== undefined && info.options.validationLevel === "strict");
check("validationAction is error", info !== undefined && info.options.validationAction === "error");

if (info !== undefined) {
  accepts("accepts a valid room", validRoom({}));
  accepts("accepts a room whose seats omit row and column", validRoom({
    seats: [{ seat_number: "1", type: "ACCESSIBLE" }, { seat_number: "2", type: "STANDARD" }]
  }));
  accepts("accepts an archived room", validRoom({ deleted_at: new Date() }));
  rejects("rejects an empty seats array", validRoom({ seats: [] }));
  rejects("rejects more than 500 seats", validRoom({
    capacity: NumberInt(501),
    seats: Array.from({ length: 501 }, (_, i) => seat({ seat_number: `S${i}` }))
  }));
  rejects("rejects a seat with an undeclared field", validRoom({ seats: [seat({ price: 10 })] }));
  rejects("rejects a seat without seat_number", validRoom({
    seats: [{ row: "A", column: NumberInt(1), type: "STANDARD" }]
  }));
  rejects("rejects a seat type outside the enum", validRoom({ seats: [seat({ type: "PREMIUM" })] }));
  rejects("rejects a seat column of zero", validRoom({ seats: [seat({ column: NumberInt(0) })] }));
  rejects("rejects an undeclared field on the room", validRoom({ floor: 2 }));
  rejects("rejects a missing name", without("name"));
  rejects("rejects a name of 101 characters", validRoom({ name: "x".repeat(101) }));
  rejects("rejects a capacity of zero", validRoom({ capacity: NumberInt(0) }));
  rejects("rejects an identifier that is not a UUID", validRoom({ _id: "not-a-uuid" }));
  rejects("rejects a missing creation date", without("created_at"));

  const first = validRoom({});
  const second = validRoom({ _id: "22222222-2222-4222-8222-222222222222" });
  db.rooms.insertOne(first);
  let duplicateCode = null;
  try {
    db.rooms.insertOne(second);
  } catch (e) {
    duplicateCode = e.code;
  }
  db.rooms.deleteOne({ _id: first._id });
  db.rooms.deleteOne({ _id: second._id });
  check("rejects a second room with the same name (duplicate key)", duplicateCode === 11000);
}

const nameIndex = info === undefined ? undefined : db.rooms.getIndexes().find(i => i.name === "idx_rooms_name");
check("index idx_rooms_name exists", nameIndex !== undefined);
check("the index is unique", nameIndex !== undefined && nameIndex.unique === true);
check("the index is on name", nameIndex !== undefined && JSON.stringify(nameIndex.key) === JSON.stringify({ name: 1 }));

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
