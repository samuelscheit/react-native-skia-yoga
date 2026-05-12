# Worker 214: Matrix / Transform Finite Validation

## Summary

Implemented deterministic finite-number validation for `style.matrix` and
`style.transform` payloads before `YogaNode::setStyle(...)` mutates native
state.

The initial Worker 214 agent and recovery agent both stalled without producing
a report or commit. Orchestration preserved the partial worker-owned patch,
verified it, completed this report, and committed the branch from the isolated
Worker 214 worktree.

## Changed Files

- `cpp/JSIConverter+SkMatrix.hpp`
- `cpp/YogaNode.cpp`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-214-matrix-transform-finite-validation.md`

## Implementation

- Added public matrix-array finite checks in the custom SkMatrix JSI
  converters before RN Skia narrows 16-value public matrix arrays to a 3x3
  `SkMatrix`.
- Added `YogaNode::setStyle(...)` pre-mutation validation for:
  - `std::shared_ptr<SkMatrix>` style payloads.
  - 9-value and 16-value matrix tuple payloads.
  - Every current generated transform operation: `rotateX`, `rotateY`,
    `rotateZ`, `scale`, `scaleX`, `scaleY`, `translateX`, `translateY`,
    `skewX`, and `skewY`.
- Kept validation before `invalidateLayout()`, `_style` assignment, Yoga style
  reset, paint/layer/clip/matrix reset, and computed-layout changes.
- Added compile-time drift guards so unsupported future matrix/transform
  variants fail compilation instead of silently bypassing validation.
- Expanded the generated materialized verifier with source guards and negative
  host-JSC cases for non-finite matrix arrays, SkMatrix host objects, and
  transform leaves.

## Commands Run

- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `git diff --check` - passed.
- `npm run check:feasible-matrix` - passed all 28 commands in `5m 11s`.

The full feasible matrix also removed its generated `tsconfig.tsbuildinfo`
artifact and cleaned its temp parent `/tmp/rnskia-feasible-matrix-2Lwy7S`.

## Evidence

- The materialized verifier now proves deterministic rejection for:
  - Non-finite 9-value matrix array elements.
  - Non-finite 16-value matrix array elements, including slots outside RN
    Skia's 3x3 projection.
  - Non-finite `SkMatrix` host-object entries.
  - Non-finite transform leaves for every current public operation.
- Rejection preserves previous selected `_style`, `_matrix`, `_paint`, Yoga,
  clip/radius, layer, and computed-layout state in the generated materialized
  host-JSC harness.
- Existing valid behavior remains covered: 9-value matrix arrays, 16-value
  matrix arrays, single-operation transform variants, non-empty transform
  precedence over matrix, empty-transform fallback to matrix, and
  empty-transform no-matrix reset.
- Source guards tie together the public `Transform` inventory, generated
  `NodeStyle` transform variants, native validator branches, and transform
  application branches.

## Proof Boundary

Proven:

- Matrix-array and `SkMatrix` finite validation for generated materialized
  `setStyle(...)` delivery.
- Transform-leaf finite validation for every current public transform
  operation.
- Pre-mutation preservation of prior native style, paint, Yoga, clip/radius,
  layer, matrix, and computed layout state.

Not proven:

- Exhaustive numeric validation for all style or command payloads.
- Radius scalar / `SkPoint` finite validation.
- Command numeric payload finite validation.
- Hit-slop numeric finite validation.
- Range semantics such as non-negative dimensions, opacity clamping, radius
  bounds, or transform angle limits.
- React Native bridge delivery, Nitro registry install in a real React Native
  runtime, iOS/Android app build/run, simulator/device presentation,
  UI-runtime Worklets execution, Reanimated delivery, or RNGH delivery.

## Cleanup Status

- Worktree status before report showed only expected ignored dependency
  symlinks: `node_modules` and `example/node_modules`.
- No generated native folders, tarballs, or temp matrix roots were left behind.

## Recommended Next Tasks

- Run a post-Worker 214 root-cause audit before accepting the proof boundary.
- Likely remaining validation surfaces include radius scalar / `SkPoint`
  payloads, command numeric payloads, and interaction hit-slop inputs.

Goal finished.
