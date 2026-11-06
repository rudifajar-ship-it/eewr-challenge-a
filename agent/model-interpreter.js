'use strict';
// =============================================================================
// N7 — MODEL INTERPRETATION NODE (interpreter interface + fail-closed adapter)
// =============================================================================
//
// ROLE IN THE WORKFLOW
//   User Question -> Permission Check -> Authorised Evidence Retrieval
//     -> [N7: REAL MODEL INTERPRETATION] -> [N7/N8: deterministic output guard]
//     -> Grounded Answer with Citations -> Audit Log
//
// WHAT THIS IS
//   A bounded, offline-consumable adapter that injects the VERBATIM output of a
//   genuine session-native model inference (the platform-supported subagent
//   interface available in this isolated workspace) as the N7 "interpretation"
//   step. The drafts live in a SHA-256-checked artifact
//   (traces/model-assisted-drafts-2026-11-04.json).
//
// WHAT THIS IS NOT  (claim hygiene — read before making any statement)
//   * NOT a live in-application model SDK integration. The EEWR Node process
//     performs NO model call: no network, no credential, no SDK, no billing.
//   * NOT proof that the host platform chat model is integrated into the
//     EEWR application. The model step already happened in the session
//     orchestration layer; this module only consumes its captured output.
//   * NOT an autonomous agent. Everything downstream is deterministic.
//   * NOT a host-platform agent/workflow run or export.
//   * The in-app live SDK path was probed this cycle and is BLOCKED:
//     `the in-app SDK probe` headless -> EXIT=124 / 0 bytes; no local weights; no model
//     API credential or endpoint. Enabling it is owner-gated (G1-G6).
//
// TRUST BOUNDARY  (same as the N7->N8 guard, enforced here too)
//   The model sees ONLY an authorised-citation context per case (or none).
//   It never reaches: the permission table, the full corpus, restricted items,
//   tools, the approval gate, or the audit writer. Its output is UNTRUSTED and
//   must pass the deterministic output guard before any answer is returned.
//
// FAIL-CLOSED BY DEFAULT
//   No artifact / hash mismatch / missing case / disabled mode -> the model
//   contribution is an EMPTY string and the deterministic cited answer is used.
//   No deliverable may claim "verified live AI" from this module.
// =============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LAB = path.join(__dirname, '..');
const DEFAULT_ARTIFACT = path.join(
  LAB, 'traces', 'model-assisted-drafts-2026-11-04.json'
);

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

// Status of the ONLY model interface technically supported in this workspace.
// `inAppLiveSdk` is deliberately false: it is a real, probed blocker, not a
// configuration oversight. Any "live AI" claim must clear Gates first.
function status() {
  return Object.freeze({
    node: 'N7 — OptionalModelDraft (model interpretation)',
    interfaceType: 'AUTHORIZED_SESSION_NATIVE_MODEL_INTERFACE',
    channel: 'session-native Agent subagent (general-purpose), real model inference',
    inAppLiveSdk: false,
    inAppLiveSdkBlocker: 'the in-app SDK probe EXIT=124 / 0 bytes; no local weights; no model API credential/endpoint',
    liveInference: false,          // the EEWR process itself never calls a model
    networkCallsPermitted: false,
    provider: 'none',
    billing: '0 accounts, 0 credits, 0 credentials, 0 paid billing, 0 model API calls',
    modelSeesOnly: 'authorised citation context (or none)',
    modelNeverSees: ['permission table', 'full corpus', 'restricted items', 'tools', 'approval gate', 'audit writer'],
    outputTrust: 'UNTRUSTED — must pass deterministic N7->N8 guard',
    verified: false,
    gatesToEnableLive: ['G1 service/account', 'G2 official dataset', 'G3 platform E2E', 'G4 console capture', 'G5 export', 'G6 close-out'],
    note: 'This module consumes a genuine captured model output. It is model-ASSISTED, not verified in-app live AI.'
  });
}

