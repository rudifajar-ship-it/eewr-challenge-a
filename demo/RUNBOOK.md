# DRAFT — EEWR 5–8 Minute Reproducible Demo Runbook (target 6:50)

> **Status:** DRAFT for recording. Not a submission artifact; not inside any ZIP.
> **Product:** EEWR — Executive Early Warning Radar · **Team:** BRONX
> **Organization:** XRC · **Team:** Team BRONX
> **Note:** Legacy risk-path demo draft, retained for architecture evidence only. This repository is standalone: every runnable script and trace ships inside it.
> **Industry:** Natural resource-based industries · **Demo entity (fictional):** The Goodlight Company (TGC)
> **Scope:** Self-contained. No external evidence folder, draft directory or owner-side record is required to run this demo.

## 0. Recording parameters

| Parameter | Value |
|---|---|
| Target runtime | **6:50 (410 s)** — inside the 5:00–8:00 requirement |
| Runtime if Shot 8 is shortened | 6:25 — still compliant |
| Voice-over | ≈950 words at 140 wpm |
| **Disclosure card D3** | Visible for the **entire** Shots 5–7 (M4 assessment + full agent run) |
| Reproducibility | every on-screen number is produced by a command below, re-runnable in < 60 s |
| Freeze | no workspace edits after the published freeze point |

**D3 card text (verbatim, keep on screen throughout Shots 5–7):**
> "100% SYNTHETIC DATA · Fictional entity The Goodlight Company (TGC).
> Deterministic, auditable simulation (`AI (simulasi)`). **No live model inference.**
> Every action requires explicit human approval before it is recorded.
> EEWR — Executive Early Warning Radar · Team BRONX · XRC."

**Honesty rules (apply to every frame and every spoken line):**
1. Describe the prototype as a **deterministic, auditable agent workflow**, never as an autonomous agent.
2. Do not state or imply that a live model, a cloud AI service, or functional AI is in use.
3. Do not describe the shipped dashboard as an agent.
4. Do not use any terminology appearing on the locked FINAL-v2 script's banned-terms list.
5. State that action records are local to the browser / local state, never cross-device persistence.
6. Never name or imply any employer, client or third-party affiliation.

---

## 1. Pre-flight (do this immediately before recording)

```bash
cd .
node agent/run.js selftest          # MUST print 20/20 PASS, 0 FAIL and exit 0
echo $?                            # MUST be 0
rm -rf state/                      # clean, reproducible starting point
node agent/run.js ledger            # MUST print []
node agent/run.js model-status      # liveInference:false, verified:false, enabled:false
```

If any pre-flight check fails, **do not record**. Capture the passing terminal as screenshot evidence `E-01`.

**Fixed timebase for reproducible numbers:** pass `--now=2026-11-03T22:10:00+08:00` to `ask` / `approve`. Without it, timestamps differ but all scores and IDs stay identical.

---

## 2. Shot list

| # | Time | Dur | Content | On screen |
|---|---|---|---|---|
| 1 | 0:00–0:30 | 30 s | Hook + identity + synthetic disclosure | Title card |
| 2 | 0:30–1:05 | 35 s | Problem framing / Challenge A · Project History positioning (CONFIRMED) | Text card |
| 3 | 1:05–1:55 | 50 s | M1 Executive Dashboard + what-if recompute | Frozen app |
| 4 | 1:55–2:35 | 40 s | M2 Intelligence Radar + M3 Early Warning | Frozen app |
| 5 | 2:35–3:25 | 50 s | M4 AI Risk Assessment, provenance, D3 card | Frozen app + D3 |
| 6 | 3:25–4:05 | 40 s | M5 Action Tracker, ownership, browser-local state | Frozen app |
| 7 | **4:05–5:35** | **90 s** | **LIVE AGENT WORKFLOW RUN — the core new evidence** | Terminal + D3 |
| 8 | 5:35–6:10 | 35 s | Architecture / data-flow walkthrough | Diagram |
| 9 | 6:10–6:35 | 25 s | Challenge test cases + screenshot evidence | Screenshot sheet |
| 10 | 6:35–6:50 | 15 s | Close + identity + disclosure | End card + D3 |

