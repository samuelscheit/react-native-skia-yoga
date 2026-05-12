# Worker 216 Radius Finite Validation

## Summary

Implemented deterministic pre-mutation finite-number validation for YogaNode radius style payloads.

## Changed files

- `cpp/YogaNode.cpp`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-216-radius-finite-validation.md`

## Implementation

- Added `validateFiniteRadiusStyleFields(...)` before `invalidateLayout()`, `_style = style`, Yoga reset, paint/layer/clip/radius/matrix resets, and computed-layout invalidation.
- Rejects non-finite scalar `borderRadius`.
- Rejects non-finite scalar per-corner radii and non-finite `SkPoint.x` / `SkPoint.y` for all four corner radius fields.
- Preserved existing range semantics: no non-negative enforcement, no clamping.
- Added materialized verifier source guards for public/generated/native radius inventory and validation ordering.
- Added generated wrapper negative coverage for `borderRadius`, all per-corner scalar branches, and all per-corner `SkPoint` x/y branches.

## Commands run

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-nitro-materialization`
- `git diff --check`
- `npm run check:feasible-matrix`

## Evidence

- `node --check scripts/verify-yoganode-nitro-materialization.mjs` passed.
- `npm run check:yoganode-nitro-materialization` passed. The verifier compiled and ran the host-JSC Nitro materialization probe and reported radius finite rejection coverage for non-finite `borderRadius`, all per-corner scalar branches, and all per-corner `SkPoint` x/y payload branches while preserving prior `_style` radius fields, `_clipToBoundsRadii`, explicit clip state, `_paint`, Yoga, layer, matrix, and computed layout.
- `git diff --check` passed.
- `npm run check:feasible-matrix` passed all 28 child checks in 4m 25s, including its nested `check:yoganode-nitro-materialization`.

## Proof boundary

The proof covers local host-JSC materialized Nitro `setStyle(...)` wrappers, real `YogaNode.cpp` native execution, source inventory/order guards, and feasible local package/source/example metadata checks. It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, Reanimated delivery, RNGH native delivery, or exact render fidelity beyond existing asserted pixels and clipping predicates.

## Cleanup status

The feasible matrix removed its owned temp parent and the generated `tsconfig.tsbuildinfo`. Final worktree changes are scoped to the files listed above.

## Recommended next tasks

- Merge with the current orchestrator-selected worker queue after reviewing overlap with adjacent YogaNode validation workers.
- Consider a future shared helper for finite validation of generated point-like structs if more `SkPoint` style payloads become public.

Goal finished.
