# Worker 099 - Post-worker-098 root-cause audit

## Scope And Read-Only Status

- Objective: audit the post-worker-098 state and select the next strongest unblocked root-cause target.
- Scope was read-only for product code, verifier scripts, package metadata, generated files, planning docs, and ignored local artifacts.
- The only file written by this worker is `worker-progress/worker-099-post-098-root-cause-audit.md`.
- I did not edit product source, verifier scripts, package metadata, generated files, docs outside this report, or ignored local artifacts such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, or `tsconfig.tsbuildinfo`.

## Post-worker-098 Baseline Evidence

Worker 098 baseline accepted:

- Current branch: `worker/099-post-098-root-cause-audit`; initial tracked status was clean.
- Current HEAD: `cb912b3 Accept worker 098 and prepare worker 099`, after merge commit `951ada3 Merge worker 098 Reconciler JS mode coverage` and worker commit `910b017 Expand Reconciler JS mode command binding coverage`.
- `worker-progress/worker-098-reconciler-js-mode-command-bindings.md` documents verifier-only changes to `scripts/verify-reconciler-animated-bindings.mjs`; no product TypeScript, native C++, package metadata, generated files, or example files changed.
- Current `src/Reconciler.ts` still has the command prop roots and nested traversal worker 098 relied on: command roots include `group.rasterize`, `line.from`, `path.stroke`, and `points.points`; nested roots include `from`, `to`, `stroke`, `textStyle`, `paragraphStyle`, and `points`; arrays are traversed under allowed nested roots.
- Current `scripts/verify-reconciler-animated-bindings.mjs` output confirms both sides of the Reconciler source-level boundary:
  - Native mode mirrors all current whitelist entries: `blurMaskFilter.blur`, `circle.radius`, `path.trimEnd`, `path.trimStart`, and `rrect.cornerRadius`.
  - JS-mode listener coverage now includes `circle.radius`, `group.rasterize`, `line.from.x`, `path.stroke.miter_limit`, and `points.points.0.x`.

Accepted aggregate gate:

- `scripts/verify-feasible-matrix.mjs` remains the accepted local aggregate gate.
- It runs 28 commands and its output states the proof boundary: feasible local package/source/example metadata checks only. It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.
- `/usr/bin/time -p npm run check:feasible-matrix` passed all 28 commands.
  - Matrix total command duration: `4m 45s`.
  - `/usr/bin/time` real time: `285.51s`.
  - Relevant entries: `check:reconciler-animated-bindings` passed in `984ms`; `check:yoganode-native-commands-render` passed in `33.4s`; `check:animated-double-synchronizable` passed in `7.7s`; `check:yoganode-nitro-materialization` passed in `31.2s`; `check:rnsk-yoga-view-runtime` passed in `27.1s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-6jRAfy` was empty before removal and was removed.

Local platform blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because full Xcode is not selected.
- `command -v pod`, `adb`, `cmake`, `ninja`, and `gradle`: no output.
- `command -v java`: `/usr/bin/java`; `java -version` failed because no Java runtime is installed.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

## Candidate Target Ranking

1. Expand host-JSC Nitro-materialized generated `YogaNode.setCommand(...)` wrapper coverage beyond `group`, using representative post-worker-098 command payload shapes.
   - Classification: locally unblocked host-JSC verifier target.
   - Root-cause value: highest. Worker 098 proved the source-level Reconciler JS listener path for `group.rasterize`, `line.from.x`, `path.stroke.miter_limit`, and `points.points.0.x`. `check:yoganode-native-commands-render` already proves direct C++ `JSIConverter<NodeCommand>::fromJSI(...)`, direct `YogaNode::setCommand()`, and bounded render behavior for these command families. The remaining local gap between those two proofs is the generated JS-facing wrapper path from a materialized `YogaNode` object: current `check:yoganode-nitro-materialization` invokes generated `setCommand(group)` only.
   - Likely verification shape: extend `scripts/verify-yoganode-nitro-materialization.mjs` so fresh shared `YogaNode` instances are materialized with `toObject(runtime)` and their generated `setCommand(...)` JS function is called for representative `line`, `points`, and public-shaped `path.stroke.miter_limit` payloads. Use fresh nodes per command kind because native `YogaNode::setCommand()` rejects type changes after initialization. For the path case, build a real `RNSkia::JsiSkPath` host object. Assert returned `undefined`, NativeState identity, `_commandKind`, concrete command class via `dynamic_cast`, and representative payload state. Keep render proof optional and tightly bounded because direct command/render already owns raster evidence.
   - Expected files/modules touched: likely `scripts/verify-yoganode-nitro-materialization.mjs` and the worker report. Product C++/TS only if the generated wrapper proof exposes a real bug.
   - Overclaim risks: this would still be host-JSC Nitro materialization and generated wrapper execution only. It must not claim actual React Native bridge delivery, Nitro module registry install inside React Native, platform-native runtime, simulator/device launch, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, image asset decoding/loading, or render fidelity.

