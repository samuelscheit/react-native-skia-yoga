# Worker 182 - Post-worker-181 Root-cause Audit

## Summary

Accepted Worker 181's scalar global `style.borderRadius`
generated/materialized and native hit-test proof as scoped.

Worker 181's materialization case calls generated
`setStyle({ borderRadius: 17 })` through a materialized `YogaNode` JS object
and proves the requested native state: NativeState/cached-object identity,
`_style.borderRadius`, `_clipsToBounds`, all four `_clipToBoundsRadii`, no
per-corner style fields, and no explicit `style.clip` / `_clipPath` /
`_clipRect` / `_clipRRect` state.

Worker 181's native hit-test case sets direct native scalar
`NodeStyle.borderRadius = 30`, inserts a full-size interactive child, rejects
all four rounded-corner points, and accepts representative in-bounds rounded
points that return the child tag.

No repair is needed.

## Changed files

- `worker-progress/worker-182-post-181-root-cause-audit.md`

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed with
  no output.
- `node --check scripts/verify-yoganode-native-hit-testing.mjs`: passed with no
  output.
- `npm run check:yoganode-nitro-materialization`: passed. Output explicitly
  reported generated materialized global `borderRadius` delivery into
  `_style.borderRadius`, `_clipsToBounds`, and all four
  `_clipToBoundsRadii` slots without per-corner or explicit clip state.
- `npm run check:yoganode-native-hit-testing`: passed. Output explicitly
  reported scalar global `borderRadius` clipping in the exercised
  `YogaNode::hitTestTagAt` / `hitTestInternal` path.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 8s. The matrix
  reran both Worker 181 verifiers, removed its generated `tsconfig.tsbuildinfo`
  cleanup target, removed its matrix-owned temp parent, and reported no
  remaining new tracked artifacts.

Platform/toolchain reprobe:

