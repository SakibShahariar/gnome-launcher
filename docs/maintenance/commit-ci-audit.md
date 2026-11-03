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
- Checkpoint SHA: `4f497f58718bb65f6a99f6ef5c3c4df80bb238e4`
- Initialized: 2026-11-02
- Baseline: latest branch tip queried through combined commit-status endpoint; empty status list recorded as **unavailable**, not green/red. Older history was not retroactively audited during setup.
- Next session: review commits after `4f497f5`; runs #481 and #482 were green (188 and 189 tests respectively). Run #483 was red from a source-test assertion matching a comment, corrected in the next commit. Older history before the original checkpoint remains outside this audit unless specifically flagged.

## Initial baseline

| Commit SHA | Subject | CI result | Checked | Follow-up |
|---|---|---|---|---|
| `7cf1ea1959a16cd1ed1fb62d883e3f57bf02ccba` | Default-branch tip at ledger initialization | unavailable | 2026-11-02 | Combined status lookup returned no entries. Revisit if new run or visible failure evidence appears. |

## Reviewed range after initial checkpoint

Checkpoint range: `7cf1ea1` → `4f497f5` (2026-11-03). Workflow run results were read from GitHub Actions, not inferred from commit-status endpoints.

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
| `5da4932e42ba45c01bc34fa9748ac3b7e5f507a9` | Handle malformed native provider results | [#473](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41615332403) | green | Full CI passed; 169 tests passed, 0 failed. |
| `33f52808902655346299aeae1b3f5b03ba4fb2c1` | Add focus and keyboard activation for reference layouts | [#474](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41615687914) | green | Full CI passed; 172 tests passed, 0 failed. |
| `c26557468323f01fc7d2d8178260261399f1ecd2` | Render focus indicators on transparent controls | [#475](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41615868511) | green | All 23 job steps completed successfully, including lint, syntax, unit tests, benchmark, metadata, and GSettings validation. |
| `1af49a68b3c02f942e20700f8bf716002f5f0dc1` | Make finder prefixes work across layouts | [#476](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41618721728) | red | Lint and syntax passed. Unit tests: 173 passed, 2 failed; power was unintentionally accepted as a default finder, and the clipboard test mock returned the raw history type. |
| `0173f253c574dda727a722f26888f6a0822845ed` | Keep power prefix out of default finder options | [#477](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41618965851) | green | Full CI passed; 175 tests passed, 0 failed. All validation steps completed. |
| `2b8e408166f1a956790d045b3442ca1662b568a8` | Keep selected finder results in view | [#478](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41619161839) | green | Full CI passed; 176 tests passed, 0 failed. All validation steps completed. |
| `aa3530983fafca6250b68f013acfe900dfb106f0` | Cover prefix routing in all layouts | [#479](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41619447216) | green | Full CI passed; 178 tests passed, 0 failed. All validation steps completed. |
| `17df637a8ee47eb33b2970136ebe892826256082` | Add shared rest cards to all layouts | [#480](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41620392169) | green | Full CI passed; 181 tests passed, 0 failed. All validation steps completed. |
| `c652dc3037192a8b583532c2c06fa3ee4b65f9b6` | Add Wayland-safe screen color picker | [#481](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41621400718) | green | Full CI passed; 188 tests passed, 0 failed. Portal response subscription race hardening follows in the next commit. |
| `4a55050c444b4bbd9416fbe0c3ed35cb09f0aaa3` | Subscribe before requesting portal color | [#482](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41621545263) | green | Full CI passed; 189 tests passed, 0 failed. Request signal subscription now precedes the portal method call and handles returned-handle mismatch. |
| `4f497f58718bb65f6a99f6ef5c3c4df80bb238e4` | Guard edge-anchored layout positioning | [#483](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41621801095) | red | Lint and syntax passed. 191 tests passed, 1 failed because a negative source assertion matched the explanatory comment mentioning `set_position()`; fixed by checking for an actual member call. |

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
| 2026-11-03 | Reviewed `7cf1ea1` through `4f497f5` | Four setup/documentation commits green; desktop-actions runs #467/#468 red and resolved by #469; native-search run #470 red and resolved by #471; proxy-cache, malformed-response, and accessibility runs #472–#475 green. Latest reviewed commit: `4f497f5`; run #483 red is a test-only false positive and is being corrected in the follow-up. |


### Finder-prefix integration test failures

- Commit SHA: `1af49a68b3c02f942e20700f8bf716002f5f0dc1`
- Commit subject: `feat(search): make finder prefixes work across layouts (#23)`
- First observed: 2026-11-03
- Workflow: [run #476](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41618721728)
- Failed job / step: `validate` / `Run unit tests`
- Failure summary: `defaultMode.test.js` correctly rejected `power` as a persistent default mode; adding it to the global prefix registry had unintentionally exposed it in default-mode preferences. The finder-search test mock also returned the raw clipboard history kind (`text`) rather than the normalized search result kind (`clipboard`).
- Classification: integration/test-contract regression.
- Fix commit: `0173f253c574dda727a722f26888f6a0822845ed`.
- Final verified outcome: [run #477](https://github.com/SakibShahariar/gnome-launcher/actions/runs/41618965851) green; 175/175 tests passed and all workflow validation steps completed.
- Remaining follow-up: verify all 15 layouts in a live GNOME session; automated CI cannot verify Shell actor rendering and real activation.
