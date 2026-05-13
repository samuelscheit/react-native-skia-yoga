# Worker 231: Post-Worker 230 Root-Cause Audit

## Objective

Audit whether Worker 230 correctly and narrowly added deterministic
finite/native-float validation for:

- generated/materialized `YogaNode.computeLayout(width, height)`
- raw `YogaNode.hitTest(x, y)`

The audit specifically checked validation placement before layout/hit-test side
effects, optional `computeLayout` behavior, invalid-number coverage,
property-specific errors, state preservation, and absence of unrelated churn.

## Worktree/Branch

- Worktree:
  `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-231-post-230-root-cause-audit`
- Branch: `worker/231-post-230-root-cause-audit`
- Launch HEAD: `b510c40 Accept worker 230 YogaNode method validation`

## Files/Commits Inspected

- Main acceptance: `b510c40 Accept worker 230 YogaNode method validation`
- Worker 230 merge: `6e77e8b Merge worker 230 YogaNode method numeric validation`
- Worker 230 implementation: `7062da0 Validate YogaNode method numeric payloads`
- Prior audit selector: `worker-progress/worker-229-post-228-root-cause-audit.md`
- Worker 230 report:
  `worker-progress/worker-230-yoganode-method-numeric-validation.md`
- Product and verifier files changed by Worker 230:
  - `cpp/YogaNode.cpp`
  - `scripts/verify-yoganode-jsi-raw-methods.mjs`
  - `scripts/verify-yoganode-nitro-materialization.mjs`

## Worker 230 Acceptance Audit

Accepted Worker 230. I found no correctness blocker.

`cpp/YogaNode.cpp` now has one scoped method-number guard,
`toFiniteYogaNodeMethodFloat(...)`, which rejects non-finite doubles and values
whose absolute value exceeds `std::numeric_limits<float>::max()`. The error
prefix is method-specific:

`Invalid numeric YogaNode method value for <property>: expected a finite native float.`

`YogaNode::computeLayout(...)` validates optional `width` and `height` with
property paths `computeLayout.width` and `computeLayout.height` before either
value is narrowed to `float`, before `YGNodeCalculateLayout(...)`, and before
`recursiveSetLayout()` mutates `_layout` / `_hasLayoutBeenComputed`. Omitted
optionals still become `YGUndefined`.

`YogaNode::hitTest(...)` preserves the existing missing/nonnumeric argument
error, then validates numeric `x` and `y` with property paths `hitTest.x` and
`hitTest.y` before calling `hitTestTagAt(...)`. That means invalid numbers are
rejected before `hitTestTagAt(...)` can implicitly call `computeLayout(...)` or
enter recursive hit-test traversal.

The raw JSI verifier now snapshots interaction state, layout state, and parent
interactive-descendant count, then proves invalid raw `hitTest(...)` numbers do
not compute layout or mutate that state. It covers `hitTest.x` NaN,
`hitTest.x` Infinity, `hitTest.y` -Infinity, and `hitTest.y`
native-float overflow with property-specific error substrings.

The Nitro materialization verifier now proves generated
`computeLayout(...)` accepts both omitted optional arguments and explicit
`undefined` optional arguments. It also snapshots layout state and proves
invalid generated `computeLayout(...)` numbers do not mutate existing computed
layout state or compute a fresh previously-uncomputed layout. It covers
`computeLayout.width` NaN, `computeLayout.width` -Infinity,
`computeLayout.height` Infinity, `computeLayout.height` native-float overflow,
and a fresh-node `computeLayout.width` native-float overflow case.

The changed-file set is narrow: one product file, two verifier scripts, and
Worker 230's report. No unrelated product/generated churn was accepted.

## Verification Rerun Results

All requested reruns passed in this worker worktree:

- `git diff --check 6e77e8b^1 6e77e8b`: passed.
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-jsi-raw-methods`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed 28/28 commands in 4m14s.

The feasible matrix removed its newly created tracked `tsconfig.tsbuildinfo`,
reported no remaining new tracked artifacts, and removed its matrix-owned temp
parent `/tmp/rnskia-feasible-matrix-WJJXGi`.

## Residual Risks/Proof Boundary

This audit proves the Worker 230 boundary through source inspection,
host-native/raw JSI execution, generated host-JSC Nitro materialization, and
the accepted feasible local matrix.

It does not prove React Native bridge delivery inside a real app, Nitro module
registry installation in a React Native runtime, CocoaPods or Gradle builds,
iOS/Android simulator or device launch, native platform presentation,
UI-runtime Worklets execution, real Reanimated delivery, RNGH native delivery,
exact Yoga conformance beyond asserted values, or future YogaNode methods added
outside this guarded inventory.

The invalid-number tests are representative by method and property label, not a
full cartesian matrix of every invalid category on every property. The shared
native helper and verifier source guard support the broader finite/native-float
claim for all four guarded properties.

## Next Strongest Locally Unblocked Root-Cause Target Recommendation

Select dynamic `AnimatedDouble` mutation-time numeric validation policy and
implementation as the next strongest locally unblocked target.

Why it ranks next: the recent finite-validation sequence has closed the public
style, layout, matrix/transform, radius, command point, static AnimatedDouble,
path stroke, hitSlop, text/paragraph style, command enum, and YogaNode method
numeric boundaries. The remaining source-confirmed numeric risk is dynamic
`AnimatedDouble` resolution after a `Synchronizable` mutates: local coverage
already proves dynamic extraction, fallback, main-runtime resolution, and
`setBlocking(...)` mutation observation, but it does not reject or define a
fail-closed policy for non-finite/native-overflow dynamic values observed after
the command has been installed.

Recommended shape: first make the policy explicit, then add focused local proof
through `check:animated-double-synchronizable` and selected dynamic
`check:yoganode-native-commands-render` cases. The proof should stay honest:
host-JSC/native mutation observation is locally unblocked, while UI-runtime
Worklets and real Reanimated delivery remain outside the local matrix.

## Cleanup/Final Git Status

The feasible matrix cleaned its temp parent and matrix-created tracked build
info. Ignored/local artifacts such as `node_modules/`, `example/node_modules/`,
`example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
`tsconfig.tsbuildinfo` were not manually removed.

Final status after writing this report:

```text
## worker/231-post-230-root-cause-audit
?? worker-progress/worker-231-post-230-root-cause-audit.md
```

Goal finished.
