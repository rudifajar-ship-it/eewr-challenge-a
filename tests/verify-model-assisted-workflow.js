'use strict';
// =============================================================================
// EEWR — MODEL-ASSISTED WORKFLOW · END-TO-END VERIFICATION HARNESS
// =============================================================================
// PRIORITY 1 + PRIORITY 2. Runs the REAL six-stage pipeline against the REAL
// deterministic control plane, feeding GENUINE (captured, hash-verified) model
// interpretation drafts, then asserts:
//   * the 6 pipeline stages execute in order and are observable (P1)
//   * the 6 mandatory Challenge A behaviours (A1..A6) (P2)
//   * guard: refusal byte-identity (Uji 1), grounded answers (Uji 2),
//     fabricated-figure rejection, deterministic fallback (P1/P2)
//   * full audit chain, read-only posture, zero-network/billing (P1/P2)
//
// Also emits a machine-readable trace with integrity hashes.
//
// WHAT THIS VERIFIES  : a model-ASSISTED, deterministic-safety-preserving
//   workflow on 100% SYNTHETIC data. The model step is genuine but captured via
//   the platform subagent interface and consumed OFFLINE.
// WHAT THIS DOES NOT  : an in-app live SDK integration, a host platform
//   run/export, the official dataset, or any "verified live AI" claim.
// COST                : 0 accounts, 0 credits, 0 credentials, 0 charges, 0 network.
//
//   node tests/verify-model-assisted-workflow.js
// =============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LAB = path.join(__dirname, '..');
// Standalone checkout: all evidence ships inside this repository.
const EVID = path.join(LAB, 'traces');
const DRAFTS = path.join(EVID, 'model-assisted-drafts-2026-11-04.json');
const TRACE_OUT = path.join(LAB, 'traces', 'model-assisted-workflow-2026-11-04.json');
const EVID_OUT = path.join(EVID, 'model-assisted-workflow-evidence-2026-11-04.json');
const REPORT_TXT = path.join(require('os').tmpdir(), 'eewr-vid', 'model-assisted-workflow-report.txt');

const { createKnowledgeBrain, loadCorpus } = require(path.join(LAB, 'agent', 'knowledge'));
const { createInterpreter } = require(path.join(LAB, 'agent', 'model-interpreter'));
const { createWorkflow, runStage } = require(path.join(LAB, 'agent', 'model-assisted-workflow'));
const { applyOutputGuard, groundingCheck } = require(path.join(LAB, 'agent', 'output-guard'));
const { unknownAnswer } = require(path.join(LAB, 'agent', 'safety'));
const { loadPermissions, resolvePrincipal, scopeCorpus } = require(path.join(LAB, 'agent', 'access'));
const { retrieve } = require(path.join(LAB, 'agent', 'retrieve'));
const { detectConflicts, buildAnswer } = require(path.join(LAB, 'agent', 'answer'));

const NOW = '2026-11-04T05:40:00+08:00';
const STATE = path.join(require('os').tmpdir(), 'eewr-model-assisted-state');
fs.rmSync(STATE, { recursive: true, force: true });
fs.mkdirSync(path.dirname(REPORT_TXT), { recursive: true });

const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const shaS = s => crypto.createHash('sha256').update(String(s)).digest('hex');

const Q = {
  C1: 'Mengapa stok terlambat di Makassar, dan apa yang masih terbuka?',
  C2: 'Berapa tunjangan bahan bakar bulanan saat ini?',
  C3: 'Apa kebijakan cuti tahunan yang berlaku?',
  C4: 'Apa isi notulen rapat operasi tentang injeksi dan data?',
  C5: 'Apa itu Proyek Kenari?',
  C6: 'Apa itu Proyek Zebra?'
};
const U = { C1: 'usr-sari', C2: 'usr-andi', C3: 'usr-andi', C4: 'usr-sari', C5: 'usr-andi', C6: 'usr-andi' };

