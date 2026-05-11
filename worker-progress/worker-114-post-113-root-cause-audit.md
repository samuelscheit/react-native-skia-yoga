# Worker 114 - Post-worker-113 Root-Cause Audit

## Scope And Read-Only Status

- Objective: audit the post-worker-113 state and select the next strongest unblocked root-cause target.
- This was a read-only audit for product code, verifier scripts, package metadata, generated files, planning docs, and ignored local artifacts.
- The only file written by this worker is this report: `worker-progress/worker-114-post-113-root-cause-audit.md`.
- I did not edit product TypeScript, native C++, verifier scripts, package metadata, generated files, docs outside this report, or ignored local artifacts such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, or `tsconfig.tsbuildinfo`.

## Required Context Read

Read and used:

- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-113-nodecommand-tojsi-symmetry.md`
- `worker-progress/worker-112-package-export-boundary.md`
- `worker-progress/worker-111-post-110-root-cause-audit.md`
- `worker-progress/worker-110-dynamic-jsx-type-boundary.md`
- `worker-progress/worker-108-strokeopts-converter-contract.md`
- `worker-progress/worker-106-nitro-setcommand-more-breadth.md`
- `worker-progress/worker-104-text-paragraph-css-color.md`
- `worker-progress/worker-102-image-fit-coverage.md`
- `worker-progress/worker-100-nitro-setcommand-breadth.md`
- `worker-progress/worker-098-reconciler-js-mode-command-bindings.md`
- `worker-progress/worker-096-path-stroke-contract.md`
- `worker-progress/worker-094-reconciler-native-command-bindings.md`
- `worker-progress/worker-092-dynamic-path-trim-nodecommand.md`
- `worker-progress/worker-090-animated-double-nodecommand.md`
- `worker-progress/worker-089-animated-double-synchronizable.md`
- `worker-progress/worker-088-nitro-yoganode-materialization.md`
- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-package-surface.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-animated-double-synchronizable.mjs`
- `scripts/verify-rnsk-yoga-view-runtime.mjs`
- `scripts/verify-skia-yoga-object-lazy-init.mjs`
- `scripts/verify-example-native-generation.mjs`
- `src/Reconciler.ts`
- `src/YogaCanvas.tsx`
- `src/jsx.ts`
- `src/index.ts`
- `index.d.ts`
- `src/specs/commands.ts`
- `src/specs/SkiaYoga.nitro.ts`
- `cpp/NodeCommand.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+StrokeOpts.hpp`
- `cpp/JSIConverter+AnimatedDouble.hpp`
- `cpp/YogaNode.hpp`
- `cpp/YogaNode.cpp`
- `cpp/SkiaYoga.cpp`
- `android/CMakeLists.txt`

Additional focused context:

- `cpp/JSIConverter+YogaNode.hpp`
- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkImage.hpp`
- `cpp/JSIConverter+SkParagraph.hpp`
- `cpp/RNSkYogaView.cpp`
- `cpp/RNSkYogaView.hpp`
- `ios/SkiaYogaView.mm`

Note: the prompt names `ios/RNSkYogaView.mm`, but this checkout has no such file. `ls ios` and `sed -n '1,260p' ios/RNSkYogaView.mm` showed `No such file or directory`. The actual iOS view wrapper present in this repo is `ios/SkiaYogaView.mm`, and the shared view runtime implementation is `cpp/RNSkYogaView.cpp` / `cpp/RNSkYogaView.hpp`; I read those instead.

## Post-worker-113 Baseline Evidence

- Current branch: `worker/114-post-113-root-cause-audit`.
- Current HEAD at audit start: `97b3035 Accept worker 113 and prepare worker 114`.
- Recent history includes merge commit `8e0114f Merge worker 113 NodeCommand toJSI symmetry` and worker commit `c52295f Complete NodeCommand toJSI symmetry`.
- Initial tracked status was clean. Ignored local dependency trees `node_modules` and `example/node_modules` were present and left untouched.
- Worker 113 completed representative/current `JSIConverter<NodeCommand>::toJSI(...)` serialization for `blurMaskFilter`, `image`, `path`, `paragraph`, `line`, and `points`.
- Worker 113 expanded `check:yoganode-native-commands-render` with host-JSC/native payload shape and `toJSI(...)` followed by `fromJSI(...)` round-trip assertions.
- Worker 113 intentionally left `SkSamplingOptions::toJSI(...)`, `ParagraphStyle::toJSI(...)`, and `TextStyle::toJSI(...)` bounded to object-shaped presence/acceptance rather than value-exact reconstruction.

Accepted aggregate gate:

- The full feasible matrix remains the accepted local aggregate gate.
- Its proof boundary is feasible local package/source/example metadata checks plus Node VM, host-JSC, and host-native probes.
- It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual React Native bridge delivery, RNGH native delivery, image asset loading/decoding, exact typography, exact render fidelity, Nitro registry install inside a React Native runtime, or full React Native app integration.

Baseline run:

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
- Total command duration: `4m 30s`.
- `/usr/bin/time` real: `270.53s`; user: `197.62s`; sys: `71.82s`.
- Notable entries:
  - `check:package-codegen-autolinking`: passed in `13.5s`.
  - `check:package-typescript-consumer`: passed in `10.7s`, including dynamic JSX props and package exports negatives.
  - `check:reconciler-animated-bindings`: passed in `1.0s`, within Node VM source-level boundaries.
  - `check:yoganode-native-commands-render`: passed in `30.5s`, including worker 113 `NodeCommand::toJSI(...)` shape and round-trip coverage.
  - `check:animated-double-synchronizable`: passed in `7.2s`.
  - `check:yoganode-jsi-raw-methods`: passed in `24.8s`.
  - `check:yoganode-nitro-materialization`: passed in `30.9s`.
  - `check:rnsk-yoga-view-runtime`: passed in `26.6s`.
  - `typecheck`: passed in `1.6s`.
  - `lint-ci`: passed in `3.6s`.
  - `check:example-native-generation`: passed in `15.0s`.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`; the matrix temp parent `/tmp/rnskia-feasible-matrix-EGV5mm` was empty before removal and was removed.

Focused source/proof-boundary evidence:

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- Focused Node source probe printed:
  - `getChildren uses YogaNode converter: true`
  - `YogaNode converter toJSI creates plain object: true`
  - `Nitro verifier mentions getChildren: false`

Current local platform blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because `xcodebuild` requires full Xcode and the active developer directory is Command Line Tools.
- `command -v pod`: no output, exit 1.
- `java -version`: failed with `Unable to locate a Java Runtime`.
- `command -v adb`, `cmake`, `ninja`, and `gradle`: no output, exit 1.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

## Candidate Target Ranking

### 1. Materialized `YogaNode.getChildren()` Return Identity And Prototype

- Classification: locally unblocked native/JSI materialization target.
- Root-cause value: highest. `src/Reconciler.ts` recursively cleans nodes through `node.getChildren()` in `cleanupNode(...)` and `clearContainer(...)`. If the children returned by native `getChildren()` are not the same materialized JS objects that Reconciler originally tracked, JS `WeakMap` cleanup state can be missed. If those returned objects lack Nitro prototype/raw methods, recursive `child.getChildren()` can fail outright.
- Source evidence:
  - `YogaNode::getChildren()` currently builds the array by calling `JSIConverter<std::shared_ptr<YogaNode>>::toJSI(runtime, _children[i])`.
  - `cpp/JSIConverter+YogaNode.hpp` currently constructs a fresh `jsi::Object obj(runtime)` and attaches NativeState, but it does not call `arg->toObject(runtime)` or otherwise attach the Nitro generated/manual method prototype.
  - `scripts/verify-yoganode-nitro-materialization.mjs` proves generated methods on selected directly materialized YogaNode objects but does not mention or exercise `getChildren`.
  - `scripts/verify-yoganode-jsi-raw-methods.mjs` directly calls raw `setInteractionConfig()` and `hitTest()` in C++, but its own output says it does not claim Nitro `toObject()` / prototype materialization proof.
- Likely verification shape: extend `check:yoganode-nitro-materialization` to create shared parent/child nodes, materialize both, insert the child, call `parentObject.getChildren()` through the materialized object, and assert the returned child is the cached materialized JS object, exposes generated methods and manual raw methods, supports recursive `getChildren()`, and still allows `setInteractionConfig()` / `hitTest()` via JS `callWithThis`.
- Expected files/modules touched by the next worker: likely `cpp/YogaNode.cpp`, possibly `cpp/JSIConverter+YogaNode.hpp` if the converter is made to delegate to materialization, `scripts/verify-yoganode-nitro-materialization.mjs`, and a worker report. `scripts/verify-yoganode-jsi-raw-methods.mjs` may only need to remain green unless the proof is split.
- Overclaim risks: this would prove host-JSC Nitro materialization/prototype identity for returned children, not actual React Native bridge delivery, React Native runtime integration, Nitro module registry install inside an app, platform-native app behavior, UI-runtime Worklets, or native rendering.

