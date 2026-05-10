# Worker 076 - Post-worker-075 root-cause audit

## Goal Lifecycle

- `create_goal` objective: `Audit post-worker-075 state and select the next strongest unblocked root-cause target.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Audit post-worker-075 state and select the next strongest unblocked root-cause target.`
- Pre-report `get_goal` evidence showed status `active`, the same objective, `tokensUsed: 643384`, and `timeUsedSeconds: 1383`.

## Scope And Files Changed

- Read-only/root-cause audit after worker 075.
- No product/source/config changes were made.
- Intended tracked change: this report only, `worker-progress/worker-076-post-075-root-cause-audit.md`.

## Required Context Read

- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-074-post-073-root-cause-audit.md`
- `worker-progress/worker-075-rnsk-yoga-view-runtime.md`
- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-rnsk-yoga-view-runtime.mjs`
- Relevant runtime/native sources and verifiers:
  - `cpp/SkiaYoga.*`
  - `cpp/RNSkYogaView.*`
  - `cpp/YogaNode.*`
  - `src/YogaCanvas.tsx`
  - `src/Reconciler.ts`
  - `src/useCanvasGestures.ts`
  - `src/interactivity.ts`
  - `src/specs/SkiaYoga.nitro.ts`
  - `src/specs/NativeSkiaYoga.ts`
  - `nitrogen/generated/shared/c++/HybridYogaNodeSpec.*`
  - existing `scripts/verify-*.mjs`

## Worker 075 Acceptance Assessment

Worker 075 materially closed the native view-registry, render scheduling, and profiling proof gap selected by worker 074.

Evidence:

- `package.json` now includes `check:rnsk-yoga-view-runtime`.
- `scripts/verify-feasible-matrix.mjs` includes `npm run check:rnsk-yoga-view-runtime` as command 17 of 24 and tracks the `rnskia-rnsk-yoga-view-runtime-` temp prefix.
- `scripts/verify-rnsk-yoga-view-runtime.mjs` compiles and links a host executable against real `cpp/SkiaYoga.cpp`, `cpp/RNSkYogaView.cpp`, `cpp/YogaNode.cpp`, generated Nitro specs, upstream Yoga sources, RN Skia macOS archives, and required helper sources.
- The verifier registers a real `RNSkYogaView` through RN Skia `RNSkJsiViewApi` / `ViewRegistry`, then exercises `SkiaYoga::attachViewRoot`, `requestViewRender`, `setViewAnimating`, `consumeViewProfileSample`, and `detachViewRoot`.
- Runtime assertions cover missing-view no-ops, dirty-frame rendering, idle-frame skips, animating-frame continuation, profile serialization/reset, root detach, post-detach safety, and unregister fallback.

Proof boundary stayed accurate:

- Worker 075 did not claim iOS/Android app build/run, simulator/device behavior, platform surface presentation, UI-runtime Worklets execution, RNGH native delivery, or end-to-end app runtime.
- Worker 075 also did not claim JSI/generated hybrid method entry-point execution; the verifier invokes C++ methods directly and uses `-Wl,-undefined,dynamic_lookup` only for unentered host-incompatible paths.
- Local `MASTER_PLAN.md` and `MASTER_PROGRESS.md` still describe worker 075 as active. The prompt states worker 075 was accepted after independent review, and this worktree contains the accepted verifier/report artifacts.

## Feasible Matrix Evidence

First run:

- `npm run check:feasible-matrix`: failed at command 24 after commands 1-23 passed.
- Failure reason: the local preservation probe refused to reuse an existing verifier sentinel at `example/ios/__rnskia_native_generation_preservation_sentinel__`.
- The matrix cleanup removed newly created `example/.expo`, `example/android`, `example/ios`, and `tsconfig.tsbuildinfo`.
- Follow-up probes found no remaining sentinel, generated example native directories, TypeScript build info, repo tarballs, or `rnskia-example-native-generation-*` temp roots.

Clean rerun:

