# Worker 186 - Post-worker-185 Root-cause Audit

## Summary

Accepted Worker 185's dynamic top-level `style.clip` / `style.invertClip`
public and Reconciler proof as sound within its stated boundary.

Worker 185 fixed a real public TypeScript type gap: `style.clip` now accepts
exact union-member `SharedValue<SkRect>`, `SharedValue<SkRRect>`, and
`SharedValue<SkPath>` forms from a packed package consumer while rejecting
`SharedValue<number>`. Its Reconciler VM proof coherently covers only top-level
`clip` / `invertClip` style listeners, not nested clip leaf listeners, platform
runtime delivery, or native render fidelity.

No repair is needed. The next strongest locally unblocked target is bounded
host-native raster proof for explicit `style.clip` rect/rrect/path plus
`invertClip` in `scripts/verify-yoganode-native-commands-render.mjs`.

## Changed files

- `worker-progress/worker-186-post-185-root-cause-audit.md`

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed with no
  output.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed with
  no output.
- `npm run check:package-typescript-consumer`: passed. Output explicitly
  reported packed consumer acceptance of dynamic `style.clip`
  `SharedValue<SkRect>`, `SharedValue<SkRRect>`, and `SharedValue<SkPath>` plus
  `style.invertClip: SharedValue<boolean>`, while rejecting
  `SharedValue<number>` for `style.clip`.
- `npm run check:reconciler-animated-bindings`: passed. Output explicitly
  reported top-level dynamic `style.clip` rect/rrect/path payload listeners with
  companion `style.invertClip`, top-level keys only, initial snapshots, full
  style rebuilds, invalidation, cleanup, ignored late emits, and no native
  command mirrors.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 5s. The matrix
  reran the updated packed-consumer and Reconciler checks, removed its
  generated `tsconfig.tsbuildinfo`, removed its matrix-owned temp parent
  `/tmp/rnskia-feasible-matrix-vxZMST`, and reported no remaining new tracked
  artifacts.

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
- `ANDROID_HOME`: empty.
- `ANDROID_SDK_ROOT`: empty.

## Evidence gathered

- `worker-progress/worker-185-clip-invertclip-dynamic-proof.md` states the
  intended proof boundary and overclaim limits: public packed TypeScript plus
  Node VM source-level Reconciler listener proof only.
- Worker 185 commit `ed28565` and merge `b25fab2` changed `src/jsx.ts`,
  `scripts/verify-package-typescript-consumer.mjs`, and
  `scripts/verify-reconciler-animated-bindings.mjs`.
- `src/specs/style.ts:257` exposes `clip?: SkPathNative | SkRRectNative |
  SkRectNative`; `src/specs/style.ts:258` exposes `invertClip?: boolean`.
- `src/jsx.ts:63` adds `YogaAnimatedUnionStyleProp<T>`, and
  `src/jsx.ts:132` scopes that distributed union-member `SharedValue` support
  only to the `clip` style key.
- The packed-consumer verifier extracts `PublicClipRect`, `PublicClipRRect`,
  and `PublicClipPath` from `YogaNodeStyle["clip"]`, compiles positive
  dynamic clip rect/rrect/path cases, compiles dynamic `invertClip`, and uses a
  `@ts-expect-error` negative case for `style.clip: SharedValue<number>`.
- `src/Reconciler.ts:648` binds style `SharedValue`s through the generic JS
  style listener path, storing listener updates, rebuilding the full resolved
  style, and invalidating the container.
- `scripts/verify-reconciler-animated-bindings.mjs:1965` table-drives rect,
  rrect, and path top-level `style.clip` payloads with companion
  `style.invertClip`.
- `scripts/verify-reconciler-animated-bindings.mjs:2014` asserts listener keys
  are exactly `clip` and `invertClip`, proving top-level listener behavior.
- `scripts/verify-reconciler-animated-bindings.mjs:2053` and
  `scripts/verify-reconciler-animated-bindings.mjs:2096` assert update
  delivery through `runOnJS`, full host-style rebuilds, static sibling
  preservation, and invalidations.
- `scripts/verify-reconciler-animated-bindings.mjs:2140` and
  `scripts/verify-reconciler-animated-bindings.mjs:2187` assert cleanup removes
  both listeners and late emits do not rebuild styles, invalidate, bridge
  through `runOnJS`, or create native mirrors.
