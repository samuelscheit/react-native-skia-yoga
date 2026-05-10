# Worker 095 - Post-worker-094 root-cause audit

## Scope And Read-Only Status

- Objective: audit the post-worker-094 state and select the next strongest unblocked root-cause target.
- Scope was read-only for product code, verifier scripts, package metadata, generated files, planning docs, and ignored local artifacts.
- The only file written by this worker is `worker-progress/worker-095-post-094-root-cause-audit.md`.
- I did not edit product source, verifier scripts, package metadata, generated files, docs outside this report, or ignored local artifacts such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, or `tsconfig.tsbuildinfo`.

## Post-worker-094 Baseline Evidence

Worker 094 baseline accepted:

- Worker 094 expanded `scripts/verify-reconciler-animated-bindings.mjs` from representative native-mode `circle.radius` coverage to every current `supportsNativeCommandBinding(...)` whitelist entry: `blurMaskFilter.blur`, `circle.radius`, `path.trimEnd`, `path.trimStart`, and `rrect.cornerRadius`.
- The current verifier contains a `nativeCommandBindingCases` table for those five cases and parses `src/Reconciler.ts` with TypeScript AST checks so the table must match `supportsNativeCommandBinding(...)`.
- Current `src/Reconciler.ts` still rejects nested native command binding paths, then whitelists only `blurMaskFilter.blur`, `circle.radius`, `path.trimEnd`, `path.trimStart`, and `rrect.cornerRadius`.
- `YogaCanvas` still maps `animationBindingMode === "native"` into `nativeCommandBindingsEnabled`, and the Reconciler verifier asserts that mapping.
- Worker 094's proof boundary remains Node VM source-level Reconciler stubs. It does not prove UI-runtime Worklets execution, real Reanimated delivery, actual native bridge delivery, C++ conversion, platform app runtime, image loading/decoding, exact render fidelity, Nitro registry install, or React Native runtime integration.

Current accepted aggregate gate:

- `scripts/verify-feasible-matrix.mjs` remains the accepted local aggregate gate.
- It currently contains 28 commands.
- Its printed proof boundary is local feasible package/source/example checks only; no CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.
- `/usr/bin/time -p npm run check:feasible-matrix` passed all 28 commands.
  - Matrix total command duration: `4m 57s`.
  - `/usr/bin/time` real time: `297.84s`.
  - Important entries: `[9/28] npm run check:reconciler-animated-bindings` passed in `914ms`; `[17/28] npm run check:yoganode-native-commands-render` passed in `32.9s`; `[18/28] npm run check:animated-double-synchronizable` passed in `10.5s`; `[20/28] npm run check:yoganode-nitro-materialization` passed in `36.0s`; `[21/28] npm run check:rnsk-yoga-view-runtime` passed in `26.5s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-SogjIZ` was empty before removal and was removed.

Focused source evidence found during this audit:

- `src/jsx.ts` types `path.stroke` as `YogaAnimatedStrokeOpts | YogaAnimatedProp<StrokeOpts>`, where `StrokeOpts` comes from `@shopify/react-native-skia`.
- The installed RN Skia `StrokeOpts` TypeScript interface exposes `miter_limit?: number`.
- `cpp/JSIConverter+NodeCommand.hpp` currently parses path command stroke miter as `miterLimit`, not the public `miter_limit` key.
- `cpp/JSIConverter+StrokeOpts.hpp` also serializes `RNSkia::StrokeOpts::miter_limit` as `miterLimit`, which is consistent with RN Skia recorder internals but inconsistent with the public RN Skia TypeScript shape consumed by this package.
- `scripts/verify-yoganode-native-commands-render.mjs` currently builds `pathCommand(...)` without any `stroke` payload. Existing path render proof therefore covers path conversion/rendering and trim dynamics, but not public `path.stroke` payload conversion/render behavior.

Local platform blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `command -v pod`, `adb`, `cmake`, `ninja`, and `gradle`: no output, exit 1.
- `command -v java`: `/usr/bin/java`, but `java -version` failed with "Unable to locate a Java Runtime."
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

## Candidate Target Ranking

