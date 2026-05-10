# Worker 097 - Post-worker-096 root-cause audit

## Scope And Read-Only Status

- Objective: audit the post-worker-096 state and select the next strongest unblocked root-cause target.
- Scope was read-only for product code, verifier scripts, package metadata, generated files, planning docs, and ignored local artifacts.
- The only file written by this worker is `worker-progress/worker-097-post-096-root-cause-audit.md`.
- I did not edit product source, verifier scripts, package metadata, generated files, docs outside this report, or ignored local artifacts such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, or `tsconfig.tsbuildinfo`.

## Post-worker-096 Baseline Evidence

Worker 096 baseline accepted:

- Current HEAD includes `b3448e6 Accept worker 096 and prepare worker 097`, after merge commit `267f8ab Merge worker 096 path stroke contract` and worker commit `aac31e7 Fix public path stroke miter contract`.
- `worker-progress/worker-096-path-stroke-contract.md` documents the accepted fix: public `path.stroke.miter_limit` is canonical, `miterLimit` remains a deterministic fallback alias, and public `miter_limit` wins when both keys are present.
- Current `cpp/JSIConverter+NodeCommand.hpp` parses `stroke.miter_limit` first and falls back to `miterLimit`.
- Current `cpp/JSIConverter+StrokeOpts.hpp` parses the same alias order and emits public `miter_limit` from `toJSI(...)`.
- Current `scripts/verify-yoganode-native-commands-render.mjs` prints the post-096 proof: public-shaped `path.stroke` conversion/rendering, `PathCmd::props.stroke` state, alias precedence/fallback, public `StrokeOpts.toJSI`, non-object stroke rejection, and invalid join/cap rejection.

Accepted aggregate gate:

- `scripts/verify-feasible-matrix.mjs` remains the accepted local aggregate gate.
- It currently runs 28 commands.
- Its proof boundary is explicit: feasible local package/source/example metadata checks only. It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.
- `/usr/bin/time -p npm run check:feasible-matrix` passed all 28 commands.
  - Matrix total command duration: `4m 48s`.
  - `/usr/bin/time` real time: `288.27s`.
  - Relevant entries: `check:reconciler-animated-bindings` passed in `1.0s`; `check:yoganode-native-commands-render` passed in `34.1s`; `check:animated-double-synchronizable` passed in `8.2s`; `check:yoganode-nitro-materialization` passed in `30.9s`; `check:rnsk-yoga-view-runtime` passed in `24.9s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-xrtOgD` was empty before removal and was removed.

Local platform blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `command -v pod`, `adb`, `cmake`, `ninja`, and `gradle`: no output, exit 1.
- `command -v java`: `/usr/bin/java`; `java -version` failed because no Java runtime is installed.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.
- `example/ios`, `example/android`, and `example/.expo`: absent in this worktree.

## Candidate Target Ranking

1. Expand Reconciler JS-mode animated command coverage across representative root and nested command props.
   - Classification: locally unblocked source-level verifier target.
   - Root-cause value: highest. `src/jsx.ts` publicly allows `YogaDeepAnimated` for every command prop, including nested `path.stroke`, `line.from`/`to`, `points`, `textStyle`, `paragraphStyle`, image props, and top-level host objects. Worker 094 made native command binding coverage exhaustive only for the current native whitelist: `blurMaskFilter.blur`, `circle.radius`, `path.trimEnd`, `path.trimStart`, and `rrect.cornerRadius`. The JS-mode verifier path still proves command listener scheduling through representative `circle.radius` only.
   - Likely verification shape: extend `check:reconciler-animated-bindings` with table-driven JS-mode cases covering top-level and nested/array command props, including at least one unsupported-native prop and one post-096 nested stroke field. Assert listener registration, `runOnJS` key/value delivery, command rebuild, invalidation, cleanup, no native `createSynchronizable`, and ignored late emits after cleanup.
   - Expected files/modules touched: likely `scripts/verify-reconciler-animated-bindings.mjs` and the worker report. Product `src/Reconciler.ts` only if the expanded proof exposes a bug.
   - Overclaim risks: this remains Node VM source-level Reconciler stubs. It must not claim UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual native bridge delivery, C++ conversion, React Native runtime integration, or platform app proof.

