'use strict';
// Evidence-anchored, explainable recommendation. Pure arithmetic, no model inference.
// Every numeric input is traceable to a cited synthetic evidence item.

const WEIGHTS = Object.freeze({ p: 0.35, i: 0.40, u: 0.25 });

const CATEGORY_ADVICE = Object.freeze({
  'climate-operations': 'prioritise a water-availability review and a short-horizon operating contingency',
  'risk-portfolio': 'review the four critical alerts first and re-check the residual score after mitigation',
  'supply': 'confirm the input buffer and request an updated delivery commitment',
  'compliance': 'complete the documentation review before the scheduled checkpoint',
  'logistics': 'diversify the transport slot and validate the revised delivery window',
  'finance': 'reconcile mitigation spend against the approved scenario budget',
  'stakeholder': 'schedule a documented stakeholder response and log the outcome',
  'action-history': 'verify the previously recorded action and confirm its residual-risk effect'
});

function band(score) {
  if (score >= 75) return 'TINGGI / HIGH';
  if (score >= 55) return 'MODERAT / MODERATE';
  return 'RENDAH / LOW';
}

function compose(retrieval) {
  const hits = retrieval.hits;
  if (!hits || hits.length === 0) {
    return Object.freeze({ status: 'NO_RECOMMENDATION', reason: 'INSUFFICIENT_EVIDENCE' });
  }

  const total = hits.reduce((s, h) => s + h.score, 0) || 1;
  const weighted = { p: 0, i: 0, u: 0 };
  for (const h of hits) {
    const w = h.score / total;
    weighted.p += h.metrics.p * w;
    weighted.i += h.metrics.i * w;
    weighted.u += h.metrics.u * w;
  }
  const p = +weighted.p.toFixed(2);
  const i = +weighted.i.toFixed(2);
  const u = +weighted.u.toFixed(2);
  const score = +(p * WEIGHTS.p + i * WEIGHTS.i + u * WEIGHTS.u).toFixed(2);

  const provenance = hits.map(h => ({
    evidenceId: h.evidenceId,
    retrievalScore: h.score,
    weight: +(h.score / total).toFixed(4),
    contribution: {
      p: +(h.metrics.p * h.score / total).toFixed(4),
      i: +(h.metrics.i * h.score / total).toFixed(4),
      u: +(h.metrics.u * h.score / total).toFixed(4)
    }
  }));

  const grounding = hits.map(h => ({
    evidenceId: h.evidenceId,
    source: h.source,
    quote: h.quote.slice(0, 160),
    usedFor: 'risk factor inputs p/i/u and narrative basis'
  }));

  const top = hits[0];
  const advice = CATEGORY_ADVICE[top.category] || 'review the cited evidence before deciding';
  const primaryCited = hits.map(h => h.evidenceId).join(', ');

  const statement =
    `Based on ${hits.length} synthetic evidence item(s) [${primaryCited}], ` +
    `the composite risk score is ${score} of 100 (${band(score)}). ` +
    `Recommendation: ${advice}. ` +
    `This is a deterministic, evidence-anchored computation — not a model-generated opinion.`;

  return Object.freeze({
    status: 'RECOMMENDATION_READY',
    formula: 'score = p*0.35 + i*0.40 + u*0.25',
    weights: WEIGHTS,
    factors: { p, i, u },
    score,
    band: band(score),
    provenance: Object.freeze(provenance),
    grounding: Object.freeze(grounding),
    statement,
    disclosure: 'Deterministic simulation (AI (simulasi)); no live model inference.'
  });
}

module.exports = { compose, WEIGHTS, band };
