# Worker 223: Post-Worker 222 Root-Cause Audit

## Summary

Accepted Worker 222's path stroke numeric finite-validation boundary. The
implementation closes the intended local gap for `stroke.width`,
`stroke.miter_limit`, `stroke.miterLimit`, and `stroke.precision` without
changing omitted/null stroke behavior, direct `StrokeOpts` top-level object
requirements, public `miter_limit` precedence, alias fallback, or join/cap
parsing.

No correctness blocker was found. The next strongest locally unblocked
root-cause target is deterministic finite-number validation for interaction
`hitSlop` numeric payloads across JS normalization and native
`YogaNode.setInteractionConfig(...)` parsing.

## Evidence Reviewed

- `MASTER_PLAN.md` and `MASTER_PROGRESS.md` latest state: Worker 222 is the
  latest accepted implementation, and platform app/runtime proof remains
  outside the feasible local matrix.
- `worker-progress/worker-222-path-stroke-numeric-finite-validation.md`.
- Worker 222 implementation and merge history:
  - `3ea9bb3 Validate path stroke numeric payloads`
  - `d4f868a Merge worker 222 path stroke finite validation`
  - `317e399 Accept worker 222 path stroke validation`
- Source inspected:
  - `cpp/JSIConverter+StrokeOpts.hpp`
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `src/specs/commands.ts`
  - `src/interactivity.ts`
  - `cpp/YogaNode.cpp`
  - focused verifier scripts for native commands/render, Nitro
    materialization, raw JSI methods, native hit testing, and gesture
    interaction runtime.

## Commands Run

- `git diff --check d4f868a^1 d4f868a` - passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-native-commands-render` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run check:feasible-matrix` - passed, 28/28 commands in 5m 11s.

## Findings

- Direct `JSIConverter<RNSkia::StrokeOpts>::fromJSI(...)` now rejects
  non-finite `width`, public `miter_limit`, alias `miterLimit`, and
  `precision` values. It checks both the original JS number and the narrowed
  `float`, so finite-but-too-large values cannot silently become float
  infinity.
- Public `NodeCommand` path parsing uses finite-checked stroke helpers before
  constructing `PathCommandData::StrokeOptsData`, so rejected payloads fail
  before `YogaNode::setCommand(...)` can replace an existing same-type
  `PathCmd`.
- Direct `StrokeOpts` top-level `null`, `undefined`, number, boolean, and
  string payloads still reject through the existing object-only converter
  contract. Path command `stroke` omission and `stroke: null` still mean no
  stroke.
- Public-key precedence is preserved: if `miter_limit` exists, it is read
  instead of `miterLimit`; alias-only payloads still fall back to
  `miterLimit`. The native verifier covers direct invalid-public-with-alias
  rejection and valid path alias precedence; the source helper applies the same
  precedence to command parsing.
- Join and cap parsing remain unchanged. Existing valid numeric/string join
  and cap cases pass, and invalid join/cap rejection remains covered.
- Native command/render and generated Nitro materialization proof both assert
  prior `PathCmd` pointer and stroke state preservation after rejected
  non-finite stroke updates.
- Worker 222 did not overclaim platform/runtime proof. The accepted boundary is
  host-JSC/native conversion, real `YogaNode::setCommand(...)`, generated
  materialized `setCommand(path)`, and bounded raster/command proof only.

## Recommended Next Target

Select interaction `hitSlop` finite validation next.

Why it ranks first:

- It is source-confirmed and public-facing: `YogaHitSlop` accepts a scalar or
  edge object, and `src/interactivity.ts` currently normalizes numeric values
  without finite checks.
- The native raw method boundary also accepts unchecked numbers:
  `YogaNode::setInteractionConfig(...)` casts scalar `hitSlop` and object
  `left/right/top/bottom/horizontal/vertical` values to `float` through
  `asNumber()` / `getNumericProperty(...)`.
- Non-finite hit slop can affect hit bounds in `containsSelfAtPoint(...)`,
  which is central interaction routing rather than a cosmetic render detail.
- The proof is locally unblocked: `check:gesture-interaction-runtime` covers JS
  registry normalization, `check:yoganode-jsi-raw-methods` enters the real JSC
  `setInteractionConfig(...)` parser, and `check:yoganode-native-hit-testing`
  covers native hit-test behavior after normalized fields are set.

Suggested implementation shape:

- Add finite checks to JS `normalizeHitSlop(...)` for scalar and edge-object
  payloads, with stable errors before forwarding config to native.
- Add matching native finite checks in `YogaNode::setInteractionConfig(...)`
  for scalar hitSlop and object edge/horizontal/vertical values, including
  post-addition finite validation for combined edge plus axis values.
- Extend the gesture interaction and raw-method verifiers with NaN/Infinity
  rejection cases and state-preservation checks for the previous valid
  `_hitSlop`, `_pointerEvents`, `_preciseHit`, `_eventTag`, and interaction
  count state.

## Remaining Finite-Validation Ranking

1. Interaction `hitSlop`: strongest local target for the reasons above.
2. Text and paragraph style numeric leaves: `applyTextStyle(...)` still reads
   many public-shaped numeric fields with `asNumber()`, including font size,
   decoration thickness/style, font feature values, font style fields,
   height/spacing, shadow blur, and text baseline. This is locally testable
   through command/render and materialized `setCommand(text/paragraph)`, but it
   is a broader inventory and typography proof boundary.
3. Dynamic `AnimatedDouble` values after `Synchronizable` mutation: Worker 220
   intentionally validates only static numbers. Local host-JSC proof can mutate
   `Synchronizable` values, but a policy for dynamic rejection/fallback needs
   care because UI-runtime Worklets and Reanimated delivery remain outside
   local proof.
4. Raw `hitTest(x, y)` and generated `computeLayout(width, height)` numeric
   arguments: both cast unchecked numbers, and local host-JSC coverage exists.
   They are less direct than public `hitSlop` authoring and should follow a
   clear API-contract decision.
5. Platform app/runtime proof remains high value overall but locally blocked
   by the established CocoaPods, Android SDK/build-tools, simulator/device, and
   native app runtime boundaries.

## Review

Quality: Worker 222 localized validation at converter boundaries and added
stable field labels. The negative tests exercise both direct native conversion
and generated materialized delivery.

Maintainability: The source guards make the public path stroke inventory
visible. Future numeric command fields should extend the same command and
materialized verifier inventories in the implementation that adds them.

Performance: The new checks are constant-time and run only when optional
stroke numeric fields are present during conversion.

Security and robustness: Rejecting non-finite stroke values prevents invalid
numbers from reaching Skia path stroke state and preserves previous command
state after invalid updates.

## Proof Boundary

Proven: direct `StrokeOpts` conversion, public `NodeCommand` path parsing,
generated materialized `setCommand(path)`, same-type `PathCmd` state
preservation, public/alias miter key behavior, omitted/null stroke semantics,
join/cap preservation, and the full feasible local matrix.

Not proven: actual React Native bridge delivery, Nitro registry install inside
a full app, iOS/Android build or simulator/device runtime, native platform
presentation, UI-runtime Worklets execution, real Reanimated delivery, RNGH
native delivery, exact GPU/path geometry fidelity, or exhaustive future command
numeric fields outside the guarded inventory.

Goal finished.
