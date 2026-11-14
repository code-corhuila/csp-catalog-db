// Checks the role of the API login (HU-CATALOG chore(grants), ADR-019 pattern): catalog_writer holds only find, insert,
// update and remove on the collections of catalog_db, inherits nothing, and is granted to catalog_app and to no other
// user. The API needs nothing else: it never creates collections, indexes or users (Norma 5.2.1).
// Prerequisite: the users catalog_app and worker_app exist in catalog_db before the migration (csp-infra-mongo creates them).
// Run with: mongosh --quiet <uri>/catalog_db tests/catalog_writer_role_test.js
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

const ROLE = "catalog_writer";
const API_USER = "catalog_app";

const roleInfo = db.runCommand({
  rolesInfo: { role: ROLE, db: "catalog_db" },
  showPrivileges: true,
  showBuiltinRoles: false
}).roles;
const role = roleInfo.length === 1 ? roleInfo[0] : undefined;

check(`role ${ROLE} exists in catalog_db`, role !== undefined);
check("the role has exactly one privilege", role !== undefined && role.privileges.length === 1);
check("the privilege is on the collections of catalog_db",
  role !== undefined && role.privileges.length === 1 &&
  role.privileges[0].resource.db === "catalog_db" && role.privileges[0].resource.collection === "");
check("the actions are find, insert, remove and update and nothing else",
  role !== undefined && role.privileges.length === 1 &&
  JSON.stringify([...role.privileges[0].actions].sort()) === JSON.stringify(["find", "insert", "remove", "update"]));
check("the role inherits no role", role !== undefined && role.roles.length === 0);

const users = db.getSiblingDB("admin").runCommand({ usersInfo: { forAllDBs: true } }).users;
const api = users.find(u => u.user === API_USER && u.db === "catalog_db");
check(`user ${API_USER} exists in catalog_db (created by csp-infra-mongo)`, api !== undefined);
check(`${API_USER} holds ${ROLE}`,
  api !== undefined && api.roles.some(r => r.role === ROLE && r.db === "catalog_db"));
check(`${API_USER} holds no other role`, api !== undefined && api.roles.length === 1);
check(`no other user holds ${ROLE}`,
  users.filter(u => u.user !== API_USER && u.roles.some(r => r.role === ROLE)).length === 0);

print(`TOTAL ${passed + failed} checks, ${passed} passed, ${failed} failed`);
if (failed > 0 || passed === 0) {
  quit(1);
}