1. Prove and fix the public `path.stroke` payload contract, especially `miter_limit`.
   - Classification: locally unblocked product/verifier target.
   - Root-cause value: highest. This audit found a source-confirmed contract drift: the public JSX type accepts RN Skia `StrokeOpts` with `miter_limit`, but the hand-written `NodeCommand` stroke parser reads `miterLimit`. That can silently drop a typed public stroke option before native path rendering.
   - Verification shape: extend `check:yoganode-native-commands-render` with a real `PathCmd` stroke case using a public-shaped payload. Assert `JSIConverter<NodeCommand>::fromJSI(...)` parses `width`, `miter_limit`, `precision`, `join`, and `cap`; assert `YogaNode::setCommand()` installs a real `PathCmd`; assert the converted native `RNSkia::StrokeOpts` reaches `PathCmd::draw()` through bounded raster evidence. Add a negative or compatibility assertion for `miterLimit` only if the implementation intentionally supports it as an alias.
   - Expected files/modules touched: likely `cpp/JSIConverter+NodeCommand.hpp`, possibly `cpp/NodeCommand.hpp` naming/comments and `cpp/JSIConverter+StrokeOpts.hpp`, plus `scripts/verify-yoganode-native-commands-render.mjs` and the worker report. Product TS may not need changes because `src/jsx.ts` already imports the public RN Skia `StrokeOpts` type.
   - Overclaim risks: do not claim exact path-render fidelity, every stroke geometry edge case, RN Skia upstream correctness, UI-runtime Worklets execution, actual RN bridge delivery, platform app rendering, or image/text fidelity.

2. Expand Reconciler JS-mode animated command coverage beyond `circle.radius`.
   - Classification: locally unblocked source-level verifier target.
   - Root-cause value: high but mostly proof expansion. Worker 094 made native mode exhaustive, while JS-mode command listener behavior remains centered on `circle.radius`. `src/Reconciler.ts` supports many other command props through `commandPropKeys` and nested traversal roots such as `from`, `to`, `points`, `stroke`, `textStyle`, and `paragraphStyle`.
   - Verification shape: table-drive representative JS-mode `SharedValue` cases for root and nested command props. Assert listener registration, `runOnJS` delivery, command rebuild, invalidation, cleanup, and no native `Synchronizable` creation when native bindings are disabled or unsupported.
   - Expected files/modules touched: `scripts/verify-reconciler-animated-bindings.mjs` and report, unless a product bug is exposed.
   - Overclaim risks: still Node VM/source-level Reconciler stubs only. It would not prove real Reanimated delivery, UI-runtime Worklets execution, real JS scheduling under React Native, native bridge delivery, C++ conversion, or rendering.

3. Expand Nitro-generated `YogaNode.setCommand(...)` wrapper coverage beyond `group`.
   - Classification: locally unblocked host-JSC verifier target.
   - Root-cause value: medium-high. Worker 088 proves materialized `YogaNode::toObject(runtime)` and generated wrapper execution for `setCommand(group)`, `setStyle`, `computeLayout`, and `layout`. Worker 080/082/084/086/090/092 prove command conversion/rendering mostly through direct `JSIConverter<NodeCommand>::fromJSI(...)` plus direct `YogaNode::setCommand()`. A generated-wrapper command target would reduce the remaining gap between the materialized JS object and command conversion.
   - Verification shape: extend `check:yoganode-nitro-materialization` to create fresh materialized nodes and invoke generated `setCommand(...)` wrappers for representative command payloads, then assert native side effects and possibly bounded render evidence.
   - Expected files/modules touched: `scripts/verify-yoganode-nitro-materialization.mjs` and report.
   - Overclaim risks: host-JSC generated-wrapper proof is not Nitro module registry install, React Native runtime integration, platform app runtime, actual RN bridge scheduling, or UI presentation.

4. Expand synthetic `ImageCmd` fit-mode coverage.
   - Classification: locally unblocked for synthetic host-native images; real asset loading/decoding remains blocked or overclaim-prone.
   - Root-cause value: medium. Types and converter accept `cover`, `contain`, `fill`, `fitHeight`, `fitWidth`, `none`, and `scaleDown`; current verifier only proves synthetic `fit: "fill"`.
   - Verification shape: table-drive non-square synthetic images and layouts with nearest sampling, then assert crop/letterbox/scale pixels and invalid fit rejection.
   - Expected files/modules touched: `scripts/verify-yoganode-native-commands-render.mjs` and report.
   - Overclaim risks: do not claim image decoding, Expo/RN asset resolution, remote/local asset loading, texture-backed images, native platform presentation, or exact render fidelity.

