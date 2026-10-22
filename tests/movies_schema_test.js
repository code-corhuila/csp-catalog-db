// Checks the structure of catalog_db.movies the way the service will meet it:
// the validator accepts a valid document, rejects every invalid one, the named indexes exist and
// answer the queries of the movie search (HU-CATALOG-006).
// Run with: mongosh --quiet <uri>/catalog_db tests/movies_schema_test.js
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

const indexes = info === undefined ? [] : db.movies.getIndexes();
const byText = indexes.find(i => i.name === "idx_movies_title_synopsis_text");
check("index idx_movies_title_synopsis_text exists", byText !== undefined);
check("the text index covers title and synopsis and does not stem",
  byText !== undefined && JSON.stringify(Object.keys(byText.weights).sort()) === JSON.stringify(["synopsis", "title"])
  && byText.default_language === "none");
check("the text index is neither unique nor TTL",
  byText !== undefined && byText.unique === undefined && byText.expireAfterSeconds === undefined);
const byGenres = indexes.find(i => i.name === "idx_movies_publication_status_genres");
check("index idx_movies_publication_status_genres exists", byGenres !== undefined);
check("the genres index is on publication_status then genres",
  byGenres !== undefined && JSON.stringify(byGenres.key) === JSON.stringify({ publication_status: 1, genres: 1 }));
check("the genres index is neither unique nor TTL",
  byGenres !== undefined && byGenres.unique === undefined && byGenres.expireAfterSeconds === undefined);

function planIndexNames(plan) {
  if (plan === null || typeof plan !== "object") {
    return [];
  }
  return Object.keys(plan).flatMap(k => (k === "indexName" ? [plan[k]] : planIndexNames(plan[k])));
}

if (info !== undefined && byText !== undefined && byGenres !== undefined) {
  const published = { publication_status: "PUBLISHED" };
  const searchable = [
    validMovie({ _id: "bbbbbbbb-0000-4000-8000-000000000001", title: "Space Action", synopsis: "A pilot crosses the galaxy.",
      genres: ["Ciencia ficción", "Acción"], duration_minutes: NumberInt(110), ...published }),
    validMovie({ _id: "bbbbbbbb-0000-4000-8000-000000000002", title: "Quiet Garden", synopsis: "An action of kindness in a garden.",
      genres: ["Drama"], duration_minutes: NumberInt(95), ...published }),
    validMovie({ _id: "bbbbbbbb-0000-4000-8000-000000000003", title: "Galaxy Quest Space", synopsis: null,
      genres: ["Ciencia ficción"], duration_minutes: NumberInt(150), ...published }),
    validMovie({ _id: "bbbbbbbb-0000-4000-8000-000000000004", title: "Space Action Draft", synopsis: "Not published yet.",
      genres: ["Ciencia ficción"], duration_minutes: NumberInt(100) })
  ];
  db.movies.insertMany(searchable);
  const ids = filter => db.movies.find(Object.assign({}, published, filter)).toArray().map(d => d._id.slice(-1)).sort();
  const text = search => ({ $text: { $search: search } });
  check("a text query finds the word in the title or in the synopsis",
    JSON.stringify(ids(text("action"))) === JSON.stringify(["1", "2"]));
  check("a text query ignores case",
    JSON.stringify(ids(text("ACTION"))) === JSON.stringify(["1", "2"]));
  check("a text query matches whole words, not fragments", ids(text("act")).length === 0);
  check("quoted words must all be present",
    JSON.stringify(ids(text("\"space\" \"galaxy\""))) === JSON.stringify(["1", "3"]));
  check("quoted words that no movie has together match nothing", ids(text("\"space\" \"garden\"")).length === 0);
  check("a draft movie is not returned by the published filter",
    !ids(text("draft")).includes("4"));
  check("the genre filter is the exact stored value",
    JSON.stringify(ids({ genres: "Ciencia ficción" })) === JSON.stringify(["1", "3"]) && ids({ genres: "ciencia ficcion" }).length === 0);
  check("the filters combine with AND",
    JSON.stringify(ids(Object.assign(text("space"), { genres: "Ciencia ficción", duration_minutes: { $lte: 120 } }))) === JSON.stringify(["1"]));
  const planOf = filter => db.movies.find(Object.assign({}, published, filter)).explain("queryPlanner").queryPlanner.winningPlan;
  check("the planner picks the text index for a text query",
    planIndexNames(planOf(text("action"))).includes("idx_movies_title_synopsis_text"));
  check("the planner picks the genres index for a genre filter",
    planIndexNames(planOf({ genres: "Ciencia ficción" })).includes("idx_movies_publication_status_genres"));
  db.movies.deleteMany({ _id: { $in: searchable.map(d => d._id) } });
}

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
