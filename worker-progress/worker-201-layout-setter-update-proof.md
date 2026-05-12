# Worker 201: Layout Setter Update Proof

## Summary

Extended `scripts/verify-yoganode-nitro-materialization.mjs` with a bounded generated-wrapper host-JSC proof that reuses the same materialized parent/child `YogaNode` objects across sequential `setStyle(...)` calls.

The new proof applies an initial layout style, an updated layout style, and a cleanup/reset style through generated JS-facing wrappers. It asserts native `NodeStyle` optionals, selected Yoga style getters, stale optional cleanup, Yoga style reset behavior, layout invalidation, `computeLayout(...)`, and generated `layout` getter values.

## Changed Files

- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added helpers for undefined/default Yoga value assertions and generated layout getter assertions.
  - Added initial/update/cleanup sequential style builders.
  - Added `assertGeneratedMaterializedSequentialLayoutUpdates(...)`.
  - Wired the proof into the host-JSC native probe and verifier output.
- `worker-progress/worker-201-layout-setter-update-proof.md`
  - Added this report.

## Commands Run

- `git diff --check` - passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run check:feasible-matrix` - passed all 28 commands.

During calibration, one verifier run exposed expected-value mismatches for Yoga `content-box` sizing and rounded percent absolute layout. I updated only the expected computed layout values to match the exercised Yoga semantics, then reran the verifier successfully.

## Evidence Gathered

- The standalone materialization verifier compiled and linked the host executable against real `YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, Nitro, JSC, Yoga, Worklets helper sources, and RN Skia macOS archives.
- The executable now reports the same-node sequential proof explicitly:
  - initial generated `setStyle(...)` delivery,
  - update generated `setStyle(...)` delivery,
  - cleanup/reset generated `setStyle(...)` delivery,
  - stale native `_style` optional cleanup,
  - selected Yoga getter updates and resets,
  - invalidation after update,
  - computed native/generated layout values.
- The sequential payload covers representative dynamic layout categories: width/height, min/max constraints, flexBasis, gap/rowGap/columnGap, flexGrow/flexShrink, alignContent, alignSelf, flexWrap, direction, display, boxSizing, position, edge/inset fields, percent values, and auto values.
- The feasible matrix reran the updated verifier as step 20 and passed the full local matrix.

## Proof Boundary and Overclaim Risks

This proves generated materialized host-JSC wrapper delivery into native Yoga style state and selected computed layout values for bounded sequential layout style updates.

It does not prove actual React Native bridge delivery, Nitro registry installation in a React Native runtime, UI-runtime Worklets/Reanimated delivery, iOS/Android build/run, simulator/device/native presentation, exact Yoga conformance beyond asserted values, exhaustive layout combinations, render fidelity, or every style field combination.

## Cleanup Status

- Matrix temp parent was removed by `check:feasible-matrix`.
- Matrix-created `tsconfig.tsbuildinfo` was removed by matrix cleanup.
- Final intentional working tree changes are limited to:
  - modified `scripts/verify-yoganode-nitro-materialization.mjs`,
  - new `worker-progress/worker-201-layout-setter-update-proof.md`.

## Final Git Status Summary

- Branch: `worker/201-layout-setter-update-proof`.
- Modified: `scripts/verify-yoganode-nitro-materialization.mjs`.
- New report: `worker-progress/worker-201-layout-setter-update-proof.md`.

## Recommended Next Tasks

- If the orchestrator wants the next gap, move from host-JSC materialized wrapper proof toward a runtime-installed React Native/Nitro path on a platform target.
- Keep any broader Yoga conformance work separate from this proof; this verifier is intentionally bounded around generated delivery and selected layout evidence.

Goal finished.
