# Worker 079 - Post-worker-078 root-cause audit

## Goal Lifecycle

- `create_goal` objective: `Audit post-worker-078 state and select the next strongest unblocked root-cause target.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Audit post-worker-078 state and select the next strongest unblocked root-cause target.`
- Pre-report `get_goal` evidence showed status `active`, the same objective, `tokensUsed: 374056`, and `timeUsedSeconds: 341`.

## Scope And Files Changed

- Read-only/root-cause audit after worker 078.
- No product/source/config changes were made.
- Intended tracked change: this report only, `worker-progress/worker-079-post-078-root-cause-audit.md`.

## Required Context Read

- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-076-post-075-root-cause-audit.md`
- `worker-progress/worker-077-feasible-matrix-temp-isolation.md`
- `worker-progress/worker-078-yoganode-jsi-raw-methods.md`
- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-yoganode-jsi-raw-methods.mjs`
- `scripts/verify-yoganode-native-hit-testing.mjs`
- `scripts/verify-yoganode-native-runtime-smoke.mjs`
- `scripts/verify-rnsk-yoga-view-runtime.mjs`
- Relevant runtime/native sources and verifiers:
  - `cpp/YogaNode.*`
  - `cpp/SkiaYoga.*`
  - `cpp/RNSkYogaView.*`
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `cpp/AnimatedDouble.cpp`
  - `cpp/PlatformContextAccessor.*`
  - `src/YogaCanvas.tsx`
  - `src/Reconciler.ts`
  - `src/useCanvasGestures.ts`
  - `src/interactivity.ts`
  - `src/specs/SkiaYoga.nitro.ts`
  - `src/specs/commands.ts`
  - `src/specs/style.ts`
  - existing `scripts/verify-*.mjs`

## Worker 078 Acceptance Assessment

Worker 078 materially closed the duplicate YogaNode raw/generated `setStyle` registration gap without overstating the proof boundary.

Evidence:

- `nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp` still registers generated `setStyle` through `prototype.registerHybridMethod("setStyle", &HybridYogaNodeSpec::setStyle)`.
- `cpp/YogaNode.hpp` still calls `HybridYogaNodeSpec::loadHybridMethods()` before manual raw registrations, but now only manually registers `draw`, `getChildren`, `hitTest`, and `setInteractionConfig`.
- `rg -n "registerRawHybridMethod\\(\"setStyle|setStyleRaw"` across `cpp/YogaNode.*` found no matches.
- `node_modules/react-native-nitro-modules/cpp/prototype/Prototype.hpp` still contains the duplicate-method guard around `_methods.contains(name)` and `"Cannot add Hybrid Method"`.
- `package.json` includes `check:yoganode-jsi-raw-methods`.
- `scripts/verify-feasible-matrix.mjs` includes temp prefix `rnskia-yoganode-jsi-raw-methods-` and runs `npm run check:yoganode-jsi-raw-methods` as command 17 of 25.
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`: passed.

Current proof boundary is honest:

- Accepted: source-level no-overlap invariant; host-native compile/link against real YogaNode/generated Nitro/Yoga/RN Skia/JSC inputs; direct host-JSC execution of remaining raw `setInteractionConfig()` and `hitTest()` plus generated `NodeStyle` conversion.
- Explicitly not proven: Nitro `toObject()` / prototype materialization. Worker 078 documented the host-JSC `toObject()` crash at Nitro `getRuntimeId(runtime)` and rejected that overclaim.
- Explicitly not proven: iOS/Android app build/run, simulator/device launch, native platform surface presentation, UI-runtime Worklets execution, or RNGH native delivery.

## Feasible Matrix Evidence

- `npm run check:feasible-matrix`: passed.
- Matrix command count: 25.
- Total command duration: `3m 35s`.
- Worker 078 command: `[17/25] npm run check:yoganode-jsi-raw-methods`, passed in `29.0s`.
- Cleanup accounting removed newly created `tsconfig.tsbuildinfo`.
- Matrix temp parent before removal: `/tmp/rnskia-feasible-matrix-Hje9sU`; entries were empty; the parent was removed.
- Remaining new tracked artifacts after matrix cleanup: none.
- Proof boundary printed by the matrix: feasible local package/source/example metadata checks only; no CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.

All 25 commands passed:

1. `npm run check:package-codegen-autolinking`
2. `npm run check:package-typescript-consumer`
3. `npm run check:package-surface`
4. `npm run check:package-lifecycle`
5. `npm run check:install-isolation`
6. `npm run check:rn-codegen-schema`
7. `node node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js src/specs/NativeSkiaYoga.ts src/specs/SkiaYogaViewNativeComponent.ts`
8. `npm run check:skia-yoga-object-lazy-init`
9. `npm run check:reconciler-animated-bindings`
10. `npm run check:gesture-interaction-runtime`
11. `npm run check:yogacanvas-lifecycle-runtime`
12. `npm run check:rn-skia-imports`
13. `npm run check:android-skia-archives`
14. `npm run check:yoganode-native-lifetime`
15. `npm run check:yoganode-native-runtime`
16. `npm run check:yoganode-native-hit-testing`
17. `npm run check:yoganode-jsi-raw-methods`
18. `npm run check:rnsk-yoga-view-runtime`
19. `npm run typecheck`
20. `npm run lint-ci`
21. `cd example && bun run typecheck`
22. `bun run specs`
23. `npm run check:example-bundle`
24. `npm run check:example-native-generation`
25. `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`

## Platform-Native Blocker Evidence

Concrete local probes:

- `xcode-select -p`: exit 0, `/Library/Developer/CommandLineTools`.
- `command -v xcodebuild && xcodebuild -version`: exit 1 after resolving `/usr/bin/xcodebuild`; `xcodebuild` requires full Xcode because the active developer directory is Command Line Tools.
- `xcrun --find xcodebuild && xcrun xcodebuild -version`: exit 72; `xcrun` could not find utility `xcodebuild`.
- `command -v pod && pod --version`: exit 1, no output.
- `pod --version`: exit 127, command not found.
- `command -v java && java -version`: exit 1 after resolving `/usr/bin/java`; no Java Runtime is installed.
- `printenv ANDROID_HOME`: exit 1, unset.
- `printenv ANDROID_SDK_ROOT`: exit 1, unset.
- `command -v adb && adb version`: exit 1, no output.
- `adb version`: exit 127, command not found.
- `command -v cmake && cmake --version`: exit 1, no output.
- `cmake --version`: exit 127, command not found.
- `command -v ninja && ninja --version`: exit 1, no output.
- `ninja --version`: exit 127, command not found.
- `command -v gradle && gradle --version`: exit 1, no output.
- `gradle --version`: exit 127, command not found.
- `git ls-files example/ios example/android`: empty output.
- `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: empty output.
- `git status --short --ignored=matching example/ios example/android example/.expo`: empty output.

