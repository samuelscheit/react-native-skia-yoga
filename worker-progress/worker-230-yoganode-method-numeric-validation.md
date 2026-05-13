# Worker 230: YogaNode Method Numeric Validation

## Objective

Add deterministic finite/native-float numeric validation for YogaNode method
arguments that previously reached native float casts directly:

- generated/materialized `computeLayout(width, height)`
- raw JSI `hitTest(x, y)`

## Worktree

- Worktree:
  `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-230-yoganode-method-numeric-validation`
- Branch: `worker/230-yoganode-method-numeric-validation`
- Starting point: `e991357 Accept worker 229 audit`; main recorded the Worker
  230 launch afterward in `53ec0d6 Record worker 230 launch`.

## Changes

- Added `toFiniteYogaNodeMethodFloat(...)` in `cpp/YogaNode.cpp`.
- `YogaNode::computeLayout(...)` now validates optional width/height values
  before casting to native `float` and before calling `YGNodeCalculateLayout`.
- `YogaNode::hitTest(...)` now validates numeric x/y arguments before
  `hitTestTagAt(...)`, so invalid numbers cannot trigger implicit layout.
- Existing missing/nonnumeric raw `hitTest` argument behavior is preserved.
- `scripts/verify-yoganode-jsi-raw-methods.mjs` now proves invalid raw
  `hitTest` NaN, Infinity, -Infinity, and native-float-overflow values reject
  without mutating interaction state or computing layout.
- `scripts/verify-yoganode-nitro-materialization.mjs` now proves generated
  materialized `computeLayout(...)` rejects non-finite and native-float-overflow
  width/height values without mutating computed layout state, and still accepts
  omitted or explicit `undefined` optional arguments.
- The materialization verifier's source guard now keeps this validation and
  proof coverage from regressing.

## Validation Behavior

Invalid method numbers throw with property-specific messages such as:

- `computeLayout.width`
- `computeLayout.height`
- `hitTest.x`
- `hitTest.y`

The native error text is:

`Invalid numeric YogaNode method value for <property>: expected a finite native float.`

When surfaced through raw JSI wrappers, the message is wrapped by the existing
`withJsiError(...)` method context.

## Verification

All checks below passed in the assigned worktree:

- `git diff --check`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run typecheck`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`

The full feasible matrix passed 28/28 commands in 4m10s. It reported no newly
created tracked artifacts, no remaining new tracked artifacts, and removed its
matrix-owned temp parent.

## Proof Boundary

This proves host-native validation and state preservation for the selected
method arguments through direct raw JSI and generated materialized YogaNode
wrappers. It does not claim iOS/Android app build/run, simulator/device launch,
native platform presentation, React Native bridge delivery, UI-runtime Worklets
execution, Reanimated delivery, RNGH native delivery, or exhaustive Yoga
conformance beyond the asserted values.

## Quality Notes

- The fix is scoped to the native method-boundary casts identified by the
  worker 229 audit.
- Validation happens before stateful calls (`YGNodeCalculateLayout` and
  `hitTestTagAt`), preserving existing native state on invalid input.
- The new helper mirrors the established finite/native-float validation pattern
  already used for `hitSlop`, but keeps a method-specific error prefix.
- No generated files changed after `bun run specs` inside the matrix.

## Cleanup

- No temp roots or generated tracked artifacts remain from the matrix run.
- Final tracked diff is limited to `cpp/YogaNode.cpp`,
  `scripts/verify-yoganode-jsi-raw-methods.mjs`,
  `scripts/verify-yoganode-nitro-materialization.mjs`, and this report.

Goal finished.
