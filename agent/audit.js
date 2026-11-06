'use strict';
// CHALLENGE A — COMPLETE AUDIT LOG (§1 rule 5, §3 mandatory 6, §4 B-M7).
// Records EVERY question, the sources retrieved, the answer returned, and every
// decision (authorisation, withheld counts, conflict resolution, refusal,
// injection detection, PII masking, owner routing, approval, execution).
//
// Design: append-only JSONL-style array in an isolated state dir. Every event
// carries a monotonic sequence number, ISO timestamp, the acting principal,
// and a machine-readable event code. Nothing is overwritten or deleted.
//
// IMPORTANT: this log is READ/WRITE for observations. It is NOT an action
// executor. Action execution still requires the SEPARATE hard human-approval
// gate in approve.js (see §"human approval" in the architecture doc). This
// module can LOG an execution that a human authorised, but it can never CAUSE
// one. Zero dependencies, no network.

const fs = require('fs');
const path = require('path');

function createAudit(stateDir) {
  const file = path.join(stateDir, 'audit-log.json');

  function read() {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }

  function append(events) {
    fs.mkdirSync(stateDir, { recursive: true });
    const all = read();
    let seq = all.length ? all[all.length - 1].seq : 0;
    for (const e of events) {
      seq += 1;
      all.push(Object.freeze({ seq, ...e }));
    }
    fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n');
    return all;
  }

  return Object.freeze({ file, read, append });
}

// Build the full event set for one knowledge query. Caller supplies `now`.
function eventsForQuery(ctx) {
  const { runId, at, principal, question, scoped, hits, answer, status, injectionAll, piiAll } = ctx;
  const ev = [];
  const base = { at, runId, actor: principal.userId, role: principal.role };

  ev.push({ ...base, event: 'QUESTION_RECEIVED', question, language: 'id/en/mixed' });
  ev.push({
    ...base, event: 'AUTHORISATION_CHECKED',
    authenticated: principal.authenticated,
    downgraded: principal.downgraded,
    allowLevels: principal.allowLevels,
    allowTopics: principal.allowTopics,
    permittedSources: scoped.permittedCount,
    totalSources: scoped.total,
    withheldByLevel: scoped.withheldByLevel,
    withheldByTopic: scoped.withheldByTopic
  });
  ev.push({
    ...base, event: 'SOURCES_RETRIEVED',
    evidenceIds: hits.map(h => h.evidenceId),
    sourceRefs: hits.map(h => h.sourceRef),
    retrievalScores: hits.map(h => h.score)
  });
  if (injectionAll && injectionAll.length) {
    ev.push({ ...base, event: 'PROMPT_INJECTION_DETECTED_AND_IGNORED', patterns: injectionAll });
  }
  if (piiAll && piiAll.length) {
    ev.push({ ...base, event: 'PII_MASKED', types: piiAll });
  }
  if (answer.conflicts && answer.conflicts.length) {
    for (const c of answer.conflicts) {
      ev.push({
        ...base, event: 'CONFLICT_FLAGGED', claimKey: c.claimKey,
        selectedId: c.resolution.selectedId, supersededIds: c.resolution.supersededIds
      });
    }
  }
  ev.push({
    ...base, event: status === 'SAYA_TIDAK_TAHU' ? 'REFUSAL_OR_UNKNOWN' : 'ANSWER_RETURNED',
    status,
    answerText: answer.answer,
    sourcesCited: answer.sources.map(s => s.evidenceId),
    ownerRoute: answer.ownerRoute ? answer.ownerRoute.owner : null
  });
  return ev;
}

// Human decision + (human-authorised) execution events. Kept separate so the
// log can represent the full requested/approved/executed chain without ever
// giving the agent autonomous execution power.
function eventsForDecision(ctx) {
  const { runId, at, actor, decision, note, executed } = ctx;
  const ev = [{ at, runId, actor, event: 'HUMAN_DECISION', decision, note: String(note || '') }];
  if (executed) {
    ev.push({ at, runId, actor, event: 'ACTION_EXECUTED_AFTER_APPROVAL', decision, note: 'Executed only because a named human approved.' });
  } else {
    ev.push({ at, runId, actor, event: 'EXECUTION_DEFERRED', decision, note: 'No action executed without explicit approval.' });
  }
  return ev;
}

module.exports = { createAudit, eventsForQuery, eventsForDecision };
