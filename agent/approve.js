'use strict';
// MANDATORY HUMAN APPROVAL GATE.
// This module is the ONLY place where an action can be written to the ledger.
// The intake/retrieval/compose/propose path never imports appendLedger.
// Therefore an action cannot be recorded without an explicit approve() call.

const fs = require('fs');
const path = require('path');

function createStore(stateDir) {
  const runsDir = path.join(stateDir, 'runs');
  const ledgerPath = path.join(stateDir, 'ledger.json');

  function ensure() { fs.mkdirSync(runsDir, { recursive: true }); }

  function saveRun(run) {
    ensure();
    fs.writeFileSync(path.join(runsDir, run.runId + '.json'), JSON.stringify(run, null, 2) + '\n');
  }

  function loadRun(runId) {
    const p = path.join(runsDir, String(runId).replace(/[^A-Za-z0-9_-]/g, '') + '.json');
    if (!fs.existsSync(p)) throw new Error('RUN_NOT_FOUND: ' + runId);
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  function readLedger() {
    if (!fs.existsSync(ledgerPath)) return [];
    return JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  }

  function appendLedger(entries) {
    ensure();
    const all = readLedger().concat(entries);
    fs.writeFileSync(ledgerPath, JSON.stringify(all, null, 2) + '\n');
  }

  return { stateDir, runsDir, ledgerPath, saveRun, loadRun, readLedger, appendLedger };
}

function approve(store, runId, approver, note, now) {
  const run = store.loadRun(runId);
  if (run.status !== 'AWAITING_HUMAN_APPROVAL') {
    throw new Error('APPROVAL_NOT_ALLOWED: run status is ' + run.status);
  }
  if (!approver || !String(approver).trim()) throw new Error('APPROVER_REQUIRED');

  const decidedAt = now || new Date().toISOString();
  const entries = run.proposedActions.map(a => ({
    runId: run.runId,
    actionId: a.actionId,
    title: a.title,
    ownerRole: a.ownerRole,
    dueInDays: a.dueInDays,
    linkedEvidence: a.linkedEvidence,
    question: run.question,
    compositeScore: run.recommendation.score,
    groundedIn: run.recommendation.grounding.map(g => g.evidenceId),
    approver: String(approver),
    note: String(note || ''),
    decidedAt,
    recordedAt: decidedAt,
    synthetic: true
  }));

  // The single write point. Nothing above this line can reach it.
  store.appendLedger(entries);

  const updated = Object.freeze({
    ...run,
    status: 'RECORDED',
    approval: Object.freeze({ decision: 'APPROVED', approver: String(approver), note: String(note || ''), decidedAt }),
    proposedActions: run.proposedActions.map(a => Object.freeze({ ...a, status: 'RECORDED', recorded: true })),
    recording: Object.freeze({ recorded: true, entries: entries.length, ledgerPath: store.ledgerPath })
  });
  store.saveRun(updated);
  return updated;
}

function reject(store, runId, approver, reason, now) {
  const run = store.loadRun(runId);
  if (run.status !== 'AWAITING_HUMAN_APPROVAL') {
    throw new Error('REJECTION_NOT_ALLOWED: run status is ' + run.status);
  }
  if (!approver || !String(approver).trim()) throw new Error('APPROVER_REQUIRED');
  const decidedAt = now || new Date().toISOString();
  const updated = Object.freeze({
    ...run,
    status: 'REJECTED',
    approval: Object.freeze({ decision: 'REJECTED', approver: String(approver), note: String(reason || ''), decidedAt }),
    proposedActions: run.proposedActions.map(a => Object.freeze({ ...a, status: 'REJECTED', recorded: false })),
    recording: Object.freeze({ recorded: false, entries: 0, ledgerPath: store.ledgerPath })
  });
  store.saveRun(updated);
  return updated;
}

module.exports = { createStore, approve, reject };