2. Expand synthetic `ImageCmd` fit-mode coverage beyond current `fit: "fill"`.
   - Classification: locally unblocked host-native verifier target for synthetic images; real asset loading/decoding remains blocked or overclaim-prone.
   - Root-cause value: medium-high. `src/specs/commands.ts` exposes `cover`, `contain`, `fill`, `fitHeight`, `fitWidth`, `none`, and `scaleDown`; `cpp/JSIConverter+NodeCommand.hpp` accepts the same fit strings; `ImageCmd::updateProps(...)` defaults missing fit to `contain`; current verifier only renders a synthetic `JsiSkImage` with `fit: "fill"`.
   - Likely verification shape: table-drive non-square synthetic `SkImage` inputs through real `RNSkia::JsiSkImage`, nearest sampling, `JSIConverter<NodeCommand>::fromJSI(...)`, real `YogaNode::setCommand()`, and bounded pixels/transparent regions for selected `contain`, `cover`, `none`, and `scaleDown` cases. Add invalid-fit rejection if not already directly asserted.
   - Expected files/modules touched: likely `scripts/verify-yoganode-native-commands-render.mjs` and report; product C++ only if a focused bug appears.
   - Overclaim risks: do not claim Expo/RN asset resolution, `useImage`, local/remote image loading, image decoding, texture-backed images, platform presentation, or exact render fidelity.

3. Align direct `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)` with `fromJSI(...)`.
   - Classification: locally unblocked but lower-risk internal converter cleanup.
   - Review-note finding: `cpp/JSIConverter+StrokeOpts.hpp` still has `fromJSI(...)` reject non-objects while `canConvert(...)` returns true for objects, `null`, and `undefined`.
   - Root-cause value: low after workers 096 and 098. Current public `path.stroke` command conversion uses local `parseStrokeOpts(...)` in `cpp/JSIConverter+NodeCommand.hpp`, which treats `undefined`/`null` as omitted stroke and rejects non-object stroke payloads. Worker 096 already proves public-shaped `path.stroke.miter_limit`, alias fallback/precedence, `StrokeOpts.toJSI(...)`, non-object stroke rejection, and invalid join/cap rejection through the command path. Worker 098 only added source-level Reconciler JS listener coverage for `path.stroke.miter_limit`; it did not move this direct-converter mismatch onto the public command path.
   - Likely verification shape if selected later: add direct host-JSC assertions for `StrokeOpts::canConvert(null/undefined)` versus intended direct converter behavior, then align `canConvert(...)` or `fromJSI(...)` consistently.
   - Expected files/modules touched: `cpp/JSIConverter+StrokeOpts.hpp`, `scripts/verify-yoganode-native-commands-render.mjs` or a narrower converter verifier, and report.
   - Overclaim risks: this would not add platform-native app proof, RN bridge proof, or new public `path.stroke` command-path behavior.

4. Public TypeScript caveats around dynamic command payload types.
   - Classification: locally unblocked type-contract cleanup, but lower priority.
   - Root-cause value: medium-low. `src/specs/commands.ts` exports internal Nitro command payload types where dynamic-capable fields such as `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd` are typed as plain numbers, while public JSX props in `src/jsx.ts` expose `YogaDeepAnimated`. Top-level public package entrypoints export JSX props, not `src/specs/commands.ts`, so the user-facing contract is stronger than the deep internal types.
   - Likely verification shape: first decide whether `src/specs/SkiaYoga.nitro.ts` / `src/specs/commands.ts` deep imports are intended public API. If yes, align exported payload types and add packed-consumer type coverage; if no, guard/document the public API boundary.
   - Expected files/modules touched: `src/specs/commands.ts`, possibly generated Nitro artifacts if the spec changes, package/type consumer verifier, and report.
   - Overclaim risks: type cleanup would not prove C++ conversion, real Reanimated delivery, native bridge delivery, or rendering.

