'use strict';
// CHALLENGE A — DETERMINISTIC OUTPUT GUARD (N7 -> N8 boundary).
//
// WHY THIS EXISTS
// ----------------
// The native-model execution check (traces/native-model-execution-2026-11-04.json,
// finding F-01) proved empirically that a language model left to draft freely
// produces a DIFFERENT refusal wording for a restricted topic than for a
// non-existent topic, even though the upstream deterministic state was
// identical (0 permitted hits, no restriction hint). The official Uji 1
// requires the two responses to be PERSIS SAMA (byte-identical). Different
// wording is not an explicit leak, but it is a distinguishability side
// channel.
//
// THE FIX
// --------
// The model must never own the refusal text. This guard sits between the
// optional model node (N7) and the deterministic answer composer (N8):
//
//   * REFUSAL BRANCH  — the upstream control plane decided "no permitted
//     source". Any model draft is DISCARDED and the single shared
//     UNKNOWN_ANSWER template is emitted instead. Restricted and non-existent
//     topics therefore become byte-identical by construction.
//
//   * ANSWER BRANCH   — a model draft may be used, but only if it passes a
//     grounding check: every monetary figure it mentions must already exist
//     in the authorised citations it was given. A draft that introduces a
//     number not present in the citations is REJECTED and the deterministic
//     composed answer is used instead. This catches the classic failure mode
//     of a model inventing a plausible figure.
//
// Deterministic, zero dependencies, no network, no model call. It never sees
// the permission table, the full corpus, restricted items, tools, or the
// audit writer — only the upstream decision and the already-authorised
// citations.

const { unknownAnswer } = require('./safety');

// Upstream statuses that mean "the control plane found nothing the requester
// may see". The model is not consulted for the final text in these cases.
const REFUSAL_STATUSES = Object.freeze([
  'SAYA_TIDAK_TAHU',
  'NO_PERMITTED_SOURCE'
]);

function isRefusalBranch(upstream) {
  const u = upstream || {};
  if (REFUSAL_STATUSES.includes(u.status)) return true;
  if (u.hitCount === 0 || u.hitsCount === 0) return true;
  if (Array.isArray(u.hits) && u.hits.length === 0) return true;
  return false;
}

// Normalise a number-ish token so "Rp750.000" and "Rp750000" compare equal.
function normaliseNumber(tok) {
  return String(tok).replace(/[.,](?=\d{3}\b)/g, '').replace(/[.,\s]/g, '');
}

// Monetary amounts written with an explicit Rp prefix.
const MONEY_RE = /Rp\s?\d[\d.,]*/gi;

// Every distinct digit run appearing in a text (used for the loose check).
function digitTokens(text) {
  const out = [];
  const re = /\d[\d.,]*/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) out.push(m[0]);
  return out;
}

function groundingCheck(draft, citations) {
  const cited = (citations || []).map(c => {
    const parts = [];
    if (typeof c === 'string') parts.push(c);
    else {
      parts.push(c.quote || '', c.safeQuote || '', c.evidenceId || '', c.type || '',
                 c.date || '', c.sourceRef || '', c.value || '');
    }
    return parts.join(' ');
  }).join(' \n ');

  const citedNorm = normaliseNumber(cited);
  const citedDigits = digitTokens(cited).map(normaliseNumber);

  const money = [];
  let m;
  const re = new RegExp(MONEY_RE.source, 'gi');
  while ((m = re.exec(String(draft || ''))) !== null) money.push(m[0]);
  const unsupportedMoney = money.filter(tok => !citedNorm.includes(normaliseNumber(tok)));

  // Loose check on the remaining digit runs (ids like KB-001, years like 2026).
  // Each must appear verbatim among the digit runs of the authorised citations.
  const moneyNorm = money.map(normaliseNumber);
  const otherTokens = digitTokens(draft)
    .map(normaliseNumber)
    .filter(t => t.length >= 3)
    .filter(t => !moneyNorm.includes(t));
  const unsupportedNumbers = otherTokens.filter(tok => !citedDigits.includes(tok));

  const unsupported = unsupportedMoney.concat(unsupportedNumbers);
  return Object.freeze({
    grounded: unsupported.length === 0,
    moneyMentions: Object.freeze(money),
    unsupported,
    reason: unsupported.length === 0
      ? 'ALL_FIGURES_PRESENT_IN_AUTHORISED_CITATIONS'
      : 'FIGURE_NOT_PRESENT_IN_AUTHORISED_CITATIONS'
  });
}

