'use strict';
// =============================================================================
// EEWR — MODEL-ASSISTED WORKFLOW ORCHESTRATOR (Challenge A, isolated lab)
// =============================================================================
// Explicit, verifiable, six-stage pipeline. This is the PRIORITY-1 deliverable:
//
//   [1] User Question            intake (id / en / mixed), non-empty validation
//   [2] Permission Check         fresh permission load + least-privilege principal
//   [3] Authorised Retrieval     scope BEFORE search; permitted slice only;
//                               injection neutralised + PII masked on quotes
//   [4] Real Model Interpretation  N7 interpreter -> genuine captured model draft
//                               (UNTRUSTED, hash-verified, authorised context only)
//   [5] Grounded Answer + Citations  deterministic N7->N8 guard:
//          - REFUSAL branch  : discard ANY model text; byte-identical template
//          - ANSWER branch   : accept model prose ONLY if grounded; else
//                             fall back to the deterministic cited answer
//          - citations       : attached from the control plane, never from model
//   [6] Audit Log             append-only events per question/sources/answer,
//                            plus explicit stage records for observability
//
// HARD CONSTRAINTS (unchanged)
//   * READ-ONLY. No tool invoked, no action executed, no model call, no network,
//     no credential, no billing, no autonomy.
//   * Deterministic control plane OWNS: permissions, retrieval, citations,
//     refusal wording, conflict resolution, fallback, audit.
//   * The model OWNS nothing. It contributes an untrusted prose DRAFT that is
//     accepted only when every figure it states exists in the authorised
//     citations it was given. On any doubt the deterministic answer wins.
//
// CLAIM HYGIENE
//   "Model interpretation" here is a GENUINE session-native model output, consumed
//   offline from a hash-checked artifact. It is NOT an in-app live SDK call and
//   NOT proof of the host agent platform chat-model integration. The in-app live
//   path was probed and is BLOCKED (see model-interpreter.js status()).
//   Data is 100% SYNTHETIC — NOT the official kickoff dataset.
// =============================================================================

const { createKnowledgeBrain } = require('./knowledge');
const { createInterpreter } = require('./model-interpreter');
const { applyOutputGuard, groundingCheck } = require('./output-guard');

/**
 * Run the model-assisted workflow for one case.
 *
 * @param {object} cfg
 *   @param {object} cfg.kb            knowledge brain (control plane)
 *   @param {object} cfg.interpreter   N7 model interpreter adapter
 *   @param {string} cfg.question      user question (id/en/mixed)
 *   @param {string} cfg.userId        principal
 *   @param {string} cfg.caseId        which captured model draft to interpret
 * @returns {object} structured six-stage result (frozen)
 */