5. Broader text/paragraph typography, shaping, font fallback, and style fidelity.
   - Classification: partially unblocked for bounded host-native state/raster cases only.
   - Root-cause value: medium-low for the next slot. Worker 086 already entered real `TextCmd` and `ParagraphCmd` conversion, measurement, and bounded raster paths. Broader typography has high platform/font fidelity risk and may require device/runtime/font environment proof for stronger claims.
   - Likely verification shape: narrowly chosen text-style state and raster sanity cases only, with explicit exclusions for exact glyph geometry.
   - Expected files/modules touched: likely `scripts/verify-yoganode-native-commands-render.mjs` and report; product C++ only if a targeted bug appears.
   - Overclaim risks: do not claim exact typography, paragraph shaping, font fallback correctness, platform font parity, or full style fidelity.

6. UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual React/Reconciler-to-native bridge delivery, Nitro module registry install, RNGH native delivery, image asset loading/decoding, and full iOS/Android app build/run.
   - Classification: blocked locally for honest proof by missing runtime/tooling or unavailable platform app execution.
   - Root-cause value: high product value, but not the strongest unblocked local implementation target.
   - Likely verification shape if unblocked: real iOS/Android app build/run or simulator/device launch with Worklets/Reanimated/RNGH, Nitro registry installation, asset loading, native rendering, and observable app behavior.
   - Expected files/modules touched: likely example app harnesses, platform projects/build files, native integration code, and runtime verifiers once toolchain prerequisites exist.
   - Overclaim risks: source stubs, host-JSC probes, host-native binaries, generated native project metadata, and Expo CNG verification cannot prove UI-runtime Worklets execution, real Reanimated delivery, actual RN bridge delivery, Nitro registry install inside React Native, image asset loading, or platform presentation.

## Selected Next Target

Select: expand host-JSC Nitro-materialized generated `YogaNode.setCommand(...)` coverage beyond `group`, with representative post-worker-098 command payloads.

This is stronger than another audit/report-only step because it is a concrete unblocked implementation target with a specific proof gap. The repo now has:

- Source-level Reconciler JS-mode command listener proof for representative public animated command shapes from worker 098.
- Direct host-native command conversion/render proof for the same command families from workers 080, 082, 084, 086, 090, 092, and 096.
- Host-JSC Nitro materialization proof from worker 088, but only for generated `setCommand(group)`.

The next useful local bridge is therefore generated JS-facing wrapper breadth, not duplicating direct `YogaNode::setCommand()` evidence. It is closer to the JS object that React-facing code would eventually call than the direct C++ command/render verifier, while still staying honest about the missing actual RN bridge and Nitro registry runtime.

It is stronger than image fit expansion because image fit is a variant matrix inside an already-entered command class, while generated wrapper breadth covers the JS-facing method boundary across multiple command families and directly follows worker 098's new source-level cases.

It is stronger than the `StrokeOpts::canConvert(...)` note because worker 096 already secured the public command path and worker 098 only added Reconciler source-level delivery for the same public stroke field. The remaining direct converter mismatch is real but low-risk unless a current generated direct `StrokeOpts` entry point starts using it.

Recommended proof boundary: host-JSC Nitro `YogaNode::toObject(runtime)` materialization plus generated wrapper execution for selected command payloads. Do not claim actual native bridge delivery from React/Reconciler, Nitro module registry install in a React Native runtime, UI-runtime Worklets, real Reanimated `SharedValue` delivery, platform app build/run, native presentation, image asset loading, or exact render fidelity.

## Verification Commands And Results

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - Matrix total command duration: `4m 45s`.
  - `/usr/bin/time` real: `285.51s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-6jRAfy` was empty before removal and was removed.