### 2. Value-Exact `sampling`, `textStyle`, And `paragraphStyle` `toJSI(...)`

- Classification: locally unblocked converter target, but lower lifecycle value than candidate 1.
- Root-cause value: medium. Worker 113 explicitly left this caveat: `SkSamplingOptions::toJSI(...)`, `TextStyle::toJSI(...)`, and `ParagraphStyle::toJSI(...)` currently emit empty objects while their `fromJSI(...)` paths parse meaningful fields. This is real converter asymmetry.
- Likely verification shape: expand host-JSC/native converter assertions for selected finite fields, for example image sampling filter/mipmap fields and selected text/paragraph style color/font-size fields, then assert value-shaped `toJSI(...)` payloads and round trips.
- Expected files/modules touched: likely `cpp/JSIConverter+SkSamplingOptions.hpp`, `cpp/JSIConverter+SkTextStyle.hpp`, `cpp/JSIConverter+SkParagraphStyle.hpp`, `scripts/verify-yoganode-native-commands-render.mjs`, and a worker report.
- Overclaim risks: this target must not claim exact typography, paragraph shaping fidelity, full style coverage, font fallback correctness, or exact render fidelity. It is serialization-shape work unless paired with bounded render checks.
- Why below candidate 1: the style/sampling caveat is acknowledged and bounded in worker 113, while `getChildren()` sits directly on Reconciler cleanup and object identity/prototype behavior.

### 3. Additional Converter Hardening For Numeric Enums / `canConvert(...)`

- Classification: locally unblocked but lower value.
- Root-cause value: low to medium. Current `NodeCommand` converter paths accept numeric enum values by casting, and `canConvert(...)` only checks object type and `data` object shape. That can be tightened, but worker 113 closed the strongest `toJSI(...)` field-symmetry issue and current verifiers already cover representative valid/invalid public command payloads.
- Likely verification shape: add focused invalid numeric enum and malformed shape cases to the command/render verifier, then narrow converter predicates if a real mismatch is found.
- Expected files/modules touched: `cpp/JSIConverter+NodeCommand.hpp`, `scripts/verify-yoganode-native-commands-render.mjs`, and a worker report.
- Overclaim risks: this would be converter validation hardening only. It would not prove runtime bridge delivery, generated wrapper delivery, platform rendering, or React Native app integration.

### 4. UI-Runtime Worklets Execution And Real Reanimated `SharedValue` Delivery

- Classification: blocked locally for honest proof.
- Root-cause value: high product value.
- Existing evidence: source-level Reconciler native/JS listener checks, Worklets transform checks, host-JSC/native `Synchronizable` extraction, and selected host-native dynamic `AnimatedDouble` command/render probes.
- Likely verification shape if unblocked: simulator/device React Native runtime with Reanimated/Worklets running on the UI runtime, observed `SharedValue` updates, native mirror/listener delivery, invalidation, and native render/state effects.
- Expected files/modules touched: example runtime harnesses and possibly `src/Reconciler.ts`, `src/YogaCanvas.tsx`, or native command code if failures appear.
- Overclaim risks: Node VM stubs, Babel transform checks, and host-JSC `Synchronizable` objects do not prove UI-runtime Worklets execution or real Reanimated delivery.

### 5. Actual React/Reconciler-To-Native Bridge, Nitro Registry Install, And Full Platform App Runtime

- Classification: blocked locally by missing platform tooling/runtime.
- Root-cause value: highest product confidence value, but not currently unblocked.
- Existing evidence: packed codegen/autolinking, Expo CNG/native-generation metadata, source-level Reconciler checks, host-JSC Nitro materialization, and host-native `SkiaYoga` / `RNSkYogaView` view-registry probes.
- Local blockers: full Xcode is not selected, CocoaPods is unavailable, Java is unavailable, Android SDK variables are unset, and ADB/CMake/Ninja/Gradle are unavailable on `PATH`.
- Likely verification shape if unblocked: generated native projects, CocoaPods/Gradle build, simulator/device launch, `SkiaYoga.install()` registry evidence, React tree commit into native command conversion, and rendered/logged native state.
- Expected files/modules touched: example app/runtime harnesses, native module/platform integration, and build metadata if failures appear.
- Overclaim risks: host-JSC materialization and host-native probes do not prove a real React Native bridge or Nitro registry install inside a running app.