**Total 410 s = 6:50.**

---

## 3. Shot 7 — the reproducible agent run (record this as one continuous take)

Run these commands **in order, on screen, without cuts in the terminal region**:

```bash
# 7a. Natural-language executive risk question (Indonesian)
node agent/run.js ask "Apa risiko kekeringan terhadap operasi TGC bulan ini?" \
  --now=2026-11-03T22:10:00+08:00

# 7b. Show that NOTHING is recorded before human approval
node agent/run.js ledger

# 7c. Explicit named human approval — the only write point
node agent/run.js approve RUN-e3e9f454a52de25d "Team BRONX" \
  "Approved for demo" --now=2026-11-03T22:10:00+08:00

# 7d. Show the recorded, auditable action entries
node agent/run.js ledger

# 7e. Out-of-scope question: no fabrication
node agent/run.js ask "Bagaimana harga saham hari ini?" --now=2026-11-03T22:10:00+08:00

# 7f. Model posture — fail-closed
node agent/run.js model-status
```

**Expected, verifiable on-screen numbers (memorise these for the VO):**

| Beat | Expected output |
|---|---|
| 7a runId | `RUN-e3e9f454a52de25d` |
| 7a retrieved evidence | `EVD-001 (9.6334)`, `EVD-005 (3.8705)`, `EVD-008 (3.8159)` — each with source + quote + score breakdown |
| 7a factors / formula | `p=61.85, i=72.22, u=64.17` → `score = p*0.35 + i*0.40 + u*0.25` |
| 7a composite | **69.77 / 100 — MODERAT / MODERATE** |
| 7a status | `AWAITING_HUMAN_APPROVAL` |
| 7a proposals | 2 actions, both `PENDING_HUMAN_APPROVAL` / `recorded: false`, with owner role, due days, rationale and linked evidence IDs |
| 7b ledger | `[]` — **empty** |
| 7c status | `RECORDED`, approver `Team BRONX`, `entries: 2` |
| 7d ledger | 2 entries, each with `approver`, `recordedAt`, `groundedIn: [EVD-001, EVD-005, EVD-008]` |
| 7e | `INSUFFICIENT_EVIDENCE`, `NO_RECOMMENDATION`, 0 actions — "No recommendation or action is fabricated" |
| 7f | `liveInference: false`, `verified: false`, `enabled: false`, Gates 1–3 all not passed |

> If using the richer cross-link question instead, `"Apa risiko kekeringan terhadap operasi TGC dan tindakan apa yang harus disetujui?"` yields `RUN-7730d92acc0be437`, score `66.58`, and top evidence `EVD-008 / EVD-001 / EVD-005` — useful as a second take showing the workflow linking a climate signal to the existing action register.

---

## 4. Voice-over (≈950 words at 140 wpm)

### Shot 1 · 0:00–0:30 · Hook, identity, disclosure (~70 words)
"An executive does not need another chart. They need to know which risk to act on, why, and who signs off. This is EEWR — Executive Early Warning Radar, by Team BRONX, from XRC, founded by Team BRONX, built for natural resource-based industries. Everything you will see uses one hundred percent synthetic data for a fictional company, The Goodlight Company. The assessment layer is a deterministic, auditable simulation — not a live model."

### Shot 2 · 0:30–1:05 · Problem & positioning (~82 words)
"We are presenting against Challenge B, the Office Agent track, pending confirmation from the official participant guide. The office problem is concrete: signals arrive, someone must decide, someone must own the follow-up, and nobody should record an action without approval. Our submission is a hybrid — a preserved executive dashboard as the rollback baseline, plus a separate, isolated agent workflow prototype. We will show both, and we will be explicit about exactly what is simulated and what is real."

