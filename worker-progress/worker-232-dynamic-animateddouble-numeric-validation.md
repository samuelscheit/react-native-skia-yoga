# Worker 232: Dynamic AnimatedDouble Numeric Validation

## Objective

Define and implement a deterministic fail-closed finite/native-float policy for
dynamic `AnimatedDouble` values read from Worklets `Synchronizable` objects
after command installation, without regressing static command conversion,
no-main-runtime fallback behavior, or valid dynamic render updates for:

- `circle.radius`
- `rrect.cornerRadius`
- `blurMaskFilter.blur`
- `path.trimStart`
- `path.trimEnd`

## Files Changed

- `cpp/JSIConverter+AnimatedDouble.hpp`
- `cpp/AnimatedDouble.cpp`
- `cpp/YogaNode.hpp`
- `scripts/verify-animated-double-synchronizable.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-232-dynamic-animateddouble-numeric-validation.md`

## Policy

Dynamic render-time `AnimatedDouble` values are classified before any native
`float` narrowing:

- `Valid`: finite and `abs(value) <= std::numeric_limits<float>::max()`.
  The command render prop is updated with the narrowed value.
- `Unset`: no value is available, including the existing no-main-runtime path
  with no static fallback. Existing command fallback defaults are preserved:
  circle layout radius, rrect `0`, blur `0`, path trim start `0`, and trim end
  `1`.
- `Invalid`: non-finite, native-float-overflow, or unconvertible dynamic value.
  Stateful command render props keep their last safe value. `BlurMaskFilterCmd`
  now stores the last safe blur amount because blur is otherwise applied only as
  a paint side effect.

This intentionally avoids throwing from render-time dynamic mutation paths and
ensures an invalid dynamic number is not installed as a native `float`.

## Implementation Notes

`AnimatedDouble` now exposes `resolveNativeFloat()`, returning an explicit
`AnimatedDoubleNativeFloatResolution` with `Unset`, `Valid`, or `Invalid`
state. The helper centralizes finite/native-float-range validation and catches
conversion failures so render paths can fail closed.

`BlurMaskFilterCmd`, `RRectCmd`, `CircleCmd`, and `PathCmd` now call
`resolveNativeFloat()` before mutating render props. Valid values update props;
unset values retain the previous documented fallback defaults; invalid values
skip prop mutation and preserve the last safe state.

The raw AnimatedDouble verifier now proves native-float classification for
finite mutation, NaN mutation, Infinity mutation, native-float overflow, and
recovery after invalid mutation. The command/render verifier now proves the
selected render commands preserve safe state for representative invalid dynamic
mutations without losing existing finite dynamic behavior.

## Verification

- `git diff --check`: passed.
- `node --check scripts/verify-animated-double-synchronizable.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:animated-double-synchronizable`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed 28/28 in 5m 40s.
- `npm run typecheck`: passed as matrix command 22/28.

## Residual Proof Boundary

The proof covers host-JSC/native Worklets `Synchronizable` extraction and
mutation observation, `AnimatedDouble::resolveNativeFloat()` classification,
selected `YogaNode::renderToContext()` command paths, generated materialization
regression coverage, and the accepted feasible local matrix.

It does not prove UI-runtime Worklets execution, real Reanimated SharedValue
delivery, JS listener scheduling, React Native bridge delivery, Nitro module
registry install inside a real React Native runtime, iOS/Android simulator or
device launch, CocoaPods or Gradle builds, native platform presentation, exact
Skia render fidelity beyond asserted host-raster pixels, or every future
`AnimatedDouble` command prop outside the selected command-render coverage.

## Cleanup/Final Status

The feasible matrix removed its newly created tracked `tsconfig.tsbuildinfo`
and removed its matrix temp parent `/tmp/rnskia-feasible-matrix-oi8aea`.
Ignored/local artifacts such as `node_modules/`, `example/node_modules/`,
`example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
`tsconfig.tsbuildinfo` were not manually removed.

Final status after writing this report:

```text
## worker/232-dynamic-animateddouble-numeric-validation
 M cpp/AnimatedDouble.cpp
 M cpp/JSIConverter+AnimatedDouble.hpp
 M cpp/YogaNode.hpp
 M scripts/verify-animated-double-synchronizable.mjs
 M scripts/verify-yoganode-native-commands-render.mjs
?? worker-progress/worker-232-dynamic-animateddouble-numeric-validation.md
```

Goal finished.
