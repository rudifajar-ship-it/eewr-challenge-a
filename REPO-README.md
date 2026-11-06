# Publication provenance & integrity notice

> **NOT PUBLISHED.** This is a local, publication-ready snapshot prepared for S9
> (Route A — public source repository). No repository was created, no `git init`
> or `git push` was run, no archive was produced, and no submission was made.
> Publishing requires **explicit owner approval**.

## Provenance

This tree is a **sanitised copy** of the internal, isolated Challenge A agent lab.
The copy was produced read-only with respect to the original: the source snapshot,
the frozen submission archives, the locked one-pager and the separately deployed
static dashboard were not modified, redeployed or republished.

## What was normalised for public release

| Category | Treatment |
|---|---|
| Attribution | Normalised to **Team BRONX** and **XRC** only; no individual is named |
| Demo entity | **The Goodlight Company (TGC)**, explicitly fictional and 100% synthetic |
| Platform / vendor names | Removed; replaced with neutral technical wording |
| Internal ticket numbers and model SKUs | Removed; replaced with generic descriptions |
| Sandbox absolute paths | Rewritten as relative repository paths |
| External evidence fallback in two tests | Removed, so the checkout is fully standalone |
| Stale "Route B / native workflow export" wording | Corrected to Route A only |

No functional logic, no test assertion's intent, and no evidence value was changed.
All seven suites were re-executed against the sanitised tree and exit 0. The
portable workflow specification keeps `genuinePlatformExport: false`.

## What was deliberately retained

- `attribution` / `representedBy` field names — legacy schema keys kept so the
  recorded traces stay reproducible; values are team-level, no personal data.
- Synthetic NIK / phone-shaped placeholders in `data/` — invented strings used
  to prove PII masking works. They are marked synthetic in the same records.
- Negative security assertions in `tests/` that mention key prefixes — these are
  **absence checks** ("no such token may appear"), not credentials.
- Honest limitations, disclosed failures and the deterministic-fallback posture.

## Integrity

`REPO-MANIFEST.json` lists every included file with its real SHA-256, byte size and
line count, generated after sanitisation and after the test suites were re-run.
Verify with:

```bash
python3 - <<'PY'
import json, hashlib, pathlib
m = json.load(open('REPO-MANIFEST.json'))
files = m['files'] if isinstance(m, dict) and 'files' in m else m
bad = []
for rel, meta in (files.items() if isinstance(files, dict) else [(x['path'], x) for x in files]):
    b = pathlib.Path(rel).read_bytes()
    if hashlib.sha256(b).hexdigest() != meta['sha256'] or len(b) != meta['bytes']:
        bad.append(rel)
print('MISMATCH:', bad if bad else 'none — manifest verified')
PY
```

## Licence

No licence file is included. The owner must choose a licence at repository
creation time (or explicitly publish without one). Do not add a licence, a
credential, or paid billing on the owner's behalf.

## S9 status

Route A (public source repository) is the **only** viable S9 route. Route B
(native platform workflow export) was retired after verification that the host
platform provides no workflow-graph import or native workflow export. This
repository satisfies the source-code half of S9; the platform-native evidence
captures belong to the separate S8 deliverable and must not be simulated here.
