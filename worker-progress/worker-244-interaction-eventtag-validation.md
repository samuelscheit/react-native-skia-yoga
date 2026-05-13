# Worker 244 - Interaction EventTag Validation

## Summary

Implemented deterministic raw/native validation for
`YogaNode.setInteractionConfig(config).eventTag`.

The native setter now accepts only the internal registry contract:

- `0` clears interaction.
- Positive integer tags enable interaction.
- The upper bound is JavaScript's safe-integer maximum
  (`9007199254740991`) so tags round-trip deterministically through JS numbers.

Invalid `eventTag` values now reject before any interaction state assignment.
The rejection path preserves `_pointerEvents`, `_hitSlop`, `_preciseHit`,
`_eventTag`, `_selfInteractive`, `_interactiveDescendantCount`, and parent
interactive descendant counts.

## Changed Files

- `cpp/YogaNode.cpp`
  - Added `toValidEventTag(...)` and a stable invalid-eventTag error.
  - Validates `eventTag` as finite, non-negative, integral, and <= JS safe
    integer.
  - Computes `preciseHit`/`eventTag` in locals before assigning interaction
    state, so invalid tags cannot partially apply pointer/hitSlop/precise state.
- `scripts/verify-yoganode-jsi-raw-methods.mjs`
  - Added host-JSC raw-method coverage for invalid `eventTag` values:
    `NaN`, `Infinity`, `-Infinity`, negative, fractional, and safe-integer
    overflow.
  - Each invalid case uses a config that would otherwise mutate pointerEvents,
    hitSlop, preciseHit, eventTag, self-interactive state, node interactive
    count, and parent interactive count.

`scripts/verify-gesture-interaction-runtime.mjs` was intentionally unchanged.
The public registry already allocates internal sequential numeric tags and
clears with `0`; this worker's root cause was the raw/native boundary.

## Commands Run

- `git status --short --branch`
- `git diff --check`
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`
- `node --check scripts/verify-gesture-interaction-runtime.mjs`
- `npm run check:yoganode-jsi-raw-methods`
- `npm run check:gesture-interaction-runtime`
- `npm run typecheck`
- `npm run check:feasible-matrix`
- `npm run check:yoganode-native-hit-testing`

All passed.

## Evidence Gathered

- `npm run check:yoganode-jsi-raw-methods` compiled and linked a host executable
  against real `YogaNode.cpp`, generated Nitro specs, React Native JSC, upstream
  Yoga, RN Skia macOS archives, and Nitro/JSI helper sources. The executable
  exercised real raw `setInteractionConfig()` and proved invalid `eventTag`,
  hitSlop, and hitTest numeric state-preservation cases.
- `npm run check:gesture-interaction-runtime` passed, preserving public
  registry behavior for event-tag allocation/reuse/cleanup and interaction
  dispatch.
- `npm run check:yoganode-native-hit-testing` passed as a standalone command,
  proving native hit-test traversal, pointerEvents behavior, hitSlop,
  precise-hit geometry, and interactive descendant count propagation still work.
- `npm run check:feasible-matrix` passed all 28 feasible local checks. It also
  re-ran the updated raw-method verifier inside the matrix and cleaned its temp
  artifacts.
- `npm run typecheck` passed.

## Proof Boundary And Risks

Proven:

- Raw/native `eventTag` rejects non-finite, negative, fractional, and
  above-safe-integer numeric values before interaction state mutation.
- Valid behavior for positive integer tags and `0` clear remains covered by the
  existing raw-method and public registry verifiers.
- Parent interactive descendant counts are preserved on rejected tag updates.

Not proven:

- iOS/Android app build or simulator/device runtime.
- React Native bridge delivery in a real app runtime.
- UI-runtime Worklets execution or RNGH native delivery.
- Exhaustive validation of arbitrary nonnumeric raw `eventTag` payloads beyond
  the native source policy; the public TypeScript registry only forwards
  numeric tags.

Risk:

- This is intentionally stricter at the raw/native boundary: if an external raw
  caller supplied `eventTag: undefined` or another nonnumeric value and relied
  on the previous implicit clear behavior, that call now rejects. Public package
  calls continue to send either `0` or a positive registry integer.

## Cleanup Status

- No generated tracked artifacts remain from the verification run.
- `npm run check:feasible-matrix` reported that it removed its matrix temp
  parent and its transient `tsconfig.tsbuildinfo`.
- The worktree diff is limited to the native implementation, raw-method
  verifier, and this worker report.

## Recommended Next Tasks

Next target recommendation: audit remaining raw/native numeric entry points that
can mutate long-lived interaction or layout state before validation. If no
similar raw boundary remains, move to platform build/runtime validation once
iOS/Android prerequisites are available.

Goal finished.
