# Commit CI Audit Ledger

Persistent repository-specific record of commit-level CI checks and red-cross investigations.

## How to use this ledger

1. Read this file before auditing commit checks.
2. Check only commits newer than the checkpoint, plus older **red**, **pending**, or explicitly unresolved entries.
3. Record exact commit SHAs and observed results; never infer from missing badges or empty API responses.
4. Preserve failures and append diagnosis, fix, rerun, and final-outcome evidence.
5. Advance the checkpoint only after reviewing the range; carry unresolved entries forward.

## Result meanings

| Result | Meaning |
|---|---|
| **green** | Completed successful check/run directly observed. |
| **red** | Completed failing check/run directly observed. |
| **pending** | Check/run exists but is unfinished. |
| **unavailable** | Available evidence did not expose a result; not a pass or failure. |
| **not applicable** | Workflow configuration confirms no relevant check is triggered. |

## Checkpoint

- Repository: `SakibShahariar/gnome-launcher`
- Default branch: `main`
- Checkpoint SHA: `0299ff244ef4c3f82122419d3306ce4baf8b5651`
- Initialized: 2026-11-02
- Baseline: latest branch tip queried through combined commit-status endpoint; empty status list recorded as **unavailable**, not green/red. Older history was not retroactively audited during setup.
- Next session: review commits after `0299ff2`; all red runs in the reviewed range below have a later green fix run. Older history before the original checkpoint remains outside this audit unless specifically flagged.

## Initial baseline

| Commit SHA | Subject | CI result | Checked | Follow-up |
|---|---|---|---|---|
| `7cf1ea1959a16cd1ed1fb62d883e3f57bf02ccba` | Default-branch tip at ledger initialization | unavailable | 2026-11-02 | Combined status lookup returned no entries. Revisit if new run or visible failure evidence appears. |

## Reviewed range after initial checkpoint

Checkpoint range: `7cf1ea1` → `a5f2c6f` (2026-11-03). Workflow run results were read from GitHub Actions, not inferred from commit-status endpoints.

| Commit SHA | Subject | Run | CI result | Follow-up |
|---|---|---:|---|---|
| `4f498b370475466c0c1d8bd2e42c4ca18e2c5d8f` | Add persistent commit CI audit ledger | [#463](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41456513030) | green | All workflow steps passed. |
| `f088d8df329c9d5d76ad6d03003685d7eebb2105` | Document incremental commit CI auditing | [#464](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41456521064) | green | All workflow steps passed. |
| `b63dac2c4b68fd727b6bfa0b50935a1499168175` | Define issue triage categories | [#465](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41573335459) | green | All workflow steps passed. |
| `dedff624835654c7e5e36bc9e46998a91fff88df` | Define administrative commit hygiene | [#466](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41597961133) | green | All workflow steps passed. |
| `2f0860974e555a9fc6f706a5680061d42b61f47d` | Add Alt+Enter desktop actions | [#467](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614386331) | red | Unit tests: 163 passed, 1 failed. Existing lifecycle test expected the previous one-line close callback; corrected in `7ed3b9e`. |
| `b1463ae1e6beee254aa502fa73dd9bc86c9a4415` | Add popup cleanup lifecycle test | [#468](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614602190) | red | The first replacement assertion used an incorrectly escaped regular expression. Replaced with direct callback extraction in `7ed3b9e`. |
| `7ed3b9e131742c7db24f5993c95f1776fd4e254d` | Fix lifecycle callback assertion | [#469](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614632765) | green | Full CI passed; 164 tests passed, 0 failed. |
| `fc881a8cb94011cd6e60675ca3b660f21191ce30` | Prefer Nautilus native file search | [#470](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614982653) | red | ESLint caught an unterminated regular expression caused by over-escaped query/fallback patterns. Corrected in `a5f2c6f`. |
| `a5f2c6f484a9aaac648c7dc2612744f32212666f` | Preserve query splitting and find escaping | [#471](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41615056161) | green | Full CI passed; 168 tests passed, 0 failed. |
| `0299ff244ef4c3f82122419d3306ce4baf8b5651` | Reuse Nautilus provider proxy | [#472](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41615198509) | green | Full CI passed; 168 tests passed, 0 failed. |

## Red-cross investigation log

### Desktop-actions lifecycle assertion

- Commit SHA: `2f0860974e555a9fc6f706a5680061d42b61f47d`
- Commit subject: `feat(app-actions): open desktop actions with Alt+Enter (#70)`
- First observed: 2026-11-03
- Workflow: [run #467](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614386331)
- Failed job / step: `validate` / `Run unit tests`
- Failure summary: `tests/extensionLifecycle.test.js` asserted the old one-line close callback after popup cleanup was added.
- Classification: test contract regression; implementation passed lint and syntax checks.
- Fix commit: `7ed3b9e131742c7db24f5993c95f1776fd4e254d`
- Intermediate attempt: [run #468](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614602190) remained red because its regex assertion was incorrectly escaped.
- Final verified outcome: [run #469](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614632765) green; 164/164 tests passed.
- Remaining follow-up: Live GNOME popup interaction remains an issue #70 acceptance item, not a CI failure.

### Native file-search regex

- Commit SHA: `fc881a8cb94011cd6e60675ca3b660f21191ce30`
- Commit subject: `feat(search): prefer Nautilus native file search (#79)`
- First observed: 2026-11-03
- Workflow: [run #470](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41614982653)
- Failed job / step: `validate` / `Lint JavaScript`
- Failure summary: ESLint reported an unterminated regular expression in `lib/modes.js` caused by over-escaped regex literals.
- Classification: implementation regression.
- Fix commit: `a5f2c6f484a9aaac648c7dc2612744f32212666f`
- Final verified outcome: [run #471](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41615056161) green; lint, syntax, 168/168 tests, benchmark, metadata, and GSettings validation passed.
- Remaining follow-up: Live Nautilus-provider availability, cancellation, and performance measurements remain in issue #79.



### Failure record template

- Commit SHA:
- Commit subject:
- First observed (date):
- Workflow / run URL:
- Failed job / step:
- Failure summary:
- Classification: regression / pre-existing / inconclusive
- Fix commit(s):
- Rerun attempt(s) and result:
- Final verified outcome:
- Remaining follow-up:

## Session history

| Date | Reviewed range / checkpoint | Result summary |
|---|---|---|
| 2026-11-02 | Initial checkpoint: `7cf1ea1959a16cd1ed1fb62d883e3f57bf02ccba` | Latest commit queried; empty status response recorded as unavailable. Earlier history not retroactively audited. |
| 2026-11-03 | Reviewed `7cf1ea1` through `0299ff2` | Four setup/documentation commits green; desktop-actions runs #467/#468 red and resolved by #469; native-search run #470 red and resolved by #471; proxy-cache run #472 green. Latest verified checkpoint: `0299ff2`. |
