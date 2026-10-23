// Checks the read-only role of the outbox relay (ADR-019, HU-CATALOG-003): catalog_outbox_reader holds only `find` on
// catalog_db.outbox_event, inherits nothing, and is granted to worker_app and to no other user.
// Prerequisite: the user worker_app exists in catalog_db before the migration (csp-infra-mongo creates it).
// Run with: mongosh --quiet <uri>/catalog_db tests/outbox_reader_role_test.js
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

const ROLE = "catalog_outbox_reader";
const REPORTER = "worker_app";

const roleInfo = db.runCommand({
  rolesInfo: { role: ROLE, db: "catalog_db" },
  showPrivileges: true,
  showBuiltinRoles: false
}).roles;
const role = roleInfo.length === 1 ? roleInfo[0] : undefined;

check(`role ${ROLE} exists in catalog_db`, role !== undefined);
check("the role has exactly one privilege", role !== undefined && role.privileges.length === 1);
check("the privilege is on catalog_db.outbox_event only",
  role !== undefined && role.privileges.length === 1 &&
  role.privileges[0].resource.db === "catalog_db" && role.privileges[0].resource.collection === "outbox_event");
check("the only action is find",
  role !== undefined && role.privileges.length === 1 &&
  JSON.stringify(role.privileges[0].actions) === JSON.stringify(["find"]));
check("the role inherits no role", role !== undefined && role.roles.length === 0);

const users = db.getSiblingDB("admin").runCommand({ usersInfo: { forAllDBs: true } }).users;
const worker = users.find(u => u.user === REPORTER && u.db === "catalog_db");
check(`user ${REPORTER} exists in catalog_db (created by csp-infra-mongo)`, worker !== undefined);
check(`${REPORTER} holds ${ROLE}`,
  worker !== undefined && worker.roles.some(r => r.role === ROLE && r.db === "catalog_db"));
check(`${REPORTER} holds no other role`, worker !== undefined && worker.roles.length === 1);
check(`no other user holds ${ROLE}`,
  users.filter(u => u.user !== REPORTER && u.roles.some(r => r.role === ROLE)).length === 0);

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