- `node --check scripts/verify-feasible-matrix.mjs && node --check scripts/verify-reconciler-animated-bindings.mjs && node --check scripts/verify-yoganode-native-commands-render.mjs && node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed with no output.
- Focused source probes:
  - `rg` over `scripts/verify-yoganode-nitro-materialization.mjs` showed current generated `setCommand(...)` materialization coverage is `setCommand(group)` only.
  - `rg` over image command/spec/native sources showed all supported image fit strings in the spec/native parser, `ImageCmd` defaulting fit to `contain`, and current verifier image rendering still using `fit: "fill"` only.
  - `rg` over stroke converter/native command verifier sources showed `StrokeOpts::canConvert(...)` still accepts object/null/undefined while `fromJSI(...)` rejects non-objects, and the public command path still uses `parseStrokeOpts(...)` with non-object rejection.
- Platform blocker probes:
  - `xcode-select -p`: `/Library/Developer/CommandLineTools`.
  - `xcodebuild -version`: failed because full Xcode is not selected.
  - `pod`, `adb`, `cmake`, `ninja`, and `gradle`: unavailable on `PATH`.
  - `command -v java`: `/usr/bin/java`; `java -version` failed because no Java runtime is installed.
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.
- `git diff --check`: passed before report creation.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- No installs, product edits, generated-file edits, or platform-native app builds were introduced.

## Nested Challenger Documentation

- Nested agent: `/root/target_ranking_challenger`.
- Prompt summary: read-only challenger in this worktree; compare post-worker-098 target candidates, especially generated Nitro-materialized `YogaNode.setCommand(...)` breadth, image fit-mode coverage, `StrokeOpts::canConvert(...)`, public TS dynamic command typing, and blocked platform/UI-runtime/RN bridge proof; inspect relevant reports, source, and verifiers; do not edit files, install packages, run long platform/native app builds, or touch ignored artifacts; list any commands and acceptance claims.
- Result: completed.
- Challenger ranking:
  - Ranked generated host-JSC Nitro-materialized `YogaNode.setCommand(...)` breadth as strongest, specifically because worker 098 proved source-level JS-mode payload handling while current materialization proof only invokes generated `setCommand(group)`.
  - Ranked synthetic `ImageCmd` fit-mode expansion second as useful but weaker because it is a variant matrix for an already-entered command class.
  - Ranked `StrokeOpts::canConvert(...)` alignment third as a real but lower-priority mismatch because the public `path.stroke` command path uses `parseStrokeOpts(...)`.
  - Ranked public TS dynamic command payload caveats fourth and platform/UI-runtime/RN bridge proof fifth as currently blocked for honest local proof.
- Challenger recommended verification shape: add generated `setCommand(...)` calls for fresh materialized nodes covering `line`, `points`, and public `path.stroke.miter_limit` with a real `JsiSkPath`; assert `_commandKind`, concrete command class, and payload state; avoid render overclaims unless bounded.
- Challenger commands claimed: `rg --files`, targeted `rg`, `sed`, `nl | sed`, `node --check scripts/verify-yoganode-nitro-materialization.mjs`, `node --check scripts/verify-yoganode-native-commands-render.mjs`, `node --check scripts/verify-reconciler-animated-bindings.mjs`, and `git status --short --ignored=matching`.
- Nested acceptance evidence: none claimed for any new target. The challenger claimed only read-only source/syntax evidence; this worker's acceptance evidence is the local verification above.
- Closure evidence: `close_agent /root/target_ranking_challenger` returned completed status.

## Cleanup And Status Evidence

Cleanup/status probes before report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/099-post-098-root-cause-audit`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- The feasible matrix removed newly created `tsconfig.tsbuildinfo`, reported no remaining new tracked artifacts, and removed its temp parent.

Final cleanup/status probes after report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/099-post-098-root-cause-audit`
  - `?? worker-progress/worker-099-post-098-root-cause-audit.md`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, package, example export, example native generation, YogaNode command/render, AnimatedDouble, Nitro materialization, RNSkYogaView runtime, hit testing, raw methods, native runtime, and native lifetime roots: no output.
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Active verifier/debug process probe excluding its own probe command found no active `node .*verify-`, `clang++`, verifier binary, `lldb`, or `debugserver` process.
- `list_agents`: only `/root` after closing the nested challenger.

Final tracked status is only:

- `?? worker-progress/worker-099-post-098-root-cause-audit.md`

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier/debug processes remained. Ignored dependency trees were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The recommendation targets a specific remaining proof boundary: generated JS-facing `YogaNode.setCommand(...)` wrapper execution for command shapes now proven at the Reconciler source level and direct C++ command/render level.
- The target can assert meaningful native side effects without claiming platform runtime or render fidelity.
- The `StrokeOpts::canConvert(...)` mismatch remains documented and reassessed after worker 098; it is not promoted over a broader JS-facing wrapper gap because the current public command path is already guarded.

Maintainability:

- Extending `check:yoganode-nitro-materialization` keeps materialized-object and generated-wrapper evidence in the verifier that already owns that boundary.
- Using fresh materialized nodes per command kind respects `YogaNode::setCommand()`'s type-stability invariant instead of weakening product behavior for test convenience.
- Reusing command-builder patterns from the command/render verifier should avoid duplicating source-of-truth semantics while still proving the generated wrapper route.

Performance:

- The selected verifier should remain in host-JSC materialization scope and avoid broad platform prebuilds, device launches, network work, retries, or large raster surfaces.
- If render checks are added, they should stay bounded and avoid duplicating the full host-native command/render matrix.

Security:

- The recommended verifier uses fixed local JSI objects and structured compiler/process invocation, matching existing verifier patterns.
- No user input, network access, package installation, simulator/device automation, or broad temp deletion is required.
- Cleanup should remain constrained to verifier-owned temp roots and matrix-owned temp parent accounting.
