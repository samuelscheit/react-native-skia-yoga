# Worker 243 - Post-Worker 242 Root-Cause Audit

## Summary

The managed Worker 243 subagent and one retry stalled without observable
worktree changes. This report was completed in the assigned isolated worktree
as a fallback so the audit lane could continue.

Worker 242's accepted boundary is correct: non-command `NodeStyle` numeric
values that narrow into Yoga/Skia `float` state now validate finite/native
`float` range before narrowing. The next strongest locally unblocked
root-cause target is raw/native interaction `eventTag` validation in
`YogaNode::setInteractionConfig(...)`.

## Accepted Worker 242 Boundary

Inspected:

- `worker-progress/worker-242-nodestyle-native-float-validation.md`
- Commit `7e970ee Validate NodeStyle native floats`
- Merge `882dbf1 Merge worker 242 NodeStyle native-float validation`
- `cpp/YogaNode.cpp`
- `cpp/JSIConverter+SkMatrix.hpp`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-jsi-raw-methods.mjs`
- `scripts/verify-gesture-interaction-runtime.mjs`

Evidence:

- `YogaNode.cpp` now defines `isFiniteNativeStyleFloat(...)`,
  `validateNativeStyleFloat(...)`, and `toNativeStyleFloat(...)`.
- `parseYogaPercent(...)` checks `isFiniteNativeStyleFloat(parsed)` before
  returning `static_cast<float>(parsed)` and no longer relies on a post-narrow
  `std::isfinite(percent)` check.
- Numeric layout variants route through `toNativeStyleFloat(...)` before Yoga
  setters.
- Flex, flex grow/shrink, aspect ratio, border widths, gaps, opacity, scalar
  radii, per-corner scalar radii, and per-corner `SkPoint` axes now narrow
  through `toNativeStyleFloat(...)`.
- Matrix tuple elements are checked through `validateNativeStyleFloat(...)`
  before `tupleToScalarArray(...)` narrows to `SkScalar`.
- Public matrix arrays are checked in `cpp/JSIConverter+SkMatrix.hpp` against
  `std::numeric_limits<float>::max()` before RN Skia matrix conversion.
- Transform rotate/scale/translate leaves narrow through
  `toNativeStyleFloat(...)`, and skew paths validate `std::tan(...)` results
  before using tangent floats.
- The materialization verifier has source guards for the helper policy and
  runtime cases for representative layout, percent-string, paint/border,
  radius, matrix-array, and transform native-float-overflow rejection.

## Verification

Commands run:

- `git status --short --branch`
- `sed -n '1,220p' WORKER_BRIEF.md`
- `sed -n '1,220p' worker-progress/worker-242-nodestyle-native-float-validation.md`
- `git show --stat --oneline 7e970ee`
- `git show --name-only --oneline 882dbf1`
- `rg -n "isFiniteNativeStyleFloat|validateNativeStyleFloat|toNativeStyleFloat|parseYogaPercent|validateFiniteStyleNumber|validateFiniteCornerRadius|validateFiniteMatrixElement|validateFiniteTransformLeaf|static_cast<float>|static_cast<SkScalar>|std::isfinite\\(percent\\)|numeric_limits<float>::max|std::tan" cpp/YogaNode.cpp cpp/JSIConverter+SkMatrix.hpp`
- `rg -n "native-float overflow|isFiniteNativeStyleFloat\\(parsed\\)|std::numeric_limits<float>::max\\(\\)|toNativeStyleFloat\\(|validateNativeStyleFloat\\(|MatrixArray9 native-float overflow|MatrixArray16 native-float overflow|borderRadius native-float|transform\\.skew|std::tuple \\{ \\\"width\\\", \\\"1e39%\\\"" scripts/verify-yoganode-nitro-materialization.mjs`
- `git show --unified=80 7e970ee -- cpp/YogaNode.cpp cpp/JSIConverter+SkMatrix.hpp scripts/verify-yoganode-nitro-materialization.mjs`
- `rg -n "static_cast<float>|static_cast<SkScalar>|asNumber\\(|std::isfinite|numeric_limits<float>::max|resolveNativeFloat|toFinite|native-float|finite" cpp src scripts --glob '!node_modules/**'`
- `sed -n '2030,2135p' cpp/YogaNode.cpp`
- `sed -n '1,130p' src/YogaCanvas.tsx`
- `sed -n '1,140p' src/interactivity.ts`
- `rg -n "eventTag|interaction|setInteractionConfig|updateSelfInteractionState|hitSlop|pointerEvents|preciseHit" scripts/verify-gesture-interaction-runtime.mjs scripts/verify-yoganode-jsi-raw-methods.mjs scripts/verify-yoganode-native-hit-testing.mjs src/interactivity.ts cpp/YogaNode.cpp worker-progress/worker-224-hit-slop-finite-validation.md worker-progress/worker-230-yoganode-method-numeric-validation.md`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-gesture-interaction-runtime.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:gesture-interaction-runtime`
- `git diff --check`

