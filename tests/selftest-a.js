'use strict';
// CHALLENGE A — offline end-to-end self-test for the knowledge brain.
// Zero network. Deterministic timestamps. Covers:
//   - the 6 mandatory Challenge A behaviours (guide §3)
//   - the 5 accountability rules (guide §1)
//   - official Uji 1 (restricted project) and Uji 2 (conflicting allowance)
//   - 4 bonus items, full audit chain, human-approval gate, no-live-AI posture
// Must exit 0 before any demo or evidence document relies on it.

const fs = require('fs');
const path = require('path');
const os = require('os');
const A = require('assert');
const { createKnowledgeBrain, DISCLOSURE, loadCorpus } = require('../agent/knowledge');
const { loadPermissions, resolvePrincipal } = require('../agent/access');
const { buildAnswer } = require('../agent/answer');
const { createAudit } = require('../agent/audit');
const provider = require('../agent/provider-adapter');

const LAB = path.join(__dirname, '..');
const FIXED_NOW = '2026-11-04T05:10:00+08:00';
const Q_ALLOWANCE = 'Berapa tunjangan bahan bakar bulanan saat ini?';
const Q_RESTRICTED = 'Apa itu Proyek Kenari?';
const Q_NONEXISTENT = 'Apa itu Proyek Zebra?';
const Q_INTERNAL = 'Berapa indeks kekeringan di wilayah operasi TGC?';
const Q_ORIENTASI = 'Data identitas apa saja yang ada di panduan orientasi pegawai baru?';
const Q_NOTULEN = 'Apa isi catatan rapat operasi tentang injeksi dan notulen?';
const Q_OOS = 'Bagaimana harga saham hari ini?';

