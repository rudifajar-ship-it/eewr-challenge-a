# Security posture & publication scan summary

> Full owner-only scan report (with adjudications and the sanitisation map) is kept
> outside this repository in the S9 publication kit. This file is the public summary.

## 1. Data classification

| Class | Present? | Detail |
|---|:--:|---|
| API keys / tokens / private keys | **NO** | No `.env`, no key file, no literal assignment, no PEM block |
| Real personal data | **NO** | No real name, email, phone, national ID or contact |
| Real organisations / employers / clients | **NO** | Only **XRC**, **Team BRONX** and the fictional **The Goodlight Company (TGC)** |
| Confidential commercial information | **NO** | All figures, documents, chat exports and scenarios are invented |
| Absolute sandbox / machine paths | **NO** | Rewritten as relative repository paths |
| Internal ticket numbers / vendor SKUs | **NO** | Removed for public release |
| Live external endpoints | **NO** | No `http`/`https`/`net`/`tls` import, no `fetch()`, no socket |

## 2. Controls built into the code

- **Permission before search.** The corpus is scoped before retrieval, so restricted
  items never enter the candidate set.
- **Least privilege.** Unknown principals are downgraded on every call.
- **Non-leaking refusal.** Restricted and non-existent topics produce byte-identical answers.
- **Prompt-injection neutralisation and PII masking** on every quoted snippet.
- **Mandatory human approval gate.** `agent/approve.js` is the only module that can write
  the ledger; `ask()` cannot record an action.
- **Append-only audit.** No update or delete path exists.
- **Fail-closed model adapter.** Disabled by default, requires three explicit environment
  gates, performs no network call, and falls back to fully deterministic behaviour.
- **Hash-checked untrusted model input.** Captured prose is verified with SHA-256 before
  the deterministic output guard consumes it; refusal-wording drift is discarded.
- **Integrity manifest.** `REPO-MANIFEST.json` hashes every included file.

## 3. Scan verdict

| Check | Result |
|---|:--:|
| Credentials / API keys / private keys | **PASS — 0 hits** |
| Real personal data | **PASS — 0 hits** |
| References to real organisations | **PASS — 0 hits** |
| Absolute sandbox paths / internal ticket IDs | **PASS — 0 hits** |
| Network calls / live endpoints in `agent/**` | **PASS — 0 hits** |
| Misleading live-AI / platform-run / workflow-export claims | **PASS — 0 unnegated hits** |
| All seven suites re-run on the sanitised tree | **PASS — exit 0** |
| Frozen artifacts and deployed dashboard untouched | **PASS — hashes unchanged** |

**Adjudicated non-findings** (explicitly listed so nothing is silently dropped):

- `AKID[A-Za-z0-9]{10,}` and similar patterns in `tests/` are **negative assertions**
  proving no such token exists — not credentials.
- `sk-portfolio` / `sk-dashboard` shaped strings are substrings of the synthetic
  category name `risk-portfolio` — not API keys.
- NIK- and phone-shaped strings inside `data/` are **synthetic placeholders** marked as
  such in the same JSON records; they exist to prove PII masking works.
- `fetch()` appears once in documentation as a **negated** statement ("no `fetch()` anywhere
  in `agent/**`") — not a call site.
- `credential` / `.env` wording appears only in absence checks and prohibition statements.

## 4. Prohibited content in any future commit

Credentials, real personal data, employer or client names, internal ticket numbers,
absolute machine paths, paid-service configuration, simulated platform screenshots,
and any unnegated claim of verified live AI or a native platform workflow export.

## 5. Reporting

If you find a sensitive token in this repository, do not open a public issue with the
value. Report it privately to the repository owner and rotate anything real immediately.
