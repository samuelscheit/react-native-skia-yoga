# Worker 171: Corner-Radius Dynamic Proof

## Summary

Added representative public and Reconciler proof for SkPoint-capable dynamic style corner radii, focused on `style.borderTopLeftRadius`.

- Packed package consumer TypeScript now accepts `borderTopLeftRadius` as `SharedValue<number>`, `SharedValue<SkPoint>`, and `{ x, y }` with `SharedValue<number>` leaves.
- Packed package consumer TypeScript now rejects an invalid corner-radius point leaf with `@ts-expect-error`.
- Reconciler Node VM proof now covers nested `{ x, y }` SharedValue leaves and whole `SharedValue<SkPoint>` snapshots/updates for `style.borderTopLeftRadius`.
- Reconciler proof asserts stable listener keys, initial snapshots, `runOnJS` update payloads, full style rebuilds, invalidation, cleanup, ignored late emits, no native mirrors, and explicit invalid-shape errors.

## Changed Files

- `scripts/verify-package-typescript-consumer.mjs`
  - Added public `SkPoint` import in the packed consumer source.
  - Added dynamic corner-radius consumer props for scalar SharedValue, whole SkPoint SharedValue, and nested x/y SharedValue leaves.
  - Added invalid nested point leaf negative coverage.
  - Updated verifier summary output.
- `scripts/verify-reconciler-animated-bindings.mjs`
  - Added corner-radius explicit error message constants.
  - Added `verifyCornerRadiusStyleSharedValuesUseJsStyleDelivery()`.
  - Added nested leaf, whole SkPoint SharedValue, and invalid-shape Reconciler checks.
  - Updated verifier summary output.
- `worker-progress/worker-171-corner-radius-dynamic-proof.md`
  - Added this report.

## Commands Run

- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-package-typescript-consumer.mjs` - passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-reconciler-animated-bindings.mjs` - passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:package-typescript-consumer` - passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:reconciler-animated-bindings` - first run failed because a VM-created point object was compared to an outer-context literal with `assert.deepEqual`; changed those assertions to field-level checks, then reran and passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization` - passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-native-hit-testing` - passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix` - passed all 28 commands in 4m 35s.
- `git diff --check` - passed.

## Evidence Gathered

- Packed consumer proof output explicitly reports acceptance of `style.borderTopLeftRadius` as `SharedValue<number>`, `SharedValue<SkPoint>`, and nested `{ x, y }` `SharedValue<number>` leaves, and rejection of invalid point leaves.
- Reconciler proof output explicitly reports dynamic SkPoint-capable `style.borderTopLeftRadius` coverage for nested leaves and whole SkPoint SharedValue snapshots/updates with stable keys, full rebuilds, invalidation, cleanup, ignored late emits, explicit errors, and no native command mirrors.
- Direct native materialization and hit-testing checks still passed after these proof-only script changes.
- Feasible matrix re-ran the updated package consumer and Reconciler verifier, plus package/source/example/native host probes, and passed end to end.

## Proof Boundary and Overclaim Risks

- This proves public packed TypeScript acceptance/rejection and Node VM source-level Reconciler behavior only.
- It does not prove React Native bridge delivery, Nitro registry install in a React Native runtime, iOS/Android platform build or launch, UI-runtime Worklets execution, real Reanimated SharedValue delivery, native presentation, exact pixel rendering, or exact render fidelity.
- The public proof uses representative `borderTopLeftRadius`; the same public type machinery covers the other SkPoint-capable corner keys, but this report does not claim separate per-key runtime proof for all four keys.

## Cleanup Status

- No ambiguous local artifacts were removed.
- Preserved local artifact directories such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, and `lib`.
- The feasible matrix removed its matrix-owned temp parent and a generated `tsconfig.tsbuildinfo` artifact it owned during cleanup.
- Current worktree changes are scoped to the two verifier scripts and this report.

## Recommended Next Tasks

- Add a small inventory-driven Reconciler sweep if the project wants explicit per-key proof for all four SkPoint-capable corner radius keys.
- Add RN/runtime-level Reanimated delivery proof only when the test environment can exercise real UI-runtime Worklets and native presentation without overclaiming.

## Nested-Agent Findings

- No nested agents were spawned.

Goal finished.
