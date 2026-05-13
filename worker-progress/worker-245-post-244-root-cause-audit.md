# Worker 245 - Post-244 Root-Cause Audit

## Summary

Accepted Worker 244's `eventTag` validation boundary.

Worker 244 moved raw/native
`YogaNode.setInteractionConfig(config).eventTag` to deterministic validation:
only `0` or positive JavaScript safe integers are accepted, and invalid tags
reject before `_pointerEvents`, `_hitSlop`, `_preciseHit`, `_eventTag`,
`_selfInteractive`, or interactive descendant counts are assigned.

The next strongest locally unblocked target is interaction `hitSlop` type/shape
hardening. Numeric invalid `hitSlop` values are covered, but present nonnumeric
`hitSlop` values can still be silently defaulted before interaction state is
applied.

## Worker 244 Acceptance Decision

Accepted.

Source review:

- `cpp/YogaNode.cpp:263-278` adds the `eventTag` rejection path and validates
  finite, non-negative, integral, JavaScript-safe values.
- `cpp/YogaNode.cpp:2107-2118` computes `preciseHit` and `nextEventTag` before
  assigning persistent state.
- `cpp/YogaNode.cpp:2121-2125` performs the only interaction state assignment
  after `eventTag` validation has succeeded.
- `scripts/verify-yoganode-jsi-raw-methods.mjs:940-977` covers `NaN`,
  `Infinity`, `-Infinity`, negative, fractional, and safe-integer overflow
  `eventTag` values.

The intentional behavior change is acceptable: present nonnumeric `eventTag`
now rejects instead of implicitly clearing. That matches the internal registry
contract and prevents invalid raw callers from mutating interaction state.

## Verification Run

Run from assigned worktree:
`/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-245-post-244-root-cause-audit`.

Passed:

- `git diff --check HEAD~2 HEAD`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-gesture-interaction-runtime.mjs`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:gesture-interaction-runtime`
- `npm run check:yoganode-native-hit-testing`
- `npm run typecheck`

I did not rerun the full feasible matrix in this report-only fallback because
the orchestrator had just run it after the Worker 244 merge from `main`, and it
passed all 28 checks in `5m 41s`. This audit branch contains only this report.

## Remaining Raw/Native Numeric Audit

Covered boundaries:

- Raw `hitTest(x, y)` rejects nonnumbers, non-finite values, and native-float
  overflow before implicit layout or hit testing in `cpp/YogaNode.cpp:2046-2058`.
- Generated/raw `computeLayout(width, height)` uses
  `toFiniteYogaNodeMethodFloat(...)` before `YGNodeCalculateLayout(...)` in
  `cpp/YogaNode.cpp:1876-1881`.
- Generated `setStyle(...)` validates layout strings, background colors,
  numeric style fields, radius fields, matrix arrays, and transform fields
  before resetting Yoga, paint, clip, layer, matrix, or layout state in
  `cpp/YogaNode.cpp:916-925`.
- `NodeCommand`, `StrokeOpts`, text/paragraph style, `SkMatrix`, and
  `AnimatedDouble` numeric paths have explicit converter/runtime validation and
  are covered by the native command/render, Nitro materialization, and
  AnimatedDouble verifiers.

Remaining gap:

- `src/interactivity.ts:88-100` validates finite/native-float range only when a
  `hitSlop` value is already a number; nonnumbers pass through.
- `src/interactivity.ts:103-158` treats any truthy non-number `hitSlop` as a
  record and can produce nonnumeric normalized leaves before forwarding native
  config.
- `cpp/YogaNode.cpp:310-319` treats present nonnumeric object leaves as missing
  and returns the fallback.
- `cpp/YogaNode.cpp:2082-2104` ignores top-level nonnumber/nonobject `hitSlop`
  and silently defaults object leaves that are present but nonnumeric, then
  later applies `_pointerEvents`, `_hitSlop`, `_preciseHit`, and `_eventTag`.
- Existing JS/runtime coverage at
  `scripts/verify-gesture-interaction-runtime.mjs:394-438` covers numeric
  invalid cases, but not string/object/non-number shape cases.
- Existing raw-native coverage at
  `scripts/verify-yoganode-jsi-raw-methods.mjs:819-938` covers numeric invalid
  cases, but not present nonnumeric `hitSlop` top-level values or object leaves.

This is locally actionable and root-cause level because a bad runtime JS payload
can be accepted as defaulted `hitSlop` while the rest of the interaction config
is applied.

## Risks And Proof Boundaries

This audit does not claim iOS/Android app build/run, simulator/device runtime,
React Native bridge delivery in a real app, UI-runtime Worklets execution, or
RNGH native delivery.

The managed Worker 245 agent stalled without tracked output, so this report was
completed as an orchestrator fallback in the assigned Worker 245 worktree.

## Recommended Next Worker

Worker 246 should implement interaction `hitSlop` type/shape validation across
the public registry and raw/native boundary.

Expected scope:

- `src/interactivity.ts`: reject nonnumeric top-level `hitSlop`, nonobject
  truthy `hitSlop`, present nonnumeric object leaves, and nonnumeric combined
  edge/axis results before mutating registry tags or handlers.
- `cpp/YogaNode.cpp`: reject present nonnumeric raw `hitSlop` values and
  present nonnumeric object leaves before interaction state assignment.
- `scripts/verify-gesture-interaction-runtime.mjs`: add public registry
  state-preservation coverage for nonnumeric `hitSlop` payloads.
- `scripts/verify-yoganode-jsi-raw-methods.mjs`: add raw host-JSC
  state-preservation coverage for nonnumeric `hitSlop` payloads.

Suggested verification:

- `git diff --check`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-gesture-interaction-runtime.mjs`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:gesture-interaction-runtime`
- `npm run check:yoganode-native-hit-testing`
- `npm run typecheck`
- `npm run check:feasible-matrix`

Goal finished.
