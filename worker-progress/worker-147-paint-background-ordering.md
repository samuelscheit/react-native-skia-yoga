# Worker 147 - Paint Background Ordering

## Summary

- Moved `YogaNode::setStyle(...)` handling of `style.backgroundColor` before explicit public paint-style fields so a `SkPaint` background establishes the base paint first.
- Kept Yoga layout border writes in the existing border block; `style.borderWidth` still calls `YGNodeStyleSetBorder(...)` while also overriding paint stroke width after the base paint is assigned.
- Preserved string/CSS `backgroundColor` behavior by keeping the same parse-and-set-color logic, only earlier in the ordering.
- Added host-native verifier coverage for conflicting SkPaint background values versus explicit style `borderWidth`, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`, `antiAlias`, `opacity`, and `blendMode`.

## Files Changed

- `cpp/YogaNode.cpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-147-paint-background-ordering.md`

## Verification

- `git diff --check` - passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed.
- `npm run check:yoganode-native-commands-render` - passed.
- `npm run check:feasible-matrix` - passed all 28 commands, including `check:package-typescript-consumer` and `check:yoganode-nitro-materialization`.

## Proof Boundary

The added proof is bounded to host-native macOS C++ construction and execution of `YogaNode::setStyle(...)` through the existing native command/render verifier. It proves the local paint state ordering for a SkPaint-backed `backgroundColor` and explicit public style fields named above, plus the Yoga layout border width write for `borderWidth`.

This does not claim iOS/Android app runtime, simulator/device launch, exact render fidelity, broad NodeStyle completeness beyond the asserted fields, layer paint behavior, or future RN Skia public fields absent from the installed inventory.

## Residual Risks

- Layer paint ordering remains intentionally separate; `_layerPaint` ownership was not changed.
- The verifier inspects host-native SkPaint/Yoga state directly rather than platform presentation.
