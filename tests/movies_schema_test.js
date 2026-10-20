// Checks the structure of catalog_db.movies the way the service will meet it:
// the validator accepts a valid document, rejects every invalid one, and the
// named index exists. Run with: mongosh --quiet <uri>/catalog_db tests/movies_schema_test.js
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

function validMovie(overrides) {
  const now = new Date();
  return Object.assign({
    _id: "11111111-1111-4111-8111-111111111111",
    title: "Synthetic Movie",
    duration_minutes: NumberInt(120),
    classification: "PG-13",
    publication_status: "DRAFT",
    created_at: now,
    updated_at: now
  }, overrides);
}

function accepts(name, doc) {
  try {
    db.movies.insertOne(doc);
    db.movies.deleteOne({ _id: doc._id });
    check(name, true);
  } catch (e) {
    check(name, false);
  }
}

function rejects(name, doc) {
  try {
    db.movies.insertOne(doc);
    db.movies.deleteOne({ _id: doc._id });
    check(name, false);
  } catch (e) {
    check(name, e.code === 121);
  }
}

const info = db.getCollectionInfos({ name: "movies" })[0];
check("movies collection exists", info !== undefined);
check("validationLevel is strict", info !== undefined && info.options.validationLevel === "strict");
check("validationAction is error", info !== undefined && info.options.validationAction === "error");

if (info !== undefined) {
  accepts("accepts a valid draft movie", validMovie({}));
  accepts("accepts a published movie with every optional field", validMovie({
    publication_status: "PUBLISHED",
    synopsis: "A synthetic synopsis.",
    release_date: new Date("2026-12-01"),
    genres: ["Drama", "Comedy"],
    poster_url: "https://example.com/poster.png",
    deleted_at: null
  }));
  rejects("rejects a duration of zero", validMovie({ duration_minutes: NumberInt(0) }));
  rejects("rejects a negative duration", validMovie({ duration_minutes: NumberInt(-5) }));
  rejects("rejects a status outside the enum", validMovie({ publication_status: "HIDDEN" }));
  rejects("rejects an undeclared field", validMovie({ titel: "typo" }));
  rejects("rejects an empty title", validMovie({ title: "" }));
  rejects("rejects a title over 255 characters", validMovie({ title: "x".repeat(256) }));
  rejects("rejects a missing classification", (() => {
    const doc = validMovie({});
    delete doc.classification;
    return doc;
  })());
  rejects("rejects a missing title", (() => {
    const doc = validMovie({});
    delete doc.title;
    return doc;
  })());
  rejects("rejects more than 20 genres", validMovie({
    genres: Array.from({ length: 21 }, (_, i) => `Genre ${i}`)
  }));
  rejects("rejects an identifier that is not a UUID", validMovie({ _id: "not-a-uuid" }));
  accepts("accepts a movie with a cast", validMovie({ cast: ["Synthetic Actor", "Another Actor"] }));
  accepts("accepts a movie with a null cast", validMovie({ cast: null }));
  rejects("rejects a cast with an item that is not a string", validMovie({ cast: ["Synthetic Actor", 7] }));
  rejects("rejects more than 50 cast members", validMovie({
    cast: Array.from({ length: 51 }, (_, i) => `Actor ${i}`)
  }));
}

const indexNames = info === undefined ? [] : db.movies.getIndexes().map(i => i.name);
check("index idx_movies_publication_status_deleted_at exists",
  indexNames.includes("idx_movies_publication_status_deleted_at"));

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