/**
 * Apply the guard.
 *
 * @param {object} upstream  { status, hits | hitCount | hitsCount }
 * @param {string} modelDraft  the model's draft prose (may be empty)
 * @param {object} opts        { citations: [...], deterministicAnswer, deterministicStatus,
 *                                ownerRoute }
 * @returns {object} { finalAnswer, finalStatus, modelDraftUsed, reason, guard, grounding }
 */
function applyOutputGuard(upstream, modelDraft, opts) {
  const o = opts || {};
  const draft = typeof modelDraft === 'string' ? modelDraft.trim() : '';

  // ---- REFUSAL BRANCH: the model never owns the refusal text -------------
  if (isRefusalBranch(upstream)) {
    const answer = unknownAnswer(o.ownerRoute || null);
    return Object.freeze({
      finalAnswer: answer.answer,
      finalStatus: answer.status,
      finalOwnerRoute: answer.ownerRoute,
      modelDraftUsed: false,
      modelDraftDiscarded: draft.length > 0,
      reason: draft.length > 0
        ? 'REFUSAL_TEMPLATE_IS_DETERMINISTIC_MODEL_DRAFT_DISCARDED'
        : 'REFUSAL_TEMPLATE_IS_DETERMINISTIC_NO_MODEL_DRAFT',
      guard: 'REFUSAL_BRANCH',
      grounding: null,
      sources: Object.freeze([]),
      disclosure: 'Refusal text is emitted from one shared deterministic template. The model never drafts it.'
    });
  }

  // ---- ANSWER BRANCH: model prose allowed, but it must be grounded -------
  const fallbackAnswer = o.deterministicAnswer || '';
  const fallbackStatus = o.deterministicStatus || 'ANSWER_WITH_SOURCES';

  if (!draft) {
    return Object.freeze({
      finalAnswer: fallbackAnswer,
      finalStatus: fallbackStatus,
      finalOwnerRoute: null,
      modelDraftUsed: false,
      modelDraftDiscarded: false,
      reason: 'NO_MODEL_DRAFT_DETERMINISTIC_ANSWER_USED',
      guard: 'ANSWER_BRANCH',
      grounding: null,
      sources: Object.freeze([]),
      disclosure: 'Deterministic answer used; the optional model node produced no draft.'
    });
  }

  const g = groundingCheck(draft, o.citations || []);
  if (!g.grounded) {
    return Object.freeze({
      finalAnswer: fallbackAnswer,
      finalStatus: fallbackStatus,
      finalOwnerRoute: null,
      modelDraftUsed: false,
      modelDraftDiscarded: true,
      reason: 'MODEL_DRAFT_REJECTED_' + g.reason,
      guard: 'ANSWER_BRANCH',
      grounding: g,
      sources: Object.freeze([]),
      disclosure: 'Model draft was rejected because it mentioned a figure absent from the authorised citations. The deterministic cited answer was used.'
    });
  }

  return Object.freeze({
    finalAnswer: draft,
    finalStatus: fallbackStatus,
    finalOwnerRoute: null,
    modelDraftUsed: true,
    modelDraftDiscarded: false,
    reason: 'MODEL_DRAFT_ACCEPTED_' + g.reason,
    guard: 'ANSWER_BRANCH',
    grounding: g,
    sources: Object.freeze(o.citations || []),
    disclosure: 'Model prose was accepted because every figure it stated is present in the authorised citations it was given.'
  });
}

module.exports = {
  applyOutputGuard,
  groundingCheck,
  isRefusalBranch,
  normaliseNumber,
  REFUSAL_STATUSES
};
