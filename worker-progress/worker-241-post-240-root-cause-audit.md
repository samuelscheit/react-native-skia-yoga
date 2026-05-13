# Worker 241 - Post-Worker 240 Root-Cause Audit

## Summary

The managed Worker 241 subagent stalled after launch and one follow-up without
writing a report. This report was completed in the assigned isolated worktree
as a fallback to keep the audit lane moving.

Worker 240's accepted boundary is correct: text/paragraph style `float`
conversion now validates finite/native-float range before narrowing. The next
strongest unclosed local root-cause target is the non-command `NodeStyle`
`setStyle(...)` numeric path in `cpp/YogaNode.cpp`.

## Accepted Worker 240 Boundary

Inspected:

- `worker-progress/worker-240-text-paragraph-prenarrow-native-float-validation.md`
- Merge `53be068 Merge worker 240 text paragraph pre-narrow float validation`
- Commit `9cda646 Validate text paragraph floats before narrowing`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`

Evidence:

- `getRequiredFiniteStyleFloat(...)` now calls `isFiniteNativeStyleFloat(...)`
  before `static_cast<float>(number)`.
- The helper checks `std::isfinite(number)` and
  `abs(number) <= numeric_limits<float>::max()`.
- Worker 240's report records direct converter proof for
  `TextStyle.letterSpacing` native-float overflow and direct/generated
  `TextCmd` / `ParagraphCmd` state-preservation proof for text font size,
  paragraph font size, and `StrutStyle.leading`.
- Main post-merge verification passed after Worker 240, including both focused
  native verifiers, typecheck, and the full feasible matrix.

## Remaining Risk

`YogaNode::setStyle(...)` already validates many public numeric `NodeStyle`
fields before mutation, but the validators are finite-only:

- `validateFiniteStyleNumber(...)` rejects NaN/Infinity, then later layout,
  paint, opacity, border, gap, and radius fields are narrowed with
  `static_cast<float>`.
- `validateFiniteCornerRadius(...)` rejects non-finite scalar and point radii,
  but scalar radii still narrow in `borderRadius` and per-corner scalar paths.
- `validateFiniteMatrixElement(...)` rejects only non-finite matrix tuple
  elements; tuple values later narrow to `SkScalar` in `tupleToScalarArray(...)`.
- `validateFiniteTransformLeaf(...)` rejects only non-finite transform inputs;
  rotate, scale, and translate values later narrow to float, and skew paths
  additionally narrow `std::tan(...)` results.
- `parseYogaPercent(...)` currently casts parsed doubles to float before using
  post-narrow `std::isfinite(percent)`.

Representative narrowing sites:

- `cpp/YogaNode.cpp:461` parses percentages by narrowing `parsed`.
- `cpp/YogaNode.cpp:599-678` lists finite-only numeric style validation.
- `cpp/YogaNode.cpp:689-711` lists finite-only radius validation.
- `cpp/YogaNode.cpp:714-805` lists finite-only matrix/transform validation.
- `cpp/YogaNode.cpp:841` and `cpp/YogaNode.cpp:867` narrow layout variant
  doubles before Yoga setters.
- `cpp/YogaNode.cpp:952-1003` narrows flex/aspect scalar fields.
- `cpp/YogaNode.cpp:1145-1206` narrows border width and gap fields.
- `cpp/YogaNode.cpp:1239` narrows opacity before `SkPaint::setAlphaf`.
- `cpp/YogaNode.cpp:1257` and `cpp/YogaNode.cpp:1272` narrow radius scalars.
- `cpp/YogaNode.cpp:1332-1370` narrows transform values and skew tangents.

The current materialization verifier proves generated `setStyle(...)`
non-finite rejection and state preservation for selected layout, paint, radius,
matrix, and transform cases. It does not yet require native-float overflow
rejection for those `NodeStyle` paths.

## Selected Next Target

Select a focused implementation worker for `NodeStyle` native-float validation
in `cpp/YogaNode.cpp`.

Proposed objective:

- Add a central native-float validation helper for `NodeStyle` numeric values.
- Upgrade `validateFiniteStyleNumber(...)`, `validateFiniteCornerRadius(...)`,
  `validateFiniteMatrixElement(...)`, `validateFiniteTransformLeaf(...)`, and
  `parseYogaPercent(...)` so they reject finite values outside native `float`
  range before any local `static_cast<float>` / `SkScalar` narrowing.
- Include transform skew result validation for `std::tan(...)` outputs before
  casting tangent results to float.
- Preserve current accepted behavior for valid finite values and existing
  invalid-value state preservation.
- Update source guards and generated materialized `setStyle(...)` runtime
  coverage in `scripts/verify-yoganode-nitro-materialization.mjs`. Add native
  command/render source guard coverage only where direct native rendering
  verifier already owns the relevant `NodeStyle` surface.

Suggested verification:

- `git diff --check`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:yoganode-native-commands-render`
- `npm run typecheck`
- `npm run check:feasible-matrix`

