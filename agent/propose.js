'use strict';
// Proposes accountable follow-up actions. PROPOSAL ONLY — never records anything.
// Recording is structurally impossible from this module (see approve.js).

const CATEGORY_TEMPLATES = Object.freeze({
  'climate-operations': {
    title: 'Jalankan tinjauan ketersediaan air dan kontingensi operasi 14 hari',
    ownerRole: 'TGC — Head of Operations (peran fiktif)',
    dueInDays: 3
  },
  'risk-portfolio': {
    title: 'Tinjau 4 peringatan kritikal dan perbarui skor residual',
    ownerRole: 'TGC — Risk & Compliance Lead (peran fiktif)',
    dueInDays: 2
  },
  'supply': {
    title: 'Konfirmasi buffer input dan komitmen pengiriman pemasok',
    ownerRole: 'TGC — Procurement Lead (peran fiktif)',
    dueInDays: 5
  },
  'compliance': {
    title: 'Selesaikan tinjauan dokumentasi sebelum checkpoint terjadwal',
    ownerRole: 'TGC — Risk & Compliance Lead (peran fiktif)',
    dueInDays: 7
  },
  'logistics': {
    title: 'Diversifikasi slot transport dan validasi jendela pengiriman',
    ownerRole: 'TGC — Logistics Lead (peran fiktif)',
    dueInDays: 4
  },
  'finance': {
    title: 'Rekonsiliasi biaya mitigasi terhadap anggaran skenario',
    ownerRole: 'TGC — Finance Lead (peran fiktif)',
    dueInDays: 6
  },
  'stakeholder': {
    title: 'Jadwalkan respons pemangku kepentingan terdokumentasi',
    ownerRole: 'TGC — Stakeholder Relations (peran fiktif)',
    dueInDays: 5
  },
  'action-history': {
    title: 'Verifikasi tindakan ACT-301 dan konfirmasi dampak residual',
    ownerRole: 'TGC Finance Lead (synthetic role)',
    dueInDays: 3
  }
});

function propose(recommendation, retrieval, runId) {
  if (recommendation.status !== 'RECOMMENDATION_READY') return Object.freeze([]);

  const seen = new Set();
  const evidenceIds = retrieval.hits.map(h => h.evidenceId);
  const actions = [];

  for (const h of retrieval.hits.slice(0, 2)) {
    const tpl = CATEGORY_TEMPLATES[h.category] || CATEGORY_TEMPLATES['risk-portfolio'];
    if (seen.has(tpl.title)) continue;
    seen.add(tpl.title);
    actions.push(Object.freeze({
      actionId: `${runId}-A${actions.length + 1}`,
      title: tpl.title,
      ownerRole: tpl.ownerRole,
      dueInDays: tpl.dueInDays,
      rationale: `Derived from ${h.evidenceId} (${h.title}) and composite score ${recommendation.score}.`,
      linkedEvidence: Object.freeze([h.evidenceId]),
      allCitedEvidence: Object.freeze([...evidenceIds]),
      status: 'PENDING_HUMAN_APPROVAL',
      recorded: false,
      synthetic: true
    }));
  }

  return Object.freeze(actions);
}

module.exports = { propose };
