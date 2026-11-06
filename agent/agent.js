'use strict';
// Orchestrator: NL question -> evidence retrieval -> explainable recommendation
// -> accountable action proposals -> HUMAN APPROVAL GATE -> recording.
// Deterministic by construction. No model, no network, no autonomy.

const crypto = require('crypto');
const path = require('path');
const { loadEvidence } = require('./evidence');
const { retrieve } = require('./retrieve');
const { compose } = require('./compose');
const { propose } = require('./propose');
const { createStore, approve, reject } = require('./approve');
const provider = require('./provider-adapter');

const DISCLOSURE = Object.freeze({
  product: 'EEWR — Executive Early Warning Radar',
  team: 'BRONX',
  organization: 'XRC',
  representedBy: 'Team BRONX',
  industry: 'Natural resource-based industries',
  demoEntity: 'The Goodlight Company (TGC)',
  data: '100% synthetic; not real-world data',
  capability: 'Deterministic, auditable agent WORKFLOW — not an autonomous agent, not functional AI',
  model: 'No live model inference (AI (simulasi))',
  approval: 'No action is recorded until a named human explicitly approves it',
  independence: 'Independent project — not affiliated with, endorsed by, or representative of any employer, client or third party'
});

function createAgent(opts) {
  const o = opts || {};
  const corpus = loadEvidence(o.evidencePath);
  const stateDir = o.stateDir || path.join(__dirname, '..', 'state');
  const store = createStore(stateDir);
  const nowFn = o.now ? () => o.now : () => new Date().toISOString();

  function runIdFor(question) {
    const h = crypto.createHash('sha256')
      .update(String(question).trim().toLowerCase() + '|' + corpus.schemaVersion)
      .digest('hex').slice(0, 16);
    return 'RUN-' + h;
  }

  function baseRun(question, retrieval) {
    return {
      schemaVersion: 'eewr-agent-run.v1',
      runId: runIdFor(question),
      createdAt: nowFn(),
      question: String(question).trim(),
      disclosure: DISCLOSURE,
      model: Object.freeze({
        mode: 'deterministic-simulation',
        wording: 'AI (simulasi)',
        liveInference: false,
        provider: 'none',
        networkCallsPermitted: false
      }),
      retrieval
    };
  }

  function ask(question) {
    if (typeof question !== 'string' || !question.trim()) throw new Error('QUESTION_REQUIRED');
    const retrieval = retrieve(question, corpus);
    const base = baseRun(question, retrieval);

    if (!retrieval.sufficient) {
      const run = Object.freeze({
        ...base,
        status: 'INSUFFICIENT_EVIDENCE',
        humanApprovalRequired: false,
        recommendation: Object.freeze({ status: 'NO_RECOMMENDATION', reason: 'INSUFFICIENT_EVIDENCE' }),
        proposedActions: Object.freeze([]),
        recording: Object.freeze({ recorded: false, entries: 0 }),
        note: 'No relevant synthetic evidence found. No recommendation or action is fabricated.'
      });
      store.saveRun(run);
      return run;
    }

    const recommendation = compose(retrieval);
    const proposedActions = propose(recommendation, retrieval, base.runId);
    const run = Object.freeze({
      ...base,
      status: 'AWAITING_HUMAN_APPROVAL',
      humanApprovalRequired: true,
      recommendation,
      proposedActions,
      recording: Object.freeze({
        recorded: false,
        entries: 0,
        blockedUntil: 'explicit approve() by a named human approver'
      })
    });
    store.saveRun(run);
    return run;
  }

  function approveRun(runId, approver, note) { return approve(store, runId, approver, note, nowFn()); }
  function rejectRun(runId, approver, reason) { return reject(store, runId, approver, reason, nowFn()); }
  function getRun(runId) { return store.loadRun(runId); }
  function ledger() { return store.readLedger(); }

  return Object.freeze({
    ask, approve: approveRun, reject: rejectRun, getRun, ledger,
    evidenceCount: corpus.items.length,
    disclosure: DISCLOSURE,
    modelStatus: provider.status,
    provider,
    store
  });
}

module.exports = { createAgent, DISCLOSURE };