- `npm run check:feasible-matrix`: passed.
- Matrix command count: 24.
- Total command duration: `3m 2s`.
- Worker 075 command: `[17/24] npm run check:rnsk-yoga-view-runtime`, passed in `29.9s`.
- Cleanup accounting removed one new verifier-owned temp root, `/var/folders/th/kc95m5nd2lq44bmk410n5jg80000gn/T/rnskia-yoganode-hit-testing-xmjUXn`, and new `tsconfig.tsbuildinfo`.
- Remaining new tracked artifacts after cleanup: none.
- Proof boundary printed by the matrix: feasible local package/source/example metadata checks only; no CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.

All 24 clean-rerun commands passed:

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
17. `npm run check:rnsk-yoga-view-runtime`
18. `npm run typecheck`
19. `npm run lint-ci`
20. `cd example && bun run typecheck`
21. `bun run specs`
22. `npm run check:example-bundle`
23. `npm run check:example-native-generation`
24. `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`

## Platform-Native Blocker Evidence

Concrete local probes:

- `xcode-select -p`: exit 0, `/Library/Developer/CommandLineTools`.
- `command -v xcodebuild`: exit 0, `/usr/bin/xcodebuild`.
- `xcodebuild -version`: exit 1, `tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance`.
- `xcrun --find xcodebuild`: exit 72, `unable to find utility "xcodebuild"`.
- `xcrun xcodebuild -version`: exit 72, `unable to find utility "xcodebuild"`.
- `command -v pod`: exit 1, no output.
- `pod --version`: exit 127, command not found.
- `command -v java`: exit 0, `/usr/bin/java`.
- `java -version`: exit 1, unable to locate a Java Runtime.
- `printenv ANDROID_HOME`: exit 1, unset.
- `printenv ANDROID_SDK_ROOT`: exit 1, unset.
- `command -v adb`: exit 1, no output.
- `adb version`: exit 127, command not found.
- `command -v cmake`: exit 1, no output.
- `cmake --version`: exit 127, command not found.
- `command -v ninja`: exit 1, no output.
- `ninja --version`: exit 127, command not found.
- `command -v gradle`: exit 1, no output.
- `gradle --version`: exit 127, command not found.
- `git ls-files example/ios example/android`: empty output.
- `find example -maxdepth 1 -name ios -o -name android -o -name .expo`: empty output.
- `git status --short --ignored=matching example/ios example/android example/.expo`: empty output.

Interpretation: full iOS/Android native app build/run remains blocked by external local machine prerequisites, not by a currently reproduced repo-owned source failure.

## Current Coverage And Remaining Gaps

Proven by the 24-command matrix and source inspection:

- Package publish surface, package lifecycle, packed TypeScript consumer, and packed RN codegen/autolinking consumer are green.
- Root/example typecheck, lint, Nitro generation, example bundle export, and Node-run Expo native generation are green.
- Import laziness, public import graph behavior, Worklets transform shape, Reconciler animated bindings, gesture interaction runtime, and YogaCanvas lifecycle/profiling behavior are locally verified with source-level stubs.
- Host-native YogaNode lifetime/reparenting, runtime smoke, hit-testing traversal, and Worker 075's `SkiaYoga` / `RNSkYogaView` view runtime behavior are green.

Not proven:

- CocoaPods install, Gradle sync/build, iOS/Android native compilation, simulator/device launch, real app runtime, native platform surface presentation, real Worklets UI-runtime execution, and RNGH native delivery.
- JSI execution of `YogaNode::setInteractionConfig` and `YogaNode::hitTest`; worker 073 deliberately sets native interaction fields directly.
- YogaNode hybrid prototype setup for manually registered raw methods.
- Real RN Skia command drawing across the full command set through `YogaNode::setCommand`; host-native runtime verifiers use narrow probe commands or selected source-level stubs.

Important source-level finding:

- `nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp` registers generated `setStyle` through `prototype.registerHybridMethod("setStyle", &HybridYogaNodeSpec::setStyle)`.
- `cpp/YogaNode.hpp` then calls `HybridYogaNodeSpec::loadHybridMethods()` and tries to register `prototype.registerRawHybridMethod("setStyle", 1, &YogaNode::setStyleRaw)`.
- `node_modules/react-native-nitro-modules/cpp/prototype/Prototype.hpp` throws when `_methods.contains(name)` before registering another method with the same name.
- Focused source probe output:

```json
{
  "generatedSetStyle": 1,
  "manualSetStyle": 1,
  "duplicateThrows": true
}
```

This is stronger than a generic "untested JSI parser" concern because it is a concrete likely prototype-registration collision outside the 24-command matrix.

## Candidate Ranking

1. Selected: YogaNode hybrid/JSI raw-method boundary verifier and collision fix.
   - Evidence: Worker 073's hit-testing verifier explicitly states `setInteractionConfig()` is JSI-only and sets native fields directly. Worker 075 explicitly leaves JSI/generated hybrid methods unentered. Source inspection found a concrete duplicate `setStyle` registration path that Nitro should throw on during prototype setup.
   - Why strongest: it is repo-owned, behavior-rich, currently unverified by the 24-command matrix, and likely affects public runtime object usability before full app execution. It also connects JS interaction config, native hit-testing, and Nitro method exposure.
   - Proof boundary: host-native/source-level JSI proof only; still not iOS/Android app build/run, simulator/device, real platform view presentation, RNGH native delivery, or UI-runtime Worklets execution.
2. Native draw-command/render behavior beyond view scheduling.
   - Evidence: Worker 075 proves scheduler/render dispatch with a local `ProbeCommand`, while real command construction/drawing in `YogaNode::setCommand`, command `updateProps`, text/paragraph/image/path handling, rasterized groups, and pixel output remain mostly unexecuted.
   - Why lower: potentially high value, but broad and likely requires heavier RN Skia/Jsi object setup. A narrowly scoped target might be feasible, but the newly found hybrid-method collision is more concrete and blocks entry-point usability earlier.
3. Host-native JSI parser coverage limited to `YogaNode::setInteractionConfig`.
   - Evidence: JS normalization is covered by `check:gesture-interaction-runtime`, and native hit traversal is covered by `check:yoganode-native-hit-testing`; the parser bridge between them remains unexecuted.
   - Why lower than selected: it is a subset of the selected target. The next worker should include it, but should also address prototype registration and raw method entry-point exposure.
4. Platform-native toolchain preflight automation.
   - Evidence: repeated audits keep collecting the same Xcode/CocoaPods/Java/Android SDK/ADB/CMake/Ninja/Gradle blockers manually.
   - Why lower: feasible and useful, but it codifies external machine state rather than advancing product runtime proof.
5. Documentation/progress drift cleanup.
   - Evidence: local `MASTER_PLAN.md` and `MASTER_PROGRESS.md` still say worker 075 is active even though this worktree contains the accepted worker 075 artifacts and the prompt states it was accepted.
   - Why lower: real hygiene issue, but documentation-only and weaker than the product runtime boundary above.
6. Full iOS/Android app build/run.
   - Why not selected: still externally blocked by the concrete platform probes above.

## Selected Next Target And Acceptance Plan

Selected next strongest target: add a focused YogaNode hybrid/JSI raw-method verifier and fix the duplicate raw/generated method registration root cause.

Suggested acceptance plan for the next worker:

1. Add a package script such as `check:yoganode-jsi-raw-methods` and a verifier script such as `scripts/verify-yoganode-jsi-raw-methods.mjs`.
2. First assert the static registration invariant: no method name is registered both by generated `HybridYogaNodeSpec::loadHybridMethods()` and manual `YogaNode::loadHybridMethods()` raw registrations.
3. Fix the current `setStyle` collision by removing or redesigning the duplicate raw registration while preserving JS-facing `setStyle` behavior and useful error reporting.
4. If feasible, compile a host-native probe with real `YogaNode.cpp`, generated Nitro specs, upstream Yoga, RN Skia helper sources/archives, Nitro helper sources, and a concrete local JSI runtime. Local evidence shows `node_modules/react-native/ReactCommon/jsc/JSCRuntime.*` is present and `/System/Library/Frameworks/JavaScriptCore.framework` exists, so `facebook::jsc::makeJSCRuntime()` is the likely host runtime path.
5. In the host probe, expose `YogaNode::loadHybridMethods()` through a test subclass or the normal Nitro object exposure path and assert prototype setup does not throw.
6. Exercise `YogaNode::setInteractionConfig()` with real `jsi::Object` inputs for numeric/object hitSlop, pointerEvents, preciseHit, and eventTag; then call real `hitTest()` raw method with valid and invalid arguments to prove the parser-to-hit-test bridge.
7. Keep `draw()` and full command-pixel proof optional unless they can be scoped tightly; do not let them broaden this target into a full drawing engine verifier.
8. Add the new verifier to `scripts/verify-feasible-matrix.mjs` only after the standalone command is stable and cleanup accounting is bounded to verifier-owned temp prefixes.

