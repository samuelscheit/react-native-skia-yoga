# Worker 163 - Transform composition runtime proof

## Summary

Added bounded host-native proof that composed public `style.transform` arrays
reach concrete native consumers of `YogaNode::_matrix`.

This was proof-only work. No product C++ bug was found, and no product C++
was edited.

## Changed files

- `scripts/verify-yoganode-native-hit-testing.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-163-transform-composition-runtime.md`

## Evidence gathered

- Inspected `worker-progress/worker-162-post-161-root-cause-audit.md`.
- Inspected `scripts/verify-yoganode-native-hit-testing.mjs`.
- Inspected `scripts/verify-yoganode-native-commands-render.mjs`.
- Inspected `scripts/verify-yoganode-nitro-materialization.mjs`.
- Inspected `cpp/YogaNode.cpp` and `cpp/YogaNode.hpp` render/hit-test paths.
- Confirmed `YogaNode::drawInternal()` consumes `_matrix` through
  `ctx.canvas->concat(*_matrix)` after Yoga layout translation.
- Confirmed `YogaNode::hitTestInternal()` consumes `_matrix` by subtracting
  Yoga layout, inverting `_matrix`, mapping the point to local coordinates,
  then applying clipping/child/self traversal.

## Implemented proof

- Extended the native hit-test verifier with composed public transform-array
  cases:
  - `translateX + translateY + scale`, with positive hits in the composed
    visual bounds and negative assertions for points a scale-only transform
    would have accepted.
  - `translateX + rotateZ`, with a positive rotated visual hit and a negative
    outside-rotated-bounds hit.
- Extended the native command/render verifier with a bounded raster case for
  `translateX + translateY + scale`:
  - positive pixels inside the shifted scaled rect,
  - negative pixels at the scale-only edge,
  - positive pixels beyond translate-only width,
  - negative pixels outside the final scaled rect.

These assertions are intentionally through `hitTestTagAt()` /
`hitTestInternal()` and `renderToContext()`, not just `_style.transform` or
`_matrix` state equality.

## Commands run

All commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `node --check scripts/verify-yoganode-native-hit-testing.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 32s.
- `git diff --check`: passed.

## Proof boundary and overclaim risks

Proven:

- Host-native C++ `NodeStyle::transform` array composition can materialize a
  native `_matrix` and affect `YogaNode::hitTestInternal()` coordinate
  inversion.
- Host-native C++ composed public transforms can affect
  `YogaNode::renderToContext()` raster output through `_matrix` and canvas
  concat.
- Worker 161's generated materialized transform delivery remains green via
  `check:yoganode-nitro-materialization`.

Not proven:

- Actual React Native bridge delivery.
- Nitro module registry install inside a React Native runtime.
- iOS/Android app build/run, simulator/device launch, or native platform
  presentation.
- UI-runtime Worklets execution, real Reanimated SharedValue delivery, RNGH
  native delivery, or gesture delivery through transformed nodes.
- Exhaustive transform rendering, exact transform geometry fidelity beyond the
  asserted hit-test points and raster pixels, or exact GPU/platform fidelity.

## Cleanup status

- No product C++ files were edited.
- No generated files, package metadata, or unrelated verifiers were edited.
- `check:feasible-matrix` removed `tsconfig.tsbuildinfo` and its matrix-owned
  temp parent and reported no remaining new tracked artifacts.
- `git diff --check` passed.

## Recommended next tasks

- Keep platform-runtime transform/gesture proof as a future target once local
  iOS/Android prerequisites are available.
- Consider a separate future source-level drift guard if new public transform
  variants are added beyond the current generated `Transform` union.

Goal finished.
