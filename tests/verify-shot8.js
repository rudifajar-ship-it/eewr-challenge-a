#!/usr/bin/env node
'use strict';
// S7 Shot 8 — "the approval wait" (MANDATORY shot).
// Reproducible, offline, deterministic end-to-end evidence harness.
//
// It RE-RUNS the five real CLI commands in a clean temp state directory with a
// fixed timebase, captures stdout/stderr/exit status, and asserts the human
// approval gate behaviour. No model call, no network, no credential, no credit.
//
//   node tests/verify-shot8.js
//
// All data is 100% synthetic. This is NOT a host-platform run, console
// screenshot or exported workflow. The agent core is a deterministic
// simulation (AI (simulasi)); the provider adapter is disabled/fail-closed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const LAB = path.join(__dirname, '..');
const NOW = '2026-11-04T05:40:00+08:00';
const QUESTION = 'Apa risiko kekeringan terhadap operasi TGC dan tindakan apa yang harus disetujui?';
const APPROVER = 'Team BRONX';
const TRACE_OUT = path.join(LAB, 'traces', 'shot8-approval-gate-2026-11-04.json');

function sha(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

// Redact the checkout's absolute path so evidence traces are portable and
// contain no machine-specific path. Hash the redacted text, never the raw text.
function portable(s) { return String(s || '').split(LAB).join('.'); }

function run(stateDir, args) {
  const p = spawnSync('node', ['agent/run.js'].concat(args), {
    cwd: LAB, encoding: 'utf8', env: process.env,
    timeout: 30000
  });
  const stdout = portable(p.stdout);
  const stderr = portable(p.stderr);
  return {
    argv: ['node', 'agent/run.js'].concat(args),
    exit: p.status,
    stdout,
    stderr,
    stdoutSha256: sha(stdout)
  };
}

function verifyShot8() {
  // Use the SAME state directory that S7 §7 Shot 8 documents, so the captured
  // command lines match the recording script verbatim.
  const stateDir = '/tmp/demo-state8';
  fs.rmSync(stateDir, { recursive: true, force: true });
  fs.mkdirSync(stateDir, { recursive: true });
  const steps = [];

  // 1 — ask: the risk path may PROPOSE actions but may not record any.
  const s1 = run(stateDir, ['ask', QUESTION, '--state=' + stateDir, '--now=' + NOW]);
  steps.push({ id: 'S1', label: 'ask — propose only, gate closed', ...s1 });
  let d1 = {};
  try { d1 = JSON.parse(s1.stdout); } catch (_) { /* asserted below */ }

  // 2 — ledger must still be empty before any named human approves.
  const s2 = run(stateDir, ['ledger', '--state=' + stateDir, '--now=' + NOW]);
  steps.push({ id: 'S2', label: 'ledger — still empty after ask', ...s2 });
  let l2 = null;
  try { l2 = JSON.parse(s2.stdout); } catch (_) { /* asserted below */ }

  // 3 — first approval by a NAMED human is the only write point.
  const runId = d1.runId || '';
  const s3 = run(stateDir, ['approve', runId, APPROVER, 'Approved for demo',
                            '--state=' + stateDir, '--now=' + NOW]);
  steps.push({ id: 'S3', label: 'approve — named human approval recorded', ...s3 });
  let d3 = {};
  try { d3 = JSON.parse(s3.stdout); } catch (_) { /* asserted below */ }

  // 4 — a second approval of the same run must be refused.
  const s4 = run(stateDir, ['approve', runId, APPROVER, 'duplicate',
                            '--state=' + stateDir, '--now=' + NOW]);
  steps.push({ id: 'S4', label: 'approve again — double approval blocked', ...s4 });

  // 5 — ledger now holds exactly one entry per proposed action.
  const s5 = run(stateDir, ['ledger', '--state=' + stateDir, '--now=' + NOW]);
  steps.push({ id: 'S5', label: 'ledger — two recorded actions', ...s5 });
  let l5 = null;
  try { l5 = JSON.parse(s5.stdout); } catch (_) { /* asserted below */ }

  const proposed = Array.isArray(d1.proposedActions) ? d1.proposedActions : [];
  const checks = [
    ['S8-01', 'ask exits 0 and returns AWAITING_HUMAN_APPROVAL',
      s1.exit === 0 && d1.status === 'AWAITING_HUMAN_APPROVAL',
      'exit=' + s1.exit + ' status=' + d1.status],
    ['S8-02', 'ask records NOTHING and requires a named human',
      d1.humanApprovalRequired === true &&
      d1.recording && d1.recording.recorded === false && d1.recording.entries === 0,
      'humanApprovalRequired=' + d1.humanApprovalRequired +
      ' recorded=' + (d1.recording || {}).recorded],
    ['S8-03', 'two actions PROPOSED as PENDING_HUMAN_APPROVAL (not executed)',
      proposed.length === 2 && proposed.every(a => a.status === 'PENDING_HUMAN_APPROVAL'),
      'proposed=' + proposed.length + ' states=' + proposed.map(a => a.status).join(',')],
    ['S8-04', 'ledger is [] before approval — no write without a human',
      s2.exit === 0 && Array.isArray(l2) && l2.length === 0,
      'exit=' + s2.exit + ' entries=' + (Array.isArray(l2) ? l2.length : 'unparseable')],
    ['S8-05', 'first approve by a named human -> RECORDED, 2 entries',
      s3.exit === 0 && d3.status === 'RECORDED' &&
      d3.recording && d3.recording.recorded === true && d3.recording.entries === 2 &&
      d3.approval && d3.approval.approver === APPROVER && d3.approval.decision === 'APPROVED',
      'exit=' + s3.exit + ' status=' + d3.status +
      ' entries=' + (d3.recording || {}).entries],
    ['S8-06', 'second approve is REFUSED (exit 1, APPROVAL_NOT_ALLOWED)',
      s4.exit === 1 && s4.stdout.trim() === '' &&
      /APPROVAL_NOT_ALLOWED: run status is RECORDED/.test(s4.stderr),
      'exit=' + s4.exit + ' blocked=' + /APPROVAL_NOT_ALLOWED/.test(s4.stderr)],
    ['S8-07', 'ledger has exactly 2 entries, each with approver + timestamp + evidence',
      s5.exit === 0 && Array.isArray(l5) && l5.length === 2 &&
      l5.every(e => e.approver === APPROVER && e.recordedAt &&
                    Array.isArray(e.linkedEvidence) && e.linkedEvidence.length > 0),
      'exit=' + s5.exit + ' entries=' + (Array.isArray(l5) ? l5.length : 'unparseable')],
    ['S8-08', 'no live model inference and no platform/billing claim',
      d1.model && d1.model.liveInference === false &&
      d1.model.networkCallsPermitted === false &&
      /AI \(simulasi\)/.test(d1.model.wording || '') &&
      /not an autonomous agent/.test((d1.disclosure || {}).capability || ''),
      'liveInference=' + ((d1.model || {}).liveInference) +
      ' wording=' + ((d1.model || {}).wording)]
  ];

  const pass = checks.filter(c => c[2]).length;
  const fail = checks.length - pass;
  const ok = fail === 0;

  const trace = {
    schemaVersion: 'eewr-shot8-approval-gate.v1',
    title: 'S7 Shot 8 — the approval wait (MANDATORY shot)',
    product: 'EEWR — Executive Early Warning Radar',
    positioning: 'Executive Knowledge & Early Warning Intelligence',
    challenge: 'Challenge A — Workplace Knowledge Brain',
    scenario: 'Project History (Riwayat proyek) — CONFIRMED',
    team: 'BRONX', organization: 'XRC', attribution: 'Team BRONX',
    timebase: NOW,
    dataClassification: '100% SYNTHETIC TEST DATA — official kickoff dataset NOT yet received',
    whatThisIs: 'A real foreground run of the deterministic risk-path prototype, re-executable offline.',
    whatThisIsNot: 'NOT a host-platform run / console screenshot / exported workflow. NOT live model inference (AI (simulasi), provider disabled and fail-closed). NOT a GUI screen capture.',
    billing: '0 accounts, 0 credits, 0 credentials, 0 paid billing, 0 network calls',
    runId,
    steps: steps.map(s => ({
      id: s.id, label: s.label, argv: s.argv, exit: s.exit,
      stdout: s.stdout, stderr: s.stderr, stdoutSha256: s.stdoutSha256
    })),
    checks: checks.map(c => ({ id: c[0], capability: c[1], status: c[2] ? 'PASS' : 'FAIL', detail: c[3] })),
    summary: { total: checks.length, pass, fail, exitOk: ok },
    integrity: {
      transcriptSha256: sha(steps.map(s => s.argv.join(' ') + '\n' + s.stdout + s.stderr).join('\n'))
    }
  };
  fs.writeFileSync(TRACE_OUT, JSON.stringify(trace, null, 2) + '\n');

  const L = [];
  L.push('==============================================================================');
  L.push(' EEWR  /  S7 SHOT 8 — THE APPROVAL WAIT   [SYNTHETIC TEST DATA]');
  L.push(' Executive Knowledge & Early Warning Intelligence');
  L.push(' Challenge A — Workplace Knowledge Brain | Scenario: Project History');
  L.push(' BRONX · XRC · Team: BRONX');
  L.push('==============================================================================');
  L.push(' Channel : real foreground CLI run -> deterministic human approval gate');
  L.push(' NOT     : host-platform run / console screenshot / live model inference');
  L.push(' Cost    : 0 accounts, 0 credits, 0 credentials, 0 paid billing');
  L.push('------------------------------------------------------------------------------');
  L.push(' STEP  COMMAND                              EXIT  RESULT');
  L.push('------------------------------------------------------------------------------');
  const labels = { S1: 'ask (propose only)', S2: 'ledger (before)', S3: 'approve (named human)',
                   S4: 'approve (duplicate)', S5: 'ledger (after)' };
  for (const s of steps) {
    L.push(' ' + s.id.padEnd(5) + ' ' + labels[s.id].padEnd(34) + ' ' +
           String(s.exit).padEnd(5) + ' ' + (s.exit === 0 ? 'ok' : 'REFUSED (expected)'));
  }
  L.push('------------------------------------------------------------------------------');
  for (const c of checks) L.push('  ' + (c[2] ? 'PASS' : 'FAIL') + '  ' + c[0] + ' ' + c[1] + '\n          -> ' + c[3]);
  L.push('------------------------------------------------------------------------------');
  L.push('RESULT : ' + pass + '/' + checks.length + ' PASS, ' + fail + ' FAIL   exit ' + (ok ? 0 : 1));
  L.push('EVIDENCE: traces/shot8-approval-gate-2026-11-04.json');
  L.push('Gate   : nothing is recorded until a named human approves; double approval blocked.');
  L.push('==============================================================================');

  return { ok, pass, fail, total: checks.length, report: L.join('\n') + '\n', trace };
}

if (require.main === module) {
  const r = verifyShot8();
  process.stdout.write(r.report);
  process.exit(r.ok ? 0 : 1);
}

module.exports = { verifyShot8 };