- Existing lower-stack anchors remain green:
  `scripts/verify-yoganode-nitro-materialization.mjs:2405` through
  `scripts/verify-yoganode-nitro-materialization.mjs:2492` prove generated
  materialized clip rect/rrect/path and `invertClip` native state delivery;
  `scripts/verify-yoganode-native-hit-testing.mjs:696` through
  `scripts/verify-yoganode-native-hit-testing.mjs:834` prove explicit clip and
  `invertClip` native hit-test behavior.

## Proof boundary and overclaim risks

Accepted proof boundary:

- Public TypeScript authoring from an installed npm tarball for dynamic
  top-level `style.clip` rect/rrect/path union-member `SharedValue` forms.
- Public TypeScript authoring for `style.invertClip: SharedValue<boolean>`.
- Public TypeScript rejection of `style.clip: SharedValue<number>`.
- Node VM source-level Reconciler behavior for top-level `style.clip` /
  `style.invertClip` JS style listeners: initial snapshots, update delivery,
  full style rebuild, invalidation, cleanup, ignored late emits, and no native
  command mirror creation.

Not proven:

- React Native bridge delivery.
- Nitro registry installation inside a React Native runtime.
- Real Reanimated `SharedValue` delivery or UI-runtime Worklets execution.
- RNGH native delivery or real gesture/event dispatch.
- iOS/Android app build or launch, simulator/device behavior, native platform
  presentation, or full platform app runtime.
- Native conversion, native rendering, hit-test, or raster fidelity newly from
  Worker 185 beyond the already separate lower-stack materialization and
  native hit-test verifiers.

Overclaim risks to avoid:

- The Reconciler proof uses local VM stubs; it is not evidence of real
  UI-runtime scheduling or device/runtime delivery.
- The path clip payload in the Reconciler verifier is an opaque source-level
  placeholder; real `SkPath` host-object materialization is owned by the
  existing Nitro/materialization verifier.
- `src/Reconciler.ts` does not treat `clip` as a nested style root. Worker 185
  proves whole top-level `SharedValue` delivery, not nested `clip.x`,
  `clip.rect.rx`, or other leaf listeners.
- Do not describe the feasible matrix as platform-native app proof while the
  simulator SDK, CocoaPods, Java, Android SDK variables, Gradle, ADB, CMake,
  and Ninja remain unavailable.

## Cleanup status

- Report-only scope was preserved.
- No product source, verifier script, generated spec, package metadata, docs,
  or example native folders were edited by this worker.
- Ambiguous ignored/local artifacts such as `node_modules`,
  `example/node_modules`, `example/ios`, `example/android`, `example/.expo`,
  `lib`, `.DS_Store`, and `tsconfig.tsbuildinfo` were preserved except for the
  feasible matrix's own tracked `tsconfig.tsbuildinfo` cleanup target.
- `npm run check:feasible-matrix` removed its matrix-owned temp parent and
  reported no remaining new tracked artifacts.
- No nested subagents or explorers were used.
- Worktree status was clean before writing this report.

## Recommended next tasks

- Assign the next locally unblocked root-cause target to bounded host-native
  raster proof for explicit `style.clip` rect/rrect/path plus `invertClip`.
- Recommended implementation scope:
  `scripts/verify-yoganode-native-commands-render.mjs` should add focused
  `YogaNode::renderToContext()` cases using a `GroupCmd` parent and full-size
  `RectCmd` child, with pixel assertions that rect, rrect, and path clips
  preserve in-clip child pixels and clear out-of-clip pixels; add an
  `invertClip` rect case proving the inside is cleared and outside remains
  painted.
- Rationale: `cpp/YogaNode.cpp:1179` through `cpp/YogaNode.cpp:1184` contains
  the render-time explicit clip path/rect/rrect branches and `cpp/YogaNode.cpp:1146`
  selects the `invertClip` operation. Generated materialization and native
  hit-testing are already covered, and Worker 185 now covers public/Reconciler
  dynamic delivery, but `scripts/verify-yoganode-native-commands-render.mjs`
  currently names bounded style corner-radius and global `borderRadius` raster
  clipping, not explicit `style.clip` raster clipping.
- Keep platform-native build/run, React Native bridge/runtime registry proof,
  real Reanimated/UI-runtime proof, and RNGH native delivery separate until the
  reprobed platform blockers are cleared.

Goal finished.