function runStage(cfg) {
  const { kb, interpreter, question, userId, caseId } = cfg;
  const stages = [];

  // ---- [1] USER QUESTION --------------------------------------------------
  if (typeof question !== 'string' || !question.trim()) {
    throw new Error('QUESTION_REQUIRED');
  }
  const q = question.trim();
  stages.push({ stage: 1, name: 'USER_QUESTION', ok: true,
    detail: { question: q, userId, language: /[a-zA-Z]/.test(q) && /[à-ÿ\s]/.test(q) ? 'mixed' : 'id/en' } });

  // ---- [2]+[3] CONTROL PLANE: permission + authorised retrieval + audit ---
  // kb.ask() performs, deterministically and read-only:
  //   fresh permissions -> least-privilege principal -> scope-before-search ->
  //   permitted-slice retrieval -> injection/PII treatment -> conflict detect ->
  //   cited answer -> append-only audit events.
  const run = kb.ask(q, userId);
  const hits = run.retrieval.hits;
  stages.push({ stage: 2, name: 'PERMISSION_CHECK', ok: true,
    detail: {
      role: run.principal.role,
      downgraded: run.principal.downgraded,
      scopedBeforeSearch: run.retrieval.scopedBeforeSearch,
      permittedSources: run.retrieval.permittedSources,
      totalSources: run.retrieval.totalSources
    } });
  stages.push({ stage: 3, name: 'AUTHORISED_RETRIEVAL', ok: true,
    detail: {
      permittedHits: hits.length,
      evidenceIds: hits.map(h => h.evidenceId),
      levels: [...new Set(hits.map(h => h.level))],
      injectionNeutralised: hits.some(h => h.neutralisedPatterns && h.neutralisedPatterns.length),
      piiMaskedTypes: [...new Set(hits.flatMap(h => (h.pii && h.pii.maskedTypes) || []))],
      conflicts: run.conflicts.map(c => ({ claimKey: c.claimKey, selectedValue: c.resolution.selectedValue,
        supersededIds: c.resolution.supersededIds }))
    } });

  // ---- [4] REAL MODEL INTERPRETATION (N7) --------------------------------
  // The model sees ONLY the authorised citation context captured for this case.
  // It never sees the permission table, restricted items, or the audit writer.
  const interpretation = interpreter.interpret({
    caseId, upstreamStatus: run.status, permittedHits: hits.length
  });
  stages.push({ stage: 4, name: 'REAL_MODEL_INTERPRETATION', ok: true,
    detail: {
      interfaceType: 'AUTHORIZED_SESSION_NATIVE_MODEL_INTERFACE',
      modelContributed: interpretation.used,
      reason: interpretation.reason,
      modelOutputSha256: interpretation.modelOutputSha256 || null,
      inAppLiveSdk: false,
      note: 'Genuine captured model output (hash-verified), UNTRUSTED until stage 5.'
    } });

  // ---- [5] GROUNDED ANSWER + CITATIONS (deterministic N7->N8 guard) ------
  const guard = applyOutputGuard(
    { status: run.status, hits },
    interpretation.draft,
    {
      citations: run.answer.sources,          // citations from the CONTROL PLANE only
      deterministicAnswer: run.answer.answer,
      deterministicStatus: run.status,
      ownerRoute: run.answer.ownerRoute
    }
  );
  const grounding = guard.grounding || groundingCheck(interpretation.draft, run.answer.sources);
  stages.push({ stage: 5, name: 'GROUNDED_ANSWER_WITH_CITATIONS', ok: true,
    detail: {
      branch: guard.guard,
      modelDraftUsed: guard.modelDraftUsed,
      modelDraftDiscarded: guard.modelDraftDiscarded,
      reason: guard.reason,
      grounded: grounding.grounded,
      unsupportedFigures: grounding.unsupported,
      finalStatus: guard.finalStatus,
      citedEvidenceIds: run.answer.sources.map(s => s.evidenceId),
      answer: guard.finalAnswer
    } });

  // ---- [6] AUDIT LOG ------------------------------------------------------
  // kb.ask() already appended the complete question/sources/answer chain. Here
  // we surface the resulting event count/types as the observable audit stage.
  const audit = kb.audit.read();
  const events = Array.isArray(audit) ? audit : ((audit && (audit.events || audit.log)) || []);
  stages.push({ stage: 6, name: 'AUDIT_LOG', ok: true,
    detail: {
      appendOnly: true,
      eventCountSoFar: events.length,
      eventTypes: [...new Set(events.map(e => String(e.event || e.type || e.eventType || '?')))].sort(),
      runId: run.runId
    } });

  return Object.freeze({
    schemaVersion: 'eewr-model-assisted-workflow.v1',
    caseId, question: q, userId, runId: run.runId,
    controlPlaneStatus: run.status,
    model: Object.freeze({
      interpretationChannel: 'session-native subagent (genuine captured output)',
      inAppLiveSdk: false, liveInferenceInProcess: false,
      networkCallsPermitted: false, billing: '0 accounts/0 credits/0 credentials/0 charges'
    }),
    disclosure: run.disclosure,
    stages: Object.freeze(stages.map(s => Object.freeze(s))),
    finalAnswer: guard.finalAnswer,
    finalStatus: guard.finalStatus,
    citations: run.answer.sources,
    guard: Object.freeze({
      branch: guard.guard, modelDraftUsed: guard.modelDraftUsed,
      modelDraftDiscarded: guard.modelDraftDiscarded, reason: guard.reason,
      grounded: grounding.grounded, unsupported: grounding.unsupported,
      disclosure: guard.disclosure
    }),
    interpretation: Object.freeze({
      used: interpretation.used, reason: interpretation.reason,
      modelOutputSha256: interpretation.modelOutputSha256 || null
    })
  });
}

/**
 * Convenience factory: wire a fresh control plane + interpreter for an offline,
 * deterministic, fully reproducible run.
 */
function createWorkflow(opts) {
  const o = opts || {};
  const kb = o.kb || createKnowledgeBrain({ stateDir: o.stateDir, now: o.now });
  const interpreter = o.interpreter || createInterpreter({ mode: o.mode || 'captured', artifactPath: o.artifactPath });
  return Object.freeze({
    kb, interpreter,
    run: (question, userId, caseId) => runStage({ kb, interpreter, question, userId, caseId }),
    status: () => interpreter.status(),
    isAvailable: () => interpreter.isAvailable()
  });
}

module.exports = { runStage, createWorkflow };