### Shot 3 · 1:05–1:55 · Module 1 (~116 words)
"The dashboard opens on the executive view for TGC: twenty-two active alerts, four of them critical, drawn from twenty-six monitored signals. On the left, the drought index moves from sixty-seven point five to seventy-three point three. A what-if control recomputes the exposure live in the browser. This is the preserved baseline — unchanged, frozen, and byte-verifiable. It is an attractive dashboard, and we are deliberately not stopping here: a dashboard alone cannot answer an executive's question, and it cannot propose who should act."

### Shot 4 · 1:55–2:35 · Modules 2–3 (~93 words)
"Intelligence Radar groups the twenty-six signals by provenance, so an executive can see where a signal came from. Early Warning turns them into twenty-two alerts, with four escalated to critical. Each alert carries an evidence trail — for example signal SIG-8801 feeding early warning EWR-1042. Nothing here is inferred by a model: these are deterministic, synthetic monitoring records, displayed with their sources. That matters, because the next layer has to cite them, not invent them."

### Shot 5 · 2:35–3:25 · Module 4 + disclosure (~116 words) **[D3 visible]**
"AI Risk Assessment computes a score of eighty-six out of one hundred, with a residual of sixty-eight after mitigation. The formula is visible and fixed: probability times zero point three five, plus impact times zero point four zero, plus urgency times zero point two five. The Langsung control is disabled. The on-screen label reads AI (simulasi). Please note the disclosure card: this is a deterministic, evidence-anchored computation over synthetic data. There is no live model inference anywhere in this build, and we will not claim otherwise."

### Shot 6 · 3:25–4:05 · Module 5 (~93 words)
"The Executive Action Tracker closes the loop: an alert becomes an assigned action with an owner and a due date — twenty-seven actions in the synthetic register, including ACT-301 assigned to a fictional TGC role. State is saved locally in this browser only; it is not synchronised across devices. That limitation is intentional and disclosed. It also exposes the real gap we set out to close: the action is created by a human clicking a form. So we built a separate layer that can be questioned in natural language — and that still refuses to record anything on its own."

### Shot 7 · 4:05–5:35 · Live agent workflow run (~210 words) **[D3 visible]**
"Now the isolated prototype. One command, one natural-language question in Indonesian: what is the drought risk to TGC operations this month? The workflow tokenises the question and retrieves ranked synthetic evidence — EVD-001 on the drought index, EVD-005 on transport reliability, and EVD-008 on the existing action register. Each hit shows its source, a quote, and a transparent score breakdown. No vector store, no embedding, no model call.

It then computes an explainable recommendation: probability sixty-one point eight five, impact seventy-two point two two, urgency sixty-four point one seven, giving sixty-nine point seven seven out of one hundred — moderate. Every factor is traceable to a cited evidence item, and the provenance weights sum to one.

Two accountable follow-up actions are proposed, each with an owner role, a due date, a rationale and linked evidence. Note their state: pending human approval. Watch the ledger — it is empty. Nothing has been recorded.

Only now do we call approve, with a named human approver. The status changes to recorded, and exactly two auditable entries appear, each carrying the approver, a timestamp and the three evidence IDs it was grounded in. Approve twice, and the second call is rejected.

Now an out-of-scope question about share prices. The workflow returns insufficient evidence — no recommendation, no action, nothing fabricated. That refusal is a feature.

Finally, model-status: live inference false, verified false, adapter disabled. Gates one through three are not passed. We are demonstrating a working, reproducible, human-gated workflow — and we are explicitly not claiming functional AI."

### Shot 8 · 5:35–6:10 · Architecture & data flow (~82 words)
"Here is the boundary. The frozen baseline — the dashboard, the one-pager, both ZIPs and the public link — is untouched and hash-verified. The prototype lives in a separate lab directory with its own synthetic corpus and its own state. It reads nothing from the shipped application and writes nothing to it. The approval gate is the only write point in the entire system. That separation is why we can treat the frozen build as a rollback baseline at any moment."

