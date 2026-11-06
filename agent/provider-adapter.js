'use strict';
// OPTIONAL external model adapter — DISABLED and FAIL-CLOSED by default.
// No network call is performed anywhere in this prototype build.
// A live model may be enabled only after Gate 1 (service), Gate 2 (real selftest
// response, exit 0) and Gate 3 (full workflow E2E) all pass, AND the official
// guide confirms integration is required/allowed.

const GATES = Object.freeze([
  { gate: 'Gate 1', label: 'Service operational (an internal service ticket)', state: 'FAIL — Insufficient Balance reported' },
  { gate: 'Gate 2', label: 'Real API response with selftest exit 0', state: 'NOT RUN — no credential' },
  { gate: 'Gate 3', label: 'Full workflow E2E with model in loop', state: 'NOT RUN' }
]);

function isEnabled() {
  return process.env.EEWR_AGENT_ALLOW_LIVE === '1'
    && !!process.env.EEWR_AGENT_MODEL_API_KEY
    && !!process.env.EEWR_AGENT_MODEL_BASE_URL;
}

function status() {
  return Object.freeze({
    mode: 'deterministic-simulation',
    wording: 'AI (simulasi)',
    liveInference: false,
    provider: 'none',
    enabled: isEnabled(),
    verified: false,
    networkCallsPermitted: false,
    gates: GATES,
    modelMismatch: 'An internal service ticket concerns a legacy model SKU; shipped backend configures a legacy model SKU. Ticket resolution alone does not enable this adapter.',
    note: 'Any failure falls back to 100% deterministic behaviour. No deliverable may claim functional AI until Gates 2 and 3 return a verified successful response.'
  });
}

// Deliberately returns a structured refusal. There is no fetch/http import.
async function generate() {
  if (!isEnabled()) {
    return Object.freeze({ ok: false, code: 'LIVE_MODEL_DISABLED_FAIL_CLOSED', output: null });
  }
  return Object.freeze({ ok: false, code: 'LIVE_MODEL_NOT_IMPLEMENTED_IN_THIS_BUILD', output: null });
}

module.exports = { status, isEnabled, generate, GATES };
