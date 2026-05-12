# Worker 218 - Command Point Finite Validation

## Summary

Implemented deterministic finite-number rejection for command `SkPoint` payloads during `JSIConverter<NodeCommand>::fromJSI(...)` conversion. Non-finite `line.from.x/y`, `line.to.x/y`, and indexed `points.points[]` `x/y` values now throw before a `NodeCommand` is produced, so generated or manual conversion paths cannot call `YogaNode::setCommand(...)` with those invalid payloads.

## Changed Files

- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-218-command-point-finite-validation.md`

## Implementation

- Added `parseFinitePointNumber(...)` and path-specific command point errors such as `line.from.x` and `points.points[1].y`.
- Updated line conversion to parse `line.from` and `line.to` through the finite point parser.
- Updated points array conversion to pass an indexed point path for every element.
- Added native command/render negative coverage for NaN, Infinity, and -Infinity across line and points point axes, proving prior LineCmd/PointsCmd state and command pointers are preserved.
- Added generated materialized `setCommand(...)` negative coverage proving the generated wrapper rejects the same non-finite payloads before mutating existing native command state.
- Added drift guards for public command specs, Reconciler command builders, native point parsing labels/order, native verifier coverage, and generated materialized verifier coverage.

## Commands Run

- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed
- `npm run check:yoganode-native-commands-render` - passed
- `npm run check:yoganode-nitro-materialization` - passed
- `git diff --check` - passed
- `npm run check:feasible-matrix` - passed all 28 matrix commands in 4m 24s

## Evidence

- Native command/render verifier reports non-finite command point rejection for `line.from.x/y`, `line.to.x/y`, and indexed `points.points[]` `x/y` payloads with NaN, Infinity, and -Infinity while preserving previously installed native LineCmd/PointsCmd state.
- Nitro materialization verifier reports generated materialized `setCommand(...)` rejects the same non-finite command point payloads before mutating existing native LineCmd/PointsCmd state.
- Feasible matrix reran both updated command verifiers as part of the 28-command local proof and passed.

## Proof Boundary

This proves host-JSC/native conversion and generated materialized wrapper behavior in the local macOS verifier environment. It does not prove actual React Native bridge delivery, Nitro registry install in a React Native runtime, iOS/Android app build/run, simulator/device launch, UI-runtime Worklets execution, or device rendering behavior.

## Cleanup Status

No manual cleanup was needed. `npm run check:feasible-matrix` removed its matrix temp parent and its generated `tsconfig.tsbuildinfo`; remaining tracked changes are scoped to this worker.

## Recommended Next Tasks

- Review whether other command numeric payloads should get the same deterministic finite-number rejection policy.
- Consider a follow-up audit for command-level finite validation that is not `SkPoint`-specific.

Goal finished.
