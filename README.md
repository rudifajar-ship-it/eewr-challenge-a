# EEWR — Executive Early Warning Radar

**Challenge A — Workplace Knowledge Brain · Public source repository (Route A)**

| Field | Value |
|---|---|
| Product | EEWR — Executive Early Warning Radar |
| Team | **Team BRONX** |
| Organisation | **XRC** |
| Demo entity | **The Goodlight Company (TGC)** — fictional / 100% synthetic |
| Positioning | Executive Knowledge & Early Warning Intelligence |
| Scenario | Project History (*Riwayat proyek*) |
| Data | 100% synthetic, participant-owned, self-contained; no external dataset |
| Model posture | Deterministic simulation (`AI (simulasi)`). Provider adapter disabled and fail-closed. **No live model inference.** |
| Runtime | Node.js 22 standard library only. No `package.json`, no dependencies, no network calls |
| Status | **NOT PUBLISHED.** Publication-ready local snapshot; publishing requires explicit owner approval |

> This repository is the **source-code evidence** for S9 (Route A). It is a deterministic,
> offline, auditable prototype — not a deployed service, not a hosted agent, and not a
> claim of live AI.

---

## 1. What this is

A read-only **Workplace Knowledge Brain** that turns a natural-language executive question
into an evidence-grounded, permission-scoped, human-approved answer path:

```
question (ID / EN / mixed) + user id
  -> 1. load the permission table FRESH (access changes are reflected immediately)
  -> 2. resolve the principal (least privilege for unknown users)
  -> 3. scope the corpus BEFORE searching (restricted items never enter retrieval)
  -> 4. deterministic retrieval with a published score breakdown
  -> 5. safety: prompt-injection neutralisation + PII masking on quoted text
  -> 6. conflict detection, source citation, owner routing -> grounded answer
  -> 7. append a COMPLETE audit log (question / sources / answer / decisions)
```

The brain **never sends, schedules, modifies, publishes, or invokes a tool**. Action execution
is gated behind `agent/approve.js`, the only module that can write the ledger. `ask()` returns
`AWAITING_HUMAN_APPROVAL` and structurally cannot record an action.

A second, six-stage **model-assisted** workflow exists (`agent/model-assisted-workflow.js`).
Its model interpretation is a genuine captured prose draft consumed **offline** as
SHA-256-checked **untrusted input** to a deterministic output guard. The Node process
performs **no** live model call.

## 2. What this is not

- **Not verified live AI.** `model-status` reports `liveInference: false`, `verified: false`,
  `enabled: false`, `networkCallsPermitted: false`.
- **Not a native platform run, console screenshot, or platform export.**
  `workflow-spec/workflow.json` is a portable 10-node / 11-edge EEWR specification with
  `genuinePlatformExport: false`. The host platform provides no visual node builder, no
  workflow-graph import and no native workflow export, so Route A (this repository) is the
  only viable S9 route.
- **Not an organiser-shared / official dataset result.** The organiser clarification of
  4 November 2026 permits a participant-owned dataset; this repository uses only its own
  100% synthetic corpus.
- **Not an autonomous agent.** No planning, tool invocation, learning, document ingestion,
  vector store, multi-turn dialogue or office-suite integration.

## 3. Quick start

Node.js 22 or newer is the only requirement. From the repository root:

```bash
node agent/run.js model-status            # deterministic posture: liveInference=false
node agent/run.js ask-a "Berapa tunjangan bahan bakar bulanan saat ini?" --user=usr-andi
node agent/run.js workflow "Berapa tunjangan bahan bakar bulanan saat ini?" --user=usr-andi --case=C2
node agent/run.js ledger                  # [] on a clean state
```

Reproduce the full verification baseline (all suites exit 0):

```bash
node agent/run.js selftest                 # 20/20
node agent/run.js selftest-a              # 23/23
node agent/run.js selftest-guard          # 15/15
node agent/run.js verify-final            # 16/16
node agent/run.js verify-shot8            # 8/8
node agent/run.js verify-model-assisted   # 26/26
node tests/genuine-e2e-demo.js            # 9/9
```

Total: **117 assertions, 7 suites, 0 network calls, 0 credentials, 0 charges.**

## 4. Repository layout

| Path | Contents |
|---|---|
| `agent/` | 16 deterministic modules — permissions, retrieval, answer, safety, approval, audit, model guard, CLI |
| `data/` | 3 synthetic JSON corpora (knowledge corpus, permission table, evidence items) |
| `tests/` | 7 self-contained Node test suites |
| `traces/` | 10 machine-readable evidence traces, including hash-checked captured drafts |
| `workflow-spec/` | Portable workflow specification, agent role prompt, verification runbook |
| `demo/RUNBOOK.md` | Reproducible 5–8 minute demonstration script |
| `ARCHITECTURE.md` | Modules, data flow, trust boundary, security controls |
| `DEPLOYMENT.md` | How to run, reproduce and (optionally) publish this repository |
| `SECURITY.md` | Data classification, prohibited content, scan verdict |
| `REPO-README.md` | Publication provenance and integrity manifest notes |
| `REPO-MANIFEST.json` | Real SHA-256, byte size and line count of every included file |

`state/` (mutable runtime output) is deliberately excluded and git-ignored.

## 5. Confidentiality and attribution

Only three entities are named in this repository: **XRC**, **Team BRONX**, and the
fictional **The Goodlight Company (TGC)**. All company names, staff roles, locations,
figures, documents, chat exports and risk scenarios are invented. No real person,
employer, client, public institution endorsement, email address, phone number,
credential, API key or absolute sandbox path is present.

The `attribution` / `representedBy` fields retain their legacy schema names for
compatibility with the recorded traces; their values are team-level only and carry
no personal data.

## 6. Integrity

`REPO-MANIFEST.json` records the real SHA-256, byte size and line count of every file
in this snapshot. Any reviewer can verify the tree byte-for-byte. The frozen submission
archives, the locked one-pager and the separately deployed static dashboard are **not
part of this repository** and were not modified to produce it.

## 7. Licence and publication

No licence file is included: the licence is an owner decision to be made at repository
creation time. **This repository has not been created on any host, initialised with git,
or pushed.** Publishing requires explicit owner approval. See `DEPLOYMENT.md` §4 and the
submission pack's S9 publication instructions.