## Alternatives Considered

- Remaining command payloads: lower priority because command points, static and
  dynamic `AnimatedDouble`, path stroke, command numeric enums, and
  text/paragraph style numerics already have native-float or range coverage.
- `YogaNode` method arguments: lower priority because `computeLayout(width,
  height)` and raw `hitTest(x, y)` already use native-float validation.
- `YogaNode.hpp` layout casts: lower priority for this pass because those
  values are downstream of Yoga layout state, not the public authoring boundary.
- Platform runtime proof: still valuable, but local platform build/run gaps are
  known and this audit found an unblocked source-level numeric root cause.

## Commands Run

- `git status --short --branch`
- `git log --oneline -5`
- `git show --stat --oneline 53be068`
- `git show --name-only --oneline 53be068`
- `sed -n '1,220p' worker-progress/worker-240-text-paragraph-prenarrow-native-float-validation.md`
- `git show --unified=40 9cda646 -- cpp/JSIConverter+SkTextStyle.hpp scripts/verify-yoganode-native-commands-render.mjs scripts/verify-yoganode-nitro-materialization.mjs`
- `rg -n "static_cast<float>|std::isfinite|isFinite|NativeFloat|resolveNativeFloat|getRequiredFinite|finite" cpp/YogaNode.cpp cpp/YogaNode.hpp cpp/JSIConverter+SkTextStyle.hpp nitrogen/generated/shared/c++/NodeStyle.hpp`
- `rg -n "validateFiniteNumericStyleFields|validateFiniteRadiusStyleFields|validateFiniteMatrixAndTransformStyleFields|validateYogaLayoutUnitStrings|parseYogaPercent|setYGValueOrPercent|setYGEdgeValue" scripts/verify-yoganode-nitro-materialization.mjs scripts/verify-yoganode-native-commands-render.mjs scripts/verify-feasible-matrix.mjs cpp/YogaNode.cpp`
- `rg -n "std::numeric_limits<float>::max\\(\\)|std::isfinite\\(percent\\)|static_cast<float>\\(parsed\\)|validateFiniteStyleNumber|validateFiniteTransformLeaf|validateFiniteMatrixElement" cpp/YogaNode.cpp scripts/verify-yoganode-nitro-materialization.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `git diff --check`

All commands completed successfully except one broad `rg` included a
nonexistent optional path (`cpp/JSIConverter+NodeStyle.hpp`) and returned
status 2 after still printing the relevant matches. The follow-up targeted
searches completed successfully.

## Proof Boundary And Risks

Proven: source-level audit of Worker 240's accepted boundary, source-level
inventory of remaining `YogaNode::setStyle(...)` finite-only validators and
float-narrowing sites, syntax checks for both focused verifier scripts, and a
clean report-only diff.

Not proven: a new implementation, runtime native-float overflow rejection for
`NodeStyle`, iOS/Android app build/run, simulator/device launch, React Native
bridge delivery, Nitro registry install in a real React Native runtime,
UI-runtime Worklets execution, RNGH delivery, exact Yoga conformance, or exact
render fidelity.

Goal finished.
