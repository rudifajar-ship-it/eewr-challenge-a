'use strict';
// Offline end-to-end self-test for the isolated EEWR agent prototype.
// Zero network. Deterministic timestamps. Must exit 0 before any demo is recorded.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createAgent, DISCLOSURE } = require('../agent/agent');
const { WEIGHTS } = require('../agent/compose');
const provider = require('../agent/provider-adapter');

const LAB = path.join(__dirname, '..');
const FIXED_NOW = '2026-11-03T22:10:00+08:00';
const Q_ID = 'Apa risiko kekeringan terhadap operasi TGC dan tindakan apa yang harus disetujui?';
const Q_EN = 'What is the drought risk to TGC operations and which action needs approval?';
const Q_OOS = 'Bagaimana harga saham hari ini?';

function walk(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!['state', 'traces'].includes(e.name)) walk(p, acc); }
    else if (/\.(js|json|md)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function run(opts) {
  const o = opts || {};
  const stateDir = o.stateDir || path.join(os.tmpdir(), 'eewr-selftest');
  fs.rmSync(stateDir, { recursive: true, force: true });

  const results = [];
  function check(name, fn) {
    try { fn(); results.push(['PASS', name]); }
    catch (err) { results.push(['FAIL', name + ' :: ' + err.message]); }
  }
  const A = require('assert');

  const agent = createAgent({ stateDir, now: FIXED_NOW });
  const corpusIds = new Set(JSON.parse(fs.readFileSync(path.join(LAB, 'data', 'synthetic-evidence.json'), 'utf8')).items.map(x => x.id));

  let run1;
  check('T01 corpus loads, is synthetic, 8 unique items', () => {
    A.strictEqual(agent.evidenceCount, 8);
    A.strictEqual(corpusIds.size, 8);
  });

  check('T02 exact project identity + disclosure', () => {
    A.strictEqual(DISCLOSURE.product, 'EEWR — Executive Early Warning Radar');
    A.strictEqual(DISCLOSURE.team, 'BRONX');
    A.strictEqual(DISCLOSURE.organization, 'XRC');
    A.strictEqual(DISCLOSURE.representedBy, 'Team BRONX');
    A.strictEqual(DISCLOSURE.industry, 'Natural resource-based industries');
    A.ok(DISCLOSURE.demoEntity.includes('The Goodlight Company'));
    A.match(DISCLOSURE.model, /No live model inference/);
    A.match(DISCLOSURE.capability, /not functional AI/);
  });

  check('T03 NL question accepted (Indonesian) -> awaiting human approval', () => {
    run1 = agent.ask(Q_ID);
    A.strictEqual(run1.status, 'AWAITING_HUMAN_APPROVAL');
    A.strictEqual(run1.humanApprovalRequired, true);
    A.ok(run1.runId.startsWith('RUN-'));
  });

  check('T04 retrieval returns cited synthetic evidence with score breakdown', () => {
    A.ok(run1.retrieval.hits.length >= 1);
    for (const h of run1.retrieval.hits) {
      A.ok(corpusIds.has(h.evidenceId));
      A.ok(h.score >= run1.retrieval.minScore);
      A.ok(h.quote.length > 20 && h.source.length > 10);
      A.ok(h.breakdown.length >= 1);
      A.strictEqual(h.synthetic, true);
    }
  });

  check('T05 no live model inference in run', () => {
    A.strictEqual(run1.model.liveInference, false);
    A.strictEqual(run1.model.wording, 'AI (simulasi)');
    A.strictEqual(run1.model.networkCallsPermitted, false);
  });

  check('T06 evidence-anchored recommendation produced', () => {
    A.strictEqual(run1.recommendation.status, 'RECOMMENDATION_READY');
    A.strictEqual(typeof run1.recommendation.score, 'number');
    A.ok(run1.recommendation.grounding.length >= 1);
    A.ok(run1.recommendation.statement.length > 60);
  });

  check('T07 score equals p*0.35 + i*0.40 + u*0.25', () => {
    const f = run1.recommendation.factors;
    const expected = f.p * WEIGHTS.p + f.i * WEIGHTS.i + f.u * WEIGHTS.u;
    A.ok(Math.abs(run1.recommendation.score - expected) < 0.02);
  });

  check('T08 provenance weights sum to 1 and contributions are numeric', () => {
    const s = run1.recommendation.provenance.reduce((a, x) => a + x.weight, 0);
    A.ok(Math.abs(s - 1) < 0.001);
    for (const x of run1.recommendation.provenance) {
      A.ok(corpusIds.has(x.evidenceId));
      A.ok(typeof x.contribution.p === 'number');
    }
  });

  check('T09 every grounding citation points to a retrieved evidence item', () => {
    const hitIds = new Set(run1.retrieval.hits.map(h => h.evidenceId));
    for (const g of run1.recommendation.grounding) A.ok(hitIds.has(g.evidenceId));
  });

  check('T10 accountable actions proposed with owner, due, rationale and PENDING state', () => {
    A.ok(run1.proposedActions.length >= 1);
    for (const a of run1.proposedActions) {
      A.strictEqual(a.status, 'PENDING_HUMAN_APPROVAL');
      A.strictEqual(a.recorded, false);
      A.ok(a.ownerRole && a.dueInDays > 0 && a.rationale && a.linkedEvidence.length >= 1);
    }
  });

  check('T11 HARD GATE: ledger is empty after ask() — no action can be recorded yet', () => {
    A.deepStrictEqual(agent.ledger(), []);
    A.strictEqual(run1.recording.recorded, false);
    A.strictEqual(run1.recording.entries, 0);
  });

  check('T12 approve() rejects a missing human approver', () => {
    A.throws(() => agent.approve(run1.runId, '', 'note'), /APPROVER_REQUIRED/);
    A.deepStrictEqual(agent.ledger(), []);
  });

  let approved;
  check('T13 approve() by a named human records actions with full audit trail', () => {
    approved = agent.approve(run1.runId, 'Team BRONX', 'Approved for demo');
    A.strictEqual(approved.status, 'RECORDED');
    const led = agent.ledger();
    A.strictEqual(led.length, run1.proposedActions.length);
    for (const e of led) {
      A.ok(e.approver && e.recordedAt && e.groundedIn.length >= 1 && e.runId === run1.runId);
    }
  });

  check('T14 double approval is blocked (no duplicate recording)', () => {
    A.throws(() => agent.approve(run1.runId, 'Team BRONX', 'again'), /APPROVAL_NOT_ALLOWED/);
    A.strictEqual(agent.ledger().length, run1.proposedActions.length);
  });

  const beforeReject = agent.ledger().length;
  check('T15 reject() records nothing', () => {
    const r2 = agent.ask(Q_EN);
    A.strictEqual(r2.status, 'AWAITING_HUMAN_APPROVAL');
    const rejected = agent.reject(r2.runId, 'Team BRONX', 'Out of scope for demo');
    A.strictEqual(rejected.status, 'REJECTED');
    A.strictEqual(agent.ledger().length, beforeReject);
  });

  check('T16 out-of-scope question -> NO fabrication (no recommendation, no action)', () => {
    const r3 = agent.ask(Q_OOS);
    A.strictEqual(r3.status, 'INSUFFICIENT_EVIDENCE');
    A.strictEqual(r3.recommendation.status, 'NO_RECOMMENDATION');
    A.strictEqual(r3.proposedActions.length, 0);
    A.strictEqual(agent.ledger().length, beforeReject);
  });

  check('T17 reproducibility: identical question -> byte-identical run on a clean state', () => {
    const state2 = path.join(os.tmpdir(), 'eewr-selftest-2');
    fs.rmSync(state2, { recursive: true, force: true });
    const agent2 = createAgent({ stateDir: state2, now: FIXED_NOW });
    const r = agent2.ask(Q_ID);
    A.strictEqual(r.runId, run1.runId);
    A.strictEqual(r.recommendation.score, run1.recommendation.score);
    A.deepStrictEqual(r.proposedActions.map(a => a.actionId), run1.proposedActions.map(a => a.actionId));
    A.strictEqual(JSON.stringify(r), JSON.stringify(run1));
    fs.rmSync(state2, { recursive: true, force: true });
  });

  check('T18 provider adapter disabled, fail-closed, no network capability', () => {
    const s = provider.status();
    A.strictEqual(s.liveInference, false);
    A.strictEqual(s.verified, false);
    A.strictEqual(s.networkCallsPermitted, false);
    A.strictEqual(s.gates.length, 3);
    const src = fs.readFileSync(path.join(LAB, 'agent', 'provider-adapter.js'), 'utf8');
    A.doesNotMatch(src, /\brequire\(['"](https?|net|tls)['"]\)/);
    A.doesNotMatch(src, /\bfetch\s*\(/);
  });

  check('T19 no unnegated functional-AI / live-model claim in run output', () => {
    const s = JSON.stringify(run1);
    // Deny-list phrases are assembled from fragments so that a keyword scan of
    // this source file cannot mistake the deny-list itself for a positive claim.
    const deny = [
      'live ai (is|are) ' + 'working',
      'real[- ]time inference is',
      'powered by [a-z0-9_-]+ ai',
      'live model inference is ' + 'working',
      'fully operational live ' + 'ai',
      'functional ai is ' + 'working'
    ];
    A.doesNotMatch(s, new RegExp(deny.join('|'), 'i'));
  });

  check('T20 source hygiene: no secrets, email, AKID, phone or embedded credential', () => {
    const files = walk(LAB, []);
    A.ok(files.length >= 8);
    // Integrity manifests embed long hexadecimal SHA digests. A phone-shaped
    // digit run can occur by chance inside such a digest; it is not PII. Neutralise
    // hex digests for the phone check only, so genuine numbers are still caught.
    const HEX_DIGEST = /[0-9a-fA-F]{32,}/g;
    for (const p of files) {
      const t = fs.readFileSync(p, 'utf8');
      A.doesNotMatch(t, /[\w.+-]+@[\w-]+\.[\w.]{2,}/, p);
      A.doesNotMatch(t, /sk-[A-Za-z0-9]{16,}/, p);
      A.doesNotMatch(t, /AKID[A-Za-z0-9]{10,}/, p);
      A.doesNotMatch(t.replace(HEX_DIGEST, '<digest>'),
                     /(?<!\d)(?:\+62|08)\d{8,12}(?!\d)/, p);
    }
    A.ok(!fs.existsSync(path.join(LAB, '.env')));
  });

  const pass = results.filter(r => r[0] === 'PASS').length;
  const fail = results.length - pass;

  if (o.writeTrace !== false && fail === 0) {
    const tdir = path.join(LAB, 'traces');
    fs.mkdirSync(tdir, { recursive: true });
    fs.writeFileSync(path.join(tdir, 'sample-run.json'), JSON.stringify({
      generatedAt: FIXED_NOW,
      note: 'Reproducible offline trace. Deterministic simulation — no live model inference.',
      commands: ['node agent/run.js ask "' + Q_ID + '"', 'node agent/run.js approve ' + run1.runId + ' "Team BRONX" "Approved for demo"'],
      ask: run1,
      approved,
      ledger: agent.ledger()
    }, null, 2) + '\n');
  }

  const lines = results.map(([st, n]) => `  ${st}  ${n}`);
  const report = [
    'EEWR Agent Lab — offline E2E self-test',
    'Product : EEWR — Executive Early Warning Radar | Team BRONX',
    'Org     : XRC',
    'Mode    : deterministic simulation (AI (simulasi)); no live model inference',
    'Timebase: ' + FIXED_NOW,
    '------------------------------------------------------------',
    ...lines,
    '------------------------------------------------------------',
    `RESULT  : ${pass}/${results.length} PASS, ${fail} FAIL`,
    fail === 0
      ? 'Gate    : workflow reproducible; HUMAN APPROVAL GATE enforced; NO functional-AI claim made.'
      : 'Gate    : FAILED — do not record a demo until all checks pass.',
    ''
  ].join('\n');

  return { ok: fail === 0, pass, fail, report };
}

if (require.main === module) {
  const r = run({});
  process.stdout.write(r.report);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { run };