5. Broader text/paragraph typography, shaping, font fallback, and style fidelity.
   - Classification: locally possible only for bounded host-native cases.
   - Root-cause value: medium-low for the next slot. Worker 086 already entered real `TextCmd` and `ParagraphCmd` conversion, measurement, and bounded raster paths. Broader typography has high platform/font fidelity risk.
   - Verification shape: add narrowly chosen style-state and raster sanity cases, avoiding glyph snapshot claims.
   - Expected files/modules touched: likely `scripts/verify-yoganode-native-commands-render.mjs`; product C++ only if a focused bug appears.
   - Overclaim risks: exact typography, paragraph shaping, font fallback correctness, platform font parity, and full style fidelity must remain unclaimed.

6. Public TypeScript caveats around dynamic command props.
   - Classification: locally unblocked type/contract cleanup, but lower priority than the stroke contract target.
   - Root-cause value: medium-low. Public JSX currently permits dynamic command props through `YogaDeepAnimated`, while `src/specs/commands.ts` payload fields still declare plain numbers for dynamic-capable fields such as `radius`, `cornerRadius`, `blur`, `trimStart`, and `trimEnd`. The stronger implementation and verifier proof is runtime/source-level rather than that internal payload type.
   - Verification shape: decide whether `src/specs/commands.ts` is intended as a public deep-import contract. If yes, align payload types and add packed TypeScript consumer coverage; if no, document/guard the supported public JSX surface instead.
   - Expected files/modules touched: `src/specs/commands.ts`, `src/jsx.ts`, typecheck fixtures, and package TypeScript consumer verifier only if a public contract change is intended.
   - Overclaim risks: changing internal TypeScript payload types does not prove C++ conversion, runtime bridge delivery, or React Native integration.

7. UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, RNGH native delivery, actual React Native bridge delivery, Nitro module registry install, full iOS/Android app build/run, and image asset loading/decoding.
   - Classification: blocked locally for real proof by missing platform/runtime tooling or unavailable native app execution.
   - Root-cause value: high product value, but not the strongest unblocked local implementation target.
   - Verification shape if unblocked: real iOS/Android app build/run or simulator/device launch with Worklets/Reanimated/RNGH, Nitro registry installation, asset loading, native rendering, and observable app behavior.
   - Expected files/modules touched: platform app/native integration and runtime verification infrastructure.
   - Overclaim risks: source stubs, host-JSC probes, generated native project metadata, and host-native C++ binaries cannot honestly prove UI-runtime Worklets execution, Reanimated runtime delivery, RNGH native delivery, Nitro registry install inside React Native, native app launch, image asset loading, or platform presentation.

## Selected Next Target

Select: prove and fix the public `path.stroke` payload contract, with particular attention to `StrokeOpts.miter_limit`.

This is stronger than another audit/report-only step because it identifies a concrete product-owned contract drift, not just a missing proof label. The current public JSX surface accepts RN Skia `StrokeOpts`, and RN Skia's public type names the miter option `miter_limit`. The current hand-written `NodeCommand` converter reads `miterLimit`, and the current native command/render verifier does not send any stroke payload through `PathCmd`.

This is stronger than Reconciler JS-mode expansion because it is likely to expose or fix a real runtime behavior mismatch in a host-native path that is already locally verifiable. JS-mode expansion remains useful, but after worker 094 it is mostly a source-level coverage broadening target. This is also stronger than image fit expansion because it addresses a typed public prop that can be silently ignored, while synthetic image fit coverage would mainly expand already-working `ImageCmd` rendering within the known synthetic-image boundary.

The recommended proof boundary should be: public-shaped path stroke payload conversion through `JSIConverter<NodeCommand>::fromJSI(...)`, real `YogaNode::setCommand()`, real `PathCmd`, and bounded host-native render evidence. It must not claim platform-native app proof, real RN bridge delivery, UI-runtime Worklets execution, Reanimated delivery, image asset loading, exact render fidelity, or full path/stroke fidelity.

