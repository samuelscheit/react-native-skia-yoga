# Worker 111 - Post-worker-110 Root-Cause Audit

## Scope And Read-Only Status

- Objective: audit the post-worker-110 state and select the next strongest unblocked root-cause target.
- Scope was read-only for product code, verifier scripts, package metadata, generated files, planning docs, and ignored local artifacts.
- The only file written by this worker is this report: `worker-progress/worker-111-post-110-root-cause-audit.md`.
- I did not edit product TypeScript, native C++, verifier scripts, package metadata, generated files, docs outside this report, or ignored local artifacts such as `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, or `tsconfig.tsbuildinfo`.

## Required Context Read

Read and used:

- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-110-dynamic-jsx-type-boundary.md`
- `worker-progress/worker-109-post-108-root-cause-audit.md`
- `worker-progress/worker-108-strokeopts-converter-contract.md`
- `worker-progress/worker-107-post-106-root-cause-audit.md`
- `worker-progress/worker-106-nitro-setcommand-more-breadth.md`
- `worker-progress/worker-104-text-paragraph-css-color.md`
- `worker-progress/worker-102-image-fit-coverage.md`
- `worker-progress/worker-100-nitro-setcommand-breadth.md`
- `worker-progress/worker-098-reconciler-js-mode-command-bindings.md`
- `worker-progress/worker-096-path-stroke-contract.md`
- `worker-progress/worker-094-reconciler-native-command-bindings.md`
- `worker-progress/worker-092-dynamic-path-trim-nodecommand.md`
- `worker-progress/worker-090-animated-double-nodecommand.md`
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
- `cpp/YogaNode.hpp`
- `cpp/YogaNode.cpp`

Additional focused context:

- `worker-progress/worker-043-public-declaration-export-boundary.md`
- `worker-progress/worker-053-public-import-graph-verifier.md`
- `worker-progress/worker-055-native-skiayoga-deep-import-harden.md`
- `git log --oneline -5`
- focused `nl`/`rg` probes over package boundary, spec exports, and native converter serialization

## Post-worker-110 Baseline Evidence

- Current branch: `worker/111-post-110-root-cause-audit`.
- Current HEAD at audit start: `9078b57 Accept worker 110 and prepare worker 111`.
- Recent history includes merge commit `8c5e7ee Merge worker 110 dynamic JSX type boundary` and worker commit `c88abea Add packed dynamic JSX type coverage`.
- Initial tracked status was clean.
- Worker 110 changed only `scripts/verify-package-typescript-consumer.mjs` and its report. It did not change product TypeScript, C++, generated Nitro artifacts, public exports, or package metadata.
- Worker 110 proved top-level packed TypeScript authoring coverage for representative dynamic `SharedValue` JSX command props and hardened top-level public-boundary negatives for `NodeCommand`, `NodeCommandNative`, `NodeCommandKind`, representative payload types, `createYogaNode`, and `SkiaYoga`.
- Worker 110 intentionally did not prevent deep imports. Current `package.json` still has no `exports` field, still publishes `"src"` in `files`, and still uses `codegenConfig.jsSrcsDir: "./src/specs"`.
- Current `src/specs/SkiaYoga.nitro.ts` re-exports `NodeCommandKind`, `NodeCommand`, `NodeCommandNative`, and representative command payload types from `./commands`; this remains spec/native transport surface, not the top-level public JSX authoring surface.

Accepted aggregate gate:

- The full feasible matrix remains the accepted local aggregate gate.
- Its proof boundary is feasible local package/source/example metadata checks plus host-source/host-native probes. It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual React Native bridge delivery, RNGH native delivery, image asset loading/decoding, exact typography, exact render fidelity, Nitro registry install inside a React Native runtime, or full React Native app integration.

