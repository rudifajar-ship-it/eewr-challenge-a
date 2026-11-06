#!/usr/bin/env node
'use strict';
// CLI for the isolated EEWR agent prototype. Zero dependencies.
// Risk path (unchanged):
//   node agent/run.js ask "<question>"
//   node agent/run.js show <runId>
//   node agent/run.js approve <runId> "<approver>" "<note>"
//   node agent/run.js reject  <runId> "<approver>" "<reason>"
//   node agent/run.js ledger
//   node agent/run.js model-status
//   node agent/run.js selftest
// Challenge A knowledge-brain path (isolated, read-only):
//   node agent/run.js ask-a "<question>" --user=<userId> [--need-pii]
//   node agent/run.js access <userId>
//   node agent/run.js kb-status
//   node agent/run.js audit-show
//   node agent/run.js selftest-a
//   node agent/run.js selftest-guard        (F-01 output-guard self-test, 15 assertions)
//   node agent/run.js guard-demo "<question>" --user=<id>   (show the guard in action)
//   node agent/run.js verify-final           (final-positioning E2E harness, 16 assertions)
//   node agent/run.js verify-shot8            (S7 Shot 8 approval-gate harness, 8 assertions)
//   node agent/run.js verify-model-assisted   (model-assisted 6-stage E2E + A1-A6, 26 assertions)
//   node agent/run.js workflow "<question>" --user=<id> --case=<C1..C6>  (single six-stage run)
// Optional flags (anywhere): --state=<dir>  --now=<ISO>
//                            --user=<id>  --permissions=<file>  --need-pii
const path = require('path');
const { createAgent } = require('./agent');
const { createKnowledgeBrain } = require('./knowledge');
const { loadPermissions, resolvePrincipal } = require('./access');

function parse(argv) {
  const flags = { state: null, now: null, user: null, permissions: null, needPii: false, caseId: null };
  const pos = [];
  for (const a of argv) {
    if (a.startsWith('--state=')) flags.state = a.slice(8);
    else if (a.startsWith('--now=')) flags.now = a.slice(6);
    else if (a.startsWith('--user=')) flags.user = a.slice(7);
    else if (a.startsWith('--permissions=')) flags.permissions = a.slice(14);
    else if (a.startsWith('--case=')) flags.caseId = a.slice(7);
    else if (a === '--need-pii') flags.needPii = true;
    else pos.push(a);
  }
  return { flags, pos };
}

function out(x) { process.stdout.write(JSON.stringify(x, null, 2) + '\n'); }