Quality review:

- The selected target attacks a concrete runtime boundary not covered by existing verifiers.
- It should fail on duplicate prototype registration before platform app build/run is available, making it a useful local feedback loop.

Maintainability review:

- A static duplicate-registration assertion plus a small host JSI probe should be easier to maintain than relying on manual source review.
- The verifier should reuse existing host-native helper patterns rather than introduce a broad new framework.

Performance review:

- Keep the first verifier focused on prototype setup and interaction/hit-test raw methods. Avoid a broad command drawing matrix in the same worker.

Security review:

- Use structured `spawnSync` argument arrays, verifier-owned temp directories, no shell interpolation, and cleanup limited to verifier-owned prefixes.
- Do not execute arbitrary user input through the JSI runtime; generated probe inputs should be fixed literals.

## Nested Challenger Documentation

- Nested challenger: `/root/post_075_target_challenger`.
- Prompt:

```text
You are a read-only challenger for the react-native-skia-yoga worker 076 audit in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-076-post-075-root-cause-audit. Do not edit files and do not run long verification commands. Independently challenge this tentative ranking: the next strongest unblocked target is a host-native JSI/raw-method boundary verifier for YogaNode::setInteractionConfig plus YogaNode::hitTest/draw/setStyleRaw coverage, because worker 073 hit-testing sets interaction fields directly and worker 075 explicitly leaves generated hybrid/JSI methods unentered. Inspect only the files needed, especially package.json, scripts/verify-feasible-matrix.mjs, scripts/verify-yoganode-native-hit-testing.mjs, scripts/verify-rnsk-yoga-view-runtime.mjs, cpp/YogaNode.*, cpp/SkiaYoga.*, cpp/RNSkYogaView.*, src/interactivity.ts, src/useCanvasGestures.ts, and existing verifier scripts. Return a concise answer with: (1) whether that target is stronger than alternatives, (2) at least 3 alternative candidates and why they rank lower or higher, (3) proof boundary/acceptance suggestions, and (4) any feasibility concerns, especially whether local JSI runtime support appears available through React Native JSC/Hermes sources. If you cannot finish promptly, say so; no acceptance evidence should be inferred.
```

- Result: stalled. `wait_agent` timed out, `list_agents` showed the challenger still running, and `close_agent` returned previous status `running`.
- No nested challenger acceptance evidence is claimed.

## Cleanup And Status Evidence

- `git diff --check`: passed.
- Final repo-root tarball probe: empty output.
- Final TypeScript build-info probe: empty output.
- Final generated example native/Expo probe for `example/ios`, `example/android`, and `example/.expo`: empty output.
- Final preservation sentinel probe: empty output.
- Final temp probes found and removed one verifier-owned leftover from the first/second matrix runs: `/var/folders/th/kc95m5nd2lq44bmk410n5jg80000gn/T/rnskia-yoganode-hit-testing-JnRFip`.
- Final `/tmp`, `/private/tmp`, and `/var/folders/.../T` verifier-temp probes found no remaining verifier-owned temp roots except the pre-existing `/private/tmp/rnskia-example-export.bE7set` directory that the matrix also reported as pre-existing and preserved.
- Final `git status --short --ignored=matching`:
  - `?? worker-progress/worker-076-post-075-root-cause-audit.md`
  - `!! example/node_modules`
  - `!! node_modules`
