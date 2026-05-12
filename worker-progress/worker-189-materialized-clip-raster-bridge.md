# Worker 189 - Materialized clip raster bridge

## Summary

Implemented the generated materialized `setStyle(clip/invertClip)` to raster
bridge proof in `scripts/verify-yoganode-nitro-materialization.mjs`.

The verifier now materializes parent/child `YogaNode`s through
`YogaNode::toObject(runtime)`, calls generated JS-facing `setCommand(group)` and
`setCommand(rect)` wrappers, calls generated JS-facing `setStyle(...)` wrappers
for explicit clip rect/rrect/path and inverted clip rect, inserts the child
through generated `parent.insertChild(...)`, computes layout through the
generated wrapper, renders the native parent through `YogaNode::renderToContext()`,
and asserts bounded pixels for inside/outside clip behavior.

## Changed files

- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added `pixelAt(...)` and `renderNode(...)` host-raster helpers.
  - Parameterized `makeGroupCommand(...)` so the bridge proof can use a
    generated non-rasterizing group command.
  - Added materialized parent/child render style builders.
  - Added generated `setStyle(...)` wrapper helper.
  - Added materialized raster cases for clip rect, clip rrect, clip path, and
    inverted clip rect.
  - Updated verifier output/proof-boundary text to include the new bounded
    host-raster evidence.
- `worker-progress/worker-189-materialized-clip-raster-bridge.md`

## Commands run

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: first run failed during C++
  compile because the new helper took move-only `jsi::Object` by value; fixed by
  taking `const jsi::Object&`.
- `npm run check:yoganode-nitro-materialization`: passed after the fix.
- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 6s.

## Evidence gathered

- The updated materialization verifier compiled and linked a host executable
  against real `YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, Nitro
  materialization/prototype/cache sources, React Native JSC, upstream Yoga, RN
  Skia macOS archives, RN Skia CSS color parsing, Worklets helper sources,
  `AnimatedDouble`, and other existing helper sources.
- The new bridge cases use materialized parent/child `YogaNode` JS objects from
  `YogaNode::toObject(runtime)` and generated wrappers, not direct C++ style or
  command construction.
- Rect clip case proves generated `setStyle(clip rect)` populates `SkRect`
  state and `_clipRect`, then keeps a green in-clip pixel and clears selected
  out-of-clip/bounds pixels.
- RRect clip case proves generated `setStyle(clip rrect)` populates `SkRRect`
  state and `_clipRRect`, then keeps a blue rounded-rect interior pixel and
  clears selected rounded-corner/out-of-clip/bounds pixels.
- Path clip case proves generated `setStyle(clip path)` preserves the
  host-object circle `SkPath` in `_clipPath`, then keeps a cyan center pixel and
  clears selected outside/path-edge/bounds pixels.
- Inverted rect case proves generated `setStyle(clip rect, invertClip=true)`
  stores `_style.invertClip`, populates `_clipRect`, clears a magenta inside-clip
  pixel, and keeps selected outside-clip pixels painted while remaining bounded
  outside parent layout.
- The adjacent direct native command/render verifier still passed.
- The full feasible matrix reran the materialization verifier as item 20/28 and
  passed. It removed only its owned `tsconfig.tsbuildinfo` artifact and its
  matrix temp parent.

## Proof boundary and overclaim risks

Proven:

- Host-JSC Nitro `YogaNode::toObject(runtime)` materialization.
- Generated materialized `setCommand(group/rect)`, `setStyle(clip
  rect/rrect/path)`, `setStyle(invertClip)`, `insertChild(...)`, and
  `computeLayout(...)` wrapper delivery.
- Native `YogaNode::renderToContext()` bounded raster behavior after that
  generated wrapper delivery for explicit rect/rrect/path clips and inverted
  rect clip.
- Selected inside/outside/bounds pixels only.

Not proven:

- React Native bridge delivery, Nitro registry install in a React Native
  runtime, platform app runtime, simulator/device launch, native iOS/Android
  presentation, UI-runtime Worklets, real Reanimated delivery, RNGH delivery,
  image loading, or exact clip/render fidelity beyond asserted pixels.
- Inverted rrect/path raster behavior; only inverted rect is covered here.
- Exhaustive clip geometry or antialias transition fidelity.

## Cleanup status

- No product/native source was changed.
- No root planning files were edited.
- Preserved ambiguous ignored/local artifacts including `node_modules/`,
  `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`,
  `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` except for matrix-owned cleanup.
- No nested subagents were used.
- After verification, tracked changes are limited to the verifier and this
  report.

## Recommended next tasks

- Consider adding materialized inverted rrect/path raster cases as a separate
  bounded expansion.
- Keep platform-native app build/run and real React Native runtime delivery as
  separate tasks until the known local toolchain blockers are cleared.

Goal finished.
