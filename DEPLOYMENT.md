# Running, reproducing and publishing EEWR Challenge A

> This repository is a **source-code artifact**. There is no application server to
> deploy, no build pipeline, no container and no environment configuration.

## 1. Prerequisites

| Requirement | Version / note |
|---|---|
| Node.js | 22 or newer (`node --version`) |
| Python 3 | Optional, only for manifest verification |
| Git | Optional, only if you publish this repository |
| Network access | **Not required and not used** |
| Credentials / API keys | **None. Do not add any.** |
| Paid services | **None. Do not enable any.** |

No `npm install`, no `package.json`, no `.env`, no database, no secrets manager.

## 2. Run locally

From the repository root:

```bash
node agent/run.js model-status
node agent/run.js ask-a "Berapa tunjangan bahan bakar bulanan saat ini?" --user=usr-andi
node agent/run.js workflow "Mengapa stok terlambat di Makassar, dan apa yang masih terbuka?" --user=usr-andi --case=C2
node agent/run.js ledger
```

`model-status` must report `liveInference: false`, `verified: false`,
`enabled: false`, `networkCallsPermitted: false`. If it reports anything else, stop
and investigate — the deterministic fallback is the primary path.

Runtime state is written to `state/`, which is git-ignored. Delete it to return to a
clean state:

```bash
rm -rf state/
```

## 3. Reproduce the evidence

All seven suites are self-contained: they read only from `data/`, `agent/` and
`traces/` inside this repository. No external evidence directory is consulted.

```bash
node agent/run.js selftest                 # 20/20
node agent/run.js selftest-a              # 23/23
node agent/run.js selftest-guard          # 15/15
node agent/run.js verify-final            # 16/16
node agent/run.js verify-shot8            # 8/8
node agent/run.js verify-model-assisted   # 26/26
node tests/genuine-e2e-demo.js            # 9/9
```

Several suites **regenerate** files in `traces/` and write temporary reports to the
OS temp directory. That is expected: the checked-in traces are reproducible outputs,
not frozen artifacts. Re-running them changes their hash, so regenerate
`REPO-MANIFEST.json` afterwards if you intend to publish the new tree.

Verify the manifest:

```bash
python3 - <<'PY'
import json, hashlib, pathlib
m = json.load(open('REPO-MANIFEST.json'))
files = m['files'] if isinstance(m, dict) and 'files' in m else m
items = files.items() if isinstance(files, dict) else [(x['path'], x) for x in files]
bad = [r for r, meta in items
       if hashlib.sha256(pathlib.Path(r).read_bytes()).hexdigest() != meta['sha256']]
print('MISMATCH:', bad if bad else 'none — manifest verified')
PY
```

For the recorded 5–8 minute demonstration, follow `demo/RUNBOOK.md`.

## 4. Publishing (owner action only — NOT EXECUTED)

This workspace has **not** created a repository, initialised git, or pushed anything.
Publishing is an **explicit owner decision** and belongs to S9 / Route A. The owner-side
step-by-step instructions live in the submission pack (S9 publication kit), not in this
repository. In outline:

1. Obtain explicit written approval to publish.
2. Create a new **public** repository on the chosen host and choose a licence.
3. Copy the contents of this directory (including dotfiles) into a fresh clone.
4. Confirm `state/` is absent, `REPO-MANIFEST.json` is current, and `SECURITY.md` verdict is PASS.
5. Commit and push once; record the public URL in the S9 submission field.
6. Do **not** add credentials, do **not** enable paid features, do **not** caption any
   local screenshot as a platform console capture, and do **not** redeploy the frozen
   static dashboard.

## 5. What must never be deployed from here

- Any live model endpoint or API key. `provider-adapter.js` must stay disabled and fail-closed.
- The frozen static dashboard or the locked submission archives. They are separate,
  already-published artifacts with their own share link and must not be replaced.
- Any claim of verified live AI, a native platform run, or a genuine workflow export.