2. Expand synthetic `ImageCmd` fit-mode coverage beyond `fit: "fill"`.
   - Classification: locally unblocked host-native verifier target for synthetic images; real asset loading/decoding remains blocked or overclaim-prone.
   - Root-cause value: medium-high. `src/specs/commands.ts` and `cpp/JSIConverter+NodeCommand.hpp` support `cover`, `contain`, `fill`, `fitHeight`, `fitWidth`, `none`, and `scaleDown`, while current host-native image proof renders only synthetic `fit: "fill"`.
   - Likely verification shape: table-drive non-square synthetic `SkImage` inputs through real `RNSkia::JsiSkImage`, nearest sampling, `JSIConverter<NodeCommand>::fromJSI(...)`, real `YogaNode::setCommand()`, `ImageCmd` state, and bounded pixels/transparent letterbox or crop assertions. Add invalid fit rejection if not already directly asserted.
   - Expected files/modules touched: likely `scripts/verify-yoganode-native-commands-render.mjs` and the worker report; product C++ only if a focused bug appears.
   - Overclaim risks: do not claim Expo/RN asset resolution, local/remote image loading, image decoding, texture-backed images, platform presentation, or exact render fidelity.

3. Expand generated `YogaNode.setCommand(...)` materialization coverage beyond `group`.
   - Classification: locally unblocked host-JSC verifier target.
   - Root-cause value: medium. `check:yoganode-nitro-materialization` proves `YogaNode::toObject(runtime)`, generated prototype members, and generated `setCommand(group)`. The command/render verifier proves complex command conversion/rendering directly, not through a materialized generated wrapper.
   - Likely verification shape: extend `check:yoganode-nitro-materialization` with one or two representative generated `setCommand(...)` calls beyond `group`, then assert native side effects. A path or image case would require the same host-object setup discipline as the command/render verifier.
   - Expected files/modules touched: `scripts/verify-yoganode-nitro-materialization.mjs` and report.
   - Overclaim risks: host-JSC generated-wrapper proof is not Nitro module registry install, actual React Native bridge delivery, React Native runtime integration, platform app launch, or native presentation.

4. Align `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)` with `fromJSI(...)`.
   - Classification: locally unblocked but low-risk internal mismatch.
   - Review-note finding: current `cpp/JSIConverter+StrokeOpts.hpp` has `fromJSI(...)` reject non-objects, while `canConvert(...)` returns true for objects, `null`, and `undefined`.
   - Usage assessment: current public `path.stroke` command conversion does not call `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)`; it uses the local `parseStrokeOpts(...)` in `cpp/JSIConverter+NodeCommand.hpp`, which explicitly accepts `undefined`/`null` as omitted stroke and rejects non-object stroke payloads. Generated `HybridFunction` calls `JSIConverter<NodeCommand>::fromJSI(...)` directly for `setCommand`. Source search found no current generated `std::optional<RNSkia::StrokeOpts>` method/property path that relies on the direct `StrokeOpts` `canConvert(...)`.
   - Root-cause value: low. It is a real converter contract mismatch, but current worker-096 public command path already rejects non-object stroke and treats omitted/null stroke through `parseStrokeOpts(...)`.
   - Likely verification shape if selected later: add direct host-JSC assertions that `StrokeOpts::canConvert(null/undefined)` matches the intended direct converter contract, then update `canConvert(...)` or `fromJSI(...)` consistently.
   - Expected files/modules touched: `cpp/JSIConverter+StrokeOpts.hpp`, `scripts/verify-yoganode-native-commands-render.mjs`, and report.
   - Overclaim risks: fixing this direct converter helper would not add platform-native app proof, React Native bridge proof, or new `path.stroke` command-path behavior.