### 6. Real Image Asset Loading/Decoding And Texture-Backed Image Behavior

- Classification: blocked or overclaim-prone locally.
- Root-cause value: medium-high product value.
- Existing evidence: synthetic in-memory `SkImage` / real `JsiSkImage` command conversion, fit/default/invalid behavior, bounded raster evidence, and generated wrapper delivery.
- Likely verification shape if unblocked: React Native/Expo asset resolution, `useImage`, local/remote asset loading, decoding, texture-backed image behavior, and native rendered output.
- Expected files/modules touched: example assets/screens, image-loading integration, and platform harnesses.
- Overclaim risks: synthetic host-native `SkImage` probes do not prove asset loading, decoding, texture-backed images, local/remote resolution, platform presentation, or exact image fidelity.

### 7. Exact Render Fidelity, Typography, Glyph Geometry, Font Fallback, And Paragraph Shaping

- Classification: partially sliceable locally, but exact proof remains blocked or overclaim-prone.
- Root-cause value: lower than candidate 1 right now. Existing command/render coverage already includes bounded path/stroke, dynamic path trim, CSS color strings, paragraph measurement, and representative raster/state checks.
- Likely verification shape: narrowly selected host-native style/geometry slices if a concrete source gap is found, or platform-font/render snapshots if platform runtime becomes available.
- Expected files/modules touched: likely `scripts/verify-yoganode-native-commands-render.mjs` and possibly C++ converter/render code if a focused bug appears.
- Overclaim risks: bounded pixels are not exact typography, glyph geometry, font fallback correctness, paragraph shaping parity, exact path/stroke geometry, or full render fidelity.

No stronger package export-boundary, package lifecycle, codegen/autolinking, generated-wrapper command breadth, public dynamic JSX typing, RN Skia private import, Android archive discovery, native lifetime, hit-testing, RNSkYogaView runtime, direct `StrokeOpts`, or command-render breadth target was substantiated. Those surfaces are covered by the green feasible matrix within explicit boundaries.

## Selected Next Target

Select: materialized `YogaNode.getChildren()` return identity and prototype coverage.

This is stronger than another audit-only step because it is source-confirmed, locally unblocked, and tied to a real Reconciler lifecycle path rather than a speculative runtime integration issue.

This is stronger than worker 113's bounded style/sampling `toJSI(...)` caveat because `getChildren()` can affect cleanup, listener removal, interaction unregistering, recursive traversal, and object identity. The style/sampling caveat is real, but currently bounded to converter serialization value completeness.

This is stronger than more command-render or generated `setCommand(...)` breadth because those are already broad. The remaining `getChildren()` path crosses manual raw method registration, Nitro materialization/prototype behavior, and Reconciler cleanup semantics in a way current verifiers do not cover.

Recommended proof boundary for the next worker:

- Prove host-JSC materialized YogaNode `getChildren()` behavior and returned-child identity/prototype only.
- Preserve current direct raw-method and generated-wrapper checks.
- Prove returned children are not bare NativeState-only objects.
- Do not claim platform-native app proof, React Native bridge delivery, Nitro registry install inside a real app, UI-runtime Worklets execution, real Reanimated delivery, image asset behavior, or render fidelity.

## Nested Challenger Documentation

- Nested agent: `/root/challenger_target_selection`.
- Prompt summary: read-only challenger in this worker 114 worktree; inspect post-worker-113 state and required context; return the strongest unblocked local root-cause target, why stronger than alternatives, verification shape, blocked targets/proof boundaries, and whether acceptance evidence is claimed; do not edit files.
- Exact prompt intent included the current worktree path, required reports/source files, the request to classify post-worker-113 target selection, and the instruction not to run destructive commands or edit anything.
- Result: completed and closed.
- Challenger recommendation:
  - Select `YogaNode.getChildren()` materialization/prototype identity as the strongest next target.
  - Reason: Reconciler cleanup recursively depends on `node.getChildren()`, while native `getChildren()` currently returns children through `JSIConverter<std::shared_ptr<YogaNode>>::toJSI(...)`; that converter creates a fresh plain NativeState object rather than a full `toObject(runtime)` materialized Nitro object with prototype methods.
  - Recommended extending `check:yoganode-nitro-materialization` to materialize parent/child nodes, insert the child, call materialized `parent.getChildren()`, and assert cached child object identity plus generated/raw method availability.
  - Classified full platform runtime, UI-runtime Worklets/Reanimated/RNGH, real image asset/texture behavior, and exact render fidelity as blocked or overclaim-prone locally.
