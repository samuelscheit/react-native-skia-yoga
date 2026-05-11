# Worker 116: Post-115 Root-Cause Audit

## Scope and Read-Only Status

This was a read-only audit after worker 115 was accepted and merged. I did not edit product code, verifier scripts, package metadata, generated files, or docs outside this report.

Required context was reviewed, including `MASTER_PLAN.md`, `MASTER_PROGRESS.md`, the requested worker reports from 088 through 115, package/verifier scripts, Reconciler/JSX/package entry files, command/converter C++ headers, `cpp/YogaNode.*`, `cpp/SkiaYoga.cpp`, `android/CMakeLists.txt`, and the iOS native view implementation. The requested `ios/RNSkYogaView.mm` path is not present in this worktree; the existing corresponding file is `ios/SkiaYogaView.mm`.

## Post-Worker-115 Baseline

Current branch:

- `worker/116-post-115-root-cause-audit`

Current upstream context observed in `git log`:

- `c0b2698 Accept worker 115 and prepare worker 116`
- `df1d396 Merge worker 115 getChildren materialization`
- `d376d5b Harden YogaNode getChildren materialization`

Worker 115 closed the immediate `YogaNode.getChildren()` materialization suspicion. The expanded verifier showed the compiled behavior already returned cached materialized child objects through Nitro's generic `HybridObject` converter. The source was still hardened so future include drift cannot reintroduce bare NativeState-only children:

- `YogaNode::getChildren()` now calls child `toObject(runtime)` directly.
- `JSIConverter<std::shared_ptr<YogaNode>>::toJSI(...)` rejects null and returns `arg->toObject(runtime)`.

The accepted local aggregate gate remains `npm run check:feasible-matrix`. Its proof boundary is local and feasible: it combines static/source checks, TypeScript/package checks, Node VM verifier harnesses, host-native macOS C++ verifier binaries, generated native scaffolding checks, and synthetic in-memory Skia render/converter checks. It still does not prove platform-native app launch, full React Native runtime integration, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual native bridge delivery, RNGH native delivery, image asset loading/decoding, texture-backed image behavior, Nitro module registry install inside a real app, or exact render/typography fidelity.

Baseline verification:

- `/usr/bin/time -p npm run check:feasible-matrix`
  - Result: passed all 28 matrix commands.
  - Matrix command duration: `4m 43s`.
  - `/usr/bin/time`: `real 283.50`, `user 200.54`, `sys 71.77`.
  - Cleanup observed: matrix removed its temporary root after removing newly-created local build-info output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.

Worker 115's focused materialization gate, `npm run check:yoganode-nitro-materialization`, is now part of the accepted baseline. It proves materialized parent/child/grandchild behavior through generated APIs and raw YogaNode methods, including returned-child prototype exposure and generated/raw method usability through returned children.

## Candidate Ranking

### 1. Select Next: Whole `SharedValue<SamplingOptions>` Public Type Support

Classification: unblocked locally.

Root-cause value: high. The public JSX surface exposes `sampling?: YogaDeepAnimated<SamplingOptions>` in `src/jsx.ts`, and `SamplingOptions` is intentionally listed in `YogaOpaqueValue`. That means nested sampling leaves such as `{ filter: SharedValue<FilterMode> }` are not honestly part of the typed contract. The stronger issue is narrower: because `SamplingOptions` is a union (`CubicResampler | FilterOptions`) and `YogaDeepAnimated<T>` uses distributive conditional types, the public type accepts `SharedValue<FilterOptions>` and `SharedValue<CubicResampler>` but rejects a common whole-value shape, `SharedValue<SamplingOptions>`.

Runtime shape appears locally feasible: `src/Reconciler.ts` includes `sampling` in `commandPropKeys.image`, and `bindAnimatedValues(...)` checks a top-level `SharedValue` before nested traversal. This is therefore primarily a public package/type-boundary mismatch, with an optional source-level Reconciler verifier to keep the runtime listener path explicit.

Verification shape:

- Extend `scripts/verify-package-typescript-consumer.mjs` with a positive packed-consumer case for `<image sampling={sharedSampling} />` where `sharedSampling: SharedValue<SamplingOptions>`.
- Add a targeted negative or source-level type probe, if desired, to clarify that nested sampling leaves remain rejected while `SamplingOptions` is treated as opaque.
- Optionally extend `scripts/verify-reconciler-animated-bindings.mjs` with a top-level JS listener case for `image.sampling` to prove command rebuild/invalidation for a whole sampling `SharedValue`.
- Fix shape is likely either a non-distributive `YogaDeepAnimated<T>` conditional or a targeted `sampling?: YogaAnimatedProp<SamplingOptions>` declaration.