### Shot 9 · 6:10–6:35 · Test cases & evidence (~58 words)
"Every claim maps to a test. Twenty offline end-to-end checks pass, including the hard approval gate, double-approval blocking, out-of-scope refusal, byte-identical reproducibility on a clean state, and a source scan for secrets. The trace file and the approval ledger are machine-readable and ship as evidence. Twelve interface screenshots are catalogued separately."

### Shot 10 · 6:35–6:50 · Close (~35 words)
"EEWR — Executive Early Warning Radar. Team BRONX, XRC. A reproducible, evidence-grounded, human-approved decision workflow on synthetic data. Independent project; no employer, client or third-party affiliation. Thank you."

---

## 5. Post-recording gates

1. **Timing gate:** measure the final cut. Reject anything below **5:00** or above **8:00**. Target 6:50.
2. **Disclosure gate:** D3 must be visible for the full duration of Shots 5, 6 and 7. Confirm no frame contradicts the honesty rules in §0.
3. **Keyword gate:** scan the VO transcript, captions and on-screen text. Any phrase asserting a working live model, a cloud AI connection, or an autonomous agent must be removed.
4. **Reproducibility gate:** re-run all §3 commands on a clean state; confirm every number in §3's expected-output table matches the recording.
5. **Identity gate:** confirm exact strings for product, team, organization, representative, industry and fictional entity; confirm zero employer/client references.

---

## 6. Upload description (paste-ready, honest)

> EEWR — Executive Early Warning Radar | Team BRONX | XRC | Team BRONX | Natural resource-based industries.
> Active submission: Challenge A — Workplace Knowledge Brain · Project History (CONFIRMED) · Executive Knowledge & Early Warning Intelligence. (This runbook documents the legacy risk-dashboard demo layer only.)
> Hybrid: a preserved, hash-verified executive dashboard (rollback baseline) plus a separate, isolated agent workflow prototype. The prototype accepts a natural-language executive risk question, retrieves ranked synthetic evidence with citations, produces an explainable evidence-anchored recommendation, proposes accountable follow-up actions, and **requires explicit named human approval before any action is recorded**.
> All data is 100% synthetic and concerns the fictional The Goodlight Company (TGC). The workflow is a deterministic, auditable simulation (`AI (simulasi)`); **no live model inference is used and no functional-AI claim is made**. Offline end-to-end self-test: 20/20 PASS, exit 0. This is an independent project, not affiliated with, endorsed by, or representative of any employer, client or third party.

---

## 7. Mandatory-evidence mapping (capture during recording)

| ID | Evidence | How this runbook supplies it | Status |
|---|---|---|---|
| E-01 | Self-test terminal transcript | Pre-flight §1, `20/20 PASS, exit 0` | ready to capture |
| E-02 | Question → citations screenshot | Shot 7a | ready to capture |
| E-03 | Provenance / formula screenshot | Shot 7a | ready to capture |
| E-04 | Ledger empty before approval | Shot 7b | ready to capture |
| E-05 | Approval command + recorded ledger | Shot 7c/7d | ready to capture |
| E-06 | Out-of-scope refusal | Shot 7e | ready to capture |
| E-07 | Model posture fail-closed | Shot 7f | ready to capture |
| E-08 | Machine-readable trace | `traces/sample-run.json` | **exists** |
| E-09 | Approval ledger export | `state/ledger.json` | **exists** (regenerate on clean state) |
| E-10 | Architecture diagram | `DRAFT-03` → render to PNG in P2 | DRAFT |
| E-11 | 12 interface screenshots | `eewr/preview/*.png` | **exist but are in neither ZIP** |
| E-12 | Accountability sheet | `DRAFT-01` → finalise in P2 | DRAFT |
| E-13 | the host platform usage evidence | workspace + terminal captures | DRAFT |

> **RISK-05:** the public deployment stays unchanged, so evaluators visiting the public demo link see only the dashboard. This **video is the compliant mechanism** that makes the agent layer visible. A separately approved demo endpoint is the alternative and requires explicit approval.
