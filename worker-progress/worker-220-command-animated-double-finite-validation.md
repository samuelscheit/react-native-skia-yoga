# Worker 220 - Command AnimatedDouble finite validation

## Summary

- Added deterministic finite-number validation for static numeric `AnimatedDouble` command payloads during `JSIConverter<NodeCommand>::fromJSI(...)`.
- Covered `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd`.
- Preserved dynamic Worklets `Synchronizable` extraction and existing dynamic command render behavior.
- Added native command/render and generated Nitro materialization verifier coverage proving rejection happens before same-type native command state is mutated.

## Changed Files

- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-220-command-animated-double-finite-validation.md`

## Implementation

- Introduced `parseStaticFiniteAnimatedDouble(...)` in the NodeCommand converter.
- The helper converts through the existing `JSIConverter<AnimatedDouble>` path, then rejects only static numeric values whose `AnimatedDouble.value` is `NaN`, `Infinity`, or `-Infinity`.
- Dynamic object payloads still route through Worklets `Synchronizable` extraction unchanged.
- Replaced the five static command-field conversions with the finite-validating helper and stable labels:
  - `circle.radius`
  - `rrect.cornerRadius`
  - `blurMaskFilter.blur`
  - `path.trimStart`
  - `path.trimEnd`
- Added source/inventory/order guards for public command specs, Reconciler command inventories/builders, native parsing labels/order, native verifier coverage, and generated materialized verifier coverage.
- Added negative verifier cases for all five fields with representative `NaN`, `Infinity`, and `-Infinity` payloads.

## Commands Run

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `git diff --check`: passed.
- `npm run check:feasible-matrix`: passed all 28 matrix commands in 4m 48s.

## Evidence

- Native command/render verifier now asserts static `AnimatedDouble` non-finite rejection before `YogaNode::setCommand(...)` can mutate `CircleCmd`, `RRectCmd`, `BlurMaskFilterCmd`, or `PathCmd` state.
- Generated materialization verifier now asserts the same rejection path through generated JS-facing `setCommand(...)` wrappers.
- Both verifiers preserve existing dynamic `Synchronizable` command coverage for the same five fields.
- `npm run check:feasible-matrix` reran the nested command/render and materialization checks successfully and reported no remaining new tracked artifacts after cleanup.

## Proof Boundary

- Proven: host-JSC/native conversion rejects non-finite static numeric command `AnimatedDouble` payloads for the five scoped fields before same-type native command state mutation.
- Proven: generated Nitro materialized `setCommand(...)` wrapper delivery reaches the same conversion rejection before same-type native command state mutation.
- Proven: scoped dynamic Worklets-backed `AnimatedDouble` command extraction/resolution coverage still passes.
- Not proven: iOS/Android app build/run, simulator/device launch, platform UI presentation, UI-runtime Worklets execution, real Reanimated delivery, exact GPU render fidelity, or exhaustive future command fields outside this inventory.

## Cleanup Status

- No repo temp artifacts remain from the matrix run.
- `git status --short` before report creation showed only the three intended tracked edits.
- `git diff --check` passed after the matrix run.

## Recommended Next Tasks

- No immediate follow-up is required for this worker scope.
- Future workers adding static numeric `AnimatedDouble` command fields should extend the converter labels and both verifier inventories in the same change.

Goal finished.
