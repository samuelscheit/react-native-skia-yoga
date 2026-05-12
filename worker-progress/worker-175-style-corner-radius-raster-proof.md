# Worker 175 - Style Corner Radius Raster Proof

## Summary

Added bounded host-native raster evidence for style corner-radius clipping in
`YogaNode::renderToContext()`.

The command/render verifier now creates a `GroupCmd` parent with style corner
radii and a full-size `RectCmd` child. The parent uses an upper-left SkPoint
style radius and a lower-right scalar style radius, renders through real
`YogaNode::renderToContext()` onto a raster `SkSurface`, and asserts transparent
pixels in the clipped rounded corners plus green pixels inside the rounded
bounds and in the unset square corners.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-175-style-corner-radius-raster-proof.md`

## Implementation details

- Added `assertStyleCornerRadiusClipRender(...)` to the host-native command/render
  probe.
- The raster case uses parent style radii:
  `borderTopLeftRadius = SkPoint(30, 20)` and
  `borderBottomRightRadius = 24`.
- The case asserts `_clipsToBounds`, `_clipToBoundsRadii`, expected per-corner
  radius slots, SkPoint/scalar variant preservation, and zero radii for the
  unset upper-right/lower-left corners.
- The case proves separation from explicit clip state by asserting
  `_style.clip`, `_clipPath`, `_clipRect`, and `_clipRRect` are empty.
- The case proves separation from `RRectCmd::cornerRadius` by using a `GroupCmd`
  parent and full-size `RectCmd` child, asserting neither command is `RRectCmd`,
  and asserting the child has no `_clipToBoundsRadii` so the child `RectCmd`
  rounded draw branch is not involved.
- Updated verifier output and proof-boundary text to name bounded style
  corner-radius raster clipping through `YogaNode::renderToContext()` only.

## Evidence/commands run

All commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `git diff --check`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 19s.

Focused render evidence:

- The executable compiled and linked against real `YogaNode.cpp`, generated Nitro
  specs, React Native JSC, upstream Yoga, RN Skia macOS archives, Worklets
  shared-item sources, and helper sources.
- The executable rendered through real `YogaNode::renderToContext()` onto raster
  `SkSurface` instances.
- The new style-radius case asserted transparent pixels at `(1, 1)` and
  `(99, 99)`, green pixels at `(30, 20)` and `(76, 76)`, green square-corner
  pixels at `(99, 1)` and `(1, 99)`, and transparent pixels outside the parent
  layout at `(104, 104)`.
- The feasible matrix reran the edited `check:yoganode-native-commands-render`
  entry and passed it inside the full accepted local matrix.

## Proof boundary

Proven:

- Bounded host-native macOS C++ raster clipping for style corner radii through
  real `YogaNode::renderToContext()`.
- Representative mixed style radius variants in the raster case: one SkPoint
  radius and one scalar radius.
- The raster case is distinct from explicit `style.clip` path/rect/rrect state
  and distinct from `RRectCmd::cornerRadius`.

Not proven:

- Platform-native presentation.
- Exact style corner-radius render fidelity beyond the asserted host-raster
  pixels.
- React Native bridge delivery.
- Nitro registry install inside a React Native runtime.
- UI-runtime Worklets execution.
- Reanimated delivery.
- RNGH native delivery.
- iOS/Android app build or launch.
- Image asset loading/decoding.
- Exact typography or GPU/backend fidelity.

## Local platform blockers

Not rechecked in this worker. This task stayed on locally unblocked host-native
verifier evidence. Prior platform blockers for full CocoaPods install, Gradle
build, simulator/device launch, and platform-native app runtime remain outside
this proof until explicitly reprobed.

## Cleanup status

- No unrelated product files, generated specs, package metadata, or example
  native folders were intentionally changed.
- Ambiguous local artifacts such as `node_modules`, `example/node_modules`,
  `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
  `tsconfig.tsbuildinfo` were preserved unless matrix-owned cleanup handled a
  generated tracked artifact.
- `check:feasible-matrix` removed its generated `tsconfig.tsbuildinfo` tracked
  artifact and removed its matrix-owned temp parent.
- No nested subagents or explorers were used.

## Recommended next tasks

- Consider a compact JS/Reconciler follow-up that inventory-checks all four
  SkPoint-capable corner keys and explicitly proves whole scalar
  `SharedValue<number>` corner-radius updates if the orchestrator wants a JS
  completion pass.
- Keep platform-native app build/run and real RN/Nitro/Reanimated/RNGH runtime
  proof blocked until local toolchain prerequisites are available.

Goal finished.