## Verification Commands And Results

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - Matrix total command duration: `4m 57s`.
  - `/usr/bin/time` real: `297.84s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-SogjIZ` was empty before removal and was removed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
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

- Nested agent: `/root/challenger_target_ranking`.
- Prompt summary: read-only challenger in this worktree; inspect the post-worker-094 baseline docs, reports, package scripts, feasible matrix, Reconciler, YogaCanvas, command specs, native command/render sources, and relevant verifiers; independently rank the top three next root-cause targets; classify local blockers, verification shape, touched files, overclaim risks, and acceptance evidence; do not edit files or run long platform builds.
- Result: completed and closed.
- Challenger recommendation:
  - Ranked Reconciler JS-mode animated command coverage first.
  - Ranked `path.stroke` payload contract and render proof second, calling out that `PathCommandPayload.stroke` is not exercised and that the public RN Skia `StrokeOpts` type uses `miter_limit` while the converter reads `miterLimit`.
  - Ranked synthetic `ImageCmd` fit-mode expansion third.
  - Reconfirmed full platform/runtime targets remain blocked by CLT-only Xcode, missing CocoaPods/Android tools, no Java runtime, and unset Android SDK environment variables.
- Response to challenger: I inspected the stroke contract and found concrete supporting evidence in `src/jsx.ts`, RN Skia's installed `StrokeOpts` type, `cpp/JSIConverter+NodeCommand.hpp`, `cpp/JSIConverter+StrokeOpts.hpp`, and the current command/render verifier. Based on that source-confirmed contract drift, I selected the challenger's second-ranked target over its first-ranked JS-mode coverage expansion.
- Challenger acceptance evidence: none claimed for a new target. The challenger reported only source/syntax checks, `git diff --check`, and blocker probes; this report's acceptance evidence comes from the local commands above.

## Cleanup And Status Evidence

Cleanup/status probes before report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/095-post-094-root-cause-audit`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, command render, AnimatedDouble, Nitro materialization, RNSkYogaView runtime, hit testing, raw methods, native runtime, lifetime, package, example export, and example native generation roots: no output.
- Repo tarball/build-info probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Initial `pgrep` returned transient PID `47660`; `ps -p 47660 -o pid=,command=` found no remaining process.
- Process-table probe excluding its own `ps`/`rg` command found no active `node .*verify-`, `clang++`, verifier binary, `lldb`, or `debugserver` process.
- `list_agents`: only `/root` after closing the nested challenger.

Final cleanup/status probes after report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/095-post-094-root-cause-audit`
  - `?? worker-progress/worker-095-post-094-root-cause-audit.md`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Verifier temp-prefix probe: no output.
- Repo tarball/build-info probe: no output.
- Generated example native directory probe: no output.
- Active verifier/debug process probe: no output.
- `list_agents`: only `/root`.

Final tracked status is only:

- `?? worker-progress/worker-095-post-094-root-cause-audit.md`

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier/debug processes remained. Ignored dependency trees were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The selected target is grounded in a concrete public-type/native-parser mismatch rather than a vague proof gap.
- The verifier shape can assert both object-state and bounded raster behavior through the existing host-native command/render harness.
- Proof boundaries stay explicit: path stroke command proof is separate from platform app runtime, UI-runtime Worklets, and exact render fidelity.

Maintainability:

- Keeping the proof in `check:yoganode-native-commands-render` preserves the current command/render verification ownership model.
- Aligning stroke key handling with the public RN Skia `StrokeOpts` shape should reduce future confusion between internal recorder keys and public TypeScript props.
- If compatibility with `miterLimit` is kept, it should be explicit and verified rather than an accidental internal-only spelling.

Performance:

- The next verifier can reuse the existing host-native command/render binary, avoiding new package installs or platform prebuild work.
- A small stroked path raster case should add negligible time relative to the current `32.9s` command/render matrix entry.
- No product runtime polling or broad retry behavior is recommended.

Security:

- The recommended verifier uses fixed local JSI payloads and structured spawn behavior already present in the command/render harness.
- No network access, arbitrary user input, broad temp deletion, platform app launch, or device/simulator automation is needed.
- Cleanup should remain constrained to verifier-owned temp roots and the matrix-owned temp parent.