- Response:
  - I checked `cpp/JSIConverter+YogaNode.hpp`, `cpp/YogaNode.cpp`, `src/Reconciler.ts`, and verifier source after receiving the challenger result.
  - I accepted the challenger target selection because the source probe confirmed `getChildren()` uses the bare YogaNode converter, the converter creates a plain NativeState object, and the Nitro materialization verifier does not cover `getChildren`.
- Challenger acceptance evidence claimed: none. The challenger performed read-only source/progress inspection and non-mutating environment/status probes only. It did not run the full feasible matrix or implementation verifiers as acceptance evidence.
- Closure evidence: `close_agent /root/challenger_target_selection` returned completed status with the above result.

## Verification Commands And Results

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 30s`.
  - `/usr/bin/time` real: `270.53s`; user: `197.62s`; sys: `71.82s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-EGV5mm` was empty before removal and was removed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed with no output.
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`: passed with no output.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed with no output.
- Focused source probe:
  - `getChildren uses YogaNode converter: true`
  - `YogaNode converter toJSI creates plain object: true`
  - `Nitro verifier mentions getChildren: false`
- Platform blocker probes:
  - `xcode-select -p`: `/Library/Developer/CommandLineTools`.
  - `xcodebuild -version`: failed because full Xcode is not selected.
  - `command -v pod`: no output, exit 1.
  - `java -version`: failed because no Java Runtime is available.
  - `command -v adb`, `cmake`, `ninja`, and `gradle`: no output, exit 1.
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

Final cleanup/status commands are recorded below after report creation.

## Cleanup And Status Evidence

Pre-report status after the matrix and focused probes:

- `git diff --stat`: no output.
- `git status --short --branch --ignored=matching` showed only:
  - `## worker/114-post-113-root-cause-audit`
  - ignored dependency trees: `example/node_modules`, `node_modules`

Final cleanup/status probes after report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching` showed only:
  - `## worker/114-post-113-root-cause-audit`
  - `?? worker-progress/worker-114-post-113-root-cause-audit.md`
  - ignored dependency trees: `example/node_modules`, `node_modules`
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding `node_modules` and `example/node_modules`: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible-matrix, example, package, AnimatedDouble, RNSkYogaView, and YogaNode roots: no output.
- Active verifier/debug process probe initially saw only the just-finished temp-prefix `find` command. Immediate rerun excluding that probe returned no output with exit 1.
- `list_agents`: only `/root` running after closing `/root/challenger_target_selection`.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The recommendation targets a lifecycle/prototype boundary that current green verifiers do not exercise, rather than adding another bounded render slice.
- It is grounded in source evidence from Reconciler cleanup, native `getChildren()`, and the YogaNode JSI converter.
- The recommended proof boundary is narrow enough to avoid claiming React Native app/runtime behavior.

Maintainability:

- The likely proof belongs in the existing Nitro materialization verifier, which already owns `YogaNode::toObject(runtime)`, generated wrapper execution, NativeState identity, and cached-object behavior.
- A fix can be small if `getChildren()` can delegate returned children to Nitro materialization rather than maintaining a separate NativeState-only conversion path.
- Existing raw-method and generated-wrapper checks should stay separate but complementary.

Performance:

- The proposed verifier extension is a small host-JSC materialization case with parent/child nodes and no raster rendering.
- It should not materially expand the feasible matrix beyond the current Nitro materialization entry.
- Runtime performance impact should be negligible if returned children reuse cached `toObject(runtime)` objects.

Security:

- The recommended target does not introduce network access, package lifecycle scripts, broad temp deletion, shell interpolation, or user-controlled native execution.
- Returning fully materialized objects from native children should narrow behavioral ambiguity compared with fresh bare NativeState wrappers.
- Any implementation should preserve scoped JSI errors and avoid hiding real failures behind retries.
