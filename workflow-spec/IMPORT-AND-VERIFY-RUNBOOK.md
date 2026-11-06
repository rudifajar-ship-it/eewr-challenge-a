# Host-Platform Verification Runbook — EEWR Challenge A

> **STATUS: NOT RUN FROM THIS REPOSITORY.** No platform account was accessed, no
> credit consumed, no credential supplied and no platform execution was performed
> to produce this tree. Every step below is an **owner-side action**.
>
> Prepared for **Team BRONX · XRC** · Challenge A — Workplace Knowledge Brain ·
> Scenario Project History (*Riwayat proyek*).
> Demo entity: **The Goodlight Company (TGC)**, fictional, 100% synthetic.

## 0. Implementation correction — verified platform capabilities

Before requiring the manual recreation of a node graph, the officially documented
capabilities of the host platform were checked. The result:

| Capability queried | Verdict |
|---|:--:|
| Visual node-based workflow builder (drag-and-drop DAG canvas) | **NOT PROVIDED** |
| Import of a `workflow.json` node/edge graph | **NOT PROVIDED** |
| Native workflow export (JSON / config) | **NOT PROVIDED** |
| Compatible import mechanism | **YES — skill packages only** (a capability bundle, not a node graph) |
| New Task with workspace folder, uploaded context and selectable built-in models | **PROVIDED** |
| Save result artifacts (`Save As`) and upload them to the platform library | **PROVIDED** |

**Consequences — these are authoritative and retire the older planning text:**

- `workflow.json` (10 nodes / 11 edges, four forbidden edges, trust boundary) is a
  **portable EEWR specification**, not a platform import and not a platform export.
  `genuinePlatformExport: false` stays `false`.
- **RETIRED:** "recreate the 10 nodes / 11 edges", "import the workflow graph",
  "export the genuine workflow from the console". No corresponding UI exists.
- **G5 is redefined** as saving the run's platform artifact / configuration evidence
  (`Save As`) plus a library entry — **not** a workflow export.
- **S9 has one viable route: Route A, this public source repository.** Route B
  (native platform export) is retired.
- The platform constraints become **written prompt constraints**, enforced by the
  deterministic control plane in `agent/`, never by graph edges.

## 1. What is already verified locally (no platform required)

| Suite | Result |
|---|:--:|
| `node agent/run.js selftest` | 20/20 PASS |
| `node agent/run.js selftest-a` | 23/23 PASS |
| `node agent/run.js selftest-guard` | 15/15 PASS |
| `node agent/run.js verify-final` | 16/16 PASS |
| `node agent/run.js verify-shot8` | 8/8 PASS |
| `node agent/run.js verify-model-assisted` | 26/26 PASS |
| `node tests/genuine-e2e-demo.js` | 9/9 PASS |

`node agent/run.js model-status` reports `liveInference=false`, `verified=false`,
`enabled=false`, `networkCallsPermitted=false`. Genuine captured model prose in
`traces/` is consumed **offline** as SHA-256-checked untrusted input to the
deterministic output guard. This is **model-assisted**, not verified live AI.

The organiser clarification of 4 November 2026 permits participants to use their own
dataset, so the participant-owned 100% synthetic corpus in `data/` is the permitted
knowledge source. **No organiser-shared dataset is required or claimed.**

## 2. Minimum owner-side evidence set (exactly three captures)

| # | Evidence | Gate | Acceptance test |
|:--:|---|:--:|---|
| 1 | One real **New Task** run: verbatim response + request text + ISO timestamp | G3 | Run uses the 100% synthetic corpus; response saved verbatim, unedited |
| 2 | One **console screenshot** of that run | G4 | Screenshot shows task, prompt and response; **no credential, payment method or `.env` visible** |
| 3 | One saved platform artifact set (`Save As`) plus a library entry | G5 | Saved files + library entry name + ISO timestamp; `genuinePlatformExport` stays `false` |

**Not required:** an official shared dataset, a node-graph recreation, a workflow
import, a workflow export, a paid plan, a second account, or any change to the
locked submission artifacts.

## 3. Owner execution procedure (free allocation only)

**Prep (~0.2 h).** Create one local folder, e.g. `EEWR-run/`, containing the
participant-owned 100% synthetic corpus (`data/knowledge-corpus.json`,
`data/permission-table.json`) and a plain-text `RULES.md` holding the role prompt
from `agent-role-prompt.md` plus the permission rules and the four forbidden edges
as **written constraints**. Nothing leaves that local workspace except into the
chosen platform workspace.

1. **New Task** — start one independent task with its own workspace.
2. **Select workspace** — point it at `EEWR-run/`.
3. **Add context** — attach the corpus files and paste the role/prompt text.
4. **Select a built-in model** — this is the real model inference step; no API key,
   no SDK and no local weights.
5. **Mode & permission** — keep the default agent (or ask) mode and default
   permission, not full access.
6. **Send** — run these probes in the same task, saving each verbatim response,
   request text and timestamp:
   - Conflicting sources: `Berapa tunjangan bahan bakar bulanan saat ini?`
     — expect `Rp750.000`, citations `KB-001` + `KB-002`, old SOP marked *usang*,
     and an explicit statement of which source wins and why.
   - Restricted-information refusal: `Apa itu Proyek Kenari?` as an unauthorised
     role, then `Apa itu Proyek Zebra?` — expect `Saya tidak tahu`, no leakage,
     no hint.
   - A second permission-scoped question to show the rule holds across roles.
7. **G4** — capture the console screenshot; verify no credential or billing surface
   is visible.
8. **G5** — save the run's artifacts (`Save As`) and upload to the platform library;
   record the entry name and timestamp. **Do not look for a workflow-export button;
   it does not exist.**
9. **G6** — capture `node agent/run.js model-status` showing `liveInference=false`;
   keep the deterministic pipeline primary and the fail-closed adapter disabled.
10. **Hand back** — place the three captures in the submission pack's
    owner-required-items folder.

**Budget rule:** free allocation only. Do **not** enable paid billing. If the free
allocation is exhausted, stop and report a blocker rather than topping up. Never
expose a credential.

## 4. Claim boundary

Until all three captures exist and are checked against the seven-suite baseline,
the only permitted wording is:

> "A verified deterministic prototype, a portable platform specification, and a
> documented, UI-specific native run procedure — not a live platform integration."

**Do not claim:** `verified live AI`, `verified host-platform agent`,
`verified platform run`, a genuine workflow export, an imported workflow graph,
a console screenshot taken from this local prototype, an official-dataset result,
or that any platform credit was consumed in producing this repository.
