# Worker 235: Post-Worker 234 Root-Cause Audit

## Summary / Verdict

Accepted Worker 234.

Worker 234 correctly closes the static numeric `AnimatedDouble` native-float
conversion gap for the current command-field inventory. Static values now
reject when non-finite or outside native `float` range before same-type
`YogaNode::setCommand(...)` mutation in both direct converter and generated
materialized wrapper paths. Dynamic Worklets-backed `AnimatedDouble` values,
`null`, and `undefined` remain supported.

No product-code changes were made by this audit. The only tracked change is
this report.

## Inspected Files / Commits

- `52647bb Record worker 235 audit launch`
- `cc638ea Accept worker 234 static AnimatedDouble validation`
- `245da89 Merge worker 234 static AnimatedDouble native-float validation`
- `28c2aa8 Validate static AnimatedDouble native floats`
- `worker-progress/worker-234-static-animateddouble-native-float-validation.md`
- `worker-progress/worker-233-post-232-root-cause-audit.md`
- `worker-progress/worker-232-dynamic-animateddouble-numeric-validation.md`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+AnimatedDouble.hpp`
- `cpp/AnimatedDouble.cpp`
- `cpp/YogaNode.cpp`
- `cpp/YogaNode.hpp`
- `cpp/NodeCommand.hpp`
- `cpp/JSIConverter+StrokeOpts.hpp`
- `src/specs/commands.ts`
- `src/Reconciler.ts`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`

## Commands / Outcomes

- `git status --short --branch`: passed; clean branch before report.
- `git log --oneline --decorate -12`: inspected current Worker 234/235
  ancestry.
- `git show --stat --oneline --decorate 28c2aa8`: inspected Worker 234 change
  scope.
- `git show --patch 28c2aa8 -- cpp/JSIConverter+NodeCommand.hpp`: inspected
  converter implementation.
- `git show --patch 28c2aa8 -- scripts/verify-yoganode-native-commands-render.mjs`:
  inspected direct verifier changes.
- `git show --patch 28c2aa8 -- scripts/verify-yoganode-nitro-materialization.mjs`:
  inspected generated materialization verifier changes.
- `git diff --check 28c2aa8^ 28c2aa8`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run typecheck`: passed.
- One exploratory `rg` command included stale optional paths `specs` and
  `generated`; it exited 2 after reporting relevant hits because those paths do
  not exist in this checkout. Follow-up reads used the real paths.

The full feasible matrix was not rerun in this audit because Worker 234 and
main post-merge evidence both already report `npm run check:feasible-matrix`
passing 28/28, and the two focused native/generated verifiers plus typecheck
were rerun successfully here.

## Audit Evidence

- `cpp/JSIConverter+NodeCommand.hpp` now includes `<limits>`, defines
  `isValidStaticAnimatedDoubleNativeFloat(double)`, and checks
  `std::isfinite(value)` plus `abs(value) <= numeric_limits<float>::max()`.
- `parseStaticFiniteAnimatedDouble(...)` converts through
  `JSIConverter<AnimatedDouble>::fromJSI(...)`, then applies the new guard only
  when the result is static and has a numeric value.
- `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimEnd`,
  `path.trimStart`, and `circle.radius` all route through
  `parseStaticFiniteAnimatedDouble(...)`.
- Dynamic behavior remains supported because `AnimatedDouble` objects with a
  Worklets `Synchronizable` return `isDynamic() == true` and skip the static
  numeric guard. `null` and `undefined` produce an unset `AnimatedDouble` with
  no value, so they also skip the rejection path.
- Worker 232's render-time dynamic policy is still intact:
  `AnimatedDouble::resolveNativeFloat()` classifies unset/valid/invalid values,
  and `YogaNode` render paths for blur, rrect, circle, and path trim use it
  before native `float` mutation.
- The direct verifier now covers non-finite plus native-float-overflow
  rejection for `circle.radius`, `rrect.cornerRadius`,
  `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd`. Each rejected
  case checks the original same-type command pointer and state are preserved.
- The generated Nitro materialization verifier repeats the same rejected-update
  coverage through materialized generated `setCommand(...)` wrappers.
- The focused rerun outputs explicitly state that dynamic Worklets-backed
  `AnimatedDouble` command behavior and dynamic invalid-mutation fail-closed
  behavior remain covered.

## Risks / Proof Boundary

This audit proves local host-JSC/native converter behavior, real
`YogaNode::setCommand(...)` direct delivery, generated host-JSC materialized
wrapper delivery, source inventory routing, and focused verifier behavior for
the current selected `AnimatedDouble` command fields.

It does not prove React Native bridge delivery, Nitro registry installation
inside a full React Native app runtime, iOS/Android build/run, simulator or
device presentation, UI-runtime Worklets execution, real Reanimated
`SharedValue` delivery, RNGH delivery, image/asset loading, exact render
fidelity, or future `AnimatedDouble` command fields added outside the guarded
inventory.

## Quality / Maintainability / Performance / Security

Quality: the validation is centralized at command conversion, before a
`NodeCommand` reaches `YogaNode::setCommand(...)`. The verifier coverage is
stateful rather than source-grep only.

Maintainability: future static `AnimatedDouble` command fields need to use the
same helper and extend both direct and generated verifier inventories.

Performance: the added work is constant-time numeric classification during
command conversion only, with no new render-path work for static values.

Security/robustness: rejecting non-finite and native-float-overflowing static
values prevents invalid `float` payloads from entering Skia-facing command
state and preserves prior valid state after rejected updates.

## Cleanup / Final Status

No product files, scripts, metadata, generated artifacts, or coordination docs
were edited. Ignored dependency artifacts were left untouched.

Final post-report checks:

- `git diff --check`: passed.
- `git status --short --branch`: only
  `?? worker-progress/worker-235-post-234-root-cause-audit.md` remains.

## Next Strongest Unblocked Root-Cause Target

Select command `SkPoint` native-float validation for `line.from`, `line.to`,
and `points.points[]` numeric coordinates.

Why it ranks next: after Worker 234, the `AnimatedDouble` static and dynamic
native-float gaps are closed. Path stroke numeric fields already check
post-narrowed floats, YogaNode method arguments have finite/native-float
validation, and hitSlop/text/paragraph/matrix/radius numeric surfaces are
covered. The clearest remaining source-confirmed float-narrowing gap is
`parseFinitePointNumber(...)`: it rejects only non-finite doubles, then
`parsePoint(...)` narrows those values into `SkPoint::Make(float, float)`.
Finite values larger than native `float` range can still become invalid point
coordinates.

Proposed objective: reject non-finite and native-float-overflowing command
point coordinates before same-type `LineCmd` or `PointsCmd` mutation in both
direct and generated `setCommand(...)` paths, while preserving valid point
payloads and existing point-object error behavior.

Likely files:

- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/<next-worker>.md`

Suggested verification:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run typecheck`
- `npm run check:feasible-matrix`
- `git diff --check`

Goal finished.
