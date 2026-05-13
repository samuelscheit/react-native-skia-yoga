# Worker 242 - NodeStyle Native Float Validation

## Summary

Moved non-command `NodeStyle` numeric application in `YogaNode::setStyle(...)`
to explicit finite/native-float validation before narrowing into Yoga or Skia
`float` state.

- `cpp/YogaNode.cpp` now has shared `isFiniteNativeStyleFloat(...)`,
  `validateNativeStyleFloat(...)`, and `toNativeStyleFloat(...)` helpers for
  style numeric values that narrow to native `float`.
- Layout percent strings, layout numeric variants, flex/aspect values, border
  widths, gaps, opacity, scalar and point radii, matrix tuple elements,
  transform leaves, and skew tangent results now reject finite values outside
  native `float` range before native mutation.
- `cpp/JSIConverter+SkMatrix.hpp` now rejects out-of-range public matrix array
  elements before RN Skia's matrix conversion can narrow 9- or 16-value arrays.
- `scripts/verify-yoganode-nitro-materialization.mjs` now source-guards the
  native-float policy and adds generated materialized `setStyle(...)`
  state-preservation coverage for representative layout, paint/border, radius,
  matrix, and transform native-float-overflow cases.

The managed Worker 242 subagent stalled after launch/retry without writing a
report. This implementation and report were completed in the assigned isolated
worktree as a fallback to keep the lane moving.

## Changed Files

- `cpp/YogaNode.cpp`
- `cpp/JSIConverter+SkMatrix.hpp`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-242-nodestyle-native-float-validation.md`

## Commands Run

- `git status --short --branch`
- `git diff --check`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:yoganode-native-commands-render`
- `npm run typecheck`
- `npm run check:feasible-matrix` - passed 28/28 in 3m53s

An initial materialization verifier run failed because new matrix/transform and
radius overflow cases referenced a generated C++ `nativeFloatOverflow` constant
before it was declared in those functions. The generated harness declarations
were corrected and the focused verifier passed.

## Evidence

- Source guard: `YogaNode.cpp` validates native-float range through
  `isFiniteNativeStyleFloat(...)` / `toNativeStyleFloat(...)`, including the
  percent-string parse before `static_cast<float>(parsed)`.
- Matrix array guard: public 9- and 16-value matrix arrays reject values whose
  absolute value exceeds `numeric_limits<float>::max()` before RN Skia matrix
  conversion.
- Runtime materialization proof: generated `setStyle(...)` rejects
  native-float overflow for representative layout numeric fields, percent
  strings, border/paint numeric fields, scalar and point radii, matrix arrays,
  and all generated transform operation leaves while preserving previous
  selected `_style`, `_paint`, Yoga, clip/radius, layer, matrix, and
  computed-layout state.
- Full matrix proof: all feasible local package/source/example checks passed
  after the shared `NodeStyle` conversion change.

## Proof Boundary And Risks

Proven locally: host-JSC Nitro materialized `YogaNode` wrapper behavior,
generated `setStyle(...)` native-float rejection and state preservation for
covered `NodeStyle` numeric families, source guard coverage, direct
command/render verifier compatibility, TypeScript compatibility, and the full
feasible local matrix.

Not proven: iOS/Android app build/run, simulator/device launch, native platform
presentation, React Native bridge delivery, Nitro registry install in a real
React Native runtime, UI-runtime Worklets execution, RNGH delivery, exact Yoga
conformance beyond asserted values, or exact render fidelity beyond covered
host-raster pixels.

## Review Notes

- Quality/maintainability: centralizes `NodeStyle` native-float policy close to
  the native mutation boundary and reuses it across layout, paint, radius,
  matrix, and transform paths.
- Performance: adds constant-time validation during style application only.
- Compatibility: existing invalid numeric error wording is preserved, while
  valid finite in-range values keep the existing behavior.

## Cleanup Status

- Matrix temp parent was removed by the verifier.
- No generated tracked artifacts remained after cleanup.
- Ignored dependency symlinks and local native/example artifacts were preserved.
- Final pending changes are the intended tracked files listed above.

## Recommended Next Target

Run a fresh post-Worker 242 root-cause audit. The immediate audit should accept
or challenge this `NodeStyle` native-float boundary, then inventory the next
highest-value locally unblocked risk rather than assuming the remaining gap is
still numeric conversion.

Goal finished.
