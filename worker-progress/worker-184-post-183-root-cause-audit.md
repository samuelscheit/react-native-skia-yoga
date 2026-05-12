# Worker 184 - Post-worker-183 Root-cause Audit

## Summary

Accepted Worker 183's public/Reconciler dynamic-contract proof for scalar
global `style.borderRadius` as sound within its stated source-level boundary.

The packed TypeScript consumer proof exercises the installed npm tarball
authoring path and accepts `style.borderRadius: SharedValue<number>` while
rejecting `SharedValue<SkPoint>` and point-object global forms. The Reconciler
proof exercises the JS style-listener path for top-level `borderRadius`,
including listener keying, initial snapshot, update rebuild, invalidation,
cleanup, ignored late emits after cleanup, no native command mirror, invalid
initial payload rejection, and late invalid emission rejection before
`node.setStyle`, invalidation, or native mirror updates.

No repair is needed.

## Changed files

- `worker-progress/worker-184-post-183-root-cause-audit.md`

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed with
  no output.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed with
  no output.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 23s.

Platform/toolchain reprobe:

- `xcode-select -p`: passed, output `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed with status 1:
  `SDK "iphonesimulator" cannot be located`, repeated by `xcrun`, then
  `unable to lookup item 'Path' in SDK 'iphonesimulator'`.
- `command -v pod gradle adb cmake ninja`: failed with status 1 and no output.
- Per-tool follow-up: `pod=not found`, `gradle=not found`, `adb=not found`,
  `cmake=not found`, `ninja=not found`.
- `java -version`: failed with status 1: unable to locate a Java Runtime.
- `ANDROID_HOME`: empty.
- `ANDROID_SDK_ROOT`: empty.

## Evidence gathered

- Worker 183 report states the intended proof boundary: public packed
  TypeScript plus Node VM source-level Reconciler behavior for scalar global
  `style.borderRadius`, explicitly excluding platform app runtime, React Native
  bridge delivery, Nitro registry install, real Reanimated/UI-runtime delivery,
  RNGH native delivery, native rendering, and simulator/device behavior.
- `src/specs/style.ts:234` declares global `borderRadius?: number`, while
  `src/jsx.ts:118` routes non-special style keys through
  `YogaAnimatedStyleProp`, making `SharedValue<number>` the public animated
  scalar form for that key.
- `src/Reconciler.ts:170` accepts only `number` or a `SharedValue` whose current
  value is `number` for global `style.borderRadius`; `src/Reconciler.ts:231`
  runs that guard before style normalization and listener registration.
- `src/Reconciler.ts:648` binds style `SharedValue`s through the JS listener
  path; the update callback stores the new value, calls
  `instance.setStyle(getResolvedStyle(state))`, then invalidates. Because
  `getResolvedStyle(...)` normalizes and re-runs the guard before
  `instance.setStyle(...)` is entered, late invalid emissions fail before a
  native-bound style snapshot is appended.
- `scripts/verify-package-typescript-consumer.mjs:537` adds the positive packed
  consumer case for `style.borderRadius: SharedValue<number>`.
- `scripts/verify-package-typescript-consumer.mjs:601` and
  `scripts/verify-package-typescript-consumer.mjs:608` add negative packed
  consumer cases for global `SharedValue<SkPoint>` and point-object forms.
- `scripts/verify-reconciler-animated-bindings.mjs:1908` adds the focused
  scalar global `borderRadius` JS style-listener proof.
- `scripts/verify-reconciler-animated-bindings.mjs:2068` adds the late invalid
  emission proof, asserting the explicit scalar boundary error and no
  additional `node.setStyle`, invalidation, or native mirror update.
- `scripts/verify-reconciler-animated-bindings.mjs:2164` adds invalid initial
  shape checks proving `SharedValue<SkPoint>` and point-object global forms fail
  before listener registration or native mirror creation.
- `npm run check:package-typescript-consumer` output explicitly reported that a
  real tarball consumer accepted scalar global `style.borderRadius` as
  `SharedValue<number>` while rejecting `SharedValue<SkPoint>` and point-object
  forms.
- `npm run check:reconciler-animated-bindings` output explicitly reported that
  scalar global `style.borderRadius` listeners resolve the initial snapshot,
  update through the top-level `borderRadius` key, rebuild full styles,
  invalidate, clean up, reject initial and late non-number dynamic payloads
  before native-bound style updates, and avoid native command mirrors.
- `npm run check:feasible-matrix` reran both updated Worker 183 verifiers and
  all accepted local package/source/example checks. It removed its generated
  `tsconfig.tsbuildinfo` cleanup target, removed its matrix-owned temp parent,
  and reported no remaining new tracked artifacts.
- Reviewed Worker 182/181/179 reports. Together with Worker 183, the scalar
  global `style.borderRadius` stack now has bounded host-raster proof, generated
  materialized delivery proof, direct native hit-test proof, public TypeScript
  authoring proof, and Reconciler source-level dynamic delivery/guard proof.
- Nested explorer result for next-target selection recommended explicit dynamic
  `style.clip` / `style.invertClip` public/Reconciler proof as the next local
  clipping/runtime source-path target, with anchors in `src/specs/style.ts`,
  `src/jsx.ts`, `src/Reconciler.ts`, and existing lower-stack materialization
  evidence.

## Proof boundary and overclaim risks

Accepted proof boundary:

- Public packed TypeScript authoring from an installed npm tarball for scalar
  global `style.borderRadius: SharedValue<number>`.
- Packed TypeScript rejection of global `style.borderRadius` `SharedValue<SkPoint>`
  and point-object forms.
- Node VM source-level Reconciler behavior for top-level global
  `style.borderRadius` JS style listeners: initial snapshot, update, full style
  rebuild, invalidation, cleanup, ignored late emits after cleanup, and no
  native command mirror.
- Node VM source-level Reconciler guard behavior for invalid initial and late
  global `borderRadius` payloads, including late invalid emission failure
  before `node.setStyle`, container invalidation, or native mirror updates.
- Separation from the SkPoint-capable per-corner radius contract, which remains
  governed by the existing corner-radius inventory and verifier cases.

Not proven by Worker 183:

- React Native bridge delivery.
- Nitro registry installation inside a React Native runtime.
- Real Reanimated `SharedValue` delivery or UI-runtime Worklets execution.
- RNGH native delivery or real gesture/event dispatch.
- iOS/Android app build/run, simulator/device launch, platform-native
  presentation, or platform app runtime behavior.
- Native rendering, hit testing, or raster fidelity for the new dynamic
  source-level case beyond already separate lower-stack scalar `borderRadius`
  proofs.

Overclaim risks to avoid:

- Do not describe Worker 183 as platform-native app proof while simulator SDK,
  CocoaPods, Java, Android SDK variables, Gradle, ADB, CMake, and Ninja remain
  unavailable.
- Do not describe the Node VM Reconciler stubs as real UI-runtime Worklets or
  real Reanimated scheduling.
- Do not collapse global scalar `style.borderRadius` with per-corner
  SkPoint-capable style radius keys; they share lower clipping consumers but
  have distinct public/runtime contracts.
- Do not claim that late invalid emissions never reach JS scheduling; the proof
  shows they bridge through `runOnJS` to the Reconciler update callback and then
  fail before native-bound style mutation, invalidation, or native mirror work.

## Cleanup status

- Report-only scope was preserved.
- No product source, verifier scripts, package metadata, generated specs, docs,
  or example native folders were edited by this worker.
- Ambiguous ignored/local artifacts were preserved. Final status showed only
  ignored `node_modules` and `example/node_modules`.
- `npm run check:feasible-matrix` removed its matrix-owned temp parent and its
  generated `tsconfig.tsbuildinfo` cleanup target.
- One nested explorer completed and supported the next-target recommendation.
  A second public-contract explorer was closed as obsolete after the same target
  was sufficiently established from direct inspection plus the completed
  runtime-gap result.

## Recommended next tasks

- Assign the next locally unblocked root-cause target to dynamic
  `style.clip` / `style.invertClip` public and Reconciler proof.
- Rationale: `src/specs/style.ts:257` exposes `clip?: SkPathNative |
  SkRRectNative | SkRectNative` and `src/specs/style.ts:258` exposes
  `invertClip?: boolean`; `src/jsx.ts:118` routes non-special style keys
  through `YogaAnimatedStyleProp`, so top-level `SharedValue` authoring is
  implied; `src/Reconciler.ts:648` already has the generic JS style-listener
  path; and `scripts/verify-reconciler-animated-bindings.mjs:384` through
  `scripts/verify-reconciler-animated-bindings.mjs:390` cover transform,
  matrix, global `borderRadius`, corner radii, layer, and whole-style
  `SharedValue` cases but no focused `clip` / `invertClip` case.
- The next worker should add packed-consumer positive coverage for whole
  `SharedValue` `style.clip` path/rect/rrect forms and
  `style.invertClip: SharedValue<boolean>`, plus Reconciler cases proving
  top-level listener keys, initial snapshots, updates, full style rebuilds,
  invalidation, cleanup, ignored late emits, and no native command mirror.
- Existing lower-stack anchors make the target locally valuable:
  `scripts/verify-yoganode-nitro-materialization.mjs:2417`,
  `scripts/verify-yoganode-nitro-materialization.mjs:2440`,
  `scripts/verify-yoganode-nitro-materialization.mjs:2463`, and
  `scripts/verify-yoganode-nitro-materialization.mjs:2487` already prove
  generated materialized clip rect/rrect/path and `invertClip` delivery.
- Keep platform-native build/run, React Native bridge/runtime registry proof,
  real Reanimated/UI-runtime proof, and RNGH native delivery separate until the
  reprobed platform blockers are cleared.

Goal finished.
