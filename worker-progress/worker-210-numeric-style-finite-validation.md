# Worker 210: numeric style finite validation

## Summary

Implemented deterministic pre-mutation finite-number validation in `YogaNode::setStyle(...)` for selected numeric paint/border fields: the border-width family, `strokeMiter`, and `opacity`.

Invalid NaN/Infinity values now throw before `invalidateLayout()`, `_style` replacement, Yoga style reset/mutation, `_paint` reset/mutation, layer reset, clip reset, or matrix reset.

Extended the generated materialized Nitro verifier with negative coverage that calls generated JS-facing `setStyle(...)` through materialized `YogaNode` objects and proves previous `_style`, `_paint`, Yoga border, clip, layer, and matrix state survive rejected non-finite inputs.

## Changed files

- `cpp/YogaNode.cpp`
  - Added `throwInvalidNumericStyleValue(...)`, `validateFiniteStyleNumber(...)`, and `validateFiniteNumericStyleFields(...)`.
  - Called the finite numeric validator after existing layout-string and background-color validation, before any native mutation in `setStyle(...)`.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added source guards for the selected validation target fields and pre-mutation call ordering.
  - Added generated materialized negative cases for NaN/Infinity on border widths, `strokeMiter`, and `opacity`.
  - Added a preservation baseline touching `_style`, `_paint`, Yoga border state, `_clipRect`, `_layerPaint`, and `_matrix`.

## Commands run

- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed
- `git diff --check` - passed
- `npm run check:yoganode-nitro-materialization` - failed once on a verifier source-guard ordering bug; fixed
- `npm run check:yoganode-nitro-materialization` - failed once on macOS SDK `positiveInfinity`/`negativeInfinity` macro collision in new probe locals; fixed
- `npm run check:yoganode-nitro-materialization` - passed
- `npm run check:feasible-matrix` - passed all 28 commands

## Evidence gathered

- `src/specs/style.ts` and generated `NodeStyle.hpp` expose the selected fields as `number` / `std::optional<double>`.
- `YogaNode.cpp` previously accepted those doubles and applied them directly to Yoga and/or SkPaint without finite checks.
- The new verifier compiles and runs a host-JSC materialized Nitro probe against real `YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, Nitro, Yoga, React Native JSC, and RN Skia macOS archives.
- The materialized negative loop rejects non-finite values for the selected fields with deterministic messages like `Invalid numeric style value for opacity: expected a finite number.`
- After each rejection, assertions confirm prior background color, border width, stroke miter, opacity, dither, antialias, Yoga border state, layer paint, clip rect, and matrix state are unchanged.
- `check:feasible-matrix` passed and cleaned its matrix temp parent; remaining changed tracked files are only the intended source/verifier/report files.

## Proof boundary and overclaim risks

- This proves selected finite numeric validation for border-width family fields, `strokeMiter`, and `opacity` through generated materialized Nitro `setStyle(...)` on a host-JSC probe.
- This does not claim exhaustive numeric style validation. Numeric layout fields, radii, transform leaves, matrix arrays, and other non-string numeric surfaces remain outside this worker's validation boundary unless covered by existing validators.
- This adds no range semantics. Finite values outside typical UI ranges still preserve existing behavior.
- This does not prove React Native app runtime delivery, iOS/Android simulator/device behavior, CocoaPods install, Gradle build, UI-runtime Worklets execution, Reanimated SharedValue delivery, or RNGH delivery.

## Cleanup status

- No unrelated files were edited.
- `npm run check:feasible-matrix` removed its generated `tsconfig.tsbuildinfo` and temp parent.
- Worktree changes before commit are limited to `cpp/YogaNode.cpp`, `scripts/verify-yoganode-nitro-materialization.mjs`, and this report.

## Recommended next tasks

- Consider a separate scoped worker for finite validation on numeric layout fields and numeric transform/matrix/radius inputs, with similarly explicit proof boundaries.
- Consider centralizing future numeric validation inventories so public `NodeStyle` additions must choose validation behavior deliberately.

Goal finished.