Expected touched files for the implementation worker:

- `src/jsx.ts`
- `scripts/verify-package-typescript-consumer.mjs`
- Possibly `scripts/verify-reconciler-animated-bindings.mjs`
- New worker report

Overclaim risks:

- A type-level fix is not proof of real Reanimated delivery, UI-runtime Worklets execution, or native bridge delivery.
- If a Reconciler case is added, it remains Node VM/source-level listener proof only.
- This does not prove nested sampling leaf support, image loading/decoding, texture-backed image behavior, native image render fidelity, or value-exact `SkSamplingOptions::toJSI`.

Why this is stronger than the alternatives: it is a concrete public package contract mismatch on an authored JSX prop and is locally testable through the packed TypeScript consumer. It is narrower and safer than claiming nested sampling leaves, and it can be closed without platform runtime tooling.

### 2. Close Second: Value-Bearing `toJSI(...)` for Sampling/Text/Paragraph Style

Classification: unblocked locally for bounded converter serialization.

Root-cause value: medium-high. `cpp/JSIConverter+SkSamplingOptions.hpp`, `cpp/JSIConverter+SkTextStyle.hpp`, and `cpp/JSIConverter+SkParagraphStyle.hpp` still serialize these C++ values as empty JS objects. `scripts/verify-yoganode-native-commands-render.mjs` explicitly states that it does not prove value-exact `paragraphStyle`, `textStyle`, or `sampling` serialization beyond current converter support, and current checks only keep object-presence/payload-presence coverage for these surfaces.

Verification shape:

- Add bounded representative `toJSI` assertions for sampling and selected text/paragraph style fields.
- Implement value-bearing serializers where Skia exposes stable getters and where round-trip shape is defensible.
- Avoid claiming full paragraph shaping, font fallback, exact typography, or complete style parity.

Expected touched files:

- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- New worker report

Overclaim risks:

- Skia style objects are large and partly lossy or platform-dependent.
- A bounded serializer can easily be overstated as full value-exact style serialization.
- This does not address the public TypeScript rejection of a whole `SharedValue<SamplingOptions>`.

### 3. Not Selected: `image.sampling` Nested Leaf Traversal

Classification: unblocked to test, but not currently a substantiated public contract bug.

Root-cause value: low until the public type contract changes. A first audit pass considered adding `"sampling"` to `commandNestedRoots`, but the source contract is more constrained: `SamplingOptions` is included in `YogaOpaqueValue`, so `YogaDeepAnimated<SamplingOptions>` does not currently advertise nested leaves such as `sampling={{ filter: sharedFilter }}`. An in-memory TypeScript probe confirmed that nested `filter: SharedValue<FilterMode>` is rejected.

Verification shape if intentionally adopted later:

- First change the public type contract to allow nested sampling leaves.
- Then add `sampling` to `commandNestedRoots` and verify a nested listener case.

Overclaim risks:

- Adding runtime traversal without a matching public type contract would be an untyped JavaScript affordance, not a fix for the current public TypeScript surface.

### 4. Actual Native Bridge Delivery from React/Reconciler to Native Commands

Classification: blocked for full proof by missing local platform runtime/tooling; partially source-testable.

Root-cause value: high, but not the strongest next local target. The matrix has Reconciler Node VM coverage and host C++ command conversion coverage, but not an end-to-end React Native bridge delivery proof into native command conversion.

Verification shape:

- Full proof would need a real RN app runtime and native module/view bridge.
- A local approximation could add more source/harness checks, but that would not close the main proof gap.

Overclaim risks:

- Source-level Reconciler proof is not native bridge delivery.
- Host-native converter proof is not React Native runtime integration.

### 5. UI-Runtime Worklets Execution and Real Reanimated Delivery

Classification: blocked for real proof by missing platform runtime.

Root-cause value: high. Current checks verify source-level listener wiring, native-binding mirrors, and synchronizable conversion paths, but not actual UI-runtime Worklets execution in a running app.

Verification shape:

- Requires a real RN runtime with Reanimated/Worklets installed and executing.
- Current Node VM harnesses are useful but cannot prove this gap.

Overclaim risks:

- Listener scheduling stubs are not real UI-runtime execution.
- Synchronizable host tests are not real Reanimated `SharedValue` delivery.

### 6. Nitro Module Registry Install / `SkiaYoga.install()` in a Real App

Classification: blocked for runtime proof by missing platform app runtime/tooling.

Root-cause value: high. Package and generated-wrapper checks reduce drift, but do not prove the module is installed and callable inside a real app process.

Verification shape:

- Requires iOS/Android app build/run or equivalent real RN runtime.
- Local source/package checks can only guard installation surface shape.