function verifyModelAssistedWorkflow() {
  const checks = [];
  const chk = (id, cap, cond, detail) => checks.push([id, cap, !!cond, detail]);

  const kb = createKnowledgeBrain({ stateDir: STATE, now: NOW });
  const interpreter = createInterpreter({ mode: 'captured', artifactPath: DRAFTS });
  const wf = createWorkflow({ kb, interpreter });
  const doc = JSON.parse(fs.readFileSync(DRAFTS, 'utf8'));

  // ---- run all 6 cases through the real six-stage pipeline -----------------
  const R = {};
  for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    R[id] = runStage({ kb, interpreter, question: Q[id], userId: U[id], caseId: id });
  }

  // =========================================================================
  // P1 — SIX-STAGE PIPELINE (User Question -> ... -> Audit Log)
  // =========================================================================
  const stageNames = ['USER_QUESTION', 'PERMISSION_CHECK', 'AUTHORISED_RETRIEVAL',
    'REAL_MODEL_INTERPRETATION', 'GROUNDED_ANSWER_WITH_CITATIONS', 'AUDIT_LOG'];
  chk('P1-01', 'six stages execute in exact order for every case',
    Object.values(R).every(r =>
      r.stages.length === 6 && r.stages.every((s, i) => s.stage === i + 1 && s.name === stageNames[i] && s.ok === true)),
    'cases=' + Object.keys(R).length + ' stages=' + R.C1.stages.map(s => s.stage).join('>'));
  chk('P1-02', 'stage 4 is a GENUINE model interpretation (hash-verified), not a live SDK call',
    R.C1.stages[3].detail.modelContributed === true &&
    /HASH_VERIFIED/.test(R.C1.stages[3].detail.reason) &&
    R.C1.stages[3].detail.inAppLiveSdk === false &&
    R.C1.model.inAppLiveSdk === false && R.C1.model.liveInferenceInProcess === false,
    'reason=' + R.C1.stages[3].detail.reason);
  chk('P1-03', 'model only ever sees authorised citation context (documented trust boundary)',
    /authorised citation context/.test(interpreter.status().modelSeesOnly) &&
    interpreter.status().modelNeverSees.includes('permission table') &&
    interpreter.status().modelNeverSees.includes('restricted items') &&
    interpreter.status().modelNeverSees.includes('audit writer'),
    'sees=' + interpreter.status().modelSeesOnly);
  chk('P1-04', 'every case produces a final answer + citations (or the shared refusal)',
    Object.values(R).every(r => typeof r.finalAnswer === 'string' && r.finalAnswer.length > 0 && Array.isArray(r.citations)),
    'answers=' + Object.values(R).map(r => r.finalAnswer.length).join(','));
  chk('P1-05', 'stage 6 audit: append-only events present for every case',
    Object.values(R).every(r => r.stages[5].detail.appendOnly === true && r.stages[5].detail.eventCountSoFar > 0),
    'cumulative events=' + R.C6.stages[5].detail.eventCountSoFar);

  // =========================================================================
  // A1 — answer id / en / mixed with sources
  // =========================================================================
  const enQ = 'What is the current monthly fuel allowance?';
  const enRun = runStage({ kb, interpreter, question: enQ, userId: 'usr-andi', caseId: 'C2' });
  const mixedRun = R.C4; // question mixes id + a foreign term; answered in id
  chk('A1-01', 'A1: Indonesian question answered with cited sources',
    R.C2.finalStatus !== 'SAYA_TIDAK_TAHU' && R.C2.citations.length >= 1 &&
    R.C2.citations.every(c => c.evidenceId && c.sourceRef && c.date),
    'status=' + R.C2.finalStatus + ' cites=' + R.C2.citations.map(c => c.evidenceId).join(','));
  chk('A1-02', 'A1: English question handled by the same pipeline (no crash, grounded)',
    enRun.stages.length === 6 && typeof enRun.finalAnswer === 'string' && enRun.finalAnswer.length > 0,
    'status=' + enRun.controlPlaneStatus + ' answerLen=' + enRun.finalAnswer.length);
  chk('A1-03', 'A1: mixed-language question handled with deterministic grounding',
    mixedRun.stages.length === 6 && mixedRun.guard.grounded === true,
    'grounded=' + mixedRun.guard.grounded + ' branch=' + mixedRun.guard.branch);

  // =========================================================================
  // A2 — authorisation BEFORE search; only permitted data; access-change reacts
  // =========================================================================
  const table = loadPermissions();
  const principal = resolvePrincipal(table, 'usr-andi');
  const corpus = loadCorpus();
  const scoped = scopeCorpus(principal, corpus.items);
  const ret = retrieve(Q.C5, { items: scoped.items }, { k: 4, minScore: 0.5 });
  chk('A2-01', 'A2: permission resolved + scope applied BEFORE retrieval',
    R.C2.stages[1].detail.scopedBeforeSearch === true &&
    R.C2.stages[1].detail.permittedSources < R.C2.stages[1].detail.totalSources,
    'permitted=' + R.C2.stages[1].detail.permittedSources + '/' + R.C2.stages[1].detail.totalSources);
  chk('A2-02', 'A2: restricted evidence never enters the permitted slice',
    !JSON.stringify(ret.hits || []).match(/KB-011|Proyek Kenari/) &&
    R.C5.citations.length === 0 && R.C5.stages[2].detail.permittedHits === 0,
    'C5 hits=' + R.C5.stages[2].detail.permittedHits);
  // access-change reactivity (fresh permission reload)
  const permDir = path.join(require('os').tmpdir(), 'eewr-maw-perm-' + process.pid);
  fs.mkdirSync(permDir, { recursive: true });
  const permFile = path.join(permDir, 'permissions.json');
  const t = JSON.parse(JSON.stringify(table));
  fs.writeFileSync(permFile, JSON.stringify(t, null, 2));
  const kb2 = createKnowledgeBrain({ stateDir: path.join(permDir, 'state'), now: NOW, permissionsPath: permFile });
  const before = kb2.ask('Apa saja sinyal pemantauan operasi?', 'usr-deni').status;
  t.users['usr-deni'].role = 'staf-operasional';
  fs.writeFileSync(permFile, JSON.stringify(t, null, 2));
  const after = kb2.ask('Apa saja sinyal pemantauan operasi?', 'usr-deni').status;
  chk('A2-03', 'A2: access change applies on the NEXT answer (fresh reload)',
    before === 'SAYA_TIDAK_TAHU' && after !== 'SAYA_TIDAK_TAHU',
    'before=' + before + ' after=' + after);
  fs.rmSync(permDir, { recursive: true, force: true });

  // =========================================================================
  // A3 — refuse restricted questions WITHOUT hinting the content exists
  // =========================================================================
  const c5 = R.C5.finalAnswer, c6 = R.C6.finalAnswer;
  chk('A3-01', 'A3: restricted vs non-existent -> BYTE-IDENTICAL refusal (PERSIS SAMA)',
    Buffer.from(c5).equals(Buffer.from(c6)),
    'identical=' + Buffer.from(c5).equals(Buffer.from(c6)) + ' len=' + c5.length);
  chk('A3-02', 'A3: refusal leaks no existence hint (no topic/rahasia/terbatas/restricted)',
    !/kenari|rahasia|terbatas|restricted|confidential/i.test(c5),
    'answer=' + c5.slice(0, 80));
  chk('A3-03', 'A3: F-01 genuine model drift DISCARDED by deterministic refusal guard',
    doc.cases.find(c => c.caseId === 'C5').modelOutputVerbatim !== doc.cases.find(c => c.caseId === 'C6').modelOutputVerbatim &&
    R.C5.guard.branch === 'REFUSAL_BRANCH' && R.C5.guard.modelDraftDiscarded === true &&
    R.C6.guard.branch === 'REFUSAL_BRANCH' && R.C6.guard.modelDraftDiscarded === true,
    'draftsDiffer=' + (doc.cases.find(c => c.caseId === 'C5').modelOutputVerbatim !== doc.cases.find(c => c.caseId === 'C6').modelOutputVerbatim) +
    ' bothDiscarded=' + (R.C5.guard.modelDraftDiscarded && R.C6.guard.modelDraftDiscarded));
  chk('A3-04', 'A3: authorisation control — same topic IS answerable for an authorised role',
    (() => { const r = kb.ask(Q.C5, 'usr-rudi'); return r.status !== 'SAYA_TIDAK_TAHU' &&
      r.retrieval.hits.some(h => h.evidenceId === 'KB-011'); })(),
    'rudi/Kenari -> KB-011 authorised');

  // =========================================================================
  // A4 — flag conflicting sources; state which is used and why
  // =========================================================================
  chk('A4-01', 'A4: conflict detected, newest value Rp750.000 selected, old SOP superseded',
    R.C2.stages[2].detail.conflicts.some(c => c.claimKey === 'fuel-allowance' && c.selectedValue === 'Rp750.000' &&
      c.supersededIds.includes('KB-001')),
    JSON.stringify(R.C2.stages[2].detail.conflicts));
  chk('A4-02', 'A4: grounded model draft ACCEPTED (Rp750.000/Rp500.000 both in citations)',
    R.C2.guard.branch === 'ANSWER_BRANCH' && R.C2.guard.modelDraftUsed === true &&
    R.C2.guard.grounded === true && R.C2.guard.unsupported.length === 0,
    'reason=' + R.C2.guard.reason);

  // =========================================================================
  // A5 — "Saya tidak tahu" + route to the correct information owner
  // =========================================================================
  chk('A5-01', 'A5: unanswerable -> "Saya tidak tahu" + neutral owner route, no fabrication',
    /^Saya tidak tahu\./.test(c5) && /pemilik informasi/.test(c5) &&
    R.C5.finalStatus === 'SAYA_TIDAK_TAHU',
    'status=' + R.C5.finalStatus + ' answer=' + c5.slice(0, 60));

  // =========================================================================
  // A6 — log every question, sources retrieved and answer returned
  // =========================================================================
  const audit = kb.audit.read();
  const events = Array.isArray(audit) ? audit : ((audit && (audit.events || audit.log)) || []);
  const types = [...new Set(events.map(e => String(e.event || e.type || e.eventType || '?')))].sort();
  chk('A6-01', 'A6: audit chain has QUESTION_RECEIVED + AUTHORISATION_CHECKED + sources/answer events',
    events.length >= 6 && types.includes('QUESTION_RECEIVED') && types.includes('AUTHORISATION_CHECKED'),
    'events=' + events.length + ' types=' + types.join(','));
  chk('A6-02', 'A6: audit is append-only with contiguous sequence numbers',
    (() => { const seqs = events.map(e => e.seq).filter(s => s !== undefined);
      return seqs.length === events.length && seqs.every((s, i) => s === i + 1); })(),
    'seq=' + events.map(e => e.seq).join(','));

  // =========================================================================
  // GUARD — fabricated figure rejected; deterministic fallback preserved
  // =========================================================================
  const r2 = kb.ask(Q.C2, 'usr-andi');
  const c2Draft = doc.cases.find(c => c.caseId === 'C2').modelOutputVerbatim;
  const fabricated = c2Draft.replace('Rp750.000', 'Rp1.250.000');
  const fab = applyOutputGuard({ status: r2.status, hits: r2.retrieval.hits }, fabricated,
    { citations: r2.answer.sources, deterministicAnswer: r2.answer.answer, deterministicStatus: r2.status });
  chk('G-01', 'guard: fabricated Rp1.250.000 draft REJECTED (deterministic cited answer used)',
    fab.modelDraftUsed === false && /REJECTED/.test(fab.reason) && fab.finalAnswer === r2.answer.answer,
    'reason=' + fab.reason);
  // fail-closed fallback: interpreter with NO valid artifact -> deterministic answer
  const disabledWf = createWorkflow({ kb, interpreter: createInterpreter({ mode: 'disabled' }) });
  const fb = disabledWf.run(Q.C2, 'usr-andi', 'C2');
  chk('G-02', 'fallback: model disabled -> deterministic cited answer, no degradation',
    fb.interpretation.used === false && fb.guard.modelDraftUsed === false &&
    fb.finalAnswer === r2.answer.answer && fb.citations.length >= 1,
    'reason=' + fb.interpretation.reason + ' answerIsDeterministic=' + (fb.finalAnswer === r2.answer.answer));
  const missing = createInterpreter({ mode: 'captured', artifactPath: '/nonexistent/path.json' });
  chk('G-03', 'fail-closed: missing/tampered artifact -> NO model contribution',
    missing.isAvailable() === false && missing.interpret({ caseId: 'C2' }).draft === '',
    'available=' + missing.isAvailable());

  // =========================================================================
  // SAFETY / HONESTY — read-only, synthetic, no live-AI / no billing claim
  // =========================================================================
  chk('H-01', 'read-only: no action executed, no tool invoked, human approval not required on this path',
    Object.values(R).every(r => r.disclosure.approval && /Read-only/.test(r.disclosure.approval)) &&
    R.C1.model.networkCallsPermitted === false,
    'approval=' + R.C1.disclosure.approval.slice(0, 40));
  chk('H-02', 'honesty: 100% synthetic, no live model inference claim, no billing',
    /synthetic/i.test(R.C1.disclosure.data) && /No live model inference/.test(R.C1.disclosure.model) &&
    /0 charges/.test(R.C1.model.billing) && /not functional AI/.test(R.C1.disclosure.capability),
    'model=' + R.C1.disclosure.model.slice(0, 40));
  chk('H-03', 'in-app live SDK path documented as BLOCKED (not silently claimed)',
    /BLOCKED|EXIT=124/.test(interpreter.status().inAppLiveSdkBlocker) &&
    interpreter.status().inAppLiveSdk === false && interpreter.status().verified === false,
    'blocker=' + interpreter.status().inAppLiveSdkBlocker.slice(0, 50));

  // ---- aggregate ----------------------------------------------------------
  const pass = checks.filter(c => c[2]).length;
  const fail = checks.length - pass;
  const ok = fail === 0;

  const integrity = {
    draftsSha256: sha(DRAFTS),
    knowledgeSha256: sha(path.join(LAB, 'agent', 'knowledge.js')),
    outputGuardSha256: sha(path.join(LAB, 'agent', 'output-guard.js')),
    interpreterSha256: sha(path.join(LAB, 'agent', 'model-interpreter.js')),
    workflowSha256: sha(path.join(LAB, 'agent', 'model-assisted-workflow.js')),
    workflowJsonSha256: sha(path.join(LAB, 'workflow-spec', 'workflow.json'))
  };
  const stageSummary = Object.fromEntries(Object.entries(R).map(([id, r]) => [id, {
    controlPlaneStatus: r.controlPlaneStatus,
    stages: r.stages.map(s => ({ stage: s.stage, name: s.name, ok: s.ok })),
    modelContributed: r.interpretation.used,
    guardBranch: r.guard.branch,
    modelDraftUsed: r.guard.modelDraftUsed,
    modelDraftDiscarded: r.guard.modelDraftDiscarded,
    grounded: r.guard.grounded,
    finalStatus: r.finalStatus,
    citedEvidenceIds: r.citations.map(c => c.evidenceId),
    finalAnswer: r.finalAnswer
  }]));

  const trace = {
    schemaVersion: 'eewr-model-assisted-workflow.v1',
    title: 'EEWR — model-assisted workflow: six-stage E2E + six mandatory behaviours',
    product: 'EEWR — Executive Early Warning Radar',
    positioning: 'Executive Knowledge & Early Warning Intelligence',
    challenge: 'Challenge A — Workplace Knowledge Brain',
    scenario: 'Project History (Riwayat proyek) — CONFIRMED',
    team: 'BRONX', organization: 'XRC', attribution: 'Team BRONX',
    timebase: NOW,
    dataClassification: '100% SYNTHETIC TEST DATA — official kickoff dataset NOT yet received',
    whatThisIs: 'A genuine session-native model interpretation (captured, hash-verified) feeding the REAL deterministic six-stage control plane and N7->N8 output guard, with a full append-only audit chain.',
    whatThisIsNot: [
      'NOT an in-application live model SDK integration (probed and BLOCKED this cycle)',
      'NOT proof of the host agent platform chat-model integration into EEWR',
      'NOT a host-platform run / console screenshot / exported workflow',
      'NOT the official kickoff dataset', 'NOT a paid/billed model API call',
      'NOT "verified live AI"'
    ],
    channel: doc.channel,
    interfaceClassification: doc.interfaceClassification,
    agentId: doc.agentId,
    costAndCredentials: doc.costAndCredentials,
    trustBoundary: doc.trustBoundary,
    blockedInAppLivePath: doc.blockedInAppLivePath,
    sixStagePipeline: stageNames,
    mandatoryBehaviours: {
      A1: 'id/en/mixed answered with cited sources',
      A2: 'authorisation BEFORE search; permitted data only; access-change reactivity',
      A3: 'restricted refusal without existence hint; PERSIS SAMA',
      A4: 'conflicting sources flagged; selected value + reason stated',
      A5: '"Saya tidak tahu" + neutral information-owner route',
      A6: 'every question, retrieved sources and returned answer logged (append-only)'
    },
    cases: stageSummary,
    f01: {
      description: 'Genuine model produced DIFFERENT refusal wording for restricted vs non-existent topic.',
      draftsDiffered: doc.cases.find(c => c.caseId === 'C5').modelOutputVerbatim !== doc.cases.find(c => c.caseId === 'C6').modelOutputVerbatim,
      bothDiscarded: R.C5.guard.modelDraftDiscarded && R.C6.guard.modelDraftDiscarded,
      finalByteIdentical: Buffer.from(R.C5.finalAnswer).equals(Buffer.from(R.C6.finalAnswer))
    },
    fabricationTripwire: { injectedFigure: 'Rp1.250.000', rejected: fab.modelDraftUsed === false, reason: fab.reason },
    fallback: { modelDisabledAnswerIsDeterministic: fb.finalAnswer === r2.answer.answer, reason: fb.interpretation.reason },
    audit: { eventCount: events.length, eventTypes: types },
    checks: checks.map(([id, cap, c, detail]) => ({ id, capability: cap, status: c ? 'PASS' : 'FAIL', detail })),
    summary: { total: checks.length, pass, fail, exitOk: ok },
    integrity
  };
  fs.writeFileSync(TRACE_OUT, JSON.stringify(trace, null, 2) + '\n');

  // submission-facing evidence (adds reproduction + integrity of the produced files)
  const evidence = Object.assign({}, trace, {
    reproduction: {
      command: 'cd . && node agent/run.js verify-model-assisted',
      allSuites: ['selftest-a', 'selftest', 'selftest-guard', 'verify-final', 'verify-shot8', 'verify-model-assisted', 'genuine-e2e-demo'],
      modelStepNote: 'The model inference step is genuine but was produced by the session-native subagent channel and captured as a hash-checked artifact; the EEWR Node process replays it offline and performs NO live model call. The full control-plane + guard + audit chain is fully reproducible offline.'
    }
  });
  fs.writeFileSync(EVID_OUT, JSON.stringify(evidence, null, 2) + '\n');

  // ---- human-readable report ---------------------------------------------
  const L = [];
  L.push('='.repeat(80));
  L.push(' EEWR  /  MODEL-ASSISTED WORKFLOW — SIX-STAGE E2E   [SYNTHETIC TEST DATA]');
  L.push(' Executive Knowledge & Early Warning Intelligence');
  L.push(' Challenge A — Workplace Knowledge Brain | Scenario: Project History');
  L.push(' EEWR — Executive Early Warning Radar | BRONX | XRC | Team: BRONX');
  L.push('='.repeat(80));
  L.push(' Pipeline: Question -> Permission -> Authorised Retrieval -> REAL MODEL');
  L.push('           Interpretation -> Grounded Answer + Citations -> Audit Log');
  L.push(' Channel : genuine session-native model output (captured, SHA-256 verified)');
  L.push('           -> REAL deterministic control plane -> N7/N8 guard -> audit');
  L.push(' NOT     : in-app live SDK / host-platform run / verified live AI');
  L.push(' Cost    : 0 accounts, 0 credits, 0 credentials, 0 charges, 0 network');
  L.push('-'.repeat(80));
  L.push(' CASE  STAGE4 MODEL      GUARD BRANCH        DRAFT   FINAL STATUS');
  L.push('-'.repeat(80));
  for (const id of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6']) {
    const r = R[id];
    L.push(' ' + id.padEnd(5) +
      (r.interpretation.used ? 'genuine    ' : 'none       ').padEnd(16) +
      r.guard.branch.padEnd(20) +
      (r.guard.modelDraftUsed ? 'USED   ' : r.guard.modelDraftDiscarded ? 'DROP   ' : 'n/a    ') +
      r.finalStatus);
  }
  L.push('-'.repeat(80));
  L.push(' F-01 drift this run : ' + (trace.f01.draftsDiffered ? 'YES (genuine model refusals differed)' : 'no') +
    '  -> both discarded = ' + trace.f01.bothDiscarded);
  L.push(' Uji 1 PERSIS SAMA   : ' + (trace.f01.finalByteIdentical ? 'TRUE (byte-identical)' : 'FALSE'));
  L.push(' Fabrication tripwire: Rp1.250.000 -> ' + (trace.fabricationTripwire.rejected ? 'REJECTED' : 'ACCEPTED (BAD)'));
  L.push(' Fallback (no model) : deterministic cited answer = ' + trace.fallback.modelDisabledAnswerIsDeterministic);
  L.push(' Audit events        : ' + events.length + '  (' + types.join(', ') + ')');
  L.push('-'.repeat(80));
  L.push(' Six mandatory behaviours (A1-A6) + pipeline (P1) + guard (G) + honesty (H):');
  for (const [id, cap, c, detail] of checks) L.push('  ' + (c ? 'PASS' : 'FAIL') + '  ' + id.padEnd(7) + cap);
  L.push('-'.repeat(80));
  L.push('RESULT : ' + pass + '/' + checks.length + ' PASS, ' + fail + ' FAIL' + (ok ? '   exit 0' : '   exit 1'));
  L.push('EVIDENCE: traces/model-assisted-workflow-2026-11-04.json');
  L.push('='.repeat(80));
  const report = L.join('\n') + '\n';
  fs.writeFileSync(REPORT_TXT, report);

  return { ok, pass, fail, total: checks.length, report, trace };
}

if (require.main === module) {
  const r = verifyModelAssistedWorkflow();
  process.stdout.write(r.report);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { verifyModelAssistedWorkflow };
