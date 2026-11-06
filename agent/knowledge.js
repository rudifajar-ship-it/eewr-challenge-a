'use strict';
// CHALLENGE A — "Workplace Knowledge Brain" orchestrator (isolated lab).
//
// Pipeline (all deterministic, read-only, zero-network, zero-model):
//   question (id/en/mixed) + userId
//     -> 1. load permission table FRESH (access-change reactivity)
//     -> 2. resolve principal (least privilege for unknown users)
//     -> 3. SCOPE corpus BEFORE searching (restricted items never enter search)
//     -> 4. deterministic retrieval with score breakdown
//     -> 5. safety: prompt-injection neutralise + PII mask on quoted text
//     -> 6. conflict detection + sources + owner routing -> cited answer
//     -> 7. append COMPLETE audit log (question/sources/answer/decisions)
//
// HARD CONSTRAINT: this brain is READ-ONLY. It never sends, schedules,
// modifies, publishes, or invokes any tool. Action execution remains subject
// to explicit human approval (the separate approve.js gate on the risk path).
// No live model inference: provider adapter stays disabled and fail-closed.

const crypto = require('crypto');
const path = require('path');
const { loadPermissions, resolvePrincipal, scopeCorpus } = require('./access');
const { retrieve } = require('./retrieve');
const { detectInjection, neutralise, maskPii, unknownAnswer } = require('./safety');
const { detectConflicts, buildAnswer, routeOwner } = require('./answer');
const { createAudit, eventsForQuery, eventsForDecision } = require('./audit');
const provider = require('./provider-adapter');

const CORPUS_PATH = path.join(__dirname, '..', 'data', 'knowledge-corpus.json');

const DISCLOSURE = Object.freeze({
  product: 'EEWR — Executive Early Warning Radar',
  subsystem: 'Challenge A — Workplace Knowledge Brain (Otak Pengetahuan Kerja)',
  team: 'BRONX',
  organization: 'XRC',
  representedBy: 'Team BRONX',
  attribution: 'Team BRONX',
  positioning: 'Executive Knowledge & Early Warning Intelligence',
  scenario: 'Project History (Riwayat proyek) — CONFIRMED (guide §3)',
  scenarioOfficialQuestion: 'Mengapa stok terlambat di Makassar, dan apa yang masih terbuka?',
  industry: 'Natural resource-based industries',
  demoEntity: 'The Goodlight Company (TGC) — fictional / synthetic',
  data: '100% synthetic, participant-added mock corpus; NOT the official kickoff dataset',
  capability: 'Deterministic, permission-aware, evidence-citing knowledge workflow — not an autonomous agent, not functional AI',
  model: 'No live model inference (AI (simulasi)); provider disabled and fail-closed',
  approval: 'Read-only. No action is executed. Any action would require explicit human approval.',
  independence: 'Independent project — not affiliated with, endorsed by, or representative of any employer, client or third party'
});

function loadCorpus(corpusPath) {
  const fs = require('fs');
  const c = JSON.parse(fs.readFileSync(corpusPath || CORPUS_PATH, 'utf8'));
  if (c.synthetic !== true) throw new Error('KNOWLEDGE_NOT_SYNTHETIC');
  if (!Array.isArray(c.items) || c.items.length === 0) throw new Error('KNOWLEDGE_EMPTY');
  const ids = new Set();
  for (const it of c.items) {
    for (const k of ['id', 'type', 'topic', 'level', 'date', 'title', 'body', 'tags', 'sourceRef', 'owner']) {
      if (!(k in it)) throw new Error('KNOWLEDGE_MALFORMED: ' + it.id + ' missing ' + k);
    }
    if (ids.has(it.id)) throw new Error('KNOWLEDGE_DUPLICATE_ID: ' + it.id);
    ids.add(it.id);
  }
  return c;
}

