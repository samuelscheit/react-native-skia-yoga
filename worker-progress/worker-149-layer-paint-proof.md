# Worker 149 - Layer paint proof

## Summary

Added bounded proof for `style.layer` / `YogaNode::_layerPaint` delivery and rendering:

- `check:yoganode-native-commands-render` now builds a real `RNSkia::JsiSkPaint` payload, converts it through generated `NodeStyle`, verifies `NodeStyle::toJSI` emits a `JsiSkPaint`, asserts `YogaNode::setStyle(...)` stores `_layerPaint`, resets it when omitted, and keeps ordinary `_paint` independent.
- The same native verifier now renders a parent `group` with `style.layer` alpha and a child `rect`, proving the layer paint affects the child subtree through `canvas->saveLayer(...)` with bounded raster evidence.
- `check:yoganode-nitro-materialization` now sends a real `JsiSkPaint` `layer` payload through the materialized generated `setStyle(...)` wrapper and asserts native `_layerPaint` state.
- `check:package-typescript-consumer` now proves a packed external TypeScript consumer can author `style.layer` with `Skia.Paint()`.

No source/API fix was needed.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-package-typescript-consumer.mjs`
- `worker-progress/worker-149-layer-paint-proof.md`

## Commands run/results

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `git diff --check`: passed.
- `npm run check:feasible-matrix`: passed, 28/28 commands, total command duration 4m 58s.

## Evidence gathered

- Generated direct `NodeStyle` conversion accepts a real `JsiSkPaint` host object for `layer`.
- `NodeStyle::toJSI(...)` serializes `layer` back to a `JsiSkPaint` host object with alpha/blend state preserved.
- `YogaNode::setStyle(...)` copies the generated layer paint into `_layerPaint`, preserves background `_paint` color/alpha separately, and clears `_layerPaint` on a later style without `layer`.
- Native raster proof renders a child subtree under a parent layer paint alpha and verifies the child red pixel blends over white as expected while outside pixels stay white.
- Materialized generated `setStyle(...)` accepts `layer: JsiSkPaint` through `YogaNode::toObject(runtime)` and updates `_layerPaint`.
- Packed consumer TypeScript accepts `style: { layer: Skia.Paint(), opacity: 0.9 }` from the installed tarball.

## Proof boundary/overclaim risks

- Proof is local host-JSC/macOS C++ plus packed TypeScript consumer evidence.
- It does not prove React Native bridge delivery, Nitro registry install in an RN runtime, simulator/device runtime, iOS/Android presentation, UI-runtime Worklets execution, Reanimated delivery, RNGH native delivery, image loading, exact render fidelity, exact GPU blend fidelity, or broad `NodeStyle` completeness.
- The raster assertion is intentionally bounded to alpha modulation of a simple child subtree through `saveLayer(...)`.

## Cleanup status

- Feasible matrix reported no remaining new tracked artifacts after cleanup and removed its matrix temp parent.
- Final worktree diff is limited to the three verifier scripts and this report.

## Recommended next tasks

- If broader runtime coverage becomes available, add an app-level proof that authored `style.layer` survives the actual React Native/Nitro runtime path.
- Keep future layer work separate from ordinary `_paint` / `backgroundColor` proofs so regressions in either path are diagnosable.

Goal finished.
