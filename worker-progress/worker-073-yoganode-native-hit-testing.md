# Worker 073 - YogaNode native hit-testing verifier

## Goal Lifecycle

- `create_goal` objective: `Add a host-native YogaNode hit-testing runtime verifier.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Add a host-native YogaNode hit-testing runtime verifier.`
- Pre-report `get_goal` evidence showed status `active`, the same objective, `tokensUsed: 138262`, and `timeUsedSeconds: 541`.

## Files Changed

- Added `scripts/verify-yoganode-native-hit-testing.mjs`.
- Added root package script `check:yoganode-native-hit-testing`.
- Added `check:yoganode-native-hit-testing` to `scripts/verify-feasible-matrix.mjs`.
- Added the matrix cleanup prefix `rnskia-yoganode-hit-testing-`.
- Added this report.

## Implementation Summary

- The new verifier follows the existing `verify-yoganode-native-runtime-smoke.mjs` compile/link model.
- It writes a temporary host C++ probe, compiles/links it with `clang++` against real `cpp/YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, upstream Yoga sources, required JSI/Nitro/RN Skia helper sources, and RN Skia macOS archives.
- The host binary executes real `YogaNode::hitTestTagAt()` / `YogaNode::hitTestInternal()` calls.
- The C++ probe uses public native methods for tree/layout flow: `setStyle`, `insertChild`, `removeChild`, `removeAllChildren`, `computeLayout`, and `hitTestTagAt`.
- A minimal host-only `PreciseRectCommand` subclass proves precise-hit positive and negative behavior through the real `YogaNodeCommand` precise-hit interface.

## Coverage And Proof Boundary

Covered by the host runtime verifier:

- `pointerEvents` modes: `auto`, `none`, `box-only`, and `box-none`.
- Reverse child traversal and topmost child wins.
- Parent-to-local coordinate translation through Yoga layout positions.
- Inverse matrix transforms through `NodeStyle.matrix`.
- `overflow: hidden` clips-to-bounds behavior.
- Explicit clip `SkRect`, `SkPath`, `SkRRect`, and `invertClip`.
- Numeric/uniform and edge-specific `HitSlopInsets` expansion semantics.
- Precise-hit positive and negative cases with a minimal command subclass.
- Interactive descendant count updates after enabling, clearing, `removeChild`, `removeAllChildren`, and reparenting.

Boundary:

- The verifier directly sets `_pointerEvents`, `_hitSlop`, `_preciseHit`, and `_eventTag`, then calls `updateSelfInteractionState()`, because `setInteractionConfig()` is a JSI method and this host verifier intentionally avoids JS runtime setup.
- That direct setup is a test boundary for the JSI config parser only. The exercised hit-test traversal, layout translation, matrix inversion, clipping, precise-hit command dispatch, and interactive count propagation are the real native runtime path.
- HitSlop numeric/object parsing in `setInteractionConfig()` is not claimed here; this verifier proves the already-normalized native hitSlop state used by hit testing.
- No iOS/Android app build/run, simulator/device behavior, RNGH native delivery, Worklets UI-runtime execution, or end-to-end app runtime proof is claimed.

## Nested Challenger

- No nested agents were used.
- No nested challenger acceptance evidence is claimed.

## Verification Results

- `node --check scripts/verify-yoganode-native-hit-testing.mjs`: passed.
- `node --check scripts/verify-feasible-matrix.mjs`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
  - The verifier compiled and linked the host executable.
  - It executed assertions for pointer events, z-order, coordinate translation, matrix inversion, clipping, hitSlop, precise-hit geometry, and interactive descendant count propagation.
- `npm run check:feasible-matrix`: passed.
  - Matrix command count: 23.
  - New command included as `[16/23] npm run check:yoganode-native-hit-testing`.
  - New command duration: `24.5s`.
  - Total command duration: `2m 50s`.
  - Cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Remaining new tracked artifacts after matrix cleanup: none.
- `git diff --check`: passed.

## Cleanup Status

- Repo cleanup probe for `tsconfig.tsbuildinfo`, root `*.tgz`, package temp names, example temp names, and YogaNode temp names returned empty output.
- `/tmp` cleanup probe for package/example/YogaNode temp names returned empty output.
- `os.tmpdir()` cleanup probe at `/var/folders/th/kc95m5nd2lq44bmk410n5jg80000gn/T` for package/example/YogaNode temp names returned empty output.
- `example/ios`, `example/android`, and `example/.expo` probe returned empty output.
- Final expected `git status --short --ignored=matching` after writing this report:
  - `M package.json`
  - `M scripts/verify-feasible-matrix.mjs`
  - `?? scripts/verify-yoganode-native-hit-testing.mjs`
  - `?? worker-progress/worker-073-yoganode-native-hit-testing.md`
  - `!! example/node_modules`
  - `!! node_modules`

## Quality, Maintainability, Performance, And Security Review

- Quality: the new proof targets the previously untested native hit-test behavior instead of another source-only check.
- Maintainability: the C++ probe is grouped by behavior and the JS harness matches the existing native runtime smoke conventions.
- Performance: the added matrix cost was `24.5s`, keeping the aggregate feasible matrix under three minutes locally in this run.
- Security: command execution uses structured `spawnSync` arguments, temp files are constrained to `mkdtempSync(os.tmpdir())`, and cleanup removes only verifier-owned temp output.