5. Public TypeScript caveats around dynamic command payload types.
   - Classification: locally unblocked type-contract cleanup, but lower priority.
   - Root-cause value: medium-low. `src/specs/commands.ts` still declares several dynamic-capable internal payload fields as plain numbers, while the supported public JSX surface in `src/jsx.ts` exposes `YogaDeepAnimated`. Public package entrypoints export JSX props, not `src/specs/commands.ts`.
   - Likely verification shape: first decide whether deep `src/specs` command types are intended public API. If yes, align types and add packed-consumer type coverage. If no, guard or document that public JSX props are the supported surface.
   - Overclaim risks: TypeScript type cleanup would not prove native conversion, Reanimated delivery, runtime bridge delivery, or rendering.

6. Broader text/paragraph typography, shaping, font fallback, and style fidelity.
   - Classification: partially unblocked for bounded host-native cases only.
   - Root-cause value: medium-low for the next slot. Worker 086 already entered real `TextCmd` and `ParagraphCmd` conversion, measurement, and bounded raster paths. Broader typography has high platform/font fidelity risk.
   - Likely verification shape: narrowly chosen style-state and raster sanity cases only.
   - Overclaim risks: exact typography, paragraph shaping, font fallback correctness, platform font parity, and full style fidelity must remain unclaimed.

7. UI-runtime Worklets, real Reanimated delivery, actual RN bridge delivery, Nitro module registry install, RNGH native delivery, image asset loading/decoding, and full iOS/Android app build/run.
   - Classification: blocked locally for real proof by missing runtime/tooling or unavailable platform app execution.
   - Root-cause value: high product value, but not the strongest unblocked local implementation target.
   - Verification shape if unblocked: real iOS/Android app build/run or simulator/device launch with Worklets/Reanimated/RNGH, Nitro registry installation, asset loading, native rendering, and observable app behavior.
   - Overclaim risks: source stubs, host-JSC probes, generated native project metadata, and host-native binaries cannot honestly prove UI-runtime Worklets execution, real Reanimated delivery, actual RN bridge delivery, Nitro registry install inside React Native, image asset loading, or platform presentation.

## Selected Next Target

Select: expand Reconciler JS-mode animated command coverage across representative root and nested command props.

This is stronger than another audit/report-only step because there is a concrete, unblocked public-prop delivery surface left under-proven: public JSX accepts dynamic command props broadly, but the current JS-mode command listener proof is still centered on `circle.radius`. Worker 094 made the native mirror whitelist exhaustive, and workers 089/090/092 proved selected native `AnimatedDouble` command paths. The corresponding JS fallback path for unsupported native props and nested dynamic command props remains the widest local source-level behavior gap.

This is stronger than image fit expansion because it covers how dynamic public React props reach command payloads across command families, including post-096 nested `path.stroke` fields, rather than adding one more bounded raster matrix for a single command class. Image fit coverage remains a good next host-native target after the Reconciler JS-mode breadth is guarded.

This is stronger than generated-wrapper expansion because worker 088 already proves the generated `setCommand(...)` wrapper path for `group`, and the command/render verifier already proves complex conversion/rendering directly. The Reconciler JS-mode gap is closer to the public React authoring path and broader across command props.

This is stronger than the `StrokeOpts::canConvert(...)` note because the mismatch is not on the current public `path.stroke` command path, and worker 096 already added non-object stroke rejection through `NodeCommand` conversion. The direct converter mismatch should be tracked as low-risk cleanup, not the next strongest root-cause target.

Recommended proof boundary: Node VM source-level Reconciler behavior with local Worklets/Reanimated stubs. Do not claim UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual native bridge delivery, C++ conversion, React Native runtime integration, platform app build/run, or native rendering.