Interpretation: full iOS/Android native app build/run remains blocked by external local machine prerequisites, not by a currently reproduced repo-owned source failure.

## Current Coverage And Remaining Gaps

Covered by the 25-command matrix:

- Package publish surface, lifecycle, packed TypeScript consumer, and packed RN codegen/autolinking consumer.
- Root/example typecheck, lint, Nitro generation, example bundle export, and Node-run Expo native generation.
- Public import laziness, Worklets transform shape, Reconciler animated bindings, gesture interaction runtime, YogaCanvas lifecycle/profiling behavior, and RN Skia import boundaries.
- Host-native YogaNode lifetime/reparenting, runtime smoke, hit-testing traversal, JSI raw `setInteractionConfig()` / `hitTest()`, and `SkiaYoga` / `RNSkYogaView` scheduler/profile behavior.

Remaining gaps:

- Full CocoaPods install, Gradle sync/build, iOS/Android native compilation, simulator/device launch, real app runtime, native platform surface presentation, UI-runtime Worklets execution, and RNGH native delivery are still blocked externally.
- Nitro `toObject()` / prototype materialization remains unproven in the host harness after worker 078's documented crash.
- `YogaNode::setCommand()` is not currently executed by any host-native verifier. Source-level Reconciler checks store command payloads in JS stubs, `RNSkYogaView` uses a custom `ProbeCommand`, and hit-testing uses a custom `PreciseRectCommand`.
- Real YogaNode command classes and draw behavior remain largely unentered: `RectCmd`, `RRectCmd`, `CircleCmd`, `PathCmd`, `LineCmd`, `PointsCmd`, `TextCmd`, `BlurMaskFilterCmd`, and group rasterization/cache behavior.
- `JSIConverter<NodeCommand>` is not covered by a focused host-JSC command conversion/runtime verifier.

Feasibility evidence for the strongest remaining local target:

