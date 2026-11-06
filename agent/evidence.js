'use strict';
// Read-only loader for the isolated synthetic evidence corpus.
// This module NEVER imports anything from the shipped dashboard — isolation boundary.

const fs = require('fs');
const path = require('path');

const DEFAULT_PATH = path.join(__dirname, '..', 'data', 'synthetic-evidence.json');

function loadEvidence(evidencePath) {
  const p = evidencePath || DEFAULT_PATH;
  const corpus = JSON.parse(fs.readFileSync(p, 'utf8'));

  if (corpus.synthetic !== true) throw new Error('EVIDENCE_NOT_SYNTHETIC');
  if (!Array.isArray(corpus.items) || corpus.items.length === 0) throw new Error('EVIDENCE_EMPTY');

  const ids = new Set();
  for (const item of corpus.items) {
    for (const k of ['id', 'title', 'body', 'category', 'source', 'metrics']) {
      if (!(k in item)) throw new Error('EVIDENCE_MALFORMED: ' + item.id + ' missing ' + k);
    }
    if (ids.has(item.id)) throw new Error('EVIDENCE_DUPLICATE_ID: ' + item.id);
    ids.add(item.id);
    for (const k of ['p', 'i', 'u']) {
      const v = item.metrics[k];
      if (typeof v !== 'number' || v < 0 || v > 100) throw new Error('EVIDENCE_BAD_METRIC: ' + item.id);
    }
  }
  return Object.freeze(corpus);
}

module.exports = { loadEvidence, DEFAULT_PATH };
