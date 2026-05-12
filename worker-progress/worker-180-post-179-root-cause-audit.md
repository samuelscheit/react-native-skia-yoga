# Worker 180 - Post-worker-179 Root-cause Audit

## Summary

Accepted Worker 179's global `style.borderRadius` host-raster proof as scoped.

Worker 179 added `assertGlobalBorderRadiusClipRender(...)` to
`scripts/verify-yoganode-native-commands-render.mjs`. The case directly sets
`NodeStyle.borderRadius = 24` on a `GroupCmd` parent, inserts a full-size blue
`RectCmd` child, renders through real `YogaNode::renderToContext()` onto a
raster `SkSurface`, and asserts all four rounded child corners are clipped
while in-bounds rounded pixels remain blue.

The proof stays distinct from explicit `style.clip` and from
`RRectCmd::cornerRadius`. No repair is needed.

The next strongest locally unblocked target is generated/materialized plus
native hit-test proof for the same global scalar `style.borderRadius` path.
Worker 179 closed direct host-raster clipping, but the existing generated
materialization and hit-test verifiers still focus on per-corner radius fields.

## Changed files

- `worker-progress/worker-180-post-179-root-cause-audit.md`

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed
  with no output.
- `npm run check:yoganode-native-commands-render`: passed. Output explicitly
  included bounded global `style.borderRadius` scalar raster clipping through
  `YogaNode::renderToContext()` using a `GroupCmd` parent and full-size
  `RectCmd` child.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 26s. The matrix
  reran `check:yoganode-native-commands-render`, removed its generated
  `tsconfig.tsbuildinfo` cleanup target, removed its matrix-owned temp parent,
  and reported no remaining new tracked artifacts.

Platform/toolchain reprobe:

- `xcode-select -p`: passed, output `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed with exit code 1:
  `SDK "iphonesimulator" cannot be located`.
- `command -v pod gradle adb cmake ninja`: failed with exit code 1 and no
  output.
- Per-tool follow-up: `pod=not found`, `gradle=not found`, `adb=not found`,
  `cmake=not found`, `ninja=not found`.
- `java -version`: failed with exit code 1: unable to locate a Java Runtime.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

## Evidence gathered

- `worker-progress/worker-179-border-radius-raster-proof.md` states the intended
  proof boundary: bounded host-native macOS C++ raster clipping for scalar
  `NodeStyle.borderRadius`, all four `_clipToBoundsRadii` slots seeded by the
  global scalar, distinct from explicit `style.clip` and from
  `RRectCmd::cornerRadius`.
- Worker 179 commit `a49c0ee` added `assertGlobalBorderRadiusClipRender(...)`
  and updated verifier output/proof-boundary text.
- `scripts/verify-yoganode-native-commands-render.mjs:3402` sets
  `rootStyle.borderRadius = radius`, uses a `GroupCmd` parent and full-size
  `RectCmd` child, asserts the parent is not `RRectCmd`, asserts the child is
  not `RRectCmd`, and asserts the child has no `_clipToBoundsRadii`.
- `scripts/verify-yoganode-native-commands-render.mjs:3422` asserts stored
  scalar `_style.borderRadius`, absence of all four per-corner style radius
  fields, `_clipsToBounds`, and all four SkRRect corner radii equal to 24.
- `scripts/verify-yoganode-native-commands-render.mjs:3440` asserts
  `_style.clip`, `_clipPath`, `_clipRect`, and `_clipRRect` are empty.
- `scripts/verify-yoganode-native-commands-render.mjs:3448` asserts transparent
  clipped pixels at `(1, 1)`, `(99, 1)`, `(99, 99)`, and `(1, 99)`, blue
  in-bounds pixels at `(24, 24)`, `(75, 24)`, `(75, 75)`, and `(24, 75)`, and
  transparency outside layout at `(104, 104)`.
- `cpp/YogaNode.cpp:712` includes global `borderRadius` in the rounded
  clip-to-bounds predicate.
- `cpp/YogaNode.cpp:718` maps the global scalar to all four
  `_clipToBoundsRadii` slots.
- `cpp/YogaNode.cpp:746` stores `_clipsToBounds = true` and the computed
  radii.
- `cpp/YogaNode.cpp:1165` consumes `_clipToBoundsRadii` in `drawInternal(...)`
  by clipping to `detail::makeRoundedRect(...)` before drawing child content.
- `worker-progress/worker-178-post-177-root-cause-audit.md` recommended this
  exact compact global `style.borderRadius` scalar host-raster smoke.
- `worker-progress/worker-175-style-corner-radius-raster-proof.md` provided the
  separation discipline that Worker 179 followed for per-corner style radii.
- `worker-progress/worker-173-native-corner-radius-proof.md` proves generated
  materialization and native hit testing for per-corner style radii, not the
  global scalar.

## Proof boundary and overclaim risks

Accepted proof boundary:

- Bounded host-native macOS C++ raster evidence for scalar
  `NodeStyle.borderRadius` through real `YogaNode::renderToContext()`.
- Direct native `YogaNode::setStyle(...)` behavior seeds all four
  `_clipToBoundsRadii` slots from the global scalar.
- The rendered proof uses parent bounds clipping of a full-size child, not
  `RRectCmd::cornerRadius` drawing and not child `RectCmd` rounded drawing.
- The case is explicitly separate from `style.clip` path/rect/rrect state.

Not proven:

- Generated/materialized `setStyle({ borderRadius })` delivery from a
  materialized YogaNode object.
- React Native bridge delivery or Nitro registry installation inside a React
  Native runtime.
- Reconciler delivery beyond existing generic style-path coverage.
- UI-runtime Worklets execution or real Reanimated SharedValue delivery.
- Native hit testing for global scalar `borderRadius`.
- iOS/Android app build or launch, simulator/device behavior, or native
  platform presentation.
- Exact global `borderRadius` renderer fidelity beyond the asserted
  host-raster pixels.
- GPU/backend fidelity, image asset loading/decoding, exact typography, or
  platform-native presentation.

Overclaim risks to avoid:

- Do not describe Worker 179 as proving generated materialization, even though
  generated `NodeStyle.hpp` contains a `borderRadius` converter slot.
- Do not describe fixed host-raster pixel samples as exact renderer fidelity.
- Do not collapse global `borderRadius` with per-corner style-radius proof; they
  share the native radii consumer but enter through separate style fields.
- Do not treat the local matrix as platform-native app proof while the simulator,
  CocoaPods, Java, Android SDK, Gradle, ADB, CMake, and Ninja probes remain
  blocked.

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

- Add a compact generated/materialized global `style.borderRadius` proof to
  `scripts/verify-yoganode-nitro-materialization.mjs`: call generated
  `setStyle({ borderRadius: <number> })` through a materialized YogaNode object,
  assert `_style.borderRadius`, `_clipsToBounds`, all four
  `_clipToBoundsRadii` slots, no per-corner style fields, and no explicit
  `style.clip` state.
- Add the matching direct native hit-test case to
  `scripts/verify-yoganode-native-hit-testing.mjs`: set scalar
  `style.borderRadius` on a parent, insert a full-size interactive child, and
  assert all four rounded corners reject hits while in-bounds rounded points
  hit the child.
- Keep platform-native app build/run and real RN/Nitro/Reanimated runtime proof
  separate until the local simulator, CocoaPods, Java, Android SDK/build-tool,
  Gradle, ADB, CMake, and Ninja prerequisites are available.
- Treat public/Reconciler-specific global `borderRadius` dynamic coverage as a
  follow-up only after the generated/native consumer gap is closed; the lower
  native delivery and hit-test boundary is the stronger adjacent unblocked gap.

Goal finished.