function main() {
  const { flags, pos } = parse(process.argv.slice(2));
  const cmd = pos[0] || 'help';
  const stateDir = flags.state || path.join(__dirname, '..', 'state');

  // Challenge A commands are self-contained; they do not construct the risk agent.
  if (cmd === 'ask-a' || cmd === 'access' || cmd === 'kb-status' || cmd === 'audit-show' || cmd === 'selftest-a' || cmd === 'decide-a' || cmd === 'selftest-guard' || cmd === 'guard-demo' || cmd === 'verify-final' || cmd === 'verify-shot8' || cmd === 'verify-model-assisted' || cmd === 'workflow') {
    const kb = createKnowledgeBrain({
      stateDir, now: flags.now || undefined,
      permissionsPath: flags.permissions || undefined
    });
    switch (cmd) {
      case 'ask-a': {
        const q = pos.slice(1).join(' ').trim();
        if (!q) { console.error('ERROR: question required'); process.exit(2); }
        out(kb.ask(q, flags.user, { needPii: flags.needPii }));
        break;
      }
      case 'access': {
        const table = loadPermissions(flags.permissions || undefined);
        out(resolvePrincipal(table, pos[1] || flags.user));
        break;
      }
      case 'kb-status':
        out({
          track: 'CHALLENGE_A_WORKPLACE_KNOWLEDGE_BRAIN',
          disclosure: kb.disclosure,
          corpusCount: kb.corpusCount,
          permissionsSource: kb.permissionsDefault,
          model: kb.modelStatus(),
          mandatoryCapabilities: [
            'A1 answer id/en/mixed with sources',
            'A2 authorisation checked BEFORE search; only permitted data searched; access changes apply next answer',
            'A3 refuse restricted questions without hinting the restricted content exists',
            'A4 flag conflicting sources; state which is used and why',
            "A5 say 'Saya tidak tahu' and route to the correct information owner",
            'A6 log every question, sources retrieved and answer returned'
          ],
          bonuses: ['fresh corpus reload', 'prompt-injection resistance', 'PII masking', 'combine chat+document+task']
        });
        break;
      case 'audit-show': out(kb.audit.read()); break;
      case 'decide-a':   out(kb.recordDecision(pos[1], { actor: pos[2], decision: pos[3], note: pos[4] })); break;
      case 'selftest-a': {
        const { runA } = require('../tests/selftest-a');
        const r = runA({ stateDir: path.join(require('os').tmpdir(), 'eewr-selftest-a'), writeTrace: true });
        process.stdout.write(r.report);
        process.exit(r.ok ? 0 : 1);
      }
      case 'selftest-guard': {
        const { runGuard } = require('../tests/selftest-guard');
        const r = runGuard({ stateDir: path.join(require('os').tmpdir(), 'eewr-selftest-guard') });
        process.stdout.write(r.report);
        process.exit(r.ok ? 0 : 1);
      }
      case 'verify-final': {
        const { verifyFinal } = require('../tests/verify-final');
        const r = verifyFinal();
        process.stdout.write(r.report);
        process.exit(r.ok ? 0 : 1);
      }
      case 'verify-shot8': {
        const { verifyShot8 } = require('../tests/verify-shot8');
        const r = verifyShot8();
        process.stdout.write(r.report);
        process.exit(r.ok ? 0 : 1);
      }
      case 'verify-model-assisted': {
        const { verifyModelAssistedWorkflow } = require('../tests/verify-model-assisted-workflow');
        const r = verifyModelAssistedWorkflow();
        process.stdout.write(r.report);
        process.exit(r.ok ? 0 : 1);
      }
      case 'workflow': {
        // Single six-stage model-assisted run — genuine captured model step +
        // REAL deterministic control plane + N7/N8 guard + audit. Read-only.
        const { createWorkflow } = require('./model-assisted-workflow');
        const q = pos.slice(1).join(' ').trim();
        if (!q) { console.error('ERROR: question required'); process.exit(2); }
        const wf = createWorkflow({
          stateDir, now: flags.now || undefined,
          mode: flags.caseId === 'none' ? 'disabled' : 'captured'
        });
        const r = wf.run(q, flags.user, flags.caseId || 'C2');
        out(r);
        break;
      }
      case 'guard-demo': {
        // Demonstrates the F-01 fix using the REAL model outputs captured in
        // traces/native-model-execution-2026-11-04.json — no model is called here.
        const { applyOutputGuard } = require('./output-guard');
        const fsx = require('fs');
        const trace = JSON.parse(fsx.readFileSync(path.join(__dirname, '..', 'traces', 'native-model-execution-2026-11-04.json'), 'utf8'));
        const q = pos.slice(1).join(' ').trim();
        const run = kb.ask(q || 'Apa itu Proyek Kenari?', flags.user || 'usr-andi');
        const draftFor = /zebra/i.test(q)
          ? (trace.runs.find(r => r.caseId === 'UJI-1-CONTROL-NONEXISTENT') || {}).modelOutputVerbatim
          : (trace.runs.find(r => r.caseId === 'UJI-1-RESTRICTED') || {}).modelOutputVerbatim;
        const g = applyOutputGuard(
          { status: run.status, hits: run.retrieval.hits.length },
          draftFor || '',
          { ownerRoute: run.answer.ownerRoute }
        );
        out({
          question: run.question,
          userId: run.userId,
          upstream: { status: run.status, hits: run.retrieval.hits.length },
          modelDraftVerbatim: draftFor || '',
          modelDraftWasIdenticalToTemplate: draftFor === g.finalAnswer,
          guard: {
            branch: g.guard,
            modelDraftUsed: g.modelDraftUsed,
            modelDraftDiscarded: g.modelDraftDiscarded,
            reason: g.reason
          },
          finalAnswer: g.finalAnswer,
          disclosure: 'Guard is deterministic; the model draft above is replayed from a recorded trace, not generated here.'
        });
        break;
      }
    }
    return;
  }

  const agent = createAgent({ stateDir, now: flags.now || undefined });
  switch (cmd) {
    case 'ask': {
      if (!pos[1]) { console.error('ERROR: question required'); process.exit(2); }
      out(agent.ask(pos.slice(1).join(' ')));
      break;
    }
    case 'show':      out(agent.getRun(pos[1])); break;
    case 'approve':   out(agent.approve(pos[1], pos[2], pos[3])); break;
    case 'reject':    out(agent.reject(pos[1], pos[2], pos[3])); break;
    case 'ledger':    out(agent.ledger()); break;
    case 'model-status': out(agent.modelStatus()); break;
    case 'selftest': {
      const { run } = require('../tests/selftest');
      const r = run({ stateDir: path.join(require('os').tmpdir(), 'eewr-selftest'), writeTrace: true });
      process.stdout.write(r.report);
      process.exit(r.ok ? 0 : 1);
    }
    default:
      out({
        usage: ['ask <question>', 'show <runId>', 'approve <runId> <approver> <note>',
                'reject <runId> <approver> <reason>', 'ledger', 'model-status', 'selftest',
                'ask-a <question> --user=<id>', 'access <userId>', 'kb-status', 'audit-show',
                'selftest-a', 'selftest-guard', 'guard-demo', 'verify-final', 'verify-shot8',
                'verify-model-assisted', 'workflow <question> --user=<id> --case=<C1..C6>'],
        product: 'EEWR — Executive Early Warning Radar',
        team: 'BRONX', organization: 'XRC',
        note: 'Deterministic simulation (AI (simulasi)); no live model inference.'
      });
  }
}

main();