Overclaim risks:

- Generated wrapper or package export proof is not Nitro registry install proof.

### 7. Full iOS/Android Build/Run

Classification: blocked locally.

Observed blockers:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`
- `xcodebuild -version`: failed because full Xcode is not selected.
- `command -v pod`: unavailable.
- `java -version`: failed with no Java runtime.
- `command -v adb`, `cmake`, `ninja`, `gradle`: unavailable.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

Root-cause value: high once tooling exists, but not an ordinary unblocked repo-code target in this worktree.

### 8. Real Image Asset Loading/Decoding and Texture-Backed Image Behavior

Classification: blocked for full proof by missing RN/platform runtime and asset pipeline; partially host-testable only with synthetic images.

Root-cause value: high for user-visible image behavior. Current C++ coverage uses synthetic in-memory `SkImage` behavior and does not prove `useImage`, local/remote asset resolution, decoding, or texture-backed rendering.

Verification shape:

- Real proof needs a platform app/runtime and actual assets.
- Host-side tests can continue to exercise synthetic `SkImage` command conversion and bounded raster behavior.

Overclaim risks:

- Synthetic `SkImage` raster checks are not asset loading/decoding.

### 9. Exact Render Fidelity, Typography, Glyph Geometry, Font Fallback, Paragraph Shaping

Classification: mostly blocked or too broad for a tight next root-cause worker; bounded host-native probes are locally possible.

Root-cause value: medium-high but hard to isolate. Current verifiers intentionally avoid claiming exact path/stroke geometry, exact typography, glyph geometry, font fallback correctness, paragraph shaping fidelity, and exact image render fidelity.

Verification shape:

- Bounded raster fixtures could be added for one behavior at a time.
- Full fidelity proof would require golden-image infrastructure, platform/font control, and careful anti-aliasing tolerances.

Overclaim risks:

- Pixel evidence can be brittle without stable fonts, rendering backends, and platform controls.

## Selected Next Target

The next strongest unblocked root-cause target is:

> Add public package support for whole `SharedValue<SamplingOptions>` on `image.sampling`, and prove it through the packed TypeScript consumer.

This target is stronger than the converter serialization target because it is a direct public JSX/package type mismatch for an authored prop and can be verified in the existing packed-consumer gate. The source evidence is specific: `SamplingOptions` is opaque, but distributive `YogaDeepAnimated<T>` splits the union and rejects `SharedValue<SamplingOptions>`. It is stronger than platform/runtime targets because it is locally unblocked and can be verified without claiming native app proof. It is stronger than broad render-fidelity work because the behavioral boundary is narrow and acceptance can be precise.

## Nested Challenger

First nested challenger prompt:

> In the worktree `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-116-post-115-root-cause-audit`, challenge this audit's likely next-target selection after worker 115. Compare two unblocked candidates: (A) public JSX `image.sampling` is `YogaDeepAnimated<SamplingOptions>` but Reconciler `commandNestedRoots` appears to omit `sampling`, so nested `SharedValue` leaves may not bind/listen; (B) `SkSamplingOptions`/`SkTextStyle`/`SkParagraphStyle` `toJSI` converters still return empty objects and verifier only proves object-presence for those value surfaces. Do a focused read-only inspection only. Do not edit files or run long tests. Return your recommended strongest next root-cause target, expected verification shape, overclaim risks, and whether you claim any acceptance evidence.

First nested challenger result:

- Recommended target A: `image.sampling` nested `SharedValue` traversal in the Reconciler.
- Rationale: public JSX advertises deep animated sampling, `commandPropKeys.image` includes `sampling`, but `commandNestedRoots` omits it, so nested sampling leaves remain raw `SharedValue` objects.
- Expected verification: add a JS command binding case for `image.sampling.filter` or `image.sampling.mipmap`, then add `"sampling"` to `commandNestedRoots`.
- Overclaim risks: Node VM/source-level Reconciler proof only; no Worklets runtime, real Reanimated delivery, image decoding, texture-backed image, native render fidelity, or value-exact sampling `toJSI`.
- Acceptance evidence claimed by challenger: none. It performed read-only source inspection only.
- Audit disposition: superseded. Later type inspection showed `SamplingOptions` is in `YogaOpaqueValue`, so nested sampling leaves are not currently part of the public TypeScript contract.

Second nested challenger prompt:

> Read-only challenge in `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-116-post-115-root-cause-audit`. A first pass thought `image.sampling` nested `SharedValue` traversal was the strongest target, but corrected evidence shows `src/jsx.ts` includes `SamplingOptions` in `YogaOpaqueValue`, so `YogaDeepAnimated<SamplingOptions>` likely does NOT type-advertise nested `SharedValue` leaves. Type probes show nested `{filter: SharedValue<FilterMode>}` is rejected, while `SharedValue<FilterOptions>`/`SharedValue<CubicResampler>` are accepted but `SharedValue<SamplingOptions>` is rejected due conditional distributivity. Compare remaining candidates: (1) public type boundary for whole `SharedValue<SamplingOptions>` / non-distributive `YogaDeepAnimated` union support, (2) bounded value-bearing `toJSI` for `SkSamplingOptions`/`TextStyle`/`ParagraphStyle` empty serializers, (3) any other stronger unblocked local target you see. Do focused source inspection only, no edits or long tests. Recommend the strongest next root-cause target, verification shape, overclaim risks, and whether you claim acceptance evidence.

Second nested challenger result:

- Recommended target: whole `SharedValue<SamplingOptions>` public type support.
- Rationale: `SamplingOptions` is opaque, top-level runtime binding should already work, and the likely bug is conditional distributivity rejecting `SharedValue<SamplingOptions>`.
- Expected verification: add a packed TypeScript consumer positive case for `<image sampling={sharedSampling} />` where `sharedSampling: SharedValue<SamplingOptions>`, and optionally add a negative/source check documenting that nested sampling leaves remain rejected if the opaque contract is intended.
- Overclaim risks: type-boundary proof only unless paired with a Reconciler listener case; no Worklets runtime, real Reanimated delivery, or native image behavior proof.
- Acceptance evidence claimed by challenger: none. It performed read-only source inspection only.

## Verification and Cleanup Evidence

Verification commands/results:

- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 matrix commands in `4m 43s`; `/usr/bin/time` reported `real 283.50`, `user 200.54`, `sys 71.77`.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.

Focused read-only probes:

- `src/jsx.ts` exposes `sampling?: YogaDeepAnimated<SamplingOptions>`.
- `src/jsx.ts` includes `SamplingOptions` in `YogaOpaqueValue`.
- RN Skia defines `SamplingOptions` as `CubicResampler | FilterOptions`.
- An in-memory TypeScript probe rejected nested `sampling: { filter: SharedValue<FilterMode> }`.
- A second in-memory TypeScript probe accepted `SharedValue<FilterOptions>` and `SharedValue<CubicResampler>` but rejected `SharedValue<SamplingOptions>`.
- `src/Reconciler.ts` includes `sampling` in `commandPropKeys.image`, so a top-level sampling `SharedValue` is in the command prop set.
- `scripts/verify-reconciler-animated-bindings.mjs` does not currently mention image sampling.
- `scripts/verify-package-typescript-consumer.mjs` does not currently compile a public consumer case for `image.sampling`.
- `cpp/JSIConverter+SkSamplingOptions.hpp`, `cpp/JSIConverter+SkTextStyle.hpp`, and `cpp/JSIConverter+SkParagraphStyle.hpp` still return empty objects from `toJSI(...)`.

Cleanup/status probe results after writing this report:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`: only this untracked report plus ignored dependency directories:
  - `?? worker-progress/worker-116-post-115-root-cause-audit.md`
  - `!! example/node_modules`
  - `!! node_modules`