// Load + integrity-check the captured drafts. Returns null on ANY problem so
// callers fail closed. Verifies: file exists, parses, has cases, each case has a
// verbatim draft whose SHA-256 matches the recorded hash.
function loadArtifact(artifactPath) {
  const p = artifactPath || DEFAULT_ARTIFACT;
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
  let doc;
  try { doc = JSON.parse(raw); } catch (_) { return null; }
  if (!doc || !Array.isArray(doc.cases) || doc.cases.length === 0) return null;
  const byId = {};
  for (const c of doc.cases) {
    if (!c || !c.caseId || typeof c.modelOutputVerbatim !== 'string') return null;
    if (!c.modelOutputSha256) return null;
    if (sha256(c.modelOutputVerbatim) !== c.modelOutputSha256) return null; // integrity fail
    byId[c.caseId] = c;
  }
  const corpus = Object.keys(byId).sort()
    .map(id => id + '\n' + byId[id].modelOutputVerbatim).join('\n');
  return Object.freeze({
    path: p,
    fileSha256: sha256(raw),
    caseIds: Object.freeze(Object.keys(byId).sort()),
    cases: Object.freeze(byId),
    syntheticDataLabel: doc.syntheticDataLabel || '',
    channel: doc.channel || '',
    agentId: doc.agentId || '',
    corpusSha256: sha256(corpus),
    integrityOk: true
  });
}

/**
 * Create the N7 interpreter adapter.
 * @param {object} opts  { mode: 'captured'|'disabled', artifactPath }
 *   mode='captured' (default): consume the genuine captured session-native model
 *     output, verified by SHA-256. This is the strongest technically supported
 *     model-assisted workflow in this isolated workspace.
 *   mode='disabled': fail closed — no model contribution at all, deterministic
 *     answer used. (Demonstrates the fallback behaviour required by the brief.)
 */
function createInterpreter(opts) {
  const o = opts || {};
  const mode = o.mode === 'disabled' ? 'disabled' : 'captured';
  const artifact = mode === 'captured' ? loadArtifact(o.artifactPath) : null;

  /**
   * Interpret one case. Returns the model draft (verbatim) or an empty string
   * (fail-closed). The caller MUST pass the result through applyOutputGuard.
   * @param {object} packet { caseId, upstreamStatus, permittedHits }
   */
  function interpret(packet) {
    const pk = packet || {};
    // No model contribution when disabled, artifact invalid, case missing.
    if (mode === 'disabled' || !artifact || !artifact.integrityOk) {
      return Object.freeze({ draft: '', used: false, reason: 'FAIL_CLOSED_NO_MODEL_CONTRIBUTION',
        caseId: pk.caseId || null, integrityOk: false });
    }
    const c = artifact.cases[pk.caseId];
    if (!c) {
      return Object.freeze({ draft: '', used: false, reason: 'FAIL_CLOSED_CASE_NOT_IN_ARTIFACT',
        caseId: pk.caseId || null, integrityOk: true });
    }
    // Re-verify the exact draft hash at consumption time (defence in depth).
    if (sha256(c.modelOutputVerbatim) !== c.modelOutputSha256) {
      return Object.freeze({ draft: '', used: false, reason: 'FAIL_CLOSED_HASH_MISMATCH',
        caseId: pk.caseId, integrityOk: false });
    }
    return Object.freeze({
      draft: c.modelOutputVerbatim,
      used: true,
      reason: 'GENUINE_CAPTURED_MODEL_OUTPUT_HASH_VERIFIED',
      caseId: pk.caseId,
      modelOutputSha256: c.modelOutputSha256,
      channel: artifact.channel,
      integrityOk: true
    });
  }

  return Object.freeze({
    mode,
    status,
    interpret,
    artifact: artifact ? Object.freeze({
      path: artifact.path, fileSha256: artifact.fileSha256,
      caseIds: artifact.caseIds, corpusSha256: artifact.corpusSha256,
      integrityOk: artifact.integrityOk, channel: artifact.channel,
      syntheticDataLabel: artifact.syntheticDataLabel
    }) : null,
    isAvailable: () => mode === 'captured' && !!artifact && artifact.integrityOk
  });
}

module.exports = { createInterpreter, loadArtifact, status, sha256, DEFAULT_ARTIFACT };
