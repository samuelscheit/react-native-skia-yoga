# Worker 188 - Post-worker-187 root-cause audit

## Summary

Accepted Worker 187's bounded host-native raster proof for explicit
`style.clip` rect/rrect/path plus `invertClip` rect rendering.

The proof is sound inside its stated boundary. It uses a `GroupCmd` parent and
full-size `RectCmd` child, asserts that explicit clip state is populated
without falling back to implicit bounds or style corner-radius clipping, and
then verifies selected raster pixels through real `YogaNode::renderToContext()`
onto host `SkSurface`s. No repair is needed.

The next strongest locally unblocked root-cause target is a generated
materialized `setStyle(...)` to raster bridge for explicit clip/invertClip:
extend host-JSC/native verification so `YogaNode::toObject(runtime)` generated
`setStyle(clip rect/rrect/path, invertClip)` delivery is followed by
`YogaNode::renderToContext()` pixel assertions. Keep platform-native build/run
separate unless the local toolchain blockers below are cleared.

## Changed files

- `worker-progress/worker-188-post-187-root-cause-audit.md`

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed
  with no output.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 7s.

Platform/toolchain reprobe:

- `xcode-select -p`: passed, output `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed with exit code 1:
  `SDK "iphonesimulator" cannot be located`, repeated by `xcrun`, then
  `unable to lookup item 'Path' in SDK 'iphonesimulator'`.
- `command -v pod gradle adb cmake ninja`: failed with exit code 1 and no
  output.
- Per-tool lookup follow-up: `pod=NOT_FOUND`, `gradle=NOT_FOUND`,
  `adb=NOT_FOUND`, `cmake=NOT_FOUND`, `ninja=NOT_FOUND`.
- `java -version`: failed with exit code 1: unable to locate a Java Runtime.
- `ANDROID_HOME`: empty.
- `ANDROID_SDK_ROOT`: empty.

## Evidence gathered

- Worker 187 commit `6d2239c` changed only
  `scripts/verify-yoganode-native-commands-render.mjs` and
  `worker-progress/worker-187-explicit-clip-raster-proof.md`.
- `worker-progress/worker-187-explicit-clip-raster-proof.md` accurately
  reports direct host-native raster coverage for explicit `style.clip`
  rect/rrect/path and `invertClip` rect, and keeps platform/runtime claims out
  of scope.
- `cpp/YogaNode.cpp:1146` selects `SkClipOp::kDifference` only when
  `_style.invertClip` is true; `cpp/YogaNode.cpp:1179` through
  `cpp/YogaNode.cpp:1184` apply explicit path, rect, or rrect clipping during
  `drawInternal(...)`.
- `scripts/verify-yoganode-native-commands-render.mjs:3460` through
  `scripts/verify-yoganode-native-commands-render.mjs:3592` contain the new
  rect, rrect, path, and inverted rect cases.
- The rect case asserts `GroupCmd` parent, full-size `RectCmd` child, no
  implicit bounds clipping, no style corner-radius clip, `SkRect` variant
  state, `_clipRect`, no `_clipPath`/`_clipRRect`, default non-inverted
  clipping, an inside green pixel, outside transparent pixels, and transparent
  surface outside parent layout.
- The rrect case asserts the corresponding `SkRRect` variant and `_clipRRect`
  state, then checks a blue interior pixel, transparent rounded-corner pixel,
  transparent outside-clip pixel, and parent-layout bound.
- The path case asserts the `SkPath` variant and `_clipPath` state, then checks
  a cyan center pixel, transparent outside/path-edge pixels, and parent-layout
  bound.
- The `invertClip` rect case asserts `invertClip=true`, `SkRect` variant
  state, `_clipRect`, and opposite raster behavior: an inside-clip pixel is
  transparent while outside-clip child pixels remain magenta.
- `npm run check:yoganode-native-commands-render` compiled and linked the host
  verifier against real `YogaNode.cpp`, generated Nitro specs, React Native
  JSC, upstream Yoga, RN Skia macOS archives, Worklets shared-item sources,
  ColorParser, PlatformContextAccessor, and helper sources, then reran the new
  raster proof successfully.
- `npm run check:yoganode-native-hit-testing` remained green and separately
  proved explicit clip and invertClip native hit-test behavior.
- `npm run check:yoganode-nitro-materialization` remained green and separately
  proved generated materialized clip rect/rrect/path delivery into
  `_style.clip` and `_clipPath`/`_clipRect`/`_clipRRect`, plus generated
  materialized `invertClip` predicate state.
- `npm run check:feasible-matrix` reran the updated command/render verifier as
  item 17/28, reran the adjacent Reconciler/materialization checks, removed
  generated `tsconfig.tsbuildinfo`, removed its matrix-owned temp parent
  `/tmp/rnskia-feasible-matrix-bPFW4p`, and reported no remaining new tracked
  artifacts.

## Proof boundary and overclaim risks

Accepted proof boundary:

- Host-native macOS C++ `YogaNode::renderToContext()` raster behavior for
  explicit `style.clip` rect, rrect, and path using a `GroupCmd` parent and a
  full-size `RectCmd` child.
- Host-native macOS C++ `invertClip` rect raster behavior using the same
  bounded harness pattern.
- State assertions that each case uses the intended command types, avoids
  implicit bounds and style corner-radius clipping, and populates the expected
  explicit clip slot.
- Pixel-level evidence only at the selected inside/outside/bounds coordinates.

Not proven:

- Exhaustive exact clip geometry, antialiasing, rrect/path edge fidelity, or
  every possible coordinate.
- `invertClip` raster behavior for rrect/path shapes; Worker 187 only proves
  inverted rect raster behavior.
- Generated materialized `setStyle(...)` clip payloads followed by raster
  rendering in one end-to-end host-JSC/native flow.
- React Native bridge delivery, Nitro registry installation inside a React
  Native runtime, real Reanimated delivery, UI-runtime Worklets execution, JS
  listener scheduling, RNGH native delivery, image loading, iOS/Android native
  build/run, simulator/device launch, or native platform presentation.

Overclaim risks:

- The new cases directly construct `NodeStyle` in C++; generated materialized
  clip delivery is proven by `scripts/verify-yoganode-nitro-materialization.mjs`
  as state only, not render fidelity.
- The pixel choices are strong enough for bounded regression proof, but they do
  not assert every clip boundary or exact antialias transition.
- The platform probes still block honest native app build/run claims: only
  Command Line Tools are selected, the iPhone simulator SDK is unavailable,
  CocoaPods/Gradle/ADB/CMake/Ninja are absent, Java is unavailable, and Android
  SDK variables are empty.

## Cleanup status

- Report-only scope; no product source, verifier source, generated spec,
  example native folder, package metadata, or planning document was edited.
- Preserved ambiguous ignored/local artifacts: `node_modules/`,
  `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`,
  `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` unless a verifier owned the
  cleanup.
- The feasible matrix removed only its owned `tsconfig.tsbuildinfo` tracked
  artifact and matrix temp parent.
- No nested subagents or explorers were used.
- Worktree tracked status was clean before this report was written; ignored
  status showed only `example/node_modules` and `node_modules`.

## Recommended next tasks

- Assign a generated materialized clip raster bridge as the next locally
  unblocked root-cause target.
- Concrete implementation anchors:
  `scripts/verify-yoganode-nitro-materialization.mjs:2405` through
  `scripts/verify-yoganode-nitro-materialization.mjs:2492` already generate
  materialized `setStyle(clip rect/rrect/path)` and `setStyle(invertClip)`
  native state; `scripts/verify-yoganode-native-commands-render.mjs:3460`
  through `scripts/verify-yoganode-native-commands-render.mjs:3592` already
  contain the direct `NodeStyle` raster pattern; `cpp/YogaNode.cpp:1179`
  through `cpp/YogaNode.cpp:1184` are the explicit render-time clip branches.
- Suggested proof shape: create materialized parent/child YogaNodes through the
  generated JS-facing object path, call generated `setCommand(group/rect)` and
  `setStyle(clip rect/rrect/path, invertClip)`, then render the native nodes to
  a raster surface and assert the same bounded inside/outside pixels. Keep this
  host-JSC/native and do not claim React Native app runtime behavior.
- Secondary unblocked expansion after that: add inverted rrect/path raster
  cases if the materialized bridge target is already covered or becomes too
  broad.
- Keep platform-native app build/run, device/simulator launch, real
  React Native bridge/Nitro registry runtime proof, UI-runtime Worklets,
  Reanimated delivery, and RNGH native delivery separate until the reprobed
  blockers are resolved.

Goal finished.