- Local artifact scan for verifier-owned `*.tgz` and `tsconfig.tsbuildinfo`, pruning ignored dependency/generated directories: no output.
- Generated example native directory scan for `example/ios`, `example/android`, and `example/.expo`: no output.
- Verifier temp-root scan under `/tmp` and `/private/tmp` for `rnskia-*` verifier roots: no output.
- Refined active verifier/debug process scan for `scripts/verify`, `verify-feasible-matrix`, `xcodebuild`, `gradle`, `adb`, `lldb`, and `metro`: no output.
- Live agent scan: only `/root` remained running after the challengers were closed.

## Quality, Maintainability, Performance, and Security Review

Quality: the selected target closes a concrete public API type mismatch with a small, inspectable type change and a packed-consumer verifier case. It should preserve the existing proof boundary by explicitly limiting claims to TypeScript/package behavior unless a Reconciler listener case is also added.

Maintainability: fixing `YogaDeepAnimated<T>` distributivity would likely improve other union-shaped public props, but it should be verified carefully because it is a shared helper. A targeted `sampling` declaration would be lower blast radius but would leave the broader helper behavior unchanged.

Performance: a type-only fix has no runtime cost. If a top-level Reconciler verifier case is added, it should not require changing runtime traversal behavior.

Security: no new I/O, network, eval, package boundary expansion, or native memory surface is implied by the selected target. The main safety issue is avoiding overclaims: the implementation should not claim nested sampling leaf support, image loading, decoding, native texture behavior, or real Reanimated runtime delivery.