Baseline run:

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
- Total command duration: `4m 44s`.
- `/usr/bin/time` real: `284.44s`; user: `203.42s`; sys: `85.59s`.
- Notable entries:
  - `check:package-codegen-autolinking`: passed in `11.4s`.
  - `check:package-typescript-consumer`: passed in `11.0s` and printed the worker-110 dynamic JSX coverage.
  - `check:package-surface`: passed in `1.8s`.
  - `check:reconciler-animated-bindings`: passed in `1.1s`.
  - `check:yoganode-native-commands-render`: passed in `32.6s`.
  - `check:animated-double-synchronizable`: passed in `7.5s`.
  - `check:yoganode-nitro-materialization`: passed in `31.6s`.
  - `check:rnsk-yoga-view-runtime`: passed in `23.9s`.
  - `typecheck`: passed in `1.4s`.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`; the matrix temp parent `/tmp/rnskia-feasible-matrix-yMSrSW` was empty before removal and was removed.
- Expected existing warnings appeared: npm `minimum-release-age` config warnings and Expo Android edge-to-edge warning during native generation.

Focused package-boundary evidence:

- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-package-surface.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- Package field probe:
  - `exports field: <absent>`
  - `files includes src: true`
- Corrected `npm pack --dry-run --json --ignore-scripts` manifest probe:
  - `src/specs/commands.ts`: published.
  - `src/specs/SkiaYoga.nitro.ts`: published.
  - `src/specs/NativeSkiaYoga.ts`: published.
  - `src/specs/SkiaYogaViewNativeComponent.ts`: published.
  - `src/specs published count: 5`.
- A preliminary pack-manifest probe used an incorrect `package/` prefix for npm's JSON paths and is not relied on; the corrected probe above is the evidence used.

Local platform blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools rather than full Xcode.
- `command -v pod`: no output, exit 1.
- `java -version`: failed because no Java Runtime is available.
- `command -v adb`, `cmake`, `ninja`, and `gradle`: no output, exit 1.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

## Candidate Target Ranking

1. Guard published `src/specs/*` deep imports / package export boundary.
   - Classification: locally unblocked package/API-boundary target.
   - Root-cause value: highest remaining unblocked target after worker 110. Worker 110 closed the supported top-level packed JSX authoring proof but left the physical deep-import caveat open. The package still publishes `src`, has no `exports` map, and ships `src/specs/SkiaYoga.nitro.ts`, which re-exports internal command transport types and `NodeCommandKind`.
   - Current public-path risk: high enough to prioritize. Prior workers intentionally treat top-level `YogaCanvas`/JSX types as the public API, but consumers can still reach the native/spec transport source files from the packed package. That weakens the boundary worker 110 just clarified.
   - Likely verification shape: add an `exports` map or equivalent package-boundary guard that preserves supported imports (`react-native-skia-yoga`, `react-native-skia-yoga/jsx-runtime`, `react-native-skia-yoga/jsx-dev-runtime`) and proves unsupported deep imports such as `react-native-skia-yoga/src/specs/commands` and `react-native-skia-yoga/src/specs/SkiaYoga.nitro` fail from a packed temporary consumer under a resolver mode that honors package exports. Keep package-surface/codegen-autolinking proof that files remain physically present if React Native codegen needs package-local `src/specs`.
   - Expected files/modules touched: likely `package.json`, `scripts/verify-package-typescript-consumer.mjs`, `scripts/verify-package-surface.mjs`, and the next worker report. Possibly README only if the boundary wording needs clarification. Generated files should not need changes.
   - Overclaim risks: an `exports` map is a resolver contract, not filesystem secrecy. Older TypeScript or Metro resolver modes may ignore it. This target must not claim platform-native app proof, native bridge delivery, C++ conversion, UI-runtime Worklets execution, Reanimated delivery, Nitro registry install, image loading, or render fidelity. It must also avoid breaking React Native source-first behavior and codegen/autolinking access to package-local spec files.

2. Complete `JSIConverter<NodeCommand>::toJSI(...)` payload serialization.
   - Classification: locally unblocked native converter target, but lower current public risk.
   - Root-cause value: medium. `JSIConverter<NodeCommand>::fromJSI(...)` parses all command families and dynamic numeric leaves, while `toJSI(...)` is incomplete: it omits or partially serializes `path`, `line`, `points`, `image`, `paragraph`, and `blurMaskFilter` payload fields.
   - Current public-path risk: lower than candidate 1. I did not find evidence that supported public JS receives `NodeCommand` values from native today. Existing core paths consume commands from JS into native.
   - Likely verification shape: add host-JSC/native direct `toJSI(...)` assertions or round-trip checks for representative omitted fields, probably beside current command/render converter coverage.
   - Expected files/modules touched: likely `cpp/JSIConverter+NodeCommand.hpp`, `scripts/verify-yoganode-native-commands-render.mjs` or a narrow converter verifier, and report.
   - Overclaim risks: this would prove converter serialization symmetry only. It would not prove public app behavior, RN bridge delivery, generated wrapper delivery, rendering, platform runtime, or dynamic Worklets/Reanimated delivery.

3. UI-runtime Worklets execution and real Reanimated `SharedValue` delivery.
   - Classification: blocked locally for honest proof.
   - Root-cause value: high product value, but not actionable from this worktree without a real RN runtime.
   - Existing evidence: source-level Reconciler binding checks, Worklets transform checks, raw host-JSC `Synchronizable` extraction, and selected host-native dynamic `AnimatedDouble` command/render probes.
   - Likely verification shape if unblocked: simulator/device React Native app launch with Reanimated/Worklets running on the UI runtime, observed `SharedValue` updates, native mirror/listener delivery, invalidation, and visible native state/render effects.
   - Expected files/modules touched: example/runtime harnesses and possibly Reconciler/YogaCanvas/native code if bugs appear.
   - Overclaim risks: Node VM stubs, Babel transform checks, and host-JSC `Synchronizable` probes do not prove UI-runtime Worklets execution or real Reanimated delivery.

4. Actual React/Reconciler native bridge delivery, Nitro module registry install / `SkiaYoga.install()` inside React Native, and full iOS/Android app build/run.
   - Classification: blocked locally by missing full Xcode selection, CocoaPods, Java runtime, Android SDK variables/tools, ADB, CMake, Ninja, and Gradle.
   - Root-cause value: highest product confidence value, but not currently unblocked.
   - Existing evidence: host-JSC generated `YogaNode.toObject(...)` materialization, generated wrapper execution, host-native `RNSkYogaView`/`SkiaYoga` view-registry scheduling, Expo native-generation/autolinking metadata, and source-level Reconciler behavior.
   - Likely verification shape if unblocked: generated native projects, CocoaPods/Gradle build, simulator/device launch, `SkiaYoga.install()` registry evidence, React tree commit into native command conversion, native logs/state, and rendered output.
   - Expected files/modules touched: example app/runtime harnesses, native module/platform integration, and build metadata if failures appear.
   - Overclaim risks: host-JSC materialization, host-native view probes, and Expo CNG metadata do not prove a real React Native bridge or Nitro registry install inside a running app.

5. Real image asset loading/decoding and texture-backed image behavior.
   - Classification: blocked or overclaim-prone locally.
   - Root-cause value: medium-high product value. Workers 084, 102, and 106 already prove synthetic in-memory `SkImage` / real `JsiSkImage` command conversion, fit/default/invalid behavior, bounded raster evidence, and generated wrapper delivery.
   - Likely verification shape if unblocked: React Native/Expo asset resolution, `useImage`, local/remote asset loading, decoding, texture-backed image behavior, and rendered app output.
   - Expected files/modules touched: example assets/screens, image-loading integration, platform harnesses.
   - Overclaim risks: synthetic host-native `SkImage` probes do not prove asset loading, decoding, texture-backed images, local/remote resolution, platform presentation, or exact image fidelity.

6. Exact text/paragraph/path/stroke/render fidelity and broader style slices.
   - Classification: partially locally sliceable, but exact proof remains blocked or overclaim-prone.
   - Root-cause value: lower than candidate 1 right now. Existing command/render coverage already includes bounded path/stroke, dynamic path trim, text/paragraph CSS color strings, paragraph measurement, and representative raster/state checks.
   - Likely verification shape: narrowly selected host-native style/geometry slices if a concrete source gap is found, or platform-font/render snapshots if platform runtime becomes available.
   - Expected files/modules touched: likely `scripts/verify-yoganode-native-commands-render.mjs` and report, with product source only if a focused bug appears.
   - Overclaim risks: bounded pixels are not exact typography, glyph geometry, font fallback correctness, paragraph shaping parity, exact path/stroke geometry, or full render fidelity.

No stronger generated-wrapper breadth, package lifecycle, autolinking/codegen, RN Skia private-import, example-generation, native lifetime, hit-testing, RNSkYogaView, direct `StrokeOpts`, or dynamic JSX top-level type target was substantiated. Those surfaces are covered by the green feasible matrix within explicit boundaries.

## Selected Next Target

Select: guard published `src/specs/*` deep imports and harden the package export boundary.

This is stronger than another audit-only step because it is source-confirmed, locally unblocked, and directly follows worker 110's explicit residual caveat. Worker 110 proved the supported top-level TypeScript authoring surface; the remaining package-boundary root cause is that the internal/native spec files are still physically published and resolver-unrestricted.

This is stronger than `NodeCommand::toJSI(...)` serialization symmetry because the deep-import caveat affects the consumer package contract that worker 110 just clarified. `NodeCommand::toJSI(...)` is real native source asymmetry, but current supported command flow is inbound JS-to-native and I found no current public API returning `NodeCommand` to JS.

This is stronger than more image/text/path/render slices because those would add bounded slices to already broad host-native coverage while leaving the package boundary intentionally porous.

This is stronger than runtime/platform targets only because those are blocked locally for honest proof. They remain high-value once full Xcode, CocoaPods, Java, Android SDK/ADB/CMake/Ninja/Gradle, and a real RN runtime are available.

Recommended proof boundary for the next worker:

- Prove a packed package resolver/API boundary, not filesystem secrecy.
- Preserve supported root and JSX runtime subpath imports.
- Preserve React Native source-first/codegen/autolinking behavior that needs package-local `src/specs`.
- Prove representative `src/specs/*` deep imports fail under a resolver configuration that honors package exports.
- Do not claim runtime Worklets/Reanimated, RN bridge delivery, C++ conversion, native rendering, Nitro registry install, platform app runtime, image loading, or exact render fidelity.

## Nested Challenger Documentation

- Nested agent: `/root/challenger_post_110_target`.
- Prompt summary: read-only focused challenger in this worker 111 worktree; compare guarding published `src/specs/*` deep imports with an `exports` map/package-boundary verifier, incomplete `JSIConverter<NodeCommand>::toJSI(...)` serialization, blocked UI-runtime/Reanimated/RN bridge/Nitro registry/platform runtime targets, and additional image/text/render fidelity slices; classify blocked/unblocked, root-cause value, verification shape, expected files, and overclaim risks; do not edit files or run long platform builds.
- Result: completed and closed.
- Challenger recommendation:
  - Ranked guarding published `src/specs/*` deep imports first as the strongest locally unblocked target.
  - Ranked `JSIConverter<NodeCommand>::toJSI(...)` serialization second as real but medium-risk converter symmetry.
  - Ranked UI-runtime/Reanimated/RN bridge/Nitro registry/platform app runtime as high value but locally blocked.
  - Ranked additional image/text/render fidelity slices lower after recent broad host-native coverage.
- Challenger evidence claimed: audit evidence only. It ran read-only source/package probes and `npm pack --dry-run --json --ignore-scripts`, confirming `src/specs/*` is physically included and `package.json` has no `exports` map. It did not run the full feasible matrix and did not claim implementation acceptance evidence.
- Closure evidence: `close_agent /root/challenger_post_110_target` returned completed status.

## Verification Commands And Results

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 44s`.
  - `/usr/bin/time` real: `284.44s`; user: `203.42s`; sys: `85.59s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-yMSrSW` was empty before removal and was removed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed with no output.
- `node --check scripts/verify-package-surface.mjs`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed with no output.
- Focused package probe:
  - `exports field: <absent>`.
  - `files includes src: true`.
  - Corrected pack-manifest probe confirmed `src/specs/commands.ts`, `src/specs/SkiaYoga.nitro.ts`, `src/specs/NativeSkiaYoga.ts`, and `src/specs/SkiaYogaViewNativeComponent.ts` are published, with `5` files under `src/specs`.
- Focused source probes:
  - `nl -ba package.json | sed -n '1,45p;100,114p'` confirmed source-first entries, `"src"` in files, and `codegenConfig.jsSrcsDir: "./src/specs"`.
  - `nl -ba src/specs/SkiaYoga.nitro.ts | sed -n '1,62p'` confirmed the spec module re-exports command transport types and `NodeCommandKind`.
  - `nl -ba src/index.ts | sed -n '1,55p'` and `nl -ba index.d.ts | sed -n '1,55p'` confirmed the top-level public API remains the explicit `YogaCanvas`/JSX/interactivity allowlist.
  - `nl -ba cpp/JSIConverter+NodeCommand.hpp | sed -n '378,455p'` confirmed the lower-ranked `toJSI(...)` asymmetry: selected command kinds serialize partial data while `path`, `line`, and `points` emit only the type plus empty data.
- Platform blocker probes are listed in the baseline section.

No installs, product edits, verifier edits, generated-file edits, ignored-artifact edits, or platform-native app builds were introduced by this audit outside existing verifier temp work.

## Cleanup And Status Evidence

Pre-report cleanup/status after the matrix and focused probes:

- Matrix cleanup removed the new `tsconfig.tsbuildinfo` and removed `/tmp/rnskia-feasible-matrix-yMSrSW`.
- The nested challenger was closed with completed status.

Final cleanup/status probes after report creation:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - `## worker/111-post-110-root-cause-audit`
  - `?? worker-progress/worker-111-post-110-root-cause-audit.md`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding `node_modules` and `example/node_modules`: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, package, example, YogaNode command/render, YogaNode Nitro materialization, AnimatedDouble, and RNSkYogaView roots: no output.
- Active verifier/debug process probe for `node .*scripts/verify-`, `clang++`, `rnskia-yoganode`, `rnskia-feasible`, `lldb`, and `debugserver` initially returned transient PID `80011`; `ps -p 80011 -o pid=,ppid=,command=` found no process, and the immediate rerun of the active-process probe returned no output with exit 1.
- `list_agents`: only `/root` running after closing `/root/challenger_post_110_target`.

Ignored `node_modules` and `example/node_modules` were pre-existing dependency trees and were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The recommendation targets the exact public-boundary gap left after worker 110 rather than reopening spec payload typing or adding another broad host-native slice.
- It distinguishes top-level supported API from physically published source files and keeps proof boundaries explicit.
- It preserves high-value runtime gaps as blocked rather than overclaiming current host/source evidence.

Maintainability:

- A package export-boundary fix can be guarded in the existing package-surface and packed-consumer verifiers.
- The expected implementation should keep `src` physically published for source-first React Native and codegen, while making supported resolver entrypoints explicit.
- The target avoids widening Nitro/spec transport types in a way that would misrepresent actual native transport.

Performance:

- The likely verifier additions are bounded package/type resolver checks and should be much cheaper than platform builds or host-native raster probes.
- The likely runtime package change should have no hot-path app overhead.

Security:

- Clarifying package exports reduces accidental reliance on native/spec internals and narrows the supported import surface.
- The target does not require network services, simulator/device automation, arbitrary user input, broad temp deletion, or runtime eval.
- The recommendation explicitly avoids claiming that package exports provide filesystem secrecy.
