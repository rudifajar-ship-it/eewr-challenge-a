'use strict';
// Deterministic, auditable evidence retrieval. No embeddings, no model, no network.
// Input : natural-language risk question (ID or EN)
// Output: ranked evidence hits with citations and a transparent score breakdown.

const STOP = new Set([
  'dan','atau','yang','di','ke','dari','untuk','dengan','apa','apakah','bagaimana',
  'ini','itu','pada','oleh','serta','ada','adalah','bagi','agar','harus','sudah',
  'the','a','an','of','is','are','to','for','and','or','what','how','does','do',
  'with','in','on','at','about','please','show','tell','me','risk','risiko'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP.has(t));
}

function fieldCount(text, token) {
  const t = String(text || '').toLowerCase();
  let n = 0, from = 0;
  while (true) {
    const i = t.indexOf(token, from);
    if (i < 0) break;
    n++;
    from = i + token.length;
  }
  return n;
}

function retrieve(question, corpus, opts) {
  const k = (opts && opts.k) || 3;
  const minScore = (opts && opts.minScore != null) ? opts.minScore : 1.0;
  const tokens = [...new Set(tokenize(question))];
  const N = corpus.items.length;

  // document frequency per query token
  const df = {};
  for (const tk of tokens) {
    df[tk] = corpus.items.filter(it =>
      fieldCount(it.title, tk) + fieldCount(it.tags.join(' '), tk) + fieldCount(it.body, tk) > 0
    ).length;
  }

  const scored = corpus.items.map(it => {
    let score = 0;
    const breakdown = [];
    for (const tk of tokens) {
      const d = df[tk];
      if (!d) continue;
      const idf = Math.log(1 + N / (1 + d));
      const wTitle = 3.0 * fieldCount(it.title, tk);
      const wTags = 2.0 * fieldCount(it.tags.join(' '), tk);
      const wBody = 1.0 * fieldCount(it.body, tk);
      const wId = 1.0 * fieldCount(it.id, tk);
      const contribution = idf * (wTitle + wTags + wBody + wId);
      if (contribution > 0) {
        score += contribution;
        breakdown.push({ token: tk, idf: +idf.toFixed(4), contribution: +contribution.toFixed(4) });
      }
    }
    return {
      evidenceId: it.id,
      title: it.title,
      date: it.date,
      category: it.category,
      source: it.source,
      score: +score.toFixed(4),
      breakdown,
      metrics: { ...it.metrics },
      quote: it.body,
      synthetic: true
    };
  });

  const hits = scored
    .filter(h => h.score >= minScore)
    .sort((a, b) => (b.score - a.score) || a.evidenceId.localeCompare(b.evidenceId))
    .slice(0, k);

  return Object.freeze({
    question: String(question),
    tokens,
    minScore,
    candidateCount: scored.filter(h => h.score >= minScore).length,
    hits: Object.freeze(hits),
    method: 'deterministic tf-idf-style keyword scoring over a fixed synthetic corpus; no model inference',
    sufficient: hits.length > 0
  });
}

module.exports = { retrieve, tokenize };