## Verification Commands And Results

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed with no output.
- `node --check scripts/verify-feasible-matrix.mjs`: passed with no output.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - Matrix total command duration: `4m 48s`.
  - `/usr/bin/time` real: `288.27s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-xrtOgD` was empty before removal and was removed.
- Platform blocker probes:
  - `xcode-select -p`: `/Library/Developer/CommandLineTools`.
  - `xcodebuild -version`: failed because full Xcode is not selected.
  - `pod`, `adb`, `cmake`, `ninja`, and `gradle`: unavailable on `PATH`.
  - `command -v java`: `/usr/bin/java`; `java -version` failed because no Java runtime is installed.
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.
- `git diff --check`: passed before report creation.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- No installs or platform-native app builds were introduced.

## Nested Challenger Documentation

- Nested agent: `/root/target_ranking_challenger`.
- Prompt summary: read-only challenger in this worktree; inspect the post-worker-096 state, feasible matrix, package scripts, Reconciler, YogaCanvas, JSX/spec command surfaces, native command/stroke converters, command/render verifier, Reconciler verifier, and Nitro materialization verifier; independently rank the next target; explicitly evaluate the `StrokeOpts::canConvert(...)` review note; do not edit files or run long platform/native builds; state commands and acceptance claims.
- Result: stalled. The agent did not return a verdict after repeated waits and was closed. `close_agent` reported previous status `running`.
- Nested acceptance evidence: none claimed.
- Response: I proceeded with the local source/verifier evidence above and will not use nested output as acceptance evidence.

## Cleanup And Status Evidence

Cleanup/status probes before report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/097-post-096-root-cause-audit`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, command render, AnimatedDouble, Nitro materialization, RNSkYogaView runtime, hit testing, raw methods, native runtime, lifetime, package, example export, and example native generation roots: no output.
- Repo tarball/build-info probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Active verifier/debug process probe excluding its own `ps`/`rg` command found no active `node .*verify-`, `clang++`, verifier binary, `lldb`, or `debugserver` process.
- `list_agents`: only `/root` after closing the stalled nested challenger.

Final cleanup/status probes after report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/097-post-096-root-cause-audit`
  - `?? worker-progress/worker-097-post-096-root-cause-audit.md`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Verifier temp-prefix probe: no output.
- Repo tarball/build-info probe: no output.
- Generated example native directory probe: no output.
- Active verifier/debug process probe: no output.
- `list_agents`: only `/root`.

Final tracked status is only:

- `?? worker-progress/worker-097-post-096-root-cause-audit.md`

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier/debug processes remained. Ignored dependency trees were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The recommendation is grounded in a concrete public JSX/runtime behavior gap, not a vague platform wish list.
- The selected verifier can assert listener registration, payload placement, command rebuilds, invalidation, cleanup, and native-vs-JS mode separation with deterministic source-level stubs.
- Proof boundaries stay explicit: JS-mode Reconciler proof is separate from UI-runtime Worklets, real Reanimated delivery, native bridge delivery, C++ conversion, and rendering.

Maintainability:

- Keeping the work in `check:reconciler-animated-bindings` preserves the current ownership model for Reconciler animated binding behavior.
- A table-driven JS-mode case list can mirror the native case style from worker 094 while adding focused representative root/nested/array paths instead of duplicating every command prop.
- The `StrokeOpts::canConvert(...)` mismatch should remain documented as a small cleanup candidate, but not conflated with the public `path.stroke` command path that worker 096 already guards.

Performance:

- The selected target should run in the existing Node VM verifier and likely add negligible time compared with host-native C++ checks.
- It avoids platform prebuilds, native compilation, broad retries, or extra runtime polling.

Security:

- The recommended verifier uses fixed local VM stubs and deterministic command props.
- No network access, package installs, user input, device/simulator automation, or broad temp deletion is needed.
- Cleanup can stay constrained to existing matrix/verifier-owned paths.