function runA(opts) {
  const o = opts || {};
  const stateDir = o.stateDir || path.join(os.tmpdir(), 'eewr-selftest-a');
  fs.rmSync(stateDir, { recursive: true, force: true });

  const results = [];
  function check(name, fn) {
    try { fn(); results.push(['PASS', name]); }
    catch (err) { results.push(['FAIL', name + ' :: ' + err.message]); }
  }

  const kb = createKnowledgeBrain({ stateDir, now: FIXED_NOW });
  const corpus = loadCorpus();
  const table = loadPermissions();

  // ---------------------------------------------------------------- identity
  check('A-T01 exact identity, 100% synthetic, Challenge A declared, no live-AI claim', () => {
    A.strictEqual(DISCLOSURE.product, 'EEWR — Executive Early Warning Radar');
    A.strictEqual(DISCLOSURE.team, 'BRONX');
    A.strictEqual(DISCLOSURE.organization, 'XRC');
    A.strictEqual(DISCLOSURE.representedBy, 'Team BRONX');
    A.strictEqual(DISCLOSURE.industry, 'Natural resource-based industries');
    A.ok(DISCLOSURE.demoEntity.includes('The Goodlight Company'));
    A.match(DISCLOSURE.subsystem, /Challenge A/);
    A.match(DISCLOSURE.model, /No live model inference/);
    A.match(DISCLOSURE.capability, /not functional AI/);
    A.strictEqual(corpus.synthetic, true);
    A.match(corpus.disclosure, /100% synthetic/);
  });

  check('A-T02 permission table loads; unknown user downgraded to least privilege', () => {
    A.strictEqual(table.synthetic, true);
    A.strictEqual(typeof table.roles, 'object');
    const anon = resolvePrincipal(table, null);
    A.strictEqual(anon.downgraded, true);
    A.strictEqual(anon.role, table.defaultRole);
    A.deepStrictEqual(anon.allowLevels, ['public']);
    const rudi = resolvePrincipal(table, 'usr-rudi');
    A.strictEqual(rudi.downgraded, false);
    A.ok(rudi.allowLevels.includes('restricted'));
  });

  // -------------------------------------------------- A2: authorise BEFORE search
  let rBaru;
  check('A-T03 authorisation is applied BEFORE search (scope excludes restricted/internal)', () => {
    rBaru = kb.ask(Q_ALLOWANCE, 'usr-andi');
    A.strictEqual(rBaru.retrieval.scopedBeforeSearch, true);
    A.ok(rBaru.retrieval.permittedSources < rBaru.retrieval.totalSources);
    const evt = kb.audit.read().filter(e => e.event === 'AUTHORISATION_CHECKED').pop();
    A.ok(evt.withheldByLevel + evt.withheldByTopic > 0);
  });

  check('A-T04 only permitted data is ever retrieved (no internal/restricted evidence leaks)', () => {
    for (const h of rBaru.retrieval.hits) {
      A.strictEqual(h.level, 'public');
      A.ok(table.roles['staf-baru'].allowTopics.includes(h.topic));
    }
    const ids = rBaru.retrieval.hits.map(h => h.evidenceId).join(',');
    A.doesNotMatch(ids, /KB-006|KB-010|KB-011/);
  });

  // ------------------------------------------------------ official Uji 1 (§3)
  let uji1, uji1Control;
  check('A-T05 Uji 1: restricted question == non-existent question, no existence leak', () => {
    uji1 = kb.ask(Q_RESTRICTED, 'usr-andi');
    uji1Control = kb.ask(Q_NONEXISTENT, 'usr-andi');
    A.strictEqual(uji1.status, 'SAYA_TIDAK_TAHU');
    A.strictEqual(uji1Control.status, 'SAYA_TIDAK_TAHU');
    A.strictEqual(JSON.stringify(uji1.answer), JSON.stringify(uji1Control.answer));
    const text = JSON.stringify(uji1.answer);
    A.doesNotMatch(text, /[Kk]enari/);
    A.doesNotMatch(text, /rahasia|terbatas|restricted|confidential/i);
    A.strictEqual(uji1.retrieval.hits.length, 0);
  });

  check('A-T06 Uji 1 control: same topic IS answerable for an authorised role (permission-aware, not fake-absence)', () => {
    const execRun = kb.ask(Q_RESTRICTED, 'usr-rudi');
    A.notStrictEqual(execRun.status, 'SAYA_TIDAK_TAHU');
    A.ok(execRun.retrieval.hits.some(h => h.evidenceId === 'KB-011'));
    A.ok(execRun.answer.sources.some(s => s.evidenceId === 'KB-011'));
    // The low-privilege answer must still be neutral.
    A.strictEqual(uji1.status, 'SAYA_TIDAK_TAHU');
  });

  // ------------------------------------------------------ official Uji 2 (§3)
  let uji2;
  check('A-T07 Uji 2: conflicting allowance -> Rp750.000, both sources cited, old SOP flagged usang', () => {
    uji2 = kb.ask(Q_ALLOWANCE, 'usr-andi');
    A.strictEqual(uji2.status, 'ANSWER_WITH_CONFLICT_FLAG');
    A.ok(uji2.conflicts.length >= 1);
    const c = uji2.conflicts[0];
    A.strictEqual(c.claimKey, 'fuel-allowance');
    A.strictEqual(c.resolution.selectedId, 'KB-002');
    A.strictEqual(c.resolution.selectedValue, 'Rp750.000');
    A.ok(uji2.answer.answer.includes('Rp750.000'));
    const cited = uji2.answer.sources.map(s => s.evidenceId);
    A.ok(cited.includes('KB-001') && cited.includes('KB-002'));
    A.match(c.resolution.explanation, /usang|superseded/);
    A.ok(c.resolution.supersededIds.includes('KB-001'));
  });

  check('A-T08 every answer sentence is anchored to a fully-described source (chat/document/task)', () => {
    A.ok(uji2.answer.sources.length >= 1);
    for (const s of uji2.answer.sources) {
      A.ok(s.evidenceId && s.sourceRef && s.date && s.level);
      A.ok(['chat', 'document', 'task'].includes(s.type));
      A.ok(typeof s.retrievalScore === 'number');
      A.ok(typeof s.quote === 'string');
      A.ok(s.role);
    }
    A.match(uji2.answer.groundingStatement, /ditautkan ke sumber/);
  });

  // ------------------------------------------- A2: access change reactivity
  check('A-T09 if access changes, the NEXT answer follows it (fresh permission reload)', () => {
    const permDir = path.join(os.tmpdir(), 'eewr-kb-perm-' + process.pid);
    fs.mkdirSync(permDir, { recursive: true });
    const permFile = path.join(permDir, 'permissions.json');
    const t = JSON.parse(JSON.stringify(table));
    fs.writeFileSync(permFile, JSON.stringify(t, null, 2));
    const st = path.join(permDir, 'state');
    const kb2 = createKnowledgeBrain({ stateDir: st, now: FIXED_NOW, permissionsPath: permFile });

    const before = kb2.ask(Q_INTERNAL, 'usr-deni');
    A.strictEqual(before.status, 'SAYA_TIDAK_TAHU');

    t.users['usr-deni'].role = 'staf-operasional';
    fs.writeFileSync(permFile, JSON.stringify(t, null, 2));
    const after = kb2.ask(Q_INTERNAL, 'usr-deni');
    A.notStrictEqual(after.status, 'SAYA_TIDAK_TAHU');
    A.ok(after.retrieval.hits.some(h => h.evidenceId === 'KB-006'));
    fs.rmSync(permDir, { recursive: true, force: true });
  });

  // ------------------------------------------------------- A4: conflict logic
  check('A-T10 conflict resolution is explainable (rule, selected, superseded, reason)', () => {
    const c = uji2.conflicts[0];
    A.match(c.resolution.rule, /NEWEST_DATED_SOURCE_WINS/);
    A.ok(c.resolution.explanation.length > 40);
    A.ok(c.candidates.length >= 2);
    A.strictEqual(c.candidates.filter(x => x.selected).length, 1);
    A.ok(c.candidates.every(x => x.value && x.date && x.type && x.sourceRef));
    A.ok(uji2.answer.notices.some(n => /KONFLIK/.test(n)));
  });

  // ------------------------- §1 rule 4: acknowledge limits (disclosed failure P4)
  check('A-T23 partial evidence with no direct value -> admits limit instead of implying a full answer', () => {
    const r = kb.ask('Berapa lama kuota cuti tahunan pegawai?', 'usr-andi');
    A.strictEqual(r.status, 'SAYA_TIDAK_TAHU_SEBAGIAN');
    A.strictEqual(r.answer.completeness.level, 'PARTIAL_NO_DIRECT_VALUE');
    A.match(r.answer.answer, /Saya tidak tahu nilai spesifik/);
    A.match(r.answer.answer, /tidak memuat angka/);
    A.ok(r.answer.sources.length >= 1);
    A.ok(r.answer.ownerRoute.owner);
    A.ok(r.answer.notices.some(n => /BATASAN DI AKUI/.test(n)));
  });

  // --------------------------------------- A5: "Saya tidak tahu" + owner routing
  check('A-T11 "Saya tidak tahu" with a neutral information-owner route, no topic hint', () => {
    A.match(uji1.answer.answer, /Saya tidak tahu/);
    A.match(uji1.answer.answer, /pemilik informasi/);
    A.ok(uji1.answer.ownerRoute && uji1.answer.ownerRoute.owner);
    A.strictEqual(uji1.answer.ownerRoute.hintedRestriction, false);
    A.deepStrictEqual(uji1.answer.sources, []);
  });

  check('A-T12 answered questions route to the TOPIC information owner (owner directory)', () => {
    A.ok(uji2.answer.ownerRoute.owner.length > 5);
    A.strictEqual(uji2.answer.ownerRoute.basis, 'TOPIC_OWNER_DIRECTORY');
    A.ok(/HR|Finance|Operations|Project|Logistics|Risk|Secretariat/.test(uji2.answer.ownerRoute.owner));
  });

  // ------------------------------------------------------------ bonus: injection
  check('A-T13 embedded instruction is treated as DATA, detected, neutralised and reported', () => {
    const r = kb.ask(Q_NOTULEN, 'usr-sari');
    const hit = r.retrieval.hits.find(h => h.evidenceId === 'KB-007');
    A.ok(hit, 'KB-007 should be retrieved for an operational-role question');
    A.strictEqual(hit.injection.detected, true);
    A.ok(hit.injection.patterns.includes('AI_DIRECTIVE') || hit.injection.patterns.includes('OVERRIDE_RULE'));
    A.match(hit.safeQuote, /INSTRUKSI TERSISIP/);
    A.doesNotMatch(hit.safeQuote, /AI: abaikan aturan/);
    A.ok(r.answer.notices.some(n => /INSTRUKSI TERSISIP TERDETEKSI & DIABAIKAN/.test(n)));
    const evt = kb.audit.read().filter(e => e.event === 'PROMPT_INJECTION_DETECTED_AND_IGNORED');
    A.ok(evt.length >= 1);
  });

  // ---------------------------------------------------------------- bonus: PII
  check('A-T14 NIK and phone numbers are masked by default', () => {
    const r = kb.ask(Q_ORIENTASI, 'usr-andi');
    const hit = r.retrieval.hits.find(h => h.evidenceId === 'KB-005');
    A.ok(hit, 'KB-005 should be retrieved');
    A.ok(hit.pii.maskedTypes.includes('NIK'));
    A.ok(hit.pii.maskedTypes.includes('PHONE'));
    A.match(hit.safeQuote, /NIK DISAMARKAN/);
    A.match(hit.safeQuote, /TELEPON DISAMARKAN/);
    A.doesNotMatch(hit.safeQuote, /3171-0101-0000-0001|0812-3456-7890/);
  });

  check('A-T15 explicit needPii exception is honoured and logged as a decision', () => {
    const r = kb.ask(Q_ORIENTASI, 'usr-andi', { needPii: true });
    const hit = r.retrieval.hits.find(h => h.evidenceId === 'KB-005');
    A.strictEqual(hit.pii.needPii, true);
    A.strictEqual(hit.pii.maskedTypes.length, 0);
  });

  // ------------------------------------------- bonus: combine chat+doc+task
  check('A-T16 chat + document + task can be combined into ONE cited answer', () => {
    const principal = resolvePrincipal(table, 'usr-rudi');
    const fake = (id, type, topic, q) => Object.freeze({
      evidenceId: id, type, topic, level: 'internal', date: '2026-10-20',
      sourceRef: 'Sintetis ' + id, score: 3, safeQuote: q, quote: q,
      injection: { detected: false, patterns: [] },
      pii: { maskedTypes: [] }, claim: null
    });
    const hits = [fake('KB-A', 'chat', 'reimbursement', 'Pesan chat sintetis.'),
                  fake('KB-B', 'document', 'cuti', 'Dokumen kebijakan sintetis.'),
                  fake('KB-C', 'task', 'logistik', 'Kartu tugas sintetis.')];
    const ans = buildAnswer({
      hits, conflicts: [], principal, question: 'Gabungan informasi',
      corpus, permissions: table, scoped: { permittedCount: 3, total: 11 }
    });
    A.deepStrictEqual(ans.sourceTypesCombined, ['chat', 'document', 'task']);
    A.strictEqual(ans.sources.length, 3);
    A.ok(ans.answer.includes('sumber'));
  });

  // ------------------------------------------------- §1 rule 5 / §3 rule 6 audit
  check('A-T17 COMPLETE audit log: question / sources / answer / conflict / refusal / decisions', () => {
    const log = kb.audit.read();
    const kinds = new Set(log.map(e => e.event));
    for (const k of ['QUESTION_RECEIVED', 'AUTHORISATION_CHECKED', 'SOURCES_RETRIEVED',
                     'ANSWER_RETURNED', 'CONFLICT_FLAGGED', 'PII_MASKED',
                     'PROMPT_INJECTION_DETECTED_AND_IGNORED', 'REFUSAL_OR_UNKNOWN']) {
      A.ok(kinds.has(k), 'missing audit event ' + k);
    }
    for (let i = 0; i < log.length; i++) {
      A.strictEqual(log[i].seq, i + 1);
      A.ok(log[i].at && log[i].runId && log[i].actor);
    }
    const q = log.find(e => e.event === 'QUESTION_RECEIVED' && e.question === Q_ALLOWANCE);
    A.ok(q);
    const answ = log.find(e => e.event === 'ANSWER_RETURNED' && e.sourcesCited.includes('KB-001'));
    A.ok(answ && answ.answerText.length > 10);
    // requested / approved / executed chain via explicit human decision logging
    const d = kb.recordDecision('KBQ-DEMO', { actor: 'Team BRONX', decision: 'APPROVED', note: 'demo' });
    A.strictEqual(d.executed, false);
    const kinds2 = new Set(kb.audit.read().map(e => e.event));
    A.ok(kinds2.has('HUMAN_DECISION') && kinds2.has('EXECUTION_DEFERRED'));
  });

  // ------------------------------------------------------- human approval gate
  check('A-T18 read-only brain: no tool invocation, execution impossible without a named human', () => {
    A.strictEqual(uji2.actionExecution.permitted, false);
    A.strictEqual(uji2.actionExecution.executed, false);
    A.strictEqual(uji2.humanApprovalRequired, false);
    A.throws(() => kb.recordDecision('KBQ-X', { actor: '', decision: 'APPROVED' }), /APPROVER_REQUIRED/);
    // Even a caller asking for execution cannot force it in this prototype.
    const forced = kb.recordDecision('KBQ-Y', { actor: 'Team BRONX', decision: 'APPROVED', executed: true });
    A.strictEqual(forced.executed, false);
  });

  // -------------------------------------------------------------- determinism
  check('A-T19 deterministic & reproducible (same question+user+timebase -> identical run)', () => {
    const st = path.join(os.tmpdir(), 'eewr-kb-repro-' + process.pid);
    fs.rmSync(st, { recursive: true, force: true });
    const k = createKnowledgeBrain({ stateDir: st, now: FIXED_NOW });
    const a = k.ask(Q_ALLOWANCE, 'usr-andi');
    const b = k.ask(Q_ALLOWANCE, 'usr-andi');
    A.strictEqual(a.runId, b.runId);
    A.strictEqual(JSON.stringify(a), JSON.stringify(b));
    fs.rmSync(st, { recursive: true, force: true });
  });

  // ------------------------------------------------------------ AI posture
  check('A-T20 fail-closed model posture, no unnegated live-AI / functional-AI claim', () => {
    A.strictEqual(uji2.model.liveInference, false);
    A.strictEqual(uji2.model.networkCallsPermitted, false);
    const s = provider.status();
    A.strictEqual(s.verified, false);
    A.strictEqual(s.networkCallsPermitted, false);
    const deny = [
      'live ai (is|are) ' + 'working', 'real[- ]time inference is',
      'live model inference is ' + 'working', 'fully operational live ' + 'ai',
      'functional ai is ' + 'working', 'powered by [a-z0-9_-]+ ai'
    ];
    A.doesNotMatch(JSON.stringify(uji2), new RegExp(deny.join('|'), 'i'));
  });

  // ------------------------------------------------------------- isolation
  check('A-T21 isolation: no network imports, no fetch, no dependency on the shipped app', () => {
    const dir = path.join(LAB, 'agent');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      A.doesNotMatch(src, /\brequire\(['"](https?|net|tls)['"]\)/, f);
      A.doesNotMatch(src, /\bfetch\s*\(/, f);
      A.doesNotMatch(src, /EEWR_DATA|localStorage|eewr\.demo\.v1/, f);
    }
    A.ok(!fs.existsSync(path.join(LAB, '.env')));
    A.ok(!fs.existsSync(path.join(LAB, 'package.json')));
  });

  // -------------------------------------------------------------- hygiene
  check('A-T22 source hygiene: synthetic flags, no secrets / email / AKID / phone in new files', () => {
    const files = [
      'data/knowledge-corpus.json', 'data/permission-table.json',
      'agent/access.js', 'agent/safety.js', 'agent/answer.js',
      'agent/audit.js', 'agent/knowledge.js'
    ];
    const skPat = new RegExp('sk-' + '[A-Za-z0-9]{16,}');
    const akPat = new RegExp('AKID' + '[A-Za-z0-9]{10,}');
    const mailPat = new RegExp('[\\w.+-]+' + '@' + '[\\w-]+\\.[\\w.]{2,}');
    const phonePat = new RegExp('(?<!\\d)(?:\\+62|08)\\d{8,12}(?!\\d)');
    for (const rel of files) {
      const t = fs.readFileSync(path.join(LAB, rel), 'utf8');
      A.doesNotMatch(t, skPat, rel);
      A.doesNotMatch(t, akPat, rel);
      A.doesNotMatch(t, mailPat, rel);
      A.doesNotMatch(t, phonePat, rel);
    }
    A.strictEqual(loadCorpus().synthetic, true);
    A.strictEqual(loadPermissions().synthetic, true);
  });

  const pass = results.filter(r => r[0] === 'PASS').length;
  const fail = results.length - pass;

  if (o.writeTrace !== false && fail === 0) {
    const tdir = path.join(LAB, 'traces');
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, 'sample-run-a.json'), JSON.stringify({
      generatedAt: FIXED_NOW,
      note: 'Challenge A offline trace. Deterministic simulation — no live model inference. 100% synthetic.',
      track: 'CHALLENGE_A_WORKPLACE_KNOWLEDGE_BRAIN',
      commands: [
        'node agent/run.js ask-a "' + Q_ALLOWANCE + '" --user=usr-andi',
        'node agent/run.js ask-a "' + Q_RESTRICTED + '" --user=usr-andi',
        'node agent/run.js ask-a "' + Q_RESTRICTED + '" --user=usr-rudi',
        'node agent/run.js kb-status'
      ],
      uji1_restricted_vs_nonexistent_identical: true,
      uji2_selected_value: uji2.conflicts[0].resolution.selectedValue,
      uji2_sources_cited: uji2.answer.sources.map(s => s.evidenceId),
      uji2_answer: uji2.answer,
      auditEventCount: kb.audit.read().length,
      auditEventKinds: [...new Set(kb.audit.read().map(e => e.event))].sort()
    }, null, 2) + '\n');
  }

  const lines = results.map(([st, n]) => `  ${st}  ${n}`);
  const report = [
    'EEWR Agent Lab — CHALLENGE A knowledge-brain offline E2E self-test',
    'Product : EEWR — Executive Early Warning Radar | Team BRONX | Org XRC',
    'Track   : Challenge A — Workplace Knowledge Brain (Otak Pengetahuan Kerja)',
    'Mode    : deterministic simulation (AI (simulasi)); no live model inference',
    'Timebase: ' + FIXED_NOW,
    '------------------------------------------------------------',
    ...lines,
    '------------------------------------------------------------',
    `RESULT  : ${pass}/${results.length} PASS, ${fail} FAIL`,
    fail === 0
      ? 'Gate    : 6 mandatory + 5 accountability + Uji 1/2 + bonuses verified; HUMAN APPROVAL GATE enforced; NO functional-AI claim.'
      : 'Gate    : FAILED — do not record a demo until all checks pass.',
    ''
  ].join('\n');

  return { ok: fail === 0, pass, fail, report };
}

if (require.main === module) {
  const r = runA({});
  process.stdout.write(r.report);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { runA };
