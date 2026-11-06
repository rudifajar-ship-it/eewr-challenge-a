'use strict';
// CHALLENGE A — answer construction.
//  * Every sentence is anchored to cited sources (§1 rule 1, §3 mandatory 1).
//  * Conflicting sources are flagged; the chosen source + reason are stated
//    (§3 mandatory 4, official Uji 2).
//  * "Saya tidak tahu" + route to the correct information owner
//    (§1 rule 4, §3 mandatory 5).
//  * Chat + document + task can be combined into one answer (§3 bonus).
//  * Language: Bahasa Indonesia / English / mixed (§3 mandatory 1).
// Deterministic. No model, no network, no fabrication.

function byDateNewestFirst(a, b) {
  const c = String(b.date).localeCompare(String(a.date));
  return c !== 0 ? c : String(a.evidenceId).localeCompare(String(b.evidenceId));
}

// Group retrieved hits by their claim key. When >=2 distinct values exist for
// the same key, a conflict is declared. Resolution rule: the newest dated
// source wins (and an explicit supersededBy link is honoured). Both sources
// are always cited, and the loser is marked "usang / superseded".
function detectConflicts(hits) {
  const groups = new Map();
  for (const h of hits) {
    if (!h.claim || !h.claim.key) continue;
    if (!groups.has(h.claim.key)) groups.set(h.claim.key, []);
    groups.get(h.claim.key).push(h);
  }
  const conflicts = [];
  for (const [key, list] of groups) {
    const values = new Set(list.map(x => x.claim.value));
    if (list.length < 2 || values.size < 2) continue;
    const ranked = list.slice().sort(byDateNewestFirst);
    let winner = ranked[0];
    // Honour an explicit supersession chain if present among the candidates.
    const pointingAtWinner = new Set();
    const superseding = list.find(x => ranked.some(r => {
      if (r.supersededBy === x.evidenceId) { pointingAtWinner.add(r.evidenceId); return true; }
      return false;
    }));
    if (superseding) winner = superseding;
    const losers = ranked.filter(x => x.evidenceId !== winner.evidenceId);
    const explicitReasons = losers.filter(x => x.supersededBy === winner.evidenceId);
    const reasonText =
      `Digunakan ${winner.evidenceId} (${winner.type}, ${winner.date}) karena bertanggal paling baru` +
      (explicitReasons.length
        ? `, dan ${explicitReasons.map(x => x.evidenceId).join(', ')} secara eksplisit menandainya sebagai pengganti (supersededBy)`
        : '') +
      `. Sumber ${losers.map(x => x.evidenceId).join(', ')} ditandai usang / superseded tetapi tetap dikutip sebagai pembanding.`;
    conflicts.push(Object.freeze({
      claimKey: key,
      detected: true,
      candidates: Object.freeze(ranked.map(x => Object.freeze({
        evidenceId: x.evidenceId,
        value: x.claim.value,
        date: x.date,
        type: x.type,
        sourceRef: x.sourceRef,
        selected: x.evidenceId === winner.evidenceId
      }))),
      resolution: Object.freeze({
        rule: 'NEWEST_DATED_SOURCE_WINS_AND_EXPLICIT_SUPERSESSION',
        selectedId: winner.evidenceId,
        selectedValue: winner.claim.value,
        selectedDate: winner.date,
        supersededIds: Object.freeze(losers.map(x => x.evidenceId)),
        explanation: `Dua sumber memberi nilai berbeda untuk ${key}. ${reasonText}`
      })
    }));
  }
  return Object.freeze(conflicts);
}

// Guide §1 rule 4 / §3 mandatory 5: when the data does not actually contain the
// requested value, the agent must acknowledge the limit instead of implying a
// complete answer. A question asking for a quantity/date/actor, answered by a
// source that contains NO numeric/direct value, is a PARTIAL answer: still cite
// the sources, but state plainly that the specific value is not in the data and
// route to the information owner. This deliberately exposes a real limitation
// of lexical retrieval (documented as a disclosed failed case in the evidence).
const VALUE_SEEKING = /\b(berapa|how much|how many|kapan|when|siapa|who|di mana|where|banyaknya|jumlahnya)\b/i;

function assessCompleteness(question, hits, conflicts) {
  if (conflicts && conflicts.length > 0) {
    return Object.freeze({ level: 'COMPLETE', reason: 'CONFLICT_RESOLVED_WITH_A_SELECTED_VALUE' });
  }
  if (hits.length === 0) {
    return Object.freeze({ level: 'NONE', reason: 'NO_PERMITTED_SOURCE' });
  }
  const asksForValue = VALUE_SEEKING.test(String(question));
  const topHasValue = /\d/.test(hits[0].safeQuote || '');
  if (asksForValue && !topHasValue) {
    return Object.freeze({ level: 'PARTIAL_NO_DIRECT_VALUE', reason: 'SOURCE_HAS_NO_SPECIFIC_VALUE' });
  }
  return Object.freeze({ level: 'COMPLETE', reason: 'DIRECT_SOURCE_AVAILABLE' });
}

