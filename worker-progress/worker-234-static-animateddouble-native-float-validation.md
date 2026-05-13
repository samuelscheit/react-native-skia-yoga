# Worker 234: Static AnimatedDouble Native Float Validation

## Summary

Implemented static `AnimatedDouble` native-float range validation in the native `NodeCommand` converter. Static numeric command payloads now reject non-finite values and finite values outside `float` range before any same-type `YogaNode::setCommand(...)` mutation can apply.

Dynamic Worklets-backed `AnimatedDouble` values remain accepted at command conversion time; dynamic native-float validity remains handled by render-time `AnimatedDouble::resolveNativeFloat()`. Null and undefined static defaults still pass as unset optionals.

## Changed Files

- `cpp/JSIConverter+NodeCommand.hpp`
  - Added static native-float validation using `std::isfinite(...)` and `std::numeric_limits<float>::max()`.
  - Updated static `AnimatedDouble` command rejection message to `expected a finite native float.`
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added direct conversion/setCommand preservation checks for native-float overflow on:
    - `circle.radius`
    - `rrect.cornerRadius`
    - `blurMaskFilter.blur`
    - `path.trimStart`
    - `path.trimEnd`
  - Updated source guards and proof text from finite-only to native-float validation.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added generated materialized `setCommand(...)` preservation checks for native-float overflow on the same five static `AnimatedDouble` fields.
  - Updated source guards and proof text from finite-only to native-float validation.
- `worker-progress/worker-234-static-animateddouble-native-float-validation.md`
  - Added this report.

## Commands Run

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `git diff --check`: passed before focused verification and passed again after the feasible matrix.
- `npm run check:yoganode-native-commands-render`: passed. The host probe compiled/linked and asserted direct static `AnimatedDouble` non-finite plus native-float-overflow rejection before same-type command mutation, while retaining dynamic Worklets-backed command behavior.
- `npm run check:yoganode-nitro-materialization`: passed. The host probe compiled/linked and asserted generated materialized `setCommand(...)` non-finite plus native-float-overflow static `AnimatedDouble` rejection before same-type command mutation.
- `npm run typecheck`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 30s, including the rerun focused command/render and Nitro materialization verifiers, `npm run typecheck`, `npm run lint-ci`, `bun run specs`, example bundle export, and example native generation probes.

Note: npm printed the existing `minimum-release-age` config warning during npm commands; it did not affect command exit status.

## Evidence Gathered

- Direct converter proof:
  - `check:yoganode-native-commands-render` now covers `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd` native-float overflow values.
  - Each case checks the existing command pointer and native command state remain unchanged after rejection.
- Generated materialized proof:
  - `check:yoganode-nitro-materialization` now covers the same five fields through materialized generated `setCommand(...)` wrappers.
  - Each case checks same-type native command state remains unchanged after rejection.
- Dynamic preservation:
  - Existing dynamic `AnimatedDouble` command/render assertions still pass in focused verification and in the full feasible matrix.

## Proof Boundary And Overclaim Risks

This proves host-JSC/native converter behavior and generated materialized wrapper delivery for selected static `AnimatedDouble` command fields. It does not prove React Native bridge delivery, Nitro registry install in a real app runtime, iOS/Android simulator/device launch, native platform presentation, UI-runtime Worklets execution, real Reanimated delivery, RNGH delivery, or exhaustive rendering fidelity beyond the existing host probes.

The static validation policy is centralized in `JSIConverter<NodeCommand>::fromJSI(...)`; future static `AnimatedDouble` command fields must use the same helper or add equivalent native-float validation.

## Cleanup Status

- No unrelated files were edited.
- The feasible matrix removed its temporary parent under `/tmp` and removed its generated `tsconfig.tsbuildinfo`.
- Final worktree changes are the three intended code/verifier files plus this report.

## Recommended Next Tasks

- Orchestrator review and merge.
- If new static `AnimatedDouble` command fields are added later, extend the converter inventory and both direct/generated verifier tables in the same pattern.

Goal finished.
