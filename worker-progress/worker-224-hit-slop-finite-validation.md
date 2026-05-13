# Worker 224: HitSlop Finite-Number Validation

## Summary

Added deterministic finite-native-float validation for interaction `hitSlop`
numeric payloads at both public JS normalization and native
`YogaNode.setInteractionConfig(config)` parsing boundaries.

The implementation rejects `NaN`, `Infinity`, `-Infinity`, finite JS/native
numbers that overflow a native `float`, and object edge plus
`horizontal`/`vertical` sums that overflow a native `float`. Rejection happens
before native interaction state mutates. JS normalization now also validates
before registry tag/handler mutation and before calling
`setInteractionConfig(...)`.

Omitted/default behavior is preserved: omitted `hitSlop` still normalizes to
empty insets, and omitted object edge/axis fields still default to `0`.
Unsupported non-number payload behavior was intentionally left unchanged except
where the payload is a numeric finite-validation case.

## Changed Files

- `src/interactivity.ts`
  - Added finite-native-float validation for scalar `hitSlop`.
  - Added per-leaf and post-addition validation for object
    `left/right/top/bottom/horizontal/vertical`.
  - Moved hitSlop normalization before registry tag/handler mutation and
    native forwarding.
- `cpp/YogaNode.cpp`
  - Added native finite-native-float parsing helpers.
  - Validates scalar hitSlop, object numeric leaves, and edge plus axis sums
    before assigning `_hitSlop`, `_pointerEvents`, `_preciseHit`, `_eventTag`,
    or interaction count state.
- `scripts/verify-gesture-interaction-runtime.mjs`
  - Added JS negative coverage for scalar and object `NaN`, `Infinity`,
    `-Infinity`, finite native-float overflow, and combined edge/axis overflow.
  - Proves invalid JS normalization does not forward to native, does not
    replace existing handlers, and does not consume event tags.
  - Strengthened omitted-hitSlop default assertions.
- `scripts/verify-yoganode-jsi-raw-methods.mjs`
  - Added native raw-method state snapshots for invalid hitSlop updates.
  - Proves rejected native updates preserve `_hitSlop`, `_pointerEvents`,
    `_preciseHit`, `_eventTag`, `_selfInteractive`,
    `_interactiveDescendantCount`, and parent interactive descendant count.

## Commands Run

- `node --check scripts/verify-gesture-interaction-runtime.mjs` - passed.
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs` - passed.
- `npm run typecheck` - passed.
- `npm run check:gesture-interaction-runtime` - passed.
- `npm run check:yoganode-jsi-raw-methods` - passed.
- `npm run check:yoganode-native-hit-testing` - passed.
- `git diff --check` - passed.
- `npm run check:feasible-matrix` - passed, 28/28 commands in 5m 5s.

## Evidence Gathered

- JS runtime proof covers scalar `hitSlop` invalid numbers, every object
  numeric key (`left`, `right`, `top`, `bottom`, `horizontal`, `vertical`),
  finite native-float overflow, and post-addition overflow for both horizontal
  and vertical axis composition.
- JS proof shows invalid hitSlop rejects before `setInteractionConfig(...)`,
  before replacing prior handlers, and before consuming event tags for a new
  node.
- Native host-JSC proof enters the real `YogaNode::setInteractionConfig(...)`
  implementation and validates scalar, leaf, and combined overflow rejection.
- Native state-preservation proof snapshots and rechecks hitSlop insets,
  pointer-events mode, precise-hit flag, event tag, self-interactive flag, node
  interactive count, and parent interactive count after each rejected update.
- Native hit-testing proof still passes finite hitSlop expansion/bounds checks
  through `YogaNode::hitTestTagAt(...)` and descendant-count propagation.
- Full feasible matrix passed after the implementation and verifier changes.

## Proof Boundary and Overclaim Risks

Proven locally: JS `YogaInteractionRegistry` normalization behavior; direct
host-JSC execution of native raw `YogaNode.setInteractionConfig(...)`;
state preservation for invalid hitSlop before native mutation; finite native
hit-test behavior for already-valid finite hitSlop state; and the full accepted
feasible local matrix.

Not proven: React Native bridge delivery inside an app, iOS/Android build or
simulator/device launch, CocoaPods/Gradle integration, native platform
presentation, UI-runtime Worklets execution, real Reanimated delivery, RNGH
native delivery, or exhaustive future interaction fields outside the guarded
hitSlop inventory.

Unsupported-type behavior remains intentionally narrow: non-number unsupported
hitSlop payloads continue through the existing fallback/coercion paths unless
they are numeric values now rejected by finite-native-float validation.

## Cleanup Status

No worker-owned generated artifacts remain. `npm run check:feasible-matrix`
reported no newly created tracked artifacts and removed its matrix temp parent.
Pre-existing ignored/local artifacts were preserved.

## Recommended Next Tasks

1. Add deterministic finite-number validation for public text and paragraph
   style numeric leaves. Worker 223 identified this as the next broad
   source-confirmed surface after interaction hitSlop.
2. Decide a policy for dynamic `AnimatedDouble` mutation-time finite
   validation; static command values are guarded, but runtime
   `Synchronizable::setBlocking(...)` updates still need an explicit contract.
3. Consider finite validation for raw `hitTest(x, y)` and generated
   `computeLayout(width, height)` arguments after the public authoring surfaces
   are closed.

## Review

Quality: validation is localized at the two conversion boundaries and tests
cover both public JS normalization and native raw parsing.

Maintainability: helper names and error messages keep the guarded hitSlop
inventory visible. Object leaf validation and combined edge/axis validation are
separate so future fields can follow the same shape.

Performance: checks are constant-time and only run during interaction config
updates. Hit-test traversal does not pay extra cost after configuration.

Security and robustness: rejecting non-finite and float-overflowing hitSlop
prevents invalid bounds from entering hit testing and prevents rejected updates
from corrupting prior interaction state.

Goal finished.