function routeOwner(topic, corpus, permissions) {
  if (topic && corpus.ownerDirectory && corpus.ownerDirectory[topic]) {
    return Object.freeze({
      owner: corpus.ownerDirectory[topic],
      basis: 'TOPIC_OWNER_DIRECTORY',
      hintedRestriction: false
    });
  }
  return Object.freeze({
    owner: (permissions && permissions.defaultOwner) || (corpus && corpus.defaultOwner) || 'TGC — Knowledge Desk (peran fiktif)',
    basis: 'DEFAULT_NEUTRAL_DESK',
    hintedRestriction: false
  });
}

// Build a citation object for every source actually used in the answer.
function cite(hit, role) {
  return Object.freeze({
    evidenceId: hit.evidenceId,
    type: hit.type,                    // chat | document | task
    sourceRef: hit.sourceRef,          // which message / document / task
    date: hit.date,
    level: hit.level,
    retrievalScore: hit.score,
    quote: hit.safeQuote,             // neutralised + PII-masked text (DATA only)
    role
  });
}

function buildAnswer(ctx) {
  const { hits, conflicts, principal, question, corpus, permissions, scoped } = ctx;
  const citations = Object.freeze(hits.map(h => cite(h, 'basis jawaban / answer basis')));

  // Conflicting-evidence branch (official Uji 2).
  const completeness = assessCompleteness(question, hits, conflicts);
  let headline;
  let status;
  if (conflicts.length > 0) {
    status = 'ANSWER_WITH_CONFLICT_FLAG';
    const c = conflicts[0];
    headline =
      `Nilai yang berlaku: ${c.resolution.selectedValue}. Terdapat perbedaan antar sumber. ` +
      c.resolution.explanation;
  } else if (completeness.level === 'PARTIAL_NO_DIRECT_VALUE') {
    status = 'SAYA_TIDAK_TAHU_SEBAGIAN';
    headline =
      `Saya tidak tahu nilai spesifik yang Anda tanyakan: data yang boleh saya akses tidak memuat angka atau jawaban langsung untuk itu. ` +
      `Berikut ${hits.length} sumber terkait untuk konteks (bukan jawaban final): ` +
      `${hits.map(h => h.evidenceId).join(', ')}. Silakan konfirmasi ke pemilik informasi yang ditunjuk.`;
  } else {
    status = 'ANSWER_WITH_SOURCES';
    const top = hits[0];
    headline =
      `Berdasarkan ${hits.length} sumber yang diizinkan, informasi tersedia. ` +
      `Rujukan utama ${top.evidenceId} (${top.type}, ${top.date}): ${top.safeQuote}`;
  }

  // Combine source types into one answer (§3 bonus).
  const types = [...new Set(hits.map(h => h.type))].sort();
  const injectionHits = hits.filter(h => h.injection && h.injection.detected);
  const piiHits = hits.filter(h => h.pii && h.pii.maskedTypes.length > 0);

  const topic = hits.length ? hits[0].topic : null;
  const owner = routeOwner(topic, corpus, permissions);

  const notices = [];
  if (conflicts.length) notices.push('KONFLIK SUMBER: perbedaan ditandai, sumber usang tetap dikutip.');
  if (injectionHits.length) {
    notices.push(
      `INSTRUKSI TERSISIP TERDETEKSI & DIABAIKAN pada ${injectionHits.map(h => h.evidenceId).join(', ')}: ` +
      'teks di dalam dokumen diperlakukan sebagai data, bukan perintah.'
    );
  }
  if (piiHits.length) notices.push(`DATA PRIBADI DISAMARKAN (${[...new Set(piiHits.flatMap(h => h.pii.maskedTypes))].join(', ')}).`);
  if (completeness.level === 'PARTIAL_NO_DIRECT_VALUE') {
    notices.push('BATASAN DI AKUI: nilai spesifik tidak ada di data; agent menolak menebak dan mengalihkan ke pemilik informasi.');
  }

  const answer = Object.freeze({
    status,
    answer: headline,
    completeness,
    conflicts: conflicts,
    sources: citations,
    sourceTypesCombined: Object.freeze(types),
    ownerRoute: owner,
    notices: Object.freeze(notices),
    language: 'id (Bahasa Indonesia) with id/en mixed intake accepted',
    questionEcho: question,
    accessContext: Object.freeze({
      role: principal.role,
      label: principal.label,
      permittedSources: scoped.permittedCount,
      totalSources: scoped.total
      // Deliberately NOT exposing withheld counts in the answer.
    }),
    groundingStatement:
      'Setiap klaim di atas ditautkan ke sumber (pesan / dokumen / tugas) pada kolom sources. ' +
      'Tidak ada jawaban yang dibuat tanpa sumber. Semua teks sumber diperlakukan sebagai data.',
    disclosure: 'Deterministic simulation (AI (simulasi)); no live model inference. 100% synthetic data.'
  });
  return answer;
}

module.exports = { detectConflicts, routeOwner, cite, buildAnswer, byDateNewestFirst };
