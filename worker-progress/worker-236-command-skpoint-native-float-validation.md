# Worker 236 - Command SkPoint Native-Float Validation

## Summary

Implemented command `SkPoint` native-float validation in `JSIConverter<NodeCommand>::fromJSI(...)`.
`line.from`, `line.to`, and indexed `points.points[]` coordinates now reject values that are non-finite or outside native `float` range before they can be narrowed into `SkPoint` and before same-type `LineCmd` or `PointsCmd` updates can mutate existing native command state.

Valid line and points payload conversion remains covered by the existing command/render and generated materialization verifier baselines. Existing malformed point container behavior is preserved: non-object point payloads still throw `Expected point object.`, and non-array points payloads still throw `Expected points array.` through the same parser branches.

## Changed Files

- `cpp/JSIConverter+NodeCommand.hpp`
  - Replaced finite-only point coordinate parsing with centralized native-float validation.
  - Added `isValidCommandPointNativeFloat(...)`.
  - Added `parseFiniteNativePointNumber(...)`, which validates before returning `float`.
  - Updated invalid coordinate messaging to `expected a finite native float.`
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Extended direct native command verifier coverage for native-float overflow on all `line.from.x/y`, `line.to.x/y`, `points.points[0].x/y`, and `points.points[1].x/y` branches.
  - Preserved existing NaN/Infinity/-Infinity coverage and command pointer/state preservation checks.
  - Updated source guards and proof text from finite-only point rejection to native-float validation.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Extended generated materialized `YogaNode.setCommand(...)` verifier coverage for native-float overflow on the same line and points coordinate branches.
  - Preserved existing non-finite coverage and prior native command pointer/state preservation checks.
  - Updated source guards and proof text from finite-only point rejection to native-float validation.
- `worker-progress/worker-236-command-skpoint-native-float-validation.md`
  - Added this report.

## Commands Run

- `cat WORKER_BRIEF.md`
- `git status --short`
- `rg ... cpp/JSIConverter+NodeCommand.hpp scripts/verify-yoganode-native-commands-render.mjs scripts/verify-yoganode-nitro-materialization.mjs worker-progress`
- `sed ... cpp/JSIConverter+NodeCommand.hpp`
- `sed ... scripts/verify-yoganode-native-commands-render.mjs`
- `sed ... scripts/verify-yoganode-nitro-materialization.mjs`
- `git diff --check` - passed before and after report creation.
- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-native-commands-render` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run typecheck` - passed.
- `npm run check:feasible-matrix` - passed all 28 matrix commands, including repeated native command/render and Nitro materialization verifiers.

## Evidence Gathered

- The direct native command/render verifier compiled and linked a host executable against the real converter/runtime path and reported:
  - `non-finite and native-float-overflow command point rejection for line.from.x/y, line.to.x/y, and indexed points.points[] x/y payloads`
  - Preservation of the previously installed native `LineCmd` and `PointsCmd` state.
- The generated Nitro materialization verifier compiled and linked a host executable through `YogaNode::toObject(runtime)` and generated JS-facing wrappers and reported:
  - Generated materialized `setCommand(...)` rejects non-finite and native-float-overflow line and points coordinate payloads before mutating existing native `LineCmd` and `PointsCmd` state.
- The focused verifier cases now cover native-float overflow for:
  - `line.from.x`
  - `line.from.y`
  - `line.to.x`
  - `line.to.y`
  - `points.points[0].x`
  - `points.points[0].y`
  - `points.points[1].x`
  - `points.points[1].y`
- The existing non-finite cases remain in place for representative NaN, Infinity, and -Infinity payloads across line and points branches.
- `npm run check:feasible-matrix` passed all 28 accepted local checks and cleaned its matrix-owned temporary parent.

## Proof Boundary and Overclaim Risks

Proven locally:

- Host-native macOS/JSC direct `JSIConverter<NodeCommand>::fromJSI(...)` conversion rejects invalid command point coordinates before same-type `YogaNode::setCommand(...)` mutation.
- Generated materialized `YogaNode.setCommand(...)` wrappers reject the same invalid command point coordinate payloads before same-type native command mutation.
- Existing valid line and points command payloads still install and preserve expected native state.
- The proof covers `LineCmd` and `PointsCmd` `SkPoint` coordinates in `NodeCommand` conversion.

Not proven:

- React Native bridge delivery in an app runtime.
- iOS/Android simulator or device launch.
- CocoaPods or Gradle full native builds.
- UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, or RNGH native delivery.
- Future command payloads not represented by the current public command schema.

## Quality, Maintainability, Performance, and Security Review

- Quality: validation is centralized at the point parser that feeds both direct and generated command conversion, so all command point paths share the same range policy and stable field labels.
- Maintainability: verifier source guards now require the native-float helper and the expanded direct/generated coverage, reducing the chance of drifting back to finite-only point parsing.
- Performance: the added check is a constant-time `std::isfinite` plus `float` max comparison per coordinate; overhead is negligible relative to JSI conversion and rendering.
- Security/robustness: rejecting non-finite and overflowing finite doubles prevents invalid `float`/infinite `SkPoint` state from being installed through untrusted JS payloads.

## Cleanup Status

- Work was limited to the assigned worktree.
- No commits, merges, rebases, or worktree removal were performed.
- No generated artifacts remain from verification according to `git status --short` before report creation.
- `npm run check:feasible-matrix` reported it removed its matrix-owned temp parent and newly created `tsconfig.tsbuildinfo`.
- Expected final dirty files are the three implementation/verifier files plus this report.

## Recommended Next Tasks

- If new command payloads add `SkPoint`-like coordinates, route them through the same native-float point parser or add equivalent source guards.
- Consider whether path stroke `float` leaves should move from finite-only validation to native-float validation in a separately scoped worker.

Goal finished.
