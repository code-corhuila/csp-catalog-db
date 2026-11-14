// Checks the structure of catalog_db.showtimes the way the service will meet it (HU-CATALOG-003):
// the validator accepts a valid showtime, rejects every invalid one (including an end that is not
// after the start and a price that is not a long), and the three named indexes exist.
// Run with: mongosh --quiet <uri>/catalog_db tests/showtimes_schema_test.js
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

function validShowtime(overrides) {
  const now = new Date();
  return Object.assign({
    _id: "11111111-1111-4111-8111-111111111111",
    movie_id: "22222222-2222-4222-8222-222222222222",
    room_id: "33333333-3333-4333-8333-333333333333",
    movie_title_snapshot: "Synthetic Movie",
    room_name_snapshot: "Synthetic Room 1",
    starts_at: new Date("2030-01-01T18:00:00Z"),
    ends_at: new Date("2030-01-01T20:00:00Z"),
    price_cents: NumberLong(1500),
    audio_language: "en",
    subtitle_language: "es",
    status: "SCHEDULED",
    created_at: now,
    updated_at: now,
    deleted_at: null
  }, overrides);
}

function accepts(name, doc) {
  try {
    db.showtimes.insertOne(doc);
    db.showtimes.deleteOne({ _id: doc._id });
    check(name, true);
  } catch (e) {
    check(name, false);
  }
}

function rejects(name, doc) {
  try {
    db.showtimes.insertOne(doc);
    db.showtimes.deleteOne({ _id: doc._id });
    check(name, false);
  } catch (e) {
    check(name, e.code === 121);
  }
}

function without(field) {
  const doc = validShowtime({});
  delete doc[field];
  return doc;
}

const info = db.getCollectionInfos({ name: "showtimes" })[0];
check("showtimes collection exists", info !== undefined);
check("validationLevel is strict", info !== undefined && info.options.validationLevel === "strict");
check("validationAction is error", info !== undefined && info.options.validationAction === "error");

if (info !== undefined) {
  accepts("accepts a valid showtime", validShowtime({}));
  accepts("accepts null languages", validShowtime({ audio_language: null, subtitle_language: null }));
  accepts("accepts a cancelled showtime", validShowtime({ status: "CANCELLED", deleted_at: new Date() }));
  accepts("accepts a price of 0", validShowtime({ price_cents: NumberLong(0) }));
  rejects("rejects an end equal to the start", validShowtime({ ends_at: new Date("2030-01-01T18:00:00Z") }));
  rejects("rejects an end before the start", validShowtime({ ends_at: new Date("2030-01-01T17:00:00Z") }));
  rejects("rejects a negative price", validShowtime({ price_cents: NumberLong(-1) }));
  rejects("rejects a price as a double", validShowtime({ price_cents: 12.5 }));
  rejects("rejects a price as an int", validShowtime({ price_cents: NumberInt(1500) }));
  rejects("rejects an undeclared field", validShowtime({ currency: "COP" }));
  rejects("rejects a missing movie title snapshot", without("movie_title_snapshot"));
  rejects("rejects a missing room name snapshot", without("room_name_snapshot"));
  rejects("rejects an empty movie title snapshot", validShowtime({ movie_title_snapshot: "" }));
  rejects("rejects an empty room name snapshot", validShowtime({ room_name_snapshot: "" }));
  rejects("rejects a status outside the enum", validShowtime({ status: "DELETED" }));
  rejects("rejects a movie id that is not a UUID", validShowtime({ movie_id: "not-a-uuid" }));
  rejects("rejects a room id that is not a UUID", validShowtime({ room_id: "not-a-uuid" }));
  rejects("rejects an identifier that is not a UUID", validShowtime({ _id: "not-a-uuid" }));
  rejects("rejects a missing creation date", without("created_at"));
}

const indexes = info === undefined ? [] : db.showtimes.getIndexes();
const byMovie = indexes.find(i => i.name === "idx_showtimes_movie_id_starts_at");
const byRoom = indexes.find(i => i.name === "idx_showtimes_room_id_starts_at");
check("index idx_showtimes_movie_id_starts_at exists", byMovie !== undefined);
check("the movie index is on movie_id then starts_at",
  byMovie !== undefined && JSON.stringify(byMovie.key) === JSON.stringify({ movie_id: 1, starts_at: 1 }));
check("index idx_showtimes_room_id_starts_at exists", byRoom !== undefined);
check("the room index is on room_id then starts_at",
  byRoom !== undefined && JSON.stringify(byRoom.key) === JSON.stringify({ room_id: 1, starts_at: 1 }));

const byStatus = indexes.find(i => i.name === "idx_showtimes_status_starts_at");
check("index idx_showtimes_status_starts_at exists", byStatus !== undefined);
check("the status index is on status then starts_at",
  byStatus !== undefined && JSON.stringify(byStatus.key) === JSON.stringify({ status: 1, starts_at: 1 }));
check("the status index is neither unique nor TTL",
  byStatus !== undefined && byStatus.unique === undefined && byStatus.expireAfterSeconds === undefined);

function indexNames(plan) {
  if (plan === null || typeof plan !== "object") {
    return [];
  }
  return Object.keys(plan).flatMap(k => (k === "indexName" ? [plan[k]] : indexNames(plan[k])));
}

if (info !== undefined && byStatus !== undefined) {
  const billboard = [
    validShowtime({ _id: "aaaaaaaa-0000-4000-8000-000000000001", starts_at: new Date("2031-03-01T20:00:00Z"), ends_at: new Date("2031-03-01T22:00:00Z") }),
    validShowtime({ _id: "aaaaaaaa-0000-4000-8000-000000000002", starts_at: new Date("2031-03-01T16:00:00Z"), ends_at: new Date("2031-03-01T18:00:00Z") }),
    validShowtime({ _id: "aaaaaaaa-0000-4000-8000-000000000003", status: "CANCELLED", starts_at: new Date("2031-03-01T18:00:00Z"), ends_at: new Date("2031-03-01T20:00:00Z") })
  ];
  db.showtimes.insertMany(billboard);
  const window = { status: "SCHEDULED", starts_at: { $gte: new Date("2031-03-01T00:00:00Z"), $lt: new Date("2031-03-02T00:00:00Z") } };
  const hinted = db.showtimes.find(window).sort({ starts_at: 1 }).hint("idx_showtimes_status_starts_at").toArray();
  check("the billboard query through the status index returns the scheduled showtimes in start order",
    JSON.stringify(hinted.map(d => d._id)) === JSON.stringify(["aaaaaaaa-0000-4000-8000-000000000002", "aaaaaaaa-0000-4000-8000-000000000001"]));
  const plan = db.showtimes.find(window).sort({ starts_at: 1 }).explain("queryPlanner");
  check("the planner picks idx_showtimes_status_starts_at for the billboard query",
    indexNames(plan.queryPlanner.winningPlan).includes("idx_showtimes_status_starts_at"));
  db.showtimes.deleteMany({ _id: { $in: billboard.map(d => d._id) } });
}

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
