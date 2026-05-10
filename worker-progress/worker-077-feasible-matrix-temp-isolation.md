# Worker 077 - Feasible-matrix temp isolation

## Goal Lifecycle

- `create_goal` objective: `Harden feasible-matrix temp isolation and flaky aggregate verifier diagnostics.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Harden feasible-matrix temp isolation and flaky aggregate verifier diagnostics.`

## Scope And Files Changed

- Added shared temp helper: `scripts/verifier-temp-utils.mjs`.
- Updated aggregate runner: `scripts/verify-feasible-matrix.mjs`.
- Updated temp-root child verifiers:
  - `scripts/verify-example-bundle-export.mjs`
  - `scripts/verify-example-native-generation.mjs`
  - `scripts/verify-package-codegen-autolinking.mjs`
  - `scripts/verify-package-lifecycle.mjs`
  - `scripts/verify-package-typescript-consumer.mjs`
  - `scripts/verify-rnsk-yoga-view-runtime.mjs`
  - `scripts/verify-yoganode-native-hit-testing.mjs`
  - `scripts/verify-yoganode-native-lifetime.mjs`
  - `scripts/verify-yoganode-native-runtime-smoke.mjs`

## Required Context Read

- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-076-post-075-root-cause-audit.md`
- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-example-native-generation.mjs`
- `scripts/verify-yoganode-native-hit-testing.mjs`
- Other temp-root verifiers listed above, especially host-native and package/example verifiers.

## Reproduction And Root Cause

I did not reproduce worker 076's exact failures on the first clean attempt:

- Pre-fix `npm run check:feasible-matrix`: passed all 24 commands in `3m 18s`.
- Pre-fix targeted loop, two iterations of `npm run check:yoganode-native-hit-testing` plus `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`: passed.

The code still had a real aggregate reliability gap:

- The old matrix scanned shared temp roots (`tmpdir()` and `/tmp`) and removed new `rnskia-*` prefix roots by name/time.
- Child verifiers also created their roots directly under those shared temp parents.
- Therefore one aggregate run could delete another run's active verifier-owned temp root if the other run started after the first run's initial snapshot. That matches the worker 076 linker symptom: `ld` could not open the output binary under an existing-looking `rnskia-yoganode-hit-testing-*` path.

Rejected or narrowed hypotheses:

- Symlinked worker `node_modules` is present in this worktree, but the affected example native-generation verifier asserts the temporary example package link resolves to the temp package root, and packed package verifiers install from tarballs. I did not find evidence that symlinked dependencies caused the failures.
- Child self-cleanup alone is unlikely: the host-native verifiers remove their own temp roots in `finally`; leftover roots are more consistent with interruption or aggregate/global cleanup races.
- Preservation sentinels are a separate workspace-concurrency/stale-sentinel problem. I hardened them with unique probe-owned names and ignored preservation-sentinel entries during non-sentinel comparison, without deleting pre-existing local artifacts.

## Implementation

- `scripts/verify-feasible-matrix.mjs` now creates one matrix-owned temp parent with prefix `rnskia-feasible-matrix-`.
- The matrix passes that parent to children through `RNSKIA_YOGA_VERIFY_TEMP_PARENT`; it no longer scans or cleans shared system temp roots.
- Temp-root child verifiers honor `RNSKIA_YOGA_VERIFY_TEMP_PARENT` through `scripts/verifier-temp-utils.mjs` and keep standalone behavior when the variable is absent.
- The matrix removes only known workspace artifacts plus its own temp parent. It prints the matrix temp parent before removal and still preserves pre-existing local artifacts.
- Host-native link verifiers now include diagnostics for compile/link failures, missing output binaries, and execution failures, including temp parent, temp root, probe source, binary output, and output parent state.
- React Native CLI dependency-missing assertions now print config roots, dependency keys, expected package roots, and relevant `node_modules` path diagnostics in the temp workspace/consumer.

No retry behavior was added.

## Verification

Syntax:

- `node --check` for all changed scripts: passed.

Affected standalone commands:

- `npm run check:yoganode-native-hit-testing`: passed.
- `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`: passed.
- `RNSKIA_YOGA_VERIFY_TEMP_PARENT=<temp> node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`: passed and left the explicit parent empty.
- `npm run check:package-lifecycle`: passed after one matrix-only transient npm peer install failure.
- `RNSKIA_YOGA_VERIFY_TEMP_PARENT=<temp> npm run check:package-lifecycle`: passed.

Aggregate matrix:

- Post-fix matrix attempt 1 failed at command 24 because my first unique-sentinel change did not ignore all preservation sentinel names in the non-sentinel directory comparison. Fixed before acceptance.
- Post-fix matrix attempt 2 failed at command 4 with a transient third-party `@shopify/react-native-skia` lifecycle install error (`TAR_ENTRY_ERROR` and missing optional Skia package). The same command passed immediately standalone and with an explicit verifier temp parent. No retry behavior was added.
- One streamed/captured matrix attempt lost its tool session while host-native compile was active; I terminated the orphaned verifier process and removed only its `rnskia-feasible-matrix-*` temp parent. No acceptance evidence is claimed from that attempt.
- Heartbeat-wrapped `npm run check:feasible-matrix`: passed all 24 commands in `3m 23s`.
- Consecutive heartbeat-wrapped `npm run check:feasible-matrix`: passed all 24 commands in `2m 47s`.

Other checks:

- `git diff --check`: passed.
- Final process probe found no active `verify-feasible-matrix`, verifier child, or `clang++` verifier process.
- Final temp probe found no verifier-owned temp roots under `tmpdir()`, `/tmp`, or `/private/tmp` except pre-existing `/tmp/rnskia-example-export.bE7set` / `/private/tmp/rnskia-example-export.bE7set`, which was present before this worker and preserved.
- Final workspace artifact probe found no `example/ios`, `example/android`, `example/.expo`, `tsconfig.tsbuildinfo`, `example/tsconfig.tsbuildinfo`, or repo-root tarball. Ignored dependency symlinks remain: `node_modules`, `example/node_modules`.

## Nested Challenger Documentation

- Nested challenger: `/root/temp_isolation_challenger`.
- Prompt:

```text
You are a read-only challenger for worker 077 in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-077-feasible-matrix-temp-isolation. Do not edit files. Inspect only the relevant scripts and package metadata. Challenge this hypothesis: the flaky aggregate failures after worker 075 are caused by child verifiers creating temp roots directly under shared system temp and by the aggregate runner not passing a per-run temp parent, so the fix should add a matrix-owned temp parent env var, make temp-root child verifiers honor it, and improve diagnostics for missing linker output dirs and missing react-native-skia-yoga in RN CLI config. Please answer concisely with: (1) whether the hypothesis fits the scripts and worker 076 evidence, (2) any stronger or rejected hypotheses including symlinked node_modules and preservation sentinels, (3) exact scripts likely needing changes, and (4) any risks in the proposed temp-parent env approach. If you cannot finish promptly, say so; no acceptance evidence should be inferred.
```

- Result: completed. It agreed the global-temp cleanup race fit the linker-output symptom, ranked preservation sentinels as a separate strong explanation for one worker 076 failure mode, ranked symlinked `node_modules` lower, listed the temp-root child scripts changed here, and warned not to use generic `TMPDIR` or keep global temp cleanup in the matrix.

## Review

Quality:

- The fix removes the cross-run shared-temp deletion surface instead of adding retries.
- Diagnostics now expose enough path/config state to distinguish missing temp dirs, missing linker outputs, and missing RN CLI dependency metadata.

Maintainability:

- Temp-parent behavior is centralized in one small helper.
- Child verifier standalone behavior remains simple: no env var is required outside the matrix.

Performance:

- No extra verifier work was added. Matrix overhead is one `mkdtemp` plus final temp-parent removal.

Security:

- Commands remain structured spawns; no new shell interpolation was added to repo scripts.
- The env var is package-specific (`RNSKIA_YOGA_VERIFY_TEMP_PARENT`), not generic `TMPDIR`.
- Cleanup is constrained to the matrix-owned temp parent and known workspace artifacts.
