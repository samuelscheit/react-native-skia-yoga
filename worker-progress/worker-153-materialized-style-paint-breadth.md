# Worker 153 - Materialized Style Paint Breadth

## Summary

Expanded `scripts/verify-yoganode-nitro-materialization.mjs` with a generated materialized `YogaNode.setStyle(...)` fixture that calls the JS-facing wrapper on a `YogaNode::toObject(runtime)` object using a real `JsiSkPaint` host object as `backgroundColor`.

The new proof asserts generated conversion populates `_style.backgroundColor`, `borderWidth`, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`, `opacity`, and `blendMode`; asserts `_paint` starts from the SkPaint-backed `backgroundColor` base; asserts public paint fields override stroke width, cap, join, miter, dither, alpha, and blend mode; and asserts `borderWidth` writes Yoga border state through the materialized wrapper path.

Existing materialized `style.layer` coverage is preserved.

## Changed files

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-153-materialized-style-paint-breadth.md`

## Commands run/results

- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run check:yoganode-native-commands-render` - passed.
- `npm run check:feasible-matrix` - passed; 28/28 matrix commands passed, total command duration 4m 43s.
- `git diff --check` - passed.

## Evidence gathered

- The updated materialization verifier compiled and linked the host-JSC probe against real `YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, generated `NodeStyle` conversion, Nitro materialization/prototype/cache sources, React Native JSC, Yoga, RN Skia macOS archives, Worklets shared-item sources, and helper sources.
- The executable called `YogaNode::toObject(runtime)`, retrieved generated `setStyle`, and invoked it through `callWithThis(...)` on the materialized JS object.
- The new SkPaint-backed style payload uses a real `RNSkia::JsiSkPaint` host object for `backgroundColor` plus explicit `borderWidth`, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`, `opacity`, and `blendMode`.
- Native assertions confirm `_style` optionals are populated by generated conversion and that `_style.backgroundColor` stores the SkPaint variant with the original base paint values.
- Native assertions confirm `YogaNode::_paint` keeps the base SkPaint color/antiAlias while public paint fields override stroke width, stroke cap, stroke join, stroke miter, dither, alpha, and blend mode.
- Native assertions confirm `YGNodeStyleGetBorder(..., YGEdgeAll)` reflects the generated-wrapper `borderWidth`.

## Proof boundary/overclaim risks

This proves host-JSC Nitro `YogaNode::toObject(runtime)` materialization and generated materialized `setStyle(...)` delivery into native `NodeStyle`, `_paint`, and Yoga border state for the covered static payload. It does not prove command rendering, app runtime, platform presentation, React Native bridge delivery, Nitro registry install in an RN runtime, UI-runtime Worklets, Reanimated delivery, exact saveLayer/GPU blend fidelity, or exact render fidelity.

## Cleanup status

- No `cpp/YogaNode.cpp` change was needed; the expanded proof did not expose a product failure.
- The feasible matrix removed its temporary tracked artifact (`tsconfig.tsbuildinfo`) and temp parent.
- `git diff --check` passed.

## Recommended next tasks

- Keep this proof as a materialized wrapper complement to the direct host-native paint-field proof in `check:yoganode-native-commands-render`.
- A future worker could add materialized wrapper coverage for clip/matrix/transform style fields if those become the next highest-risk generated conversion gap.