- `xcode-select -p`: passed, output `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed with exit code 1:
  `SDK "iphonesimulator" cannot be located`, repeated by `xcrun`, then
  `unable to lookup item 'Path' in SDK 'iphonesimulator'`.
- `command -v pod gradle adb cmake ninja`: failed with exit code 1 and no
  output.
- Per-tool follow-up: `pod=not found`, `gradle=not found`, `adb=not found`,
  `cmake=not found`, `ninja=not found`.
- `java -version`: failed with exit code 1: unable to locate a Java Runtime.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

## Evidence gathered

- `worker-progress/worker-181-border-radius-materialized-hit-test.md` states the
  intended proof boundary: host-JSC generated YogaNode materialization for
  scalar `borderRadius` delivery into native state, plus host-native
  `YogaNode::hitTestTagAt` / `hitTestInternal` behavior for scalar rounded
  bounds clipping.
- Worker 181 commit `76c1ea8` added the focused materialization and hit-test
  verifier coverage.
- `scripts/verify-yoganode-nitro-materialization.mjs:1494` builds the JS style
  object with only `borderRadius = 17`.
- `scripts/verify-yoganode-nitro-materialization.mjs:2361` calls generated
  `setStyle(...)` from the materialized object, then asserts NativeState wraps
  the original node and repeated `toObject(runtime)` returns the cached JS
  object.
- `scripts/verify-yoganode-nitro-materialization.mjs:2380` asserts
  `_style.borderRadius = 17`, absence of `borderTopLeftRadius`,
  `borderTopRightRadius`, `borderBottomRightRadius`, and
  `borderBottomLeftRadius`, `_clipsToBounds`, and populated
  `_clipToBoundsRadii`.
- `scripts/verify-yoganode-nitro-materialization.mjs:2391` asserts all four
  SkRRect corner slots equal `(17, 17)`.
- `scripts/verify-yoganode-nitro-materialization.mjs:2397` asserts no explicit
  `style.clip`, `_clipPath`, `_clipRect`, or `_clipRRect` state.
- `scripts/verify-yoganode-native-hit-testing.mjs:777` sets scalar
  `borderRadius = 30` on a direct native style and asserts the same scalar
  state, no per-corner state, no explicit clip state, and all four
  `_clipToBoundsRadii` slots.
- `scripts/verify-yoganode-native-hit-testing.mjs:803` inserts a full-size
  child with event tag `506`, then rejects `(1,1)`, `(99,1)`, `(99,99)`, and
  `(1,99)` and accepts `(30,10)`, `(70,10)`, `(70,90)`, and `(30,90)`.
- `cpp/YogaNode.cpp:712` includes scalar `style.borderRadius` in the rounded
  clip-to-bounds predicate; `cpp/YogaNode.cpp:718` maps the scalar to all four
  `_clipToBoundsRadii` slots; `cpp/YogaNode.cpp:1374` consumes clipping in
  hit testing.
- `worker-progress/worker-180-post-179-root-cause-audit.md` selected this exact
  Worker 181 target after accepting Worker 179's host-raster proof and
  explicitly left public/Reconciler-specific global `borderRadius` dynamic
  coverage as a follow-up after the generated/native gap.

## Proof boundary and overclaim risks

Accepted proof boundary:

- Host-JSC Nitro `YogaNode::toObject(runtime)` / generated-prototype
  materialization for scalar `setStyle({ borderRadius })` delivery.
- Generated materialized wrapper delivery into real native `YogaNode` state for
  `_style.borderRadius`, `_clipsToBounds`, and all four
  `_clipToBoundsRadii`.
- Explicit separation from per-corner style radius fields and explicit
  `style.clip` path/rect/rrect state.
- Host-native `YogaNode::hitTestTagAt` / `hitTestInternal` rounded-bounds
  clipping for scalar global `borderRadius`.

Not proven:

- React Native bridge delivery.
- Nitro module registry installation inside a React Native runtime.
- Reconciler delivery of scalar `style.borderRadius` beyond existing generic
  style-path coverage.
- UI-runtime Worklets execution or real Reanimated SharedValue delivery.
- RNGH native delivery or end-to-end gesture dispatch.
- iOS/Android app build or launch, simulator/device behavior, platform-native
  presentation, or platform app runtime behavior.
- Exact render fidelity, exact GPU clipping, exact typography, image loading,
  or asset decoding.

Overclaim risks to avoid:

- Do not describe Worker 181 as platform-native app proof while the simulator
  SDK, CocoaPods, Java, Android SDK variables, Gradle, ADB, CMake, and Ninja
  remain unavailable.
- Do not describe the direct native hit-test case as React Native/RNGH event
  delivery; interaction fields are set directly at the JSI config boundary.
- Do not describe the host-JSC materialization case as full React Native runtime
  registry proof.
- Do not collapse global scalar `borderRadius` with the per-corner style-radius
  contract; they share the lower clipping consumer but enter through distinct
  style fields.

## Cleanup status

- Report-only scope was preserved.
- No product source, verifier script, package metadata, generated specs, docs,
  or example native folders were edited by this worker.
- Ambiguous local artifacts such as `node_modules`, `example/node_modules`,
  `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
  `tsconfig.tsbuildinfo` were preserved unless the feasible matrix removed its
  own generated `tsconfig.tsbuildinfo` cleanup target.
- `check:feasible-matrix` removed its matrix-owned temp parent and reported no
  remaining new tracked artifacts after cleanup.
- No nested subagents or explorers were used.
- The worktree was clean before this report was written.

## Recommended next tasks

- Assign the next locally unblocked root-cause target to public/Reconciler
  scalar global `style.borderRadius` dynamic-contract proof. Anchors:
  `src/specs/style.ts:234` exposes only `borderRadius?: number`;
  `src/jsx.ts:118` routes non-special style keys through generic
  `YogaAnimatedStyleProp`, which should admit `SharedValue<number>`;
  `src/Reconciler.ts:625` routes style SharedValues through the generic JS
  style-listener path; `scripts/verify-package-typescript-consumer.mjs:379`
  currently has only static `borderRadius` coverage; and
  `scripts/verify-reconciler-animated-bindings.mjs` has no `borderRadius`
  specific case.
- That follow-up should add packed-consumer positive coverage for
  `style.borderRadius: SharedValue<number>`, negative coverage for non-number
  `borderRadius` shapes, and a Reconciler source-level case proving a top-level
  `borderRadius` listener key, initial snapshot, update, invalidation, full
  style rebuild, cleanup, ignored late emits, and no native command mirror.
- Consider adding an explicit Reconciler runtime shape guard for scalar
  `borderRadius` so invalid dynamic payloads fail before crossing into native
  conversion.
- Keep platform-native build/run, React Native bridge/runtime registry proof,
  real Reanimated/UI-runtime proof, and RNGH native delivery separate until the
  reprobed platform blockers are cleared.

Goal finished.
