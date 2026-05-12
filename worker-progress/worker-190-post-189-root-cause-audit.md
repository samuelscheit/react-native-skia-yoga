# Worker 190 - Post-worker-189 root-cause audit

## Summary

Accepted Worker 189's generated materialized `setStyle(clip/invertClip)` to
bounded raster bridge proof within its stated host-JSC/native boundary.

The implementation does not change product source. It expands
`scripts/verify-yoganode-nitro-materialization.mjs` so materialized parent and
child `YogaNode` objects created through `YogaNode::toObject(runtime)` receive
generated JS-facing `setCommand`, `setStyle`, `insertChild`, and
`computeLayout` calls before the native parent is rendered through
`YogaNode::renderToContext()`. The new pixel checks cover explicit rect, rrect,
and path clips plus inverted rect clipping only.

## Audit verdict

Accept Worker 189's proof boundary.

I found no false-green defect, stale source anchor, or accidental direct-native
setup replacing generated wrapper delivery. The setup path uses materialized
objects and generated wrapper calls; the direct native step is the deliberate
final render bridge. The assertions are strong enough for a bounded regression
proof because each case checks command types, native clip state, non-use of
implicit/style-radius clipping, at least one painted inside or outside pixel,
opposite transparent pixels, and an outside-parent bound pixel.

The proof must not be overread as platform-native, React Native runtime, exact
geometry, exact antialiasing, or all inverted-shape coverage.

## Changed files

- `worker-progress/worker-190-post-189-root-cause-audit.md`

## Evidence reviewed

- Worker 189 implementation commit `0467d48 Add materialized clip raster bridge proof`.
- Worker 189 merge commit `89cf198 Merge worker 189 materialized clip raster bridge`.
- Worker 189 report `worker-progress/worker-189-materialized-clip-raster-bridge.md`.
- Worker 188 report `worker-progress/worker-188-post-187-root-cause-audit.md`.
- `git show --stat 0467d48` showed only
  `scripts/verify-yoganode-nitro-materialization.mjs` and Worker 189's report
  changed.
- Current `scripts/verify-yoganode-nitro-materialization.mjs:1737` through
  `1744` materializes `YogaNode` through `toObject(runtime)` and asserts native
  state wraps the original node.
- Current `scripts/verify-yoganode-nitro-materialization.mjs:1785` through
  `1815` call generated `setCommand` and `setStyle` wrappers.
- Current `scripts/verify-yoganode-nitro-materialization.mjs:1864` through
  `1879` calls generated `insertChild`.
- Current `scripts/verify-yoganode-nitro-materialization.mjs:2571` through
  `2624` builds the materialized render tree, computes layout through the
  generated wrapper, and asserts GroupCmd/RectCmd setup plus absence of
  implicit and style-radius clipping.
- Current `scripts/verify-yoganode-nitro-materialization.mjs:2633` through
  `2741` contains the bounded rect, rrect, path, and inverted-rect raster
  assertions.
- Current `cpp/YogaNode.cpp:1146` selects `SkClipOp::kDifference` only when
  `invertClip` is true, and `cpp/YogaNode.cpp:1179` through `1184` applies
  explicit path, rect, or rrect clipping.
- Current `scripts/verify-yoganode-native-commands-render.mjs:3460` through
  `3593` remains the adjacent direct raster baseline for explicit rect/rrect/path
  and inverted rect.

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed with
  no output.
- `npm run check:yoganode-nitro-materialization`: passed. The verifier compiled
  and linked the host executable against real `YogaNode.cpp`, generated
  `HybridYogaNodeSpec.cpp`, Nitro materialization/prototype/cache sources,
  React Native JSC, upstream Yoga, RN Skia macOS archives, RN Skia CSS color
  parsing, Worklets helper sources, `AnimatedDouble`, and project helper
  sources. Its output included the new generated wrapper to raster bridge
  evidence.
- `npm run check:yoganode-native-commands-render`: passed. The adjacent direct
  host-native raster proof remains green.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 9s. Item 17
  reran `check:yoganode-native-commands-render`; item 20 reran
  `check:yoganode-nitro-materialization`. Cleanup removed only the matrix-owned
  `tsconfig.tsbuildinfo` and `/tmp/rnskia-feasible-matrix-DGE1fa`.

