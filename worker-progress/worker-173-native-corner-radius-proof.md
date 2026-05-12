# Worker 173 Native Corner Radius Proof

## Summary

Added lower-stack proof for style corner radii delivered through generated/materialized `setStyle(...)` and native hit-test clipping.

`scripts/verify-yoganode-nitro-materialization.mjs` now exercises generated JS-facing `setStyle(...)` from a materialized YogaNode object with all four SkPoint-capable style corner keys. The probe asserts `borderTopLeftRadius` and `borderBottomRightRadius` materialize as generated `SkPoint` variants, `borderTopRightRadius` and `borderBottomLeftRadius` materialize as scalar variants, `_clipsToBounds` is enabled, `_clipToBoundsRadii` contains the expected per-corner radii, and no explicit `style.clip` state is populated.

`scripts/verify-yoganode-native-hit-testing.mjs` now adds a direct native hit-test case where style corner radii clip a full-size child, distinct from the existing overflow and explicit `style.clip` cases.

## Changed Files

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-yoganode-native-hit-testing.mjs`
- `worker-progress/worker-173-native-corner-radius-proof.md`

## Commands Run

- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-yoganode-native-hit-testing.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH git diff --check`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-native-hit-testing`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix`

All commands passed.

## Evidence Gathered

- Generated `NodeStyle.hpp` is source-guarded for all four `std::optional<std::variant<double, SkPoint>>` corner fields and their generated property reads.
- Materialized `setStyle(...)` now proves `{ x, y }` delivery for `borderTopLeftRadius` and `borderBottomRightRadius`, scalar delivery for the other two corner keys, and native `_clipToBoundsRadii` mapping to `SkRRect` corner slots.
- Materialized style corner radii are proven separate from explicit `style.clip`: `_style.clip`, `_clipPath`, `_clipRect`, and `_clipRRect` remain empty.
- Native hit testing now proves rounded style bounds reject clipped top-left and bottom-right corner points while allowing points inside the rounded bounds and an unset square corner.
- `check:feasible-matrix` passed all 28 commands, including the edited native hit-testing and materialization verifiers.

## Proof Boundary And Overclaim Risks

This proves host-JSC Nitro materialization and host-native macOS C++ verifier behavior only. It does not prove React Native bridge delivery, Nitro registry installation inside a React Native runtime, iOS/Android app build or launch, simulator/device presentation, UI-runtime Worklets execution, Reanimated SharedValue delivery, RNGH native delivery, exact raster fidelity, or platform rendering fidelity.

The hit-test evidence is bounded to native `YogaNode::hitTestTagAt` / `hitTestInternal` traversal with direct interaction-field setup, matching the existing verifier boundary.

## Cleanup Status

No source cleanup was needed. I did not remove or modify ambiguous local artifacts such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, or pre-existing build info. The feasible matrix used and removed its own temp parent and reported no remaining new tracked artifacts.

## Recommended Next Tasks

- Add bounded raster evidence for style corner-radius clipping if the orchestrator wants render proof in addition to hit-test proof.
- A future platform worker can test the same style corner-radius behavior through an actual React Native app runtime if needed.

## Nested-Agent Findings

No nested agents were used.

Goal finished.
