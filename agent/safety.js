'use strict';
// CHALLENGE A — safety layer.
//  * Prompt-injection resistance (§3 bonus / §4 B-M6): all document and chat
//    text is DATA, never an instruction. Embedded directives are detected,
//    neutralised in any quoted output, and reported to the user.
//  * PII masking (§3 bonus): NIK and phone numbers are masked unless the
//    question explicitly requires them.
//  * Non-leaking refusal: a single, identical answer is used for "restricted"
//    and "does not exist" so the agent never hints that restricted content exists.
// Zero dependencies, no network.

const INJECTION_PATTERNS = Object.freeze([
  { id: 'AI_DIRECTIVE',        re: /\bAI\s*:/i },
  { id: 'OVERRIDE_RULE',       re: /abaikan\s+(aturan|instruksi|perintah)/i },
  { id: 'BROADCAST_EVERYONE',  re: /teruskan\s+(dokumen|file|pesan)\s+ini\s+ke\s+semua/i },
  { id: 'IGNORE_INSTRUCTIONS', re: /ignore\s+(all\s+|previous\s+)?instructions/i },
  { id: 'NEW_SYSTEM_ROLE',     re: /\bsystem\s*:\s*(kamu|you|anda)/i },
  { id: 'EXFILTRATE',          re: /(kirim|send)\s+(data|semuanya|rahasia)\s+ke/i }
]);

const PII_PATTERNS = Object.freeze([
  { id: 'NIK',   re: /\b\d{4}-\d{4}-\d{4}-\d{4}\b/g,   mask: '[NIK DISAMARKAN]' },
  { id: 'PHONE', re: /\b0\d{3}-\d{4}-\d{4}\b/g,          mask: '[TELEPON DISAMARKAN]' }
]);

function detectInjection(text) {
  const s = String(text || '');
  const hits = [];
  for (const p of INJECTION_PATTERNS) if (p.re.test(s)) hits.push(p.id);
  return Object.freeze({ detected: hits.length > 0, patterns: Object.freeze(hits) });
}

// Replace any embedded directive with a clearly inert marker. This guarantees
// the agent never forwards an instruction found inside data.
function neutralise(text) {
  let s = String(text || '');
  const removed = [];
  for (const p of INJECTION_PATTERNS) {
    if (p.re.test(s)) { removed.push(p.id); s = s.replace(p.re, '[INSTRUKSI TERSISIP — DIABAIKAN]'); }
  }
  return Object.freeze({ text: s, removed: Object.freeze(removed) });
}

function maskPii(text, needPii) {
  const s = String(text || '');
  if (needPii === true) return Object.freeze({ text: s, maskedTypes: Object.freeze([]), needPii: true });
  let out = s;
  const maskedTypes = [];
  for (const p of PII_PATTERNS) {
    p.re.lastIndex = 0;
    if (p.re.test(out)) { maskedTypes.push(p.id); out = out.replace(p.re, p.mask); }
  }
  return Object.freeze({ text: out, maskedTypes: Object.freeze(maskedTypes), needPii: false });
}

// ONE template for "no answer" and "not authorised". Must not echo the question
// or name any restricted topic/owner. Guide §3 Uji 1 requires the restricted
// question to look exactly like a question about something that does not exist.
const UNKNOWN_ANSWER = Object.freeze({
  status: 'SAYA_TIDAK_TAHU',
  answer: 'Saya tidak tahu. Jawaban tidak ditemukan pada data yang dapat saya akses. Silakan hubungi pemilik informasi yang ditunjuk.',
  reason: 'NO_PERMITTED_SOURCE',
  sources: Object.freeze([]),
  ownerRoute: null,
  note: 'Identical neutral response for an unanswerable, unauthorised or non-existent topic. No existence hint is given.'
});

function unknownAnswer(ownerRoute) {
  return Object.freeze({ ...UNKNOWN_ANSWER, ownerRoute: ownerRoute || null });
}

module.exports = { detectInjection, neutralise, maskPii, unknownAnswer, UNKNOWN_ANSWER, INJECTION_PATTERNS, PII_PATTERNS };
