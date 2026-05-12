# Worker 179 - Global Border Radius Raster Proof

## Summary

Added a compact host-native raster smoke for global scalar
`style.borderRadius` clipping through `YogaNode::renderToContext()`.

The command/render verifier now creates a `GroupCmd` parent with
`NodeStyle.borderRadius = 24`, inserts a full-size blue `RectCmd` child, renders
onto a raster `SkSurface`, and asserts that all four rounded corners clip the
child while pixels inside the rounded bounds remain blue.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-179-border-radius-raster-proof.md`

## Implementation details

- Added `assertGlobalBorderRadiusClipRender(...)` next to the existing style
  corner-radius raster proof.
- The new case asserts `_style.borderRadius`, `_clipsToBounds`, and
  `_clipToBoundsRadii`, with all four SkRRect corner slots set to the global
  scalar radius.
- The case keeps explicit clipping separate by asserting `_style.clip`,
  `_clipPath`, `_clipRect`, and `_clipRRect` remain empty.
- The case keeps `RRectCmd::cornerRadius` separate by using a `GroupCmd` parent
  and a full-size `RectCmd` child, asserting neither command is `RRectCmd`, and
  asserting the child does not own `_clipToBoundsRadii`.
- Pixel checks assert transparent clipped pixels at all four rounded child
  corners, blue pixels inside all four rounded bounds, and transparency outside
  the parent layout.
- Updated verifier output and proof-boundary text to name bounded global
  `style.borderRadius` scalar raster clipping separately from the existing
  per-corner style-radius raster proof.

## Evidence/commands run

All commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `git diff --check`: passed before report creation and again after report
  creation.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 21s.

Focused render evidence:

- The focused verifier compiled and linked a host executable against real
  `YogaNode.cpp`, generated Nitro specs, React Native JSC, upstream Yoga, RN
  Skia macOS archives, Worklets shared-item sources, and helper sources.
- The executable rendered through real `YogaNode::renderToContext()` onto raster
  `SkSurface` instances.
- The new global `borderRadius` case asserted transparent clipped pixels at
  `(1, 1)`, `(99, 1)`, `(99, 99)`, and `(1, 99)`.
- The case asserted blue pixels inside the rounded bounds at `(24, 24)`,
  `(75, 24)`, `(75, 75)`, and `(24, 75)`, plus transparent pixels outside the
  parent layout at `(104, 104)`.
- The feasible matrix reran `check:yoganode-native-commands-render` and passed
  it inside the accepted local proof set.

## Proof boundary

Proven:

- Bounded host-native macOS C++ raster clipping for scalar
  `NodeStyle.borderRadius` through real `YogaNode::renderToContext()`.
- Global scalar `borderRadius` seeds all four `_clipToBoundsRadii` corner slots
  in this host-native raster path.
- The raster case is distinct from explicit `style.clip` path/rect/rrect state
  and distinct from `RRectCmd::cornerRadius`.

Not proven:

- Generated materialization of global `borderRadius`.
- React Native bridge delivery.
- Nitro registry install inside a React Native runtime.
- UI-runtime Worklets execution.
- Reanimated delivery.
- Platform-native presentation.
- iOS/Android app build or launch.
- Simulator/device behavior.
- Exact global `borderRadius` renderer fidelity beyond the asserted host-raster
  pixels.
- Image asset loading/decoding or GPU/backend fidelity.

## Cleanup status

- No unrelated product files, package metadata, generated specs, docs, or
  example native folders were intentionally changed.
- Ambiguous local artifacts such as `node_modules`, `example/node_modules`,
  `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
  `tsconfig.tsbuildinfo` were preserved unless matrix-owned cleanup removed its
  own generated `tsconfig.tsbuildinfo` artifact.
- `check:feasible-matrix` removed its matrix-owned temp parent and reported no
  remaining new tracked artifacts after cleanup.
- No nested subagents or explorers were used.

## Recommended next tasks

- Keep platform-native app build/run and real RN/Nitro/Reanimated runtime proof
  blocked until local simulator, CocoaPods, Java, Android SDK/build-tool, and
  launch prerequisites are available.
- If a future worker targets global `borderRadius` above this host-raster layer,
  prefer a generated-materialization or JS/Reconciler scoped proof and keep it
  separate from this bounded raster evidence.

Goal finished.
