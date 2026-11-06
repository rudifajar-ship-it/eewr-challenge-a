'use strict';
// CHALLENGE A — authorisation BEFORE search.
// Guide §3: "Memeriksa otorisasi dan akses pengguna sebelum mencari, lalu hanya
// mencari informasi yang boleh diakses pengguna. Jika akses berubah, jawaban
// berikutnya harus mengikuti perubahan tersebut."
//
// Design:
//  * The permission table is RE-READ from disk on every query. Therefore an
//    edited permission file changes the very next answer (access-change rule).
//  * Filtering happens BEFORE retrieval: restricted items never enter the
//    searchable corpus, so their existence cannot leak through scores/hits.
//  * Unknown / unauthenticated users fall back to the LEAST-privilege role.
// Zero dependencies, no network, deterministic.

const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'permission-table.json');

function loadPermissions(permissionsPath) {
  const p = permissionsPath || DEFAULT_PATH;
  const table = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (table.synthetic !== true) throw new Error('PERMISSIONS_NOT_SYNTHETIC');
  if (!table.roles || !table.users || !Array.isArray(table.levels)) {
    throw new Error('PERMISSIONS_MALFORMED');
  }
  return table;
}

function resolvePrincipal(table, userId) {
  const id = (userId == null || String(userId).trim() === '') ? 'anonymous' : String(userId).trim();
  const user = table.users[id];
  const roleName = user && table.roles[user.role] ? user.role : (table.defaultRole || 'staf-baru');
  const role = table.roles[roleName];
  if (!role) throw new Error('ROLE_NOT_FOUND: ' + roleName);
  return Object.freeze({
    userId: id,
    authenticated: !!(user && table.roles[user.role]),
    role: roleName,
    label: role.label,
    allowLevels: Object.freeze(role.allowLevels.slice()),
    allowTopics: Object.freeze(role.allowTopics.slice()),
    // An unauthenticated requester is downgraded to least privilege explicitly.
    downgraded: !(user && table.roles[user.role])
  });
}

function isPermitted(principal, item) {
  if (!principal.allowLevels.includes(item.level)) return false;
  if (!principal.allowTopics.includes('*') && !principal.allowTopics.includes(item.topic)) return false;
  return true;
}

// Returns BOTH the permitted slice and a count of what was withheld. The count
// is used only inside the audit log, NEVER in the answer (no existence hint).
function scopeCorpus(principal, items) {
  const permitted = [];
  let withheldByLevel = 0, withheldByTopic = 0;
  for (const it of items) {
    if (!principal.allowLevels.includes(it.level)) { withheldByLevel++; continue; }
    if (!principal.allowTopics.includes('*') && !principal.allowTopics.includes(it.topic)) {
      withheldByTopic++; continue;
    }
    permitted.push(it);
  }
  return Object.freeze({
    items: Object.freeze(permitted),
    total: items.length,
    permittedCount: permitted.length,
    withheldByLevel,
    withheldByTopic
  });
}

module.exports = { loadPermissions, resolvePrincipal, isPermitted, scopeCorpus, DEFAULT_PATH };