- `node_modules/react-native/ReactCommon/jsc/JSCRuntime.cpp`: present.
- `cpp/AnimatedDouble.cpp`: present and needed for dynamic/numeric command `resolve()` paths.
- `cpp/PlatformContextAccessor.cpp`: present and can provide a host `RNSkPlatformContext` for text/image/paragraph paths if included.
- `node_modules/react-native-skia-apple-macos/libs` contains the expected macOS RN Skia static archives, including `libskia.a`, `libskparagraph.a`, `libskshaper.a`, and related archives already used by current host-native verifiers.

## Candidate Ranking

1. Selected: host-native YogaNode command/render verifier.
   - Evidence: current native runtime/scheduler checks route drawing through a custom `ProbeCommand`, current hit-testing uses a custom `PreciseRectCommand`, and JS Reconciler checks use command stubs rather than real C++ command classes.
   - Why strongest: it is repo-owned, behavior-rich, locally feasible with the same host-native toolchain already passing, and not already covered by the 25-command matrix. It exercises the product's central promise: layout plus Skia command rendering.
   - Proof boundary: host-native macOS C++ command/render behavior only; no iOS/Android app build/run, platform presentation, Nitro `toObject()` materialization, UI-runtime Worklets, or RNGH native delivery.
2. NodeCommand JSI conversion-only verifier.
   - Evidence: `cpp/JSIConverter+NodeCommand.hpp` maps JS command payloads to native `NodeCommand`, but no current verifier directly exercises that converter across command types.
   - Why lower: valuable but narrower than selected. It should be included where feasible in the selected verifier, at least for simple command payloads.
3. Nitro `toObject()` / prototype materialization target.
   - Evidence: worker 078 found a real host-JSC crash at Nitro `getRuntimeId(runtime)` during `HybridObjectPrototype::createPrototype(...)`.
   - Why lower: important but currently risky as an acceptance target because the harness has already crashed outside a clean local proof boundary. It needs separate careful scoping and should not block command/render verification.
4. Interaction event propagation from native hit-test to gesture dispatch.
   - Evidence: `check:gesture-interaction-runtime` covers JS/RNGH/Reanimated flow with local stubs, and worker 078 covers native raw `hitTest()`, but real RNGH native event delivery remains unproven.
   - Why lower: the next stronger unblocked part is already covered at source/host boundaries, while real delivery is platform-runtime blocked.
5. Platform-native toolchain preflight automation.
   - Evidence: audits repeatedly collect the same Xcode/CocoaPods/Java/Android SDK/ADB/CMake/Ninja/Gradle blockers.
   - Why lower: useful hygiene, but it codifies external machine state rather than expanding product-runtime proof.
6. Full iOS/Android app build/run.
   - Why not selected: still externally blocked by the concrete platform probes above.

## Selected Next Target And Acceptance Plan

Selected next strongest target: add a focused host-native YogaNode command/render verifier for real `YogaNode::setCommand()` and `drawInternal()` behavior.

Suggested acceptance plan for the next worker:

1. Add a package script such as `check:yoganode-native-commands-render` and a verifier such as `scripts/verify-yoganode-native-commands-render.mjs`.
2. Compile/link a host executable using the proven host-native patterns:
   - real `cpp/YogaNode.cpp`,
   - generated `HybridYogaNodeSpec.cpp`,
   - React Native JSC/JSI sources,
   - upstream Yoga sources,
   - RN Skia macOS archives/helper sources,
   - `cpp/AnimatedDouble.cpp`,
   - `cpp/PlatformContextAccessor.cpp` if text/image/paragraph paths need host platform context.
3. In the host probe, create a JSC runtime and call `RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(runtime.get())` before `YogaNode::setCommand()`.
4. Install a minimal host `RNSkPlatformContext` with `SetPlatformContext(...)` if any selected command path needs font/image/paragraph/platform services.
5. Execute real `YogaNode::setCommand()` with native `NodeCommand` payloads for a minimal deterministic set:
   - required: `group`, `rect`, child rendering, layout-derived geometry, clipping/paint propagation, and group `rasterize` cache behavior;
   - good expansion: `circle`, `rrect`, `path`, `line`, and `points`;
   - optional only if bounded and stable: `text`, `paragraph`, `image`.
6. Render to a small raster `SkSurface` through `renderToContext()` or `drawInternal()` and assert pixel/behavior outcomes with tolerant region samples rather than whole-image snapshots.
7. Include `JSIConverter<NodeCommand>::fromJSI(...)` for simple command payloads if it stays bounded, but do not depend on Nitro `toObject()` / prototype materialization.
8. Add the verifier to `scripts/verify-feasible-matrix.mjs` only after standalone stability and cleanup accounting are proven.

