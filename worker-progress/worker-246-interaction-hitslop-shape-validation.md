# Worker 246 - Interaction HitSlop Shape Validation

## Summary

Implemented strict `hitSlop` type/shape validation for the public interaction
registry and the raw/native `YogaNode.setInteractionConfig(config)` boundary.

The accepted policy is:

- Omitted, `null`, or `undefined` top-level `hitSlop` keeps the default empty
  insets.
- Scalar `hitSlop` must be a finite native-float-range number.
- Object `hitSlop` must be a non-array object.
- Missing, `null`, or `undefined` object leaves default to `0`.
- Present non-null/non-undefined object leaves must be finite
  native-float-range numbers.
- Edge plus axis sums must remain finite native-float-range numbers.
- Strings, booleans, arrays, functions, symbols, and other nonnumeric
  top-level/leaves reject before registry or native interaction state mutation.

The managed Worker 246 agent stalled after partial scoped edits, so
orchestration completed and verified the implementation in the assigned Worker
246 worktree.

## Changed Files

- `src/interactivity.ts`
  - Replaced pass-through `hitSlop` leaf handling with number-only validation.
  - Rejects top-level non-number/non-object values and arrays before event tags
    or handlers are allocated.
  - Validates combined edge plus horizontal/vertical values after addition.
- `cpp/YogaNode.cpp`
  - Rejects present nonnumeric raw `hitSlop` object leaves.
  - Rejects top-level raw `hitSlop` arrays and non-number/non-object values.
  - Preserves omitted/null/undefined defaults.
  - Keeps rejection before `_pointerEvents`, `_hitSlop`, `_preciseHit`,
    `_eventTag`, `_selfInteractive`, or descendant counts are assigned.
- `scripts/verify-gesture-interaction-runtime.mjs`
  - Added public registry rejection cases for string, boolean, array, function,
    symbol, and nonnumeric object-leaf `hitSlop` payloads.
  - Existing assertions prove invalid values do not call
    `setInteractionConfig`, consume event tags, or replace handlers.
- `scripts/verify-yoganode-jsi-raw-methods.mjs`
  - Added raw host-JSC rejection cases for string, boolean, array, and
    nonnumeric object-leaf `hitSlop` payloads.
  - Updated proof text to name hitSlop numeric/shape coverage.

## Commands Run

- `git diff --check`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-gesture-interaction-runtime.mjs`
- `npm run check:gesture-interaction-runtime`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:yoganode-native-hit-testing`
- `npm run typecheck`
- `npm run check:feasible-matrix`
- `git status --short --branch`

All passed. The full feasible matrix passed all 28 commands in `5m 36s`.

## Proof Boundary And Risks

Proven:

- Public registry invalid `hitSlop` shape/type payloads reject before native
  forwarding and before registry tag/handler mutation.
- Raw/native invalid `hitSlop` shape/type payloads reject before interaction
  state assignment and parent interactive descendant count mutation.
- Existing valid scalar/object `hitSlop`, `eventTag`, hit testing, gesture
  dispatch, native hit testing, and package/source/example feasible checks
  remain green.

Not proven:

- iOS/Android app build or simulator/device runtime.
- React Native bridge delivery in a real app runtime.
- UI-runtime Worklets execution or RNGH native delivery.

Risk:

- This is intentionally stricter for bad runtime payloads. Public TypeScript
  callers already type `hitSlop` as numeric scalar/object values; untyped
  callers that relied on strings, booleans, arrays, or malformed object leaves
  being silently treated as zero will now receive an error.

## Cleanup Status

- No generated tracked artifacts remain from verification.
- The feasible matrix removed its temp parent.
- Ignored `node_modules`, `example/node_modules`, and `tsconfig.tsbuildinfo`
  remain local worktree artifacts.

## Recommended Next Target

Run a post-Worker 246 root-cause audit to accept this stricter interaction
boundary and rank the next locally unblocked target. The audit should focus on
remaining raw/native interaction config shape policies first, then fall back to
platform build/runtime validation if no local source-boundary gap remains.

Goal finished.