function createKnowledgeBrain(opts) {
  const o = opts || {};
  const corpusPath = o.corpusPath || CORPUS_PATH;
  const permissionsPath = o.permissionsPath || undefined;   // undefined -> default table
  const stateDir = o.stateDir || path.join(__dirname, '..', 'state');
  const audit = createAudit(stateDir);
  const nowFn = o.now ? () => o.now : () => new Date().toISOString();

  function runIdFor(question, principal) {
    const h = crypto.createHash('sha256')
      .update(String(question).trim().toLowerCase() + '|' + principal.role + '|' + principal.userId + '|kb.v1')
      .digest('hex').slice(0, 16);
    return 'KBQ-' + h;
  }

  function ask(question, userId, extra) {
    if (typeof question !== 'string' || !question.trim()) throw new Error('QUESTION_REQUIRED');
    const x = extra || {};
    const at = nowFn();

    // 1 + 2: fresh permissions, least-privilege principal.
    const permissions = loadPermissions(permissionsPath);
    const principal = resolvePrincipal(permissions, userId);
    const corpus = loadCorpus(corpusPath);

    // 3: scope BEFORE search.
    const scoped = scopeCorpus(principal, corpus.items);

    // 4: deterministic retrieval over the PERMITTED slice only.
    const retrieval = retrieve(question, scoped, { k: 4, minScore: 0.5 });

    // 5: enrich hits with metadata + safety treatment of quoted text.
    const byId = new Map(corpus.items.map(i => [i.id, i]));
    const injectionAll = new Set();
    const piiAll = new Set();
    const hits = retrieval.hits.map(h => {
      const item = byId.get(h.evidenceId);
      const inj = detectInjection(h.quote);
      inj.patterns.forEach(p => injectionAll.add(p));
      const neu = neutralise(h.quote);
      const pii = maskPii(neu.text, x.needPii === true);
      pii.maskedTypes.forEach(t => piiAll.add(t));
      return Object.freeze({
        ...h,
        type: item.type,
        topic: item.topic,
        level: item.level,
        sourceRef: item.sourceRef,
        owner: item.owner,
        claim: item.claim || null,
        supersededBy: item.supersededBy || null,
        safeQuote: pii.text,
        injection: inj,
        pii,
        neutralisedPatterns: neu.removed
      });
    });

    const retrievalEnriched = Object.freeze({
      ...retrieval,
      scopedBeforeSearch: true,
      permittedSources: scoped.permittedCount,
      totalSources: scoped.total,
      hits: Object.freeze(hits)
    });

    // 6: conflict detection + answer construction.
    const conflicts = detectConflicts(hits);
    let answer;
    let status;
    if (hits.length === 0) {
      // Non-leaking refusal: identical for restricted AND non-existent topics.
      const neutral = routeOwner(null, corpus, permissions);
      answer = unknownAnswer(Object.freeze({ owner: neutral.owner, basis: neutral.basis, hintedRestriction: false }));
      status = 'SAYA_TIDAK_TAHU';
    } else {
      answer = buildAnswer({
        hits, conflicts, principal, question, corpus, permissions, scoped
      });
      status = answer.status;
    }

    const runId = runIdFor(question, principal);

    // 7: complete audit log (append-only).
    audit.append(eventsForQuery({
      runId, at, principal, question, scoped, hits, answer, status,
      injectionAll: [...injectionAll], piiAll: [...piiAll]
    }));

    const run = Object.freeze({
      schemaVersion: 'eewr-knowledge-run.v1',
      runId,
      createdAt: at,
      track: 'CHALLENGE_A_WORKPLACE_KNOWLEDGE_BRAIN',
      question: String(question).trim(),
      userId: principal.userId,
      principal: Object.freeze({
        role: principal.role, label: principal.label,
        authenticated: principal.authenticated, downgraded: principal.downgraded
      }),
      disclosure: DISCLOSURE,
      model: Object.freeze({
        mode: 'deterministic-simulation', wording: 'AI (simulasi)',
        liveInference: false, provider: 'none', networkCallsPermitted: false
      }),
      retrieval: retrievalEnriched,
      answer,
      status,
      conflicts: conflicts,
      actionExecution: Object.freeze({
        permitted: false,
        executed: false,
        note: 'Knowledge brain is read-only. No tool invoked. Any action requires explicit human approval via approve.js on the risk path.'
      }),
      humanApprovalRequired: false,
      auditLogPath: audit.file
    });
    return run;
  }

  // Explicit human decision logger. It RECORDS a decision for the audit trail;
  // it never executes anything. `executed` may only be true when a named human
  // approved AND a real (future) tool integration exists — the prototype has
  // none, so callers must leave it false or the flag is ignored with a warning.
  function recordDecision(runId, ctx) {
    const c = ctx || {};
    const at = c.at || nowFn();
    const actor = c.actor;
    if (!actor || !String(actor).trim()) throw new Error('APPROVER_REQUIRED');
    const decision = c.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    const executed = decision === 'APPROVED' && c.executed === true;
    audit.append(eventsForDecision({
      runId, at, actor, decision, note: c.note, executed
    }));
    return Object.freeze({
      runId, at, actor, decision,
      executed: false,
      note: c.note || '',
      disclosure: 'Logged for audit only. This prototype has NO tool integration; no action was executed.'
    });
  }

  return Object.freeze({
    ask, recordDecision, audit, disclosure: DISCLOSURE,
    modelStatus: provider.status,
    corpusCount: loadCorpus(corpusPath).items.length,
    permissionsDefault: permissionsPath || 'default'
  });
}

module.exports = { createKnowledgeBrain, DISCLOSURE, CORPUS_PATH, loadCorpus };