Quality review:

- This target expands from scheduling/probe-command proof to actual product command rendering.
- Pixel assertions should be deterministic and small to avoid fragile snapshot-style tests.

Maintainability review:

- Reuse existing host-native verifier helpers and archive discovery patterns.
- Keep command coverage focused; avoid turning the verifier into a full rendering conformance suite.

Performance review:

- Limit the probe surface and raster sizes. Compile-heavy host-native checks are acceptable in the explicit verifier/matrix path, but the matrix should stay bounded.

Security review:

- Use structured `spawnSync` arguments, verifier-owned temp roots, fixed probe inputs, and constrained cleanup.
- Do not execute arbitrary JS or shell input through the JSI/runtime harness.

## Nested Challenger Documentation

- Nested challenger: `/root/post_078_target_challenger`.
- Prompt:

```text
You are a read-only challenger for worker 079 in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-079-post-078-root-cause-audit. Do not edit files and do not run long verification commands. Independently challenge this tentative selection: after worker 078 closed the YogaNode duplicate raw/generated setStyle boundary, the next strongest unblocked target is a host-native YogaNode command/render verifier that executes real YogaNode::setCommand(), command payload conversion where feasible, Yoga layout, drawInternal/renderToContext on a raster SkSurface, and pixel/behavior assertions for actual command types (at least rect/group/rasterize plus a small set such as circle/rrect/path/line/points/text if feasible), because current matrix coverage uses source-level Reconciler command stubs and a custom ProbeCommand in RNSkYogaView rather than real command classes. Inspect only the files needed, especially package.json, scripts/verify-feasible-matrix.mjs, scripts/verify-yoganode-jsi-raw-methods.mjs, scripts/verify-yoganode-native-hit-testing.mjs, scripts/verify-rnsk-yoga-view-runtime.mjs, cpp/YogaNode.*, cpp/JSIConverter+NodeCommand.hpp, src/Reconciler.ts, src/specs/commands.ts, and existing verifier scripts. Return a concise answer with: (1) whether this target is stronger than alternatives, (2) at least 4 alternative candidates and why they rank lower/higher, (3) acceptance/proof-boundary suggestions for the next worker, and (4) feasibility concerns, especially host JSC/main runtime setup, RN Skia command dependencies, pixel assertion fragility, and avoiding overclaims about iOS/Android app runtime, Nitro toObject/prototype materialization, UI-runtime Worklets, or RNGH native delivery. If you cannot finish promptly, say so; no acceptance evidence should be inferred.
```

- Result: completed. The challenger agreed the host-native YogaNode command/render verifier is the strongest unblocked repo-owned target. It ranked full iOS/Android app build/run, Nitro `toObject()` materialization, JSI conversion-only coverage, additional Reconciler source stubs, platform preflight automation, UI-runtime Worklets, and RNGH delivery lower or blocked. It recommended explicit host JSC/main-runtime setup, minimal host platform context, small tolerant pixel checks, required rect/group/rasterize/child coverage, optional broader command coverage, and strict proof-boundary language.
- Closure evidence: `list_agents` showed the challenger completed, `close_agent /root/post_078_target_challenger` returned that completed status, and a final `list_agents` showed only `/root` running.

## Cleanup And Status Evidence

- `git diff --check`: passed.
- Final `git status --short --ignored=matching`:
  - `?? worker-progress/worker-079-post-078-root-cause-audit.md`
  - `!! example/node_modules`
  - `!! node_modules`
- Final repo-root tarball probe, `find . -maxdepth 1 -name '*.tgz' -print`: empty output.
- Final build-info probes, `find . example -maxdepth 1 \( -name 'tsconfig.tsbuildinfo' -o -name '*.tsbuildinfo' \) -print` and `find . -maxdepth 3 \( -name '*build-info*' -o -name '*.buildinfo' -o -name '*.tsbuildinfo' \) -print`: empty output.
- Final generated example native/Expo probe, `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: empty output.
- Final process probe for verifier-owned `node`, `clang++`, `lldb`, `debugserver`, `yoganode-jsi-raw-methods`, `rnsk-yoga-view-runtime`, `yoganode-native-hit-testing`, and `yoganode-runtime-smoke`: empty output.
- Final `/tmp` and `/private/tmp` verifier-temp probe found only the pre-existing `/private/tmp/rnskia-example-export.bE7set` directory, which was already documented by prior workers and was preserved.
- Final `/var/folders/.../T` verifier-temp probe found no `rnskia-*` temp roots.