## Platform blocker reprobe

- `xcode-select -p`: passed, output `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed with exit code 1:
  `SDK "iphonesimulator" cannot be located`, then `unable to lookup item 'Path'
  in SDK 'iphonesimulator'`.
- `command -v pod gradle adb cmake ninja`: failed with exit code 1 and no
  output.
- Per-tool follow-up: `pod=NOT_FOUND`, `gradle=NOT_FOUND`, `adb=NOT_FOUND`,
  `cmake=NOT_FOUND`, `ninja=NOT_FOUND`.
- `java -version`: failed with exit code 1: unable to locate a Java Runtime.
- `ANDROID_HOME=` and `ANDROID_SDK_ROOT=` are empty.

These remain local machine prerequisites for native app build/run, not a newly
observed repo-owned blocker. The feasible matrix still proves package/source
checks, example bundle export, and isolated Expo native generation, but it does
not prove CocoaPods install, Gradle build, simulator/device launch, or native
platform presentation.

## Proof boundary and overclaim risks

Proven:

- Host-JSC Nitro `YogaNode::toObject(runtime)` materialization and cached object
  identity.
- Generated materialized `setCommand(group/rect)`, `setStyle(clip
  rect/rrect/path)`, `setStyle(invertClip=true with rect clip)`,
  `insertChild(...)`, and `computeLayout(...)` wrapper delivery.
- Native `YogaNode::renderToContext()` bounded raster behavior after generated
  wrapper delivery for explicit rect, rrect, and path clips plus inverted rect.
- Selected inside/outside/bounds pixel behavior only.

Not proven:

- Inverted rrect or inverted path raster behavior.
- Exact clip geometry, antialias transition fidelity, GPU/saveLayer fidelity,
  typography, or every command rendering path.
- React Native bridge delivery, Nitro registry installation inside a React
  Native runtime, real Reanimated/UI-runtime delivery, RNGH native delivery,
  image loading, iOS/Android app build/run, simulator/device launch, or native
  platform presentation.

Overclaim risks:

- "Generated materialized clip/invertClip raster proof" must be read as
  rect/rrect/path clipping plus inverted rect only, not all inverted clip
  shapes.
- The verifier intentionally renders native C++ after generated wrapper
  delivery; that proves the bridge into the host-native renderer, not React
  Native app runtime behavior.
- The pixel choices are bounded regression assertions, not exhaustive geometry
  or antialias coverage.

## Next target recommendation

The next strongest locally unblocked target is a paired inverted rrect/path
raster proof across the direct native and generated materialized harnesses.

Worker 189's suggested materialized inverted rrect/path cases are valid, but a
materialized-only expansion would outrun the adjacent direct raster baseline.
The more coherent root-cause target is to add bounded inverted rrect and
inverted path cases to `scripts/verify-yoganode-native-commands-render.mjs`,
then mirror them through generated materialized `setStyle(...)` delivery in
`scripts/verify-yoganode-nitro-materialization.mjs`. This directly closes the
remaining shape-plus-`SkClipOp::kDifference` gap at `cpp/YogaNode.cpp:1146` and
`1179` through `1184`, while staying fully local and host-native.

Lower-ranked or blocked alternatives:

- Platform-native app build/run remains blocked by the reprobed local Xcode,
  CocoaPods, Java, Android SDK, Gradle, ADB, CMake, and Ninja prerequisites.
- React Native runtime/Nitro registry/Reanimated/RNGH delivery remains a larger
  platform/runtime target and is not locally unblocked by the current machine.
- Exact clip geometry or antialias fidelity would be broader and less
  root-cause-focused than first covering the missing inverted rrect/path
  branches with bounded pixels.

## Cleanup status

- Product/source files were not edited.
- `MASTER_PLAN.md` and `MASTER_PROGRESS.md` were not edited.
- Preserved ambiguous ignored/local artifacts: `node_modules/`,
  `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`,
  `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` except for matrix-owned
  cleanup.
- No nested subagents were used.
- Before writing this report, tracked status was clean and ignored status showed
  only `node_modules` and `example/node_modules`.

Goal finished.
