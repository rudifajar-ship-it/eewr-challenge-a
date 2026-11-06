# EEWR Challenge A — Architecture

> Deterministic, offline, read-only. Node.js 22 standard library only.
> No `package.json`, no dependency install, no server, no network socket.

## 1. System boundary

This repository is a **source-code and evidence artifact**, not a running service.
There is no deployment-time backend, no database, no message queue, no build step and
no runtime configuration. All state is a local JSON file under the git-ignored
`state/` directory.

A **separate static dashboard** (the five-module executive UI) exists as a frozen
submission artifact with its own share link. It is explicitly **not** part of this
repository and was not changed to produce this tree. The two artifacts are coupled
only by the shared product name and the shared synthetic demo entity.

```
                 THIS REPOSITORY
  ┌──────────────────────────────────────────────────────────┐
  │  CLI: agent/run.js                                        │
  │    │                                                      │
  │    ├── Knowledge Brain path (Challenge A primary)         │
  │    │     access.js → knowledge.js → retrieve.js           │
  │    │       → safety.js → answer.js → audit.js             │
  │    │                                                      │
  │    ├── Risk path (deterministic scoring, legacy demo)     │
  │    │     evidence.js → compose.js → propose.js            │
  │    │       → approve.js → audit.js                        │
  │    │                                                      │
  │    └── Model-assisted path (six stages, offline drafts)   │
  │          model-assisted-workflow.js                       │
  │            → model-interpreter.js (hash-check untrusted)  │
  │            → output-guard.js (deterministic N7→N8 gate)   │
  │                                                          │
  │  provider-adapter.js  — DISABLED + FAIL-CLOSED, no socket │
  └──────────────────────────────────────────────────────────┘
                          │
                          ▼
             data/*.json (100% synthetic) + traces/*.json
```

## 2. Modules

| Module | Responsibility | Side effects |
|---|---|---|
| `agent/access.js` | Load permission table fresh per call; resolve principal; scope corpus **before** search | none |
| `agent/knowledge.js` | Knowledge Brain orchestrator, disclosure block, deterministic run IDs | appends audit |
| `agent/retrieve.js` | Deterministic tf-idf-style retrieval with explainable score breakdown | none |
| `agent/safety.js` | Prompt-injection detection/neutralisation, PII masking, non-leaking refusal | none |
| `agent/answer.js` | Conflict detection, source citation, owner routing, cited answer | none |
| `agent/audit.js` | Append-only audit ledger | **writes `state/`** |
| `agent/evidence.js` | Read-only synthetic evidence corpus loader with validation | none |
| `agent/compose.js` | Explainable weighted recommendation `p*.35 + i*.40 + u*.25` with provenance | none |
| `agent/propose.js` | Accountable action **proposals** only — never executes | none |
| `agent/approve.js` | **Hard human approval gate** — sole module that can write the ledger | **writes `state/`** |
| `agent/agent.js` | Risk-path orchestrator, disclosure, deterministic run IDs | appends audit |
| `agent/provider-adapter.js` | Optional external model adapter, disabled and fail-closed | none (no socket) |
| `agent/model-interpreter.js` | Consumes captured model output **offline** as SHA-256-checked untrusted input | none |
| `agent/output-guard.js` | Deterministic N7→N8 guard; discards refusal-wording drift (F-01) | none |
| `agent/model-assisted-workflow.js` | Six-stage orchestrator: Question → Permission → Retrieval → Model → Grounded Answer → Audit | none |
| `agent/run.js` | CLI dispatch for all commands and all verification suites | writes `state/`, `traces/` |

## 3. Trust boundary and security controls

| Control | Implementation |
|---|---|
| Permission before search | `scopeCorpus()` runs **before** retrieval; restricted items never enter the candidate set |
| Least privilege | Unknown users are downgraded to the lowest role; `resolvePrincipal()` is called on every request |
| Non-leaking refusal | Identical answer for "restricted topic" and "non-existent topic"; no hint of a restriction |
| Prompt-injection neutralisation | `detectInjection()` + `neutralise()` on every quoted snippet |
| PII masking | `maskPii()` on quoted text; synthetic NIK/phone placeholders prove the behaviour |
| Human approval gate | `approve.js` is the only write point; `ask()` returns `AWAITING_HUMAN_APPROVAL` |
| Append-only audit | Every question, source, answer and decision is logged; no update or delete path |
| Deterministic output guard | Model drafts are untrusted; refusal drift (F-01) is discarded byte-for-byte |
| Fail-closed model adapter | `isEnabled()` requires three explicit env gates; absent by default; no network call anywhere |
| Integrity | Captured drafts are SHA-256-checked before use; `REPO-MANIFEST.json` hashes every file |
| Zero-egress | No `http`, `https`, `net`, `tls` import and no `fetch()` in `agent/**` |

## 4. Determinism and reproducibility

- Run IDs are `KBQ-` + the first 16 hex characters of
  `sha256(question.toLowerCase() | role | userId | kb.v1)`.
- A fixed timebase makes a clean-state run byte-identical.
- Retrieval scores, conflict resolution and recommendation weights are pure functions.
- Tests regenerate their own machine-readable traces from the current source, so the
  checked-in evidence is reproducible from a standalone checkout.

## 5. Model posture (honest statement)

| Field | Value |
|---|---|
| `mode` | `deterministic-simulation` |
| `wording` | `AI (simulasi)` |
| `liveInference` | `false` |
| `provider` | `none` |
| `networkCallsPermitted` | `false` |
| `verified` | `false` |

The in-app live SDK path was probed and is **BLOCKED** (headless probe timed out with
0 bytes). Captured model prose exists only as offline, hash-checked untrusted input.
This is **model-assisted**, never **verified live AI**. No deliverable in this
repository may claim otherwise until a verified end-to-end model response exists.

## 6. Portable workflow specification

`workflow-spec/workflow.json` describes 10 nodes and 11 edges, four forbidden edges and
the trust boundary. It is a **portable EEWR specification**, not a platform import:
`genuinePlatformExport: false`. The host platform offers natural-language task execution,
workspace folders, uploaded context, selectable built-in models and skill packages — but
no visual node builder, no node/edge graph import and no native workflow export. The
runbook in `workflow-spec/` therefore describes prompt-level constraints, not a graph
recreation.

## 7. Dataset

All three corpora are **100% synthetic and participant-owned**, describing the fictional
**The Goodlight Company (TGC)**. No organiser-shared dataset is used or claimed, per the
organiser clarification of 4 November 2026. Personal-data-looking strings are invented
placeholders used exclusively to exercise PII masking.