All verification commands passed.

## Remaining Risk

`YogaNode::setInteractionConfig(...)` still accepts `eventTag` with:

```cpp
if (value.isNumber()) {
    nextEventTag = value.asNumber();
}
```

It then assigns `_eventTag = nextEventTag` and calls
`updateSelfInteractionState(_eventTag > 0.0)`. Unlike nearby `hitSlop`,
`hitTest(x, y)`, `computeLayout(width, height)`, command numerics, text style
numerics, and `NodeStyle` numerics, this raw/native numeric input has no
deterministic finite/integer/range policy.

Why this is now the strongest local target:

- `eventTag` is central interaction state. It is returned from hit testing and
  drives JS handler lookup.
- `scripts/verify-yoganode-jsi-raw-methods.mjs` proves valid event-tag updates
  and invalid hitSlop state preservation, but has no invalid `eventTag` cases.
- Worker 224's JS proof shows invalid hitSlop does not consume event tags, but
  did not validate the raw/native `eventTag` payload itself.
- `scripts/verify-gesture-interaction-runtime.mjs` prints that event tags are
  normalized, but the executable coverage is allocation/reuse/defaulting; it
  does not cover raw native rejection of `NaN`, `Infinity`, fractional,
  negative, or extreme `eventTag` values.
- This is a small, repo-owned boundary with existing focused verifier scripts:
  `check:yoganode-jsi-raw-methods`, `check:gesture-interaction-runtime`, and
  `check:yoganode-native-hit-testing`.

Lower-priority alternatives:

- More `NodeStyle` numeric work: lower priority because Worker 242 now covers
  the audited pre-narrow float boundary and the focused materialization
  verifier passed.
- Command numeric payloads: lower priority because command points, static and
  dynamic `AnimatedDouble`, path stroke numerics, command numeric enums, and
  text/paragraph numerics now have finite/native-range coverage.
- `YogaNode.cpp` layout-state casts in hit testing: lower priority because they
  are downstream of Yoga-computed layout state, not raw JS authoring input.
- Platform-native app build/run: still valuable, but remains a separate track
  unless the local CocoaPods/Xcode/Java/Android SDK prerequisites are available.

## Selected Next Target

Select a focused implementation worker for deterministic interaction
`eventTag` validation.

Proposed objective:

- Add native validation in `YogaNode::setInteractionConfig(...)` so `eventTag`
  accepts only the internal registry contract: `0` to clear or positive finite
  integer tags. The implementation should decide and document any upper bound,
  such as JS safe-integer range, if needed.
- Reject invalid `eventTag` values before assigning `_pointerEvents`,
  `_hitSlop`, `_preciseHit`, `_eventTag`, `_selfInteractive`, or interactive
  descendant counts.
- Preserve existing valid behavior for `0`, positive integer tags, pointer
  events, precise hit, and already-validated hitSlop.
- Add focused raw-method verifier coverage proving invalid `eventTag` updates
  preserve interaction state and parent interactive descendant counts.
- Add or adjust JS interaction verifier coverage only if the public registry
  can produce an invalid tag path; otherwise document that JS registry tags are
  internal finite integers and native validation protects the raw boundary.

Suggested verification:

- `git diff --check`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-gesture-interaction-runtime.mjs`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:gesture-interaction-runtime`
- `npm run check:yoganode-native-hit-testing`
- `npm run typecheck`
- `npm run check:feasible-matrix`

## Proof Boundary And Risks

Proven: source-level audit of Worker 242's accepted boundary, focused
host-JSC materialized `setStyle(...)` verification, raw-method interaction
verification, JS interaction runtime verification, and a clean report-only
diff.

Not proven: a new eventTag implementation, iOS/Android app build/run,
simulator/device launch, native platform presentation, React Native bridge
delivery, Nitro registry install in a real React Native runtime, UI-runtime
Worklets execution, real Reanimated SharedValue delivery, RNGH native delivery,
or exact hit-test/render fidelity beyond existing host probes.

## Cleanup Status

- No product files were edited.
- No generated tracked artifacts remained.
- Ignored dependency symlinks in the isolated worker worktree were preserved.
- The only intended tracked change is this report.

Goal finished.
