# React Native Skia Yoga Master Plan

Last updated: 2026-05-12

## Mission

Build `react-native-skia-yoga` into a React Native C++ library that combines Yoga layout with Skia rendering for declarative, complex, animated, and interactive UI.

Breaking changes are acceptable when they remove root causes instead of preserving weak contracts.

## Operating Model

- The orchestrator owns planning, worker coordination, merge hygiene, and root-cause prioritization.
- Product code changes are delegated to isolated workers.
- Top-level workers are managed Codex subagents launched with `spawn_agent`
  from isolated git worktrees. Do not schedule current top-level project
  workers by starting `codex` in tmux.
- Before spawning a writable or report-writing worker, create or assign an
  isolated git worktree and branch for that worker.
- Launch implementation workers, and any other writable/report-writing
  top-level workers, with `agent_type: "worker"`, `goal: true`,
  `fork_turns: "none"`, `model: "gpt-5.5"`, and
  `reasoning_effort: "xhigh"`.
- Worker prompts must include the full task prompt, absolute worktree path,
  write scope, verification expectations, and overlap boundaries.
- Worker goal handling is owned by the `goal: true` launch option. Do not ask
  workers to call goal tools, check goal status, emit visible goal gates, or
  provide separate goal-lifecycle evidence; the final response/report must end
  with the exact line `Goal finished.`
- Workers must keep their own progress files under `worker-progress/`.
- Workers must review quality, maintainability, performance, and security before reporting completion.
- Workers may use nested subagents/explorers when testing uncertain root-cause
  hypotheses, and must document delegated results that affect their
  conclusions in their progress files.
- Finished worker branches are reviewed, verified, merged into `main`, then
  their subagent/worktree is cleaned up.
- Historical worker prompts and progress entries may mention older launch
  policies as archival facts; current top-level workers use `spawn_agent` with
  `goal: true`.

## Current Repository Baseline

- Main branch: `main`
- Current HEAD: latest `main` integration commit; previous accepted baseline before the current batch was `cab1cf1 Integrate first root-cause fixes`.
- Package manager evidence: `bun.lock` is present and `node_modules/` already exists.
- Public package entrypoints are TypeScript-first under `src/`, with generated Nitro artifacts under `nitrogen/`.
- Native implementation spans shared C++ plus iOS Objective-C++ and Android JNI/Kotlin/Java layers.
- Example app is Expo/React Native based under `example/`.

## Phase 0: Bootstrap Orchestration

Status: complete for evidence intake; ongoing for worker coordination

Tasks:

1. Create `MASTER_PLAN.md` and `MASTER_PROGRESS.md`.
2. Create isolated worker worktrees.
3. Launch initial evidence-gathering workers.
4. Merge accepted progress artifacts.
5. Select the first implementation task from evidence.

## Phase 1: Establish Ground Truth

Status: accepted

Goals:

- Identify the current API and architecture surface.
- Establish reproducible validation commands.
- Find root causes behind current failures, missing behavior, or fragile contracts.

Accepted worker wave:

- `worker-001-js-api-audit`: audited JS/TS API, reconciler, JSX runtime, interaction layer, and example usage.
- `worker-002-native-architecture-audit`: audited shared C++/Yoga/Skia lifecycle plus iOS and Android integration.
- `worker-003-verification-baseline`: ran current validation/build commands and classified failures by root cause.

Acceptance criteria:

- Each worker produces a progress report with concrete file references.
- Each worker states tested hypotheses and evidence.
- Each worker documents nested subagent/explorer use or an explicit reason it was not applicable.
- Verification commands and failure modes are documented precisely.
- No product code changes are accepted from this phase unless explicitly assigned.

## Phase 2: Root-Cause Implementation

Status: second implementation wave integrated through native parent lifetime, reparenting fixes, focused native lifetime verifier coverage, linked native runtime smoke coverage, and hardened RN Skia macOS archive discovery

Candidate areas to prioritize after evidence:

- Contract consistency between TS specs, generated Nitro code, C++ implementation, and platform bindings.
- Layout/render lifecycle correctness: node creation, reconciliation, Yoga calculation, draw command emission, invalidation, and teardown.
- Interactivity correctness: hit testing, pointer event semantics, gesture interop, animation state, and event propagation.
- Packaging correctness: public exports, generated `lib` output, `react-native.config.js`, podspec, Gradle/CMake, and example linking.
- Testability: minimal deterministic tests for JS contract behavior and native edge cases where feasible.

Accepted first implementation wave:

- `worker-004-install-isolation`: fixed root/example dependency isolation so `postinstall` no longer clobbers root `node_modules`, and added an isolation verifier.
- `worker-005-package-entrypoints`: fixed public package/type/JSX runtime entrypoints so fresh consumers do not depend on ignored or missing `lib` artifacts.
- `worker-006-platform-context`: removed the duplicated shared C++ platform-context store and routed shared non-view C++ paths through `PlatformContextAccessor`.
- `worker-007-typecheck-yogacanvas`: fixed the repo-wide `npm run typecheck` failure by aligning `YogaCanvas` root creation with the installed `react-reconciler` runtime shape through a local typed adapter.
- `worker-009-origin-animated-contract`: removed unsupported `origin` from the public style contract, kept the runtime guard, narrowed animated style typing, and regenerated the Nitro contract.
- `worker-008-reset-semantics`: made optional native style and command prop omission reset to defaults, including Yoga style, paint/clip/matrix/layer state, text fallback color, blur mask props, text font, and points mode.
- `worker-011-yoganode-parent-lifetime`: replaced raw YogaNode parent pointers with weak links, enforced detach-before-reparent semantics, centralized child detach cleanup, and fixed interactive-descendant count updates for partial insert cleanup.
- `worker-012-native-lifetime-regression`: added a focused reusable verifier for the worker 011 YogaNode parent lifetime and reparenting invariants, with explicit syntax/source-shape coverage limits.
- `worker-013-native-runtime-smoke`: added a linked host-native runtime smoke harness that executes retained-descendant teardown mutation and reparenting ownership assertions against real `YogaNode.cpp`, upstream Yoga sources, and RN Skia macOS archives.

Accepted report-only audit:

- `worker-010-yoganode-parent-lifetime-audit`: accepted report-only audit; implemented by worker 011 after reset/default semantics settled.

Acceptance criteria:

- Workers fix root causes, not downstream symptoms.
- Breaking API changes are documented when they simplify or correct the contract.
- Tests or equivalent verification cover the fixed behavior.
- Worker reports include quality, maintainability, performance, and security review.

## Phase 3: Integration and Example Confidence

Status: active; platform readiness audit accepted, prebuild-safe example workspace blockers fixed, Node-run CNG native generation verified, package metadata/install lifecycle hygiene resolved, Android RN Skia archive discovery fixed with source-level verification, root lint-ci configuration/formatter wiring repaired, React Native deep-import cleanup integrated, example lint-contract cleanup integrated, README/API contract drift fixed, native package publish-surface completeness fixed, example bundle feedback-loop hygiene fixed, post-worker-035 root-cause audit accepted, RN Skia private import cleanup integrated, post-worker-037 root-cause audit accepted, packed-package TypeScript consumer smoke coverage integrated, post-worker-039 root-cause audit accepted, `react-reconciler` package-surface dependency hygiene integrated, post-worker-041 root-cause audit accepted, public declaration/export boundary cleanup integrated, post-worker-043 root-cause audit accepted, `SkiaYogaObject` lazy initialization integrated, post-worker-045 root-cause audit accepted, `src/util.ts` Nitro boxing lazy-init integrated, post-worker-047 root-cause audit accepted, Worklets transform/closure verification integrated, post-worker-049 root-cause audit accepted, example/Expo Worklets transform verification integrated, public-import graph verifier hardening integrated, direct `NativeSkiaYoga` deep-import hardening integrated, post-worker-056 codegen-schema audit accepted, RN codegen schema verifier integrated, post-worker-058 root-cause audit accepted, Reconciler/gesture Worklets transform verification integrated, post-worker-060 root-cause audit accepted, Reconciler animated binding runtime verifier integrated, YogaCanvas gesture/interaction runtime verifier integrated, post-worker-062 root-cause audit accepted, YogaCanvas lifecycle runtime verifier integrated, post-worker-065 root-cause audit accepted, packed-package RN codegen/autolinking verification integrated, post-worker-067 root-cause audit accepted, example native-generation verifier integrated, local-artifact preservation hardening integrated, post-worker-069 root-cause audit accepted, aggregate feasible-matrix verifier integrated, post-worker-071 root-cause audit accepted, host-native YogaNode hit-testing verifier integrated, post-worker-073 root-cause audit accepted, host-native `SkiaYoga` / `RNSkYogaView` runtime verifier integrated, post-worker-075 root-cause audit accepted, feasible-matrix temp isolation hardening integrated, YogaNode hybrid/JSI raw-method boundary verification integrated, post-worker-078 root-cause audit accepted, YogaNode command/render verification integrated, post-worker-080 audit accepted, deterministic command/render expansion integrated, post-worker-082 audit accepted, ImageCmd command/render verification integrated, post-worker-084 audit accepted, TextCmd/ParagraphCmd command/render verification integrated, post-worker-086 root-cause audit accepted, Nitro YogaNode materialization verification integrated, dynamic AnimatedDouble Synchronizable verification integrated, selected dynamic AnimatedDouble NodeCommand verification integrated, dynamic PathCmd trim verification integrated, Reconciler native command-binding coverage integrated, post-worker-095 root-cause audit accepted, public `path.stroke` payload contract integration accepted, post-worker-097 root-cause audit accepted, Reconciler JS-mode command listener coverage integrated, post-worker-099 root-cause audit accepted, generated Nitro `setCommand(...)` breadth coverage integrated, post-worker-101 root-cause audit accepted, ImageCmd fit-mode coverage integrated, post-worker-103 root-cause audit accepted, TextCmd/ParagraphCmd CSS color-string coverage integrated, post-worker-105 root-cause audit accepted, expanded generated Nitro `setCommand(...)` breadth integrated, post-worker-107 root-cause audit accepted, direct `StrokeOpts` converter consistency integrated, post-worker-109 root-cause audit accepted, packed dynamic JSX type-boundary coverage integrated, post-worker-111 root-cause audit accepted, package export-boundary hardening integrated, NodeCommand `toJSI(...)` serialization symmetry integrated, post-worker-114 root-cause audit accepted, materialized `YogaNode.getChildren()` identity/prototype hardening integrated, post-worker-115 root-cause audit accepted, post-worker-116 root-cause audit accepted, whole `image.sampling` `SharedValue<SamplingOptions>` type support integrated, post-worker-118 root-cause audit accepted, value-bearing style/sampling `toJSI(...)` serialization integrated, post-worker-120 root-cause audit accepted, canonical `style.antiAlias` support integrated, post-worker-122 root-cause audit accepted, expanded `TextStyle` `toJSI(...)` serialization integrated, post-worker-124 root-cause audit accepted, bounded `TextStyle.fontFeatures` serialization integrated, post-worker-126 root-cause audit accepted, bounded `ParagraphStyle` scalar serialization integrated, post-worker-128 root-cause audit accepted, bounded `ParagraphStyle.strutStyle` parser/serializer coverage integrated, post-worker-130 root-cause audit accepted, unsupported public `fontVariations` contract closure integrated, post-worker-132 root-cause audit accepted, simple `<text textStyle>` contract closure integrated, post-worker-134 root-cause audit accepted, nested `paragraphStyle.textStyle` CSS color parsing integrated, post-worker-136 root-cause audit accepted, dynamic nested `paragraphStyle.textStyle` Reconciler proof integrated, post-worker-138 root-cause audit accepted, nested `ParagraphStyle::toJSI(...)` shape preservation integrated, SkPaint-backed `backgroundColor` paint ordering integrated, post-worker-147 root-cause audit accepted, `style.layer` / `_layerPaint` proof integrated, post-worker-149 root-cause audit accepted, dynamic `style.layer` / opaque style `SharedValue` proof integrated, post-worker-152 root-cause audit accepted, materialized `YogaNode.setStyle(...)` paint-field breadth proof integrated, generated materialized transform-operation breadth integrated, post-worker-162 root-cause audit accepted, bounded transform composition runtime proof integrated, post-worker-164 root-cause audit accepted, public/Reconciler transform authoring proof integrated, post-worker-166 root-cause audit accepted, overflow render/materialized bridge proof integrated, post-worker-195 root-cause audit accepted, residual generated materialized layout edge/constraint breadth integrated, post-worker-197 root-cause audit accepted, public/Reconciler dynamic layout-style proof integrated, post-worker-199 root-cause audit accepted, dynamic layout setter update proof integrated, post-worker-202 root-cause audit accepted, exact dynamic layout field-alignment proof integrated, post-worker-203 root-cause audit accepted, fresh audit-only gap discovery accepted, deterministic layout unit validation integrated, post-worker-207 root-cause audit accepted, deterministic `style.backgroundColor` string validation integrated, post-worker-209 root-cause audit accepted, selected numeric style finite validation integrated, post-worker-211 root-cause audit accepted, numeric Yoga layout finite validation integrated, post-worker-213 root-cause audit accepted, and matrix/transform finite validation integrated

Latest accepted implementation: worker 214 added deterministic native
finite-number validation for `style.matrix` array / `SkMatrix` payloads and
`style.transform` operation leaves, with generated materialized proof that
non-finite matrix/transform values reject before prior style, matrix, paint,
Yoga, clip/radius, layer, or computed-layout state mutates.

Previous accepted implementation: worker 212 added deterministic native
finite-number validation for numeric Yoga layout style fields and generated
materialized proof that non-finite values reject before prior layout, style,
paint, Yoga, clip, layer, or matrix state mutates.

Earlier accepted implementation: worker 210 added deterministic native
finite-number validation for selected numeric paint/border style fields and
generated materialized proof that non-finite values reject before prior style,
paint, Yoga, clip, layer, or matrix state mutates.

Prior accepted implementation: worker 208 added deterministic native
`style.backgroundColor` string validation and generated materialized proof for
valid CSS strings, invalid-string rejection, and prior style/paint
preservation.

Prior accepted implementation: worker 206 added deterministic native Yoga
layout unit string validation and generated materialized positive/negative
proof for valid percentages, allowed `auto`, width-only special strings, and
unsupported or malformed strings.

Prior accepted audit: worker 209 accepted Worker 208's deterministic
`style.backgroundColor` string validation boundary and selected deterministic
finite-number validation for native style scalars as the next strongest
locally unblocked target.

Previous accepted root-cause audit: worker 211 accepted Worker 210's selected
numeric finite validation boundary and selected finite-number validation for
remaining numeric Yoga layout style fields as the next strongest locally
unblocked target.

Latest accepted root-cause audit: worker 213 accepted Worker 212's numeric
Yoga layout finite validation boundary and selected deterministic
finite-number validation for `style.matrix` array / `SkMatrix` payloads and
`style.transform` operation leaves as the next strongest locally unblocked
target.

Current active worker: none.

Goals:

- Keep example app compiling and representative.
- Add targeted demo screens only when they validate real capabilities.
- Verify package consumers can import and use supported entrypoints.
- Keep native build artifacts and generated files intentional.

Accepted audit:

- `worker-014-platform-runtime-readiness`: audited the example app runtime/build feedback loop. Full iOS/Android app verification is blocked locally because the example has no committed native project folders, CocoaPods is unavailable, Android SDK variables are unset, and Gradle/ADB/CMake/Ninja are absent from `PATH`. The managed Expo config introspection path succeeds, but `react-native config` is blocked by missing `@react-native-community/cli`, `expo install --check` reports Expo 55 dependency skew, and example typecheck fails before native generation.

Accepted implementation:

- `worker-015-example-workspace-readiness`: aligned the example dependency set to Expo SDK 55 expected versions, added the missing React Native CLI dependency required for `react-native config`, regenerated `example/bun.lock`, and fixed the example typecheck config so linked package source resolves peers from `example/node_modules` while preserving Expo-provided DOM globals.

Accepted native-generation verification:

- `worker-016-platform-native-verification`: verified that Expo CNG native project generation succeeds when invoked through Node, produced a NUL-free parseable iOS project, confirmed generated React Native config and Expo autolinking include `react-native-skia-yoga` on iOS and Android, and documented that full build/run verification is currently blocked by missing local CocoaPods, full Xcode selection, Java, Android SDK variables, and Android build tools.

Accepted package-hygiene implementation:

- `worker-017-package-plugin-hygiene`: proved that the missing `app.plugin.js` entry was stale package metadata rather than a real Expo config-plugin contract, then removed that entry from `package.json.files` while preserving the native autolinking surface.
- `worker-018-next-backlog-audit`: audited the post-worker-017 backlog, rechecked local toolchain blockers, verified the currently feasible package/example checks, and identified package install lifecycle hygiene as the strongest unblocked root-cause task.
- `worker-019-package-lifecycle-hygiene`: removed the consumer-facing root `postinstall`, kept local/example header sync explicit and guarded, moved codegen-only `nitrogen` out of runtime dependencies, and added package lifecycle verification proving a tarball consumer install succeeds with lifecycle scripts enabled and Bun hidden from `PATH`.
- `worker-020-next-root-cause-audit`: audited the post-lifecycle backlog, confirmed platform-native build/run remains locally blocked, and identified the `check:yoganode-native-runtime` archive discovery failure as the strongest unblocked root-cause task.
- `worker-021-runtime-smoke-archive-discovery`: restored and hardened `check:yoganode-native-runtime` by discovering the current optional-package RN Skia macOS archive layout, validating expected archive basenames before selection, and keeping the old in-package layout as a fallback.
- `worker-022-next-root-cause-audit`: audited the post-runtime-smoke backlog, confirmed the feasible package/native smoke checks are green, and identified Android RN Skia archive discovery in `android/CMakeLists.txt` as the strongest unblocked root-cause task.
- `worker-023-android-skia-archive-discovery`: fixed Android RN Skia static archive discovery by preferring the current `react-native-skia-android/libs/${ANDROID_ABI}` optional package layout, keeping the legacy fallback, validating expected archive basenames before linking, and adding `check:android-skia-archives`.
- `worker-024-next-root-cause-audit`: audited the post-worker-023 backlog, confirmed the feasible package/native checks are green, confirmed platform-native build/run remains locally blocked, and selected root `lint-ci` repair as the next unblocked repo-owned target.
- `worker-025-lint-ci-root-config`: added an explicit root ESLint config, resolved React Native lint plugins/parser relative to the installed React Native config package, removed the missing `@jamesacarr/github-actions` formatter from `lint-ci`, included `.mjs` verifier scripts in lint scope, and fixed the narrow source lint findings needed for `npm run lint-ci` to pass.
- `worker-026-next-root-cause-audit`: audited the post-worker-025 backlog, confirmed `lint-ci` now passes with 180 warnings, classified the warning backlog as 178 example warnings plus 2 product-source React Native deep-import warnings, confirmed platform-native work is still locally blocked, and selected the product-source deep imports as the next unblocked repo-owned target.
- `worker-027-react-native-deep-imports`: replaced the two product-source React Native deep imports in `src/specs/SkiaYogaViewNativeComponent.ts` with supported top-level `react-native` exports, kept `CodegenTypes` as a type-only import, verified Nitro artifacts were unchanged, and reduced `lint-ci` to the remaining 178 example/demo warnings.
- `worker-028-next-root-cause-audit`: audited the post-worker-027 backlog, confirmed all feasible package/native/example readiness checks are green, classified the 178 remaining lint warnings as all under `example/`, confirmed platform-native build/run remains locally blocked, and selected example lint-contract cleanup as the next unblocked repo-owned target.
- `worker-029-example-lint-contract`: scoped the example inline-style lint override to demo/typecheck fixture paths, fixed the root example shell inline style directly, hoisted stable tab icon renderers, preserved typecheck sentinel intent without `void`, removed stale Babel config plumbing, and brought `npm run lint-ci` to 0 warnings and 0 errors.
- `worker-030-next-root-cause-audit`: audited the post-lint-clean backlog, confirmed the feasible checks remain green, confirmed platform-native build/run remains locally blocked, and selected public README/API documentation drift as the next unblocked repo-owned target.
- `worker-031-readme-api-contract`: documented consumer peer dependencies and the required `jsxImportSource: "react-native-skia-yoga"` TypeScript setup for lowercase intrinsic nodes, corrected stale Nitro package metadata URLs to `SamuelScheit/react-native-skia-yoga`, verified no runtime/type shim changes were needed, and proved package lifecycle verification still passes.
- `worker-032-next-root-cause-audit`: audited the post-worker-031 backlog, confirmed the feasible checks remain green, and selected native package publish-surface completeness as the next unblocked repo-owned target because the packed npm manifest omits `cpp/` while iOS and Android native build metadata requires it.
- `worker-033-native-publish-surface`: added `cpp/` and the Android `fix-prefab.gradle` helper to the packed npm surface, corrected the podspec source URL, and added `check:package-surface` to assert required native/package files in the `npm pack --dry-run --json --ignore-scripts` manifest.
- `worker-034-next-root-cause-audit`: audited the post-worker-033 backlog, confirmed the feasible package/native/example checks remain green, and selected example JS bundle feedback-loop hygiene as the next unblocked repo-owned target because the working Expo export path is not guarded by a repo script and `example/metro.config.js` dumps the full Metro config.
- `worker-035-example-bundle-smoke`: added `check:example-bundle`, implemented a bounded temp-dir Expo iOS export verifier, removed the Metro config dump, and verified cleanup plus the core package/type/lint/spec checks.
- `worker-036-post-035-root-cause-audit`: audited the post-worker-035 backlog, confirmed the full feasible package/native/example matrix remains green, and selected `src/YogaCanvas.tsx` RN Skia private import cleanup as the next unblocked repo-owned target because the current native-ID import only works through Metro's TypeScript source resolution and fails Node extensionless resolution.
- `worker-037-yogacanvas-skia-import-cleanup`: removed `src/YogaCanvas.tsx` RN Skia private/deep imports, added repo-owned native-ID allocation, and added `check:rn-skia-imports` to guard tracked source against RN Skia `src/`, `lib/typescript/src/`, and private `SkiaViewNativeId` deep paths.
- `worker-038-post-037-root-cause-audit`: audited the post-worker-037 state, confirmed the feasible package/native/example matrix remains green with `check:rn-skia-imports`, and selected packed-package TypeScript consumer smoke coverage as the next unblocked repo-owned target because existing checks do not compile public entrypoints and lowercase JSX from an installed tarball consumer.
- `worker-039-package-typescript-consumer-smoke`: added `check:package-typescript-consumer`, which packs the package to a real tarball, installs it into a temporary external TypeScript consumer, compiles public entrypoints and lowercase intrinsic JSX under `jsxImportSource: "react-native-skia-yoga"`, and cleans all temporary output.
- `worker-040-post-039-root-cause-audit`: audited the post-worker-039 state, confirmed the feasible package/native/example matrix remains green with the packed-package TypeScript consumer smoke, reproduced the external-consumer failure without `@types/react-reconciler`, and selected package-surface dependency hygiene around direct `react-reconciler` imports and type declarations as the next unblocked repo-owned target.
- `worker-041-reconciler-dependency-hygiene`: made the direct `react-reconciler` package contract explicit by publishing `react-reconciler` and `@types/react-reconciler`, removed the packed-consumer verifier's consumer-side `@types/react-reconciler` workaround, and proved the external packed TypeScript consumer still compiles.
- `worker-042-post-041-root-cause-audit`: audited the post-worker-041 state, confirmed dependency hygiene is closed with the full feasible matrix green, confirmed platform-native build/run remains externally blocked, and selected public declaration/export boundary cleanup as the next unblocked repo-owned target.
- `worker-043-public-declaration-export-boundary`: replaced top-level wildcard/source-barrel declarations and exports with explicit public allowlists for `YogaCanvas`, `YogaCanvasProfileSample`, JSX/style/prop types, and interaction event/handler types; moved `YogaNodeFinal` to an internal source module; kept JSX runtime/dev-runtime declarations compatible with `jsxImportSource`; and added package-surface plus packed-consumer negative checks for accidental internal top-level exports.
- `worker-044-post-043-root-cause-audit`: audited the post-worker-043 state, confirmed the full feasible matrix remained green, verified the new public boundary and packed-consumer negative checks, reconfirmed platform-native build/run is externally blocked by local toolchain prerequisites, and selected `src/SkiaYogaObject.ts` import-time native/global side effects as the next strongest unblocked repo-owned target.
- `worker-045-skia-yoga-object-lazy-init`: replaced import-time `SkiaYoga` native lookup/install/hybrid creation/logging/global mutation with an explicit lazy `getSkiaYoga()` accessor, updated `YogaCanvas` runtime call sites to use that accessor, removed the unsupported global write, and added `check:skia-yoga-object-lazy-init` to prove import-only public source access is free of those side effects while explicit access initializes exactly once.
- `worker-046-post-045-root-cause-audit`: audited worker 045, confirmed the feasible matrix stayed green, documented the verifier's intentional `src/util.ts` stub limit, reconfirmed local platform-native blockers, and selected `src/util.ts` top-level `NitroModules.box(NitroModules)` as the next strongest unblocked supported public import-path target.
- `worker-047-util-lazy-nitro-box`: moved `src/util.ts` Nitro boxing behind a lazy cached accessor, removed the verifier's `src/util.ts` public-import stub, added negative public import-only checks for Nitro boxing/unboxing and native/global side effects, and proved explicit `createYogaNode()` plus `YogaCanvas` root creation still create YogaNode hybrid objects lazily.
- `worker-048-post-047-root-cause-audit`: confirmed worker 047 closed the public import-time Nitro boxing target, reran the full feasible matrix, reconfirmed platform-native app build/run remains locally blocked, and selected a repo-owned Worklets transform/closure guard for `src/util.ts` as the next strongest unblocked target.
- `worker-049-util-worklets-closure-guard`: added a repo-owned Worklets transform guard to `check:skia-yoga-object-lazy-init`, asserting transformed `createYogaNode()` keeps `createYogaNode.__closure` exactly on `lazyNitroModulesBox`, does not capture `NitroModules`, and keeps the Worklets body on `lazyNitroModulesBox.current.unbox()`; added direct verifier dev dependencies for Babel and `react-native-worklets`.
- `worker-050-post-049-root-cause-audit`: audited worker 049, confirmed it meaningfully closed the root transform-level lazy Nitro closure contract without proving device/UI-runtime Worklets behavior, reconfirmed local platform-native build/run blockers, and selected an example/Expo Babel-config Worklets transform guard for the package source path as the next strongest unblocked repo-owned target.
- `worker-051-example-worklets-transform-guard`: extended `check:skia-yoga-object-lazy-init` so package source `src/util.ts` is also transformed through `example/babel.config.js` with Babel resolved from the example package context, then asserted the same lazy Nitro closure/body contract as the root Worklets transform guard.
- `worker-052-post-051-root-cause-audit`: audited worker 051, accepted it as root plus example Babel/Expo transform proof without claiming device/UI-runtime Worklets or full native app proof, reconfirmed local platform-native blockers, and selected lazy-init public-import verifier hardening around the real public import graph and `codegenNativeComponent("SkiaYogaView")` registration as the next strongest unblocked repo-owned target.
- `worker-053-public-import-graph-verifier`: hardened `check:skia-yoga-object-lazy-init` so the harness loads the real public project import graph, counts exactly one `codegenNativeComponent("SkiaYogaView")` registration, asserts `NativeSkiaYoga` is not loaded by supported public imports, and preserves the existing lazy Nitro/Worklets/native side-effect checks.
- `worker-054-post-053-root-cause-audit`: audited worker 053, accepted it as closing the public-import verifier gap, reconfirmed feasible checks and local platform-native blockers, and selected codegen-compatible hardening for the direct `src/specs/NativeSkiaYoga.ts` deep-import path as the strongest remaining unblocked repo-owned target.
- `worker-055-native-skiayoga-deep-import-harden`: made the direct runtime deep import of `src/specs/NativeSkiaYoga.ts` lazy by moving `TurboModuleRegistry.getEnforcing<Spec>("SkiaYoga")` behind explicit `install()` access, kept the file codegen-compatible, and extended `check:skia-yoga-object-lazy-init` to prove the direct import path is inert until invocation.
- `worker-056-post-055-root-cause-audit`: audited the post-worker-055 state, accepted the deep-import hardening proof boundaries, reran the feasible matrix, and selected an automated React Native codegen schema verifier for `package.json.codegenConfig` plus `src/specs` as the next strongest unblocked target.
- `worker-057-rn-codegen-schema-verifier`: added `check:rn-codegen-schema`, a repo-owned verifier that reads `package.json.codegenConfig`, uses local React Native codegen to admit the configured spec files, asserts the exact `NativeSkiaYoga` NativeModule and `SkiaYogaView` component schema, and documents the intentionally ignored non-RN-codegen files under `src/specs`.
- `worker-058-post-057-root-cause-audit`: audited worker 057, accepted the local RN codegen schema proof boundary after a repair follow-up for the exact example typecheck evidence, reran the feasible matrix, reconfirmed local platform-native blockers, and selected broader Worklets transform verification for `src/Reconciler.ts` and `src/useCanvasGestures.ts` as the next strongest unblocked target.
- `worker-059-worklets-reconciler-gestures-transform-guard`: broadened `check:skia-yoga-object-lazy-init` so both the root Worklets transform and the example Babel/Expo transform assert transformed worklet markers, closure keys, embedded worklet code, `runOnJS` dispatches, gesture factory wiring, and animated binding paths for `src/Reconciler.ts` and `src/useCanvasGestures.ts`, without claiming device/UI-runtime proof.
- `worker-060-post-059-root-cause-audit`: audited worker 059, accepted it within the transform/closure proof boundary, reran the full feasible matrix, documented stalled nested challenger attempts without claiming challenger acceptance evidence, and selected source-level runtime verification for Reconciler animated binding state transitions as the next strongest unblocked target.
- `worker-061-reconciler-animated-binding-runtime-verifier`: added `check:reconciler-animated-bindings`, a source-level Node VM verifier that captures the Reconciler host config and exercises native vs JS animated command bindings, style listeners, native mirror updates, active/continuous-redraw toggles, `commitUpdate`, `detachDeletedInstance`, and `clearContainer` cleanup with local stubs.
- `worker-062-gesture-interaction-runtime-verifier`: added `check:gesture-interaction-runtime`, a source-level Node VM verifier for `YogaInteractionRegistry`, `useCanvasGestures`, and selected `YogaCanvas` gesture wiring with local React/RNGH/Reanimated/Worklets stubs.
- `worker-063-post-062-root-cause-audit`: audited the post-worker-062 state, confirmed the feasible matrix remains green while full platform-native proof is still locally blocked, and selected `YogaCanvas` lifecycle/render/profiling source-level runtime verification as the next strongest unblocked target.
- `worker-064-yogacanvas-lifecycle-runtime-verifier`: added `check:yogacanvas-lifecycle-runtime`, a source-level Node VM verifier for `YogaCanvas` lazy native IDs, root/container setup, layout effects, `onLayout`, bounded retry RAF, animation callbacks, profiling counters/native sample parsing/fallbacks/forced flush, and unmount cleanup with local stubs.
- `worker-065-post-064-root-cause-audit`: audited the post-worker-064 state, confirmed the feasible matrix remains green, documented that full native app/device proof remains locally blocked, and selected packed-package React Native codegen/autolinking verification from an installed tarball as the next strongest unblocked target.
- `worker-066-package-codegen-autolinking`: added `check:package-codegen-autolinking`, which packs the package, installs the tarball into an external temporary React Native consumer, proves the installed package is a real non-symlink copy outside the repo, runs RN codegen from the installed package specs, asserts the expected schema/files, and verifies iOS/Android React Native CLI autolinking metadata resolves from the installed package path.
- `worker-067-post-066-root-cause-audit`: audited the post-worker-066 state, confirmed the feasible package/source matrix remains green, documented stalled nested challenger attempts without claiming acceptance evidence, and selected a repo-owned Node-run Expo CNG/native-generation verifier as the next strongest unblocked target.
- `worker-068-example-native-generation-verifier`: added `check:example-native-generation`, a Node-run Expo CNG verifier that generates clean example iOS/Android native projects, asserts generated project/config/autolinking metadata for `react-native-skia-yoga`, cleans worker-owned generated output, and avoids native build/run overclaims.
- `worker-069-example-native-generation-preserve-local`: hardened `check:example-native-generation` to run Expo CNG/native generation in a verifier-owned temporary workspace, preserve pre-existing ignored local `example/ios`, `example/android`, and `example/.expo` artifacts, and add a sentinel probe that proves preservation without expanding the proof boundary beyond Node-run native generation and metadata/autolinking checks.
- `worker-070-post-069-root-cause-audit`: reran the full feasible matrix, confirmed worker 069's temp-workspace native-generation verifier and preservation probe are green, confirmed full native build/run remains locally blocked by platform prerequisites, and selected a repo-owned aggregate feasible-matrix verifier with cleanup accounting as the next strongest unblocked target.
- `worker-071-feasible-matrix-verifier`: added `check:feasible-matrix` and `scripts/verify-feasible-matrix.mjs`, a structured-spawn aggregate runner for the 22-command feasible local package/source/example matrix with explicit proof-boundary output and cleanup accounting for known temp/native/export/tarball/build-info artifacts.
- `worker-072-post-071-root-cause-audit`: reran the aggregate feasible matrix, reconfirmed local full native build/run blockers, found no stronger package/source feedback-loop gap, and selected a host-native `YogaNode::hitTestTagAt` / `hitTestInternal` verifier as the next strongest unblocked product-runtime target.
- `worker-073-yoganode-native-hit-testing`: added `check:yoganode-native-hit-testing`, a host-native verifier that compiles/links a probe against real `YogaNode.cpp`, Yoga, RN Skia macOS archives, and helper sources, then exercises native `hitTestTagAt` / `hitTestInternal` behavior for pointer events, z-order, layout coordinate translation, matrix inversion, clipping, hitSlop, precise-hit geometry, and interactive descendant count propagation; the verifier is included in `check:feasible-matrix`.
- `worker-074-post-073-root-cause-audit`: reran the 23-command feasible matrix, reconfirmed local full native build/run blockers, documented the remaining native bridge proof boundary, and selected host-native `SkiaYoga` / `RNSkYogaView` view-registry, render scheduling, and profiling verification as the next strongest unblocked product-runtime target.
- `worker-075-rnsk-yoga-view-runtime`: added `check:rnsk-yoga-view-runtime`, a host-native verifier that compiles/links a probe against real `SkiaYoga.cpp`, `RNSkYogaView.cpp`, `YogaNode.cpp`, generated Nitro specs, Yoga, RN Skia helper sources, and RN Skia macOS archives, then exercises view registry lookup, attach/request/animate/profile/detach behavior, dirty/idle/animating frame scheduling, profile serialization/reset, missing-view no-ops, and post-detach safety; the verifier is included in `check:feasible-matrix`.
- `worker-076-post-075-root-cause-audit`: audited the post-worker-075 state, confirmed worker 075 closed the native bridge gap within its host-native boundary, found aggregate `check:feasible-matrix` instability in a worker worktree while affected standalone commands passed, and selected feasible-matrix temp isolation and diagnostics hardening as the next strongest unblocked target.
- `worker-077-feasible-matrix-temp-isolation`: hardened `check:feasible-matrix` by giving each aggregate run a private `RNSKIA_YOGA_VERIFY_TEMP_PARENT`, making temp-root child verifiers honor that parent, removing shared temp-root scanning from aggregate cleanup, improving missing temp/linker/RN CLI dependency diagnostics, and reconfirming the 24-command matrix in worker and main worktrees.
- `worker-078-yoganode-jsi-raw-methods`: removed duplicate raw `setStyle` registration from `YogaNode`, kept generated `setStyle` as the JS-facing owner, added `check:yoganode-jsi-raw-methods`, and expanded the feasible matrix to 25 commands.
- `worker-079-post-078-root-cause-audit`: audited the post-worker-078 state, reconfirmed the 25-command feasible matrix and local platform-native blockers, accepted worker 078's proof boundary, and selected host-native YogaNode command/render verification as the next strongest unblocked target.
- `worker-080-yoganode-native-commands-render`: added `check:yoganode-native-commands-render`, a host-native verifier that compiles/links a probe against real `YogaNode.cpp`, generated Nitro specs, React Native JSC, Yoga, RN Skia macOS archives, and helper sources, then converts simple `NodeCommand` payloads through `JSIConverter<NodeCommand>::fromJSI(...)`, executes real `YogaNode::setCommand()`, renders `RectCmd`, `GroupCmd`, and `PointsCmd` through `renderToContext()`, asserts raster pixels, and expands `check:feasible-matrix` to 26 commands.
- `worker-081-post-080-root-cause-audit`: audited the post-worker-080 state, reconfirmed the 26-command feasible matrix and local platform-native blockers, accepted worker 080's proof boundary, and selected deterministic host-native command/render expansion beyond `rect`/`group`/`points` as the next strongest unblocked target.
- `worker-082-yoganode-more-native-commands-render`: expanded `check:yoganode-native-commands-render` to cover real `LineCmd`, `OvalCmd`, numeric/static `CircleCmd`, numeric/static `RRectCmd`, bounded `BlurMaskFilterCmd`, and real `RNSkia::JsiSkPath` host-object `PathCmd` conversion/rendering through `JSIConverter<NodeCommand>::fromJSI(...)`, `YogaNode::setCommand()`, and `renderToContext()` raster assertions.
- `worker-083-post-082-root-cause-audit`: audited the post-worker-082 state, reconfirmed the 26-command feasible matrix and local platform-native blockers, accepted worker 082's proof boundary, and selected bounded host-native `ImageCmd` command/render verification as the next strongest unblocked target.
- `worker-084-yoganode-image-command-render`: expanded `check:yoganode-native-commands-render` to cover a bounded real `ImageCmd` path using a synthetic in-memory `SkImage` wrapped in a real RN Skia `JsiSkImage` host object, converted through `JSIConverter<NodeCommand>::fromJSI(...)`, installed via `YogaNode::setCommand()`, rendered through `renderToContext()`, asserted `fit: "fill"` pixels/bounds, and rejected a plain-JS image object.
- `worker-085-post-084-root-cause-audit`: audited the post-worker-084 state, reconfirmed the 26-command feasible matrix and local platform-native blockers, accepted worker 084's proof boundary, and selected bounded host-native `TextCmd` plus `ParagraphCmd` command/render verification as the next strongest unblocked target.
- `worker-086-yoganode-text-paragraph-command-render`: expanded `check:yoganode-native-commands-render` to cover bounded real `TextCmd` and `ParagraphCmd` paths through `JSIConverter<NodeCommand>::fromJSI(...)`, `YogaNode::setCommand()`, paragraph Yoga measurement, and `renderToContext()` raster evidence without claiming exact typography, font fallback correctness, shaping fidelity, all styles, or platform-native rendering.
- `worker-087-post-086-root-cause-audit`: audited the post-worker-086 state, reconfirmed the 26-command feasible matrix and local platform-native blockers, accepted worker 086's proof boundary, and selected Nitro `YogaNode::toObject()` / prototype materialization plus generated JS-facing `YogaNode` method execution as the next strongest unblocked target.
- `worker-088-nitro-yoganode-materialization`: added `check:yoganode-nitro-materialization`, a host-JSC verifier that materializes a shared `YogaNode` through `toObject(runtime)`, asserts NativeState identity and cached JS object stability, invokes generated `setCommand`, `setStyle`, `computeLayout`, and `layout` wrappers from the materialized object, and expands `check:feasible-matrix` to 27 commands.
- `worker-089-animated-double-synchronizable`: fixed `AnimatedDouble` Worklets `SerializableJSRef` / `Synchronizable` validation to be stable outside assertion builds, added `check:animated-double-synchronizable`, proved bounded host-JSC/native dynamic value extraction and numeric resolution through RN Skia main-runtime state, and expanded `check:feasible-matrix` to 28 commands.
- `worker-090-animated-double-nodecommand`: expanded `check:yoganode-native-commands-render` to prove selected Worklets-backed dynamic `AnimatedDouble` props through `JSIConverter<NodeCommand>::fromJSI(...)` for `circle.radius`, `rrect.cornerRadius`, and `blurMaskFilter.blur`, including fallback, main-runtime resolution, mutation, render evidence, and dynamic raster-cache bypass.
- `worker-091-post-090-root-cause-audit`: audited the post-worker-090 state, accepted the prior worker-091 28-command feasible matrix evidence, reconfirmed local platform-native blockers, and selected dynamic `PathCmd` `trimStart` / `trimEnd` `AnimatedDouble` NodeCommand/render coverage as the strongest remaining unblocked target.
- `worker-092-dynamic-path-trim-nodecommand`: expanded `check:yoganode-native-commands-render` to prove Worklets-backed dynamic `AnimatedDouble` NodeCommand coverage for `path.trimStart` and `path.trimEnd`, including real `PathCmd` conversion/rendering, render-time fallback, main-runtime resolution, mutation observation, path-trim raster evidence, symmetric rejection cases, and dynamic raster-cache bypass.
- `worker-093-post-092-root-cause-audit`: audited the post-worker-092 state, reconfirmed the 28-command feasible matrix, and selected expanding `check:reconciler-animated-bindings` across every native-bound command prop as the next strongest unblocked target.
- `worker-094-reconciler-native-command-bindings`: expanded `check:reconciler-animated-bindings` to cover every current source-whitelisted native command binding prop, added a TypeScript AST drift guard for `supportsNativeCommandBinding(...)`, and kept the proof boundary to Node VM source-level Reconciler stubs.
- `worker-095-post-094-root-cause-audit`: audited the post-worker-094 state, reconfirmed the 28-command feasible matrix, and selected the public `path.stroke` payload contract, especially `StrokeOpts.miter_limit`, as the next strongest unblocked target.
- `worker-096-path-stroke-contract`: fixed the public `path.stroke` payload contract by accepting canonical `stroke.miter_limit` with deterministic `miterLimit` fallback, making `StrokeOpts.toJSI(...)` emit public `miter_limit`, and expanding `check:yoganode-native-commands-render` with public-shaped `PathCmd` stroke conversion, installation, state, raster, alias, and rejection coverage.
- `worker-097-post-096-root-cause-audit`: audited the post-worker-096 state, reconfirmed the 28-command feasible matrix, and selected source-level Reconciler JS-mode animated command coverage across representative root and nested command props as the next strongest unblocked target.
- `worker-098-reconciler-js-mode-command-bindings`: expanded `check:reconciler-animated-bindings` with table-driven JS command listener cases for native-disabled `circle.radius`, unsupported-native `group.rasterize`, nested `line.from.x`, post-worker-096 `path.stroke.miter_limit`, and nested-array `points.points.0.x`, while preserving the native mirror whitelist table and Node VM source-level proof boundary.
- `worker-099-post-098-root-cause-audit`: audited the post-worker-098 state, reconfirmed the 28-command feasible matrix, and selected host-JSC Nitro-materialized generated `YogaNode.setCommand(...)` breadth beyond `group` as the next strongest unblocked target.
- `worker-100-nitro-setcommand-breadth`: expanded `check:yoganode-nitro-materialization` with fresh materialized generated-wrapper cases for `line.from` / `line.to`, `points.points`, and public-shaped `path.stroke.miter_limit` using a real `JsiSkPath` host object, while preserving existing generated `setCommand(group)`, `setStyle`, `computeLayout`, and `layout` coverage.
- `worker-101-post-100-root-cause-audit`: audited the post-worker-100 state, reconfirmed the 28-command feasible matrix, and selected synthetic `ImageCmd` fit-mode/default/invalid coverage in `check:yoganode-native-commands-render` as the next strongest unblocked target.
- `worker-102-image-fit-coverage`: expanded `check:yoganode-native-commands-render` with synthetic non-square `JsiSkImage` cases for all accepted image fit strings, omitted/default `contain`, helper fit-rect geometry, bounded raster evidence, and invalid-fit rejection.
- `worker-103-post-102-root-cause-audit`: audited the post-worker-102 state, reconfirmed the 28-command feasible matrix, and selected bounded `TextCmd` / `ParagraphCmd` CSS color-string command conversion/render coverage in `check:yoganode-native-commands-render` as the next strongest unblocked target.
- `worker-104-text-paragraph-css-color`: expanded `check:yoganode-native-commands-render` with bounded `TextCmd` / `ParagraphCmd` CSS color-string conversion, installed command state, raster evidence, named-color conversion, invalid color rejection, and host linkage for RN Skia's CSS color parser.
- `worker-105-post-104-root-cause-audit`: audited the post-worker-104 state, reconfirmed the 28-command feasible matrix, and selected generated materialized `YogaNode.setCommand(...)` breadth in `check:yoganode-nitro-materialization` as the next strongest unblocked target.
- `worker-106-nitro-setcommand-more-breadth`: expanded `check:yoganode-nitro-materialization` with generated materialized `setCommand(...)` wrapper coverage for `text`, `paragraph`, `circle`, `rrect`, `blurMaskFilter`, `rect`, `oval`, and synthetic `image`, while preserving existing group/line/points/path/style/layout materialization coverage.
- `worker-107-post-106-root-cause-audit`: audited the post-worker-106 state, reconfirmed the 28-command feasible matrix, and selected direct `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)` / `fromJSI(...)` consistency as the next strongest unblocked target.
- `worker-108-strokeopts-converter-contract`: aligned direct `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)` with `fromJSI(...)` by rejecting top-level `null` and `undefined`, while preserving public `path.stroke` omitted/null behavior at the command parser layer and adding focused verifier coverage.
- `worker-109-post-108-root-cause-audit`: audited the post-worker-108 state, reconfirmed the 28-command feasible matrix, and selected the public TypeScript dynamic command payload boundary plus packed dynamic JSX proof as the next strongest unblocked target.
- `worker-110-dynamic-jsx-type-boundary`: kept `src/specs/*` command payload types transport-shaped, expanded the packed TypeScript consumer verifier with dynamic `SharedValue` JSX command-prop coverage, and hardened top-level public-boundary negatives for command transport internals.
- `worker-111-post-110-root-cause-audit`: audited the post-worker-110 state, reconfirmed the 28-command feasible matrix, and selected guarding published `src/specs/*` deep imports / package export-boundary hardening as the next strongest unblocked target.
- `worker-112-package-export-boundary`: added an exact package `exports` map for the root, JSX runtime subpaths, JSX dev-runtime subpath, and `package.json`; kept `src/specs/*` physically packed for codegen/autolinking; and added exports-aware packed-consumer and package-surface checks that reject representative `src/specs` deep imports while preserving supported entrypoints.
- `worker-113-nodecommand-tojsi-symmetry`: completed `JSIConverter<NodeCommand>::toJSI(...)` payload serialization for `blurMaskFilter`, `image`, `path`, `paragraph`, `line`, and `points`, and expanded the host-JSC/native command/render verifier with representative payload-shape and `toJSI(...)`/`fromJSI(...)` round-trip coverage.
- `worker-114-post-113-root-cause-audit`: audited the post-worker-113 state, reconfirmed the 28-command feasible matrix, and selected materialized `YogaNode.getChildren()` return identity/prototype coverage as the next strongest locally unblocked target.
- `worker-115-yoganode-getchildren-materialization`: made `YogaNode::getChildren()` explicitly materialize returned children through `toObject(runtime)`, hardened the stale YogaNode shared-pointer converter away from NativeState-only wrappers, and expanded `check:yoganode-nitro-materialization` with returned-child identity/prototype/raw/generated-method coverage.
- `worker-116-post-115-root-cause-audit`: audited the post-worker-115 state, reconfirmed the 28-command feasible matrix, and selected whole `SharedValue<SamplingOptions>` support for opaque union-shaped `image.sampling`.
- `worker-117-sampling-sharedvalue-type-boundary`: widened public `YogaImageProps.sampling` for whole `SharedValue<SamplingOptions>`, kept narrower branch-specific support, removed redundant global JSX augmentation in favor of the documented JSX runtime contract, and added packed-consumer plus Reconciler verifier coverage.
- `worker-118-post-117-root-cause-audit`: audited worker 117's accepted proof boundary, reconfirmed the full 28-command feasible matrix, and selected value-bearing `toJSI(...)` serialization for `SkSamplingOptions`, `TextStyle`, and `ParagraphStyle`.
- `worker-119-value-bearing-style-tojsi`: added selected value-bearing `toJSI(...)` serialization for sampling, text style, and paragraph style, plus host-native direct converter and NodeCommand round-trip proof.
- `worker-120-post-119-root-cause-audit`: audited the post-worker-119 state, accepted the new proof boundary, and selected canonical `style.antiAlias` support with legacy `antiaAlias` alias/precedence proof.
- `worker-121-canonical-antialias-style`: added canonical public `style.antiAlias`, preserved deprecated `style.antiaAlias` fallback with canonical precedence, updated public examples/verifier fixtures, and proved generated/native style transport plus SkPaint anti-alias state.
- `worker-122-post-121-root-cause-audit`: audited worker 121's accepted proof boundary, reconfirmed the full 28-command feasible matrix, and selected bounded additional `TextStyle` `toJSI(...)` serialization.
- `worker-123-textstyle-tojsi-serialization`: added bounded additional `TextStyle` serialization for selected parsed fields and expanded host-native direct converter plus `NodeCommand` round-trip proof.
- `worker-124-post-123-root-cause-audit`: audited worker 123's accepted proof boundary, reconfirmed the full 28-command feasible matrix, and selected bounded `TextStyle.fontFeatures` serialization.
- `worker-125-textstyle-fontfeatures-tojsi`: added bounded `TextStyle.fontFeatures` serialization as public-shaped `{ name, value }` entries, omitted empty feature arrays, and expanded direct `TextStyle`, `text.textStyle`, and flattened `paragraph.paragraphStyle` round-trip proof.
- `worker-126-post-125-root-cause-audit`: audited the post-worker-125 state, reconfirmed the full 28-command feasible matrix, and selected bounded `ParagraphStyle` scalar serialization for `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`.
- `worker-127-paragraphstyle-scalar-tojsi`: added bounded `ParagraphStyle` scalar serialization for `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`, and expanded direct plus representative `paragraph.paragraphStyle` round-trip proof.
- `worker-128-post-127-root-cause-audit`: audited the post-worker-127 state, reconfirmed the full 28-command feasible matrix, and selected bounded `ParagraphStyle.strutStyle` parser/serializer coverage including a local `fontFamilies` parser overlay.
- `worker-129-paragraphstyle-strutstyle-tojsi`: added bounded `ParagraphStyle.strutStyle` parser/serializer coverage, including a local `strutStyle.fontFamilies` overlay and direct plus representative command round-trip proof.
- `worker-130-post-129-root-cause-audit`: audited the post-worker-129 proof surface, reconfirmed the full 28-command feasible matrix, and selected unsupported public `fontVariations` contract closure.
- `worker-131-fontvariations-contract`: removed unsupported `fontVariations` from the public Yoga text/paragraph style authoring contract and added packed-consumer TypeScript negatives plus host-JSC/native rejection proof.
- `worker-132-post-131-root-cause-audit`: audited the post-worker-131 proof surface, reconfirmed the full 28-command feasible matrix, and selected simple `<text textStyle>` contract closure.
- `worker-133-simple-textstyle-contract`: narrowed simple `<text textStyle>` authoring to rendered fields, added text-command-only native rich-key rejection, and preserved rich paragraph/direct text-style conversion.
- `worker-134-post-133-root-cause-audit`: audited the post-worker-133 proof surface, reconfirmed the full 28-command feasible matrix, and selected nested `paragraphStyle.textStyle` CSS string/color parsing proof and fix.
- `worker-135-nested-paragraph-textstyle-color`: fixed nested `paragraphStyle.textStyle` CSS color parsing, added package/native/render/Nitro proof, and preserved flattened-over-nested paragraph text-style precedence.
- `worker-136-post-135-root-cause-audit`: audited the post-worker-135 proof surface, reconfirmed the full 28-command feasible matrix, and selected dynamic nested `paragraphStyle.textStyle` package/Reconciler proof for `SharedValue` leaves.
- `worker-137-dynamic-paragraph-textstyle-reconciler`: added packed TypeScript and Reconciler JS-mode listener proof for dynamic nested `paragraphStyle.textStyle.color` and `fontSize` `SharedValue` leaves.
- `worker-138-post-137-root-cause-audit`: audited the post-worker-137 proof surface, reconfirmed the full 28-command feasible matrix, and selected nested `ParagraphStyle::toJSI(...)` outbound shape preservation.
- `worker-139-paragraph-tojsi-nested-textstyle`: added dual flat/nested `ParagraphStyle::toJSI(...)` output and direct/paragraph-command round-trip proof for distinct paragraph/text-style `heightMultiplier` values.
- `worker-140-post-139-root-cause-audit`: audited the post-worker-139 proof surface, reconfirmed the full 28-command feasible matrix, and selected README/API docs for the simple text versus rich paragraph styling split.
- `worker-141-readme-text-paragraph-docs`: documented the simple `<text textStyle>` versus rich `<paragraph paragraphStyle>` styling split in the README, including nested `paragraphStyle.textStyle` usage and unsupported `fontVariations` boundaries.
- `worker-142-post-141-root-cause-audit`: audited the post-worker-141 proof surface, reconfirmed the full 28-command feasible matrix, and selected the example-owned nested paragraph type/demo refresh.
- `worker-143-example-nested-paragraph-demo`: refreshed example type/demo coverage to use nested `paragraphStyle.textStyle` while keeping simple `<text textStyle>` examples limited to `fontSize`/`color`.
- `worker-144-post-143-root-cause-audit`: audited the post-worker-143 proof surface, reconfirmed the full 28-command feasible matrix, and selected bounded style serializer field-inventory/proof-boundary cleanup.
- `worker-145-style-serializer-inventory`: added an installed RN Skia style/sampling public-field inventory and tightened native command/render verifier proof-boundary output.
- `worker-146-post-145-root-cause-audit`: audited the post-worker-145 proof surface, reconfirmed the full 28-command feasible matrix, and selected SkPaint-backed `backgroundColor` ordering for explicit style paint fields.
- `worker-147-paint-background-ordering`: fixed SkPaint-backed `backgroundColor` ordering for explicit style paint fields and added host-native precedence proof.
- `worker-148-post-147-root-cause-audit`: audited the post-worker-147 proof surface, reconfirmed the full 28-command feasible matrix, and selected bounded `style.layer` / `_layerPaint` generated transport and render proof.
- `worker-149-layer-paint-proof`: added bounded `style.layer` / `_layerPaint` generated transport, materialized wrapper, packed TypeScript authoring, and host-native saveLayer raster proof.
- `worker-150-post-149-root-cause-audit`: audited the post-worker-149 proof surface, reconfirmed the full 28-command feasible matrix, and selected dynamic `style.layer` / opaque style `SharedValue` public source-path proof.
- `worker-151-dynamic-layer-style-proof`: added packed-consumer and Reconciler source-level proof for dynamic `style.layer`, `style.opacity`, and whole-style `SharedValue` delivery through the public JSX style path.
- `worker-152-post-151-root-cause-audit`: accepted the post-worker-151 proof surface, reconfirmed the full 28-command feasible matrix, and selected generated materialized `YogaNode.setStyle(...)` paint-field breadth.
- `worker-153-materialized-style-paint-breadth`: expanded `check:yoganode-nitro-materialization` with generated materialized `setStyle(...)` coverage for SkPaint-backed `backgroundColor`, `borderWidth`, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`, `opacity`, `blendMode`, public paint-field override state, and Yoga border state.
- `worker-154-post-153-root-cause-audit`: accepted Worker 153's proof boundary, reconfirmed the full 28-command feasible matrix, and selected generated materialized `setStyle(...)` coverage for `clip`, `matrix`, `transform`, and `invertClip`.
- `worker-155-materialized-clip-matrix-transform`: expanded `check:yoganode-nitro-materialization` with generated materialized `setStyle(...)` proof for `clip` path/rect/rrect, `matrix`, `transform`, transform-over-matrix precedence, and `invertClip`.
- `worker-156-post-155-root-cause-audit`: accepted Worker 155's proof boundary, reconfirmed the full 28-command feasible matrix, and selected generated materialized 16-value `style.matrix` array conversion.
- `worker-157-materialized-matrix16`: expanded `check:yoganode-nitro-materialization` with generated materialized `setStyle(...)` proof for public 16-value `style.matrix` arrays, including native `_style.matrix` and `_matrix` state.
- `worker-158-post-157-root-cause-audit`: accepted Worker 157's proof boundary, documented the SkMatrix converter branch nuance, and selected materialized `transform: []` matrix suppression as the next target.
- `worker-159-transform-empty-matrix`: fixed empty public `transform: []` so it falls back to `style.matrix` when present, preserves non-empty transform precedence, and added generated materialized `setStyle(...)` proof for the fallback state.
- `worker-160-post-159-root-cause-audit`: accepted Worker 159's proof boundary, documented that `transform: []` with no matrix is source-proven but not separately materialized, and selected table-driven generated materialized transform-operation breadth as the next target.
- `worker-161-materialized-transform-breadth`: expanded generated materialized `setStyle(...)` transform proof across all public single-transform variants and added explicit empty-transform/no-matrix reset proof.
- `worker-162-post-161-root-cause-audit`: accepted Worker 161's proof boundary, reconfirmed the full 28-command feasible matrix, and selected bounded transform composition render/hit-test proof as Worker 163's target.
- `worker-163-transform-composition-runtime`: added bounded host-native proof that composed public transform arrays affect hit-test inversion and raster rendering through `YogaNode::_matrix`.
- `worker-164-post-163-root-cause-audit`: accepted Worker 163's proof boundary, reconfirmed the relevant focused checks and full 28-command feasible matrix, and selected public/Reconciler transform authoring proof as Worker 165's target.
- `worker-165-transform-public-reconciler-proof`: added packed-consumer static and dynamic `style.transform` authoring proof plus Reconciler source-level listener/update/cleanup proof for nested and whole-transform SharedValues.
- `worker-166-post-165-root-cause-audit`: accepted Worker 165's proof boundary, reconfirmed the focused/post-merge evidence and local platform blockers, and selected transform variant breadth/drift guarding as Worker 167's target.
- `worker-167-transform-variant-drift-guard`: added source-level public `Transform` operation inventory extraction, expanded packed-consumer and Reconciler nested transform `SharedValue<number>` coverage to every current public transform operation key, and added verifier drift assertions.
- `worker-168-post-167-root-cause-audit`: accepted Worker 167's proof boundary, reconfirmed the focused/full-matrix evidence and local platform blockers, and selected whole `style.matrix` `SharedValue` public/Reconciler proof as Worker 169's target.
- `worker-169-matrix-sharedvalue-proof`: added packed-consumer whole `style.matrix` `SharedValue` 9-/16-value authoring proof, packed/Reconciler nested matrix `SharedValue<number>` rejection proof, and Reconciler whole-matrix listener/update/cleanup proof.
- `worker-170-post-169-root-cause-audit`: accepted Worker 169's proof boundary, reconfirmed the focused/full-matrix evidence and local platform blockers, and selected dynamic style corner-radius public/Reconciler proof as Worker 171's target.
- `worker-171-corner-radius-dynamic-proof`: added packed-consumer and Reconciler source-level proof for dynamic `style.borderTopLeftRadius` corner-radius values, including whole `SharedValue<number>`, whole `SharedValue<SkPoint>`, nested `{ x, y }` SharedValue leaves, cleanup/late-emit behavior, no native mirror, and invalid-shape errors.
- `worker-172-post-171-root-cause-audit`: accepted Worker 171's proof boundary, reconfirmed the focused/full-matrix evidence and local platform blockers, and selected generated/native style corner-radius proof as Worker 173's target.
- `worker-173-native-corner-radius-proof`: added materialized generated `setStyle(...)` proof for all four SkPoint-capable style corner keys, native `_clipToBoundsRadii` mapping, explicit clip separation, and bounded hit-test clipping proof.
- `worker-174-post-173-root-cause-audit`: accepted Worker 173's generated/native style corner-radius proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected bounded raster evidence for style corner-radius clipping as Worker 175's target.
- `worker-175-style-corner-radius-raster-proof`: added bounded host-native raster proof that style corner radii clip a full-size child through `YogaNode::renderToContext()`, while remaining distinct from explicit clips and `RRectCmd::cornerRadius`.
- `worker-176-post-175-root-cause-audit`: accepted Worker 175's bounded host-native style corner-radius raster proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected JS/Reconciler corner-radius completion as Worker 177's target.
- `worker-177-corner-radius-js-reconciler-completion`: added a shared corner-radius source-inventory guard, expanded packed TypeScript coverage to all four dynamic corner keys, and added Reconciler scalar `SharedValue<number>` cases for all four keys.
- `worker-178-post-177-root-cause-audit`: accepted Worker 177's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected global `style.borderRadius` scalar host-raster proof as Worker 179's target.
- `worker-179-border-radius-raster-proof`: added bounded host-native raster proof that global `style.borderRadius` seeds all four clip radii and clips a full-size child through `YogaNode::renderToContext()`.
- `worker-180-post-179-root-cause-audit`: accepted Worker 179's host-raster proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected generated materialized delivery plus native hit-test coverage for global `style.borderRadius`.
- `worker-181-border-radius-materialized-hit-test`: added generated materialized `setStyle({ borderRadius })` delivery proof plus direct native hit-test proof for scalar global `style.borderRadius`.
- `worker-182-post-181-root-cause-audit`: accepted Worker 181's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected public/Reconciler dynamic-contract proof for scalar global `style.borderRadius`.
- `worker-183-border-radius-dynamic-contract`: added public packed TypeScript and Reconciler source-level dynamic-contract proof for scalar global `style.borderRadius`, including invalid initial and late-emission runtime guard coverage.
- `worker-184-post-183-root-cause-audit`: accepted Worker 183's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected dynamic `style.clip` / `style.invertClip` public/Reconciler proof as Worker 185's target.
- `worker-185-clip-invertclip-dynamic-proof`: fixed the public `style.clip` union-member `SharedValue` type gap and added packed-consumer plus Reconciler source-level proof for dynamic top-level `style.clip` / `style.invertClip`.
- `worker-186-post-185-root-cause-audit`: accepted Worker 185's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected explicit `style.clip` rect/rrect/path plus `invertClip` raster proof as Worker 187's target.
- `worker-187-explicit-clip-raster-proof`: added bounded host-native raster proof for explicit `style.clip` rect/rrect/path plus `invertClip` through `YogaNode::renderToContext()`.
- `worker-188-post-187-root-cause-audit`: accepted Worker 187's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected generated materialized clip/invertClip to raster bridge proof as Worker 189's target.
- `worker-189-materialized-clip-raster-bridge`: added generated materialized `setStyle(clip rect/rrect/path, invertClip)` wrapper delivery to bounded `YogaNode::renderToContext()` raster proof.
- `worker-190-post-189-root-cause-audit`: accepted Worker 189's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected paired inverted rrect/path raster proof across direct native and generated materialized harnesses.
- `worker-191-inverted-rrect-path-raster-proof`: added direct and generated materialized inverted rrect/path raster proof, completing bounded inverted rect/rrect/path clip coverage.
- `worker-192-post-191-root-cause-audit`: accepted Worker 191's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected generated materialized Yoga layout breadth proof as Worker 193's target.
- `worker-193-materialized-layout-breadth`: expanded the generated materialized Nitro verifier with a compact flexbox/layout tree proof covering representative layout style delivery, selected native Yoga state, native computed layout, and generated `layout` getter output.
- `worker-194-post-193-root-cause-audit`: accepted Worker 193's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected overflow render/materialized bridge proof as Worker 195's target.
- `worker-195-overflow-render-materialized-bridge`: added bounded host-native and generated materialized overflow hidden/scroll delivery plus rectangular raster clipping proof through `YogaNode::renderToContext()`.
- `worker-196-post-195-root-cause-audit`: accepted Worker 195's proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected residual generated materialized layout edge/constraint breadth as Worker 197's target.
- `worker-197-materialized-layout-edge-breadth`: expanded the generated materialized Nitro verifier with residual layout edge/constraint breadth for align, wrap, direction, display, box sizing, min/max constraints, aspect ratio, start/end/top/bottom edges, percent values, auto values, display-none layout, selected native Yoga state, selected computed layout values, and generated `layout` getter output.
- `worker-198-post-197-root-cause-audit`: accepted Worker 197's bounded proof boundary, reconfirmed the focused materialization verifier and full feasible matrix, confirmed platform-native blockers remain, and selected public/Reconciler dynamic layout-style proof as Worker 199's target.
- `worker-199-dynamic-layout-style-proof`: added packed public TypeScript and Reconciler source-level proof for representative dynamic layout style fields, covering public JSX authoring, listener snapshots, full style rebuilds, invalidation, cleanup, ignored late emits, and no native command mirrors.
- `worker-200-post-199-root-cause-audit`: accepted Worker 199's bounded proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected dynamic layout-to-native Yoga setter update proof as Worker 201's target.
- `worker-201-layout-setter-update-proof`: added generated materialized same-node sequential `setStyle(...)` layout update/reset proof for native style optionals, selected Yoga getter state, `computeLayout(...)`, and generated `layout` getter output.
- `worker-202-post-201-root-cause-audit`: accepted Worker 201's bounded proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and selected exact public/Reconciler dynamic layout field alignment in the generated materialized sequential proof as Worker 203's target.
- `worker-203-layout-field-alignment-proof`: added same-node sequential generated materialized coverage for Worker 199's exact remaining dynamic layout edge-alias fields: `start`, `end`, `marginLeft`, `marginRight`, and `inset`.
- `worker-204-post-203-root-cause-audit`: accepted Worker 203's bounded proof boundary, reconfirmed focused/full-matrix evidence and local platform blockers, and found no concrete unblocked implementation target stronger than platform-runtime proof once tooling is available or a fresh audit-only gap search.
- `worker-205-fresh-unblocked-gap-audit`: identified deterministic Yoga layout unit string validation as a concrete locally unblocked target across public broad `Percentage = string`, generated `NodeStyle`, and native Yoga setter behavior.
- `worker-206-layout-unit-validation`: implemented deterministic native layout
  unit string validation, added generated materialized `setStyle(...)`
  positive/negative proof, and reconfirmed the full feasible matrix.
- `worker-207-post-206-root-cause-audit`: accepted Worker 206's proof
  boundary, reconfirmed local platform blockers, and selected deterministic
  `style.backgroundColor` string validation.
- `worker-208-backgroundcolor-string-validation`: implemented deterministic
  native `style.backgroundColor` string validation, added generated
  materialized state-preservation proof, and reconfirmed the full feasible
  matrix.
- `worker-209-post-208-root-cause-audit`: accepted Worker 208's proof
  boundary, reconfirmed the full feasible matrix and local platform blockers,
  and selected finite-number validation for native style scalars.
- `worker-210-numeric-style-finite-validation`: implemented deterministic
  pre-mutation finite-number validation for the border-width family,
  `strokeMiter`, and `opacity`, with generated materialized negative coverage
  proving non-finite rejection preserves prior `_style`, `_paint`, Yoga border,
  clip, layer, and matrix state.
- `worker-211-post-210-root-cause-audit`: accepted Worker 210's proof
  boundary, reconfirmed focused/full feasible verification, confirmed local
  platform-native blockers remain, and selected numeric Yoga layout finite
  validation as the next implementation target.
- `worker-212-layout-numeric-finite-validation`: implemented deterministic
  pre-mutation finite-number validation for direct numeric Yoga layout scalars
  and numeric branches of Yoga layout variants, with generated materialized
  coverage proving non-finite rejection preserves previous selected `_style`,
  Yoga getter, computed layout, paint, clip, layer, and matrix state.
- `worker-213-post-212-root-cause-audit`: accepted Worker 212's proof
  boundary, reconfirmed focused/full feasible verification and local
  platform-native blockers, and selected matrix/transform finite validation as
  the next implementation target.
- `worker-214-matrix-transform-finite-validation`: implemented deterministic
  pre-mutation finite-number validation for `style.matrix` array / `SkMatrix`
  payloads and `style.transform` operation leaves, with generated materialized
  proof that non-finite values preserve previous selected `_style`, `_matrix`,
  `_paint`, Yoga, clip/radius, layer, and computed-layout state.

Current active worker:

- None.

Next queued worker:

- Worker 215 post-worker-214 root-cause audit.
- Suggested worktree: `../worker-215-post-214-root-cause-audit`.
- Suggested branch: `worker/215-post-214-root-cause-audit`.
- Suggested agent path: `/root/worker_215_post_214_root_cause_audit`.
- Scope: independently audit Worker 214's matrix/transform finite validation
  proof boundary, rerun focused/full verification as appropriate, and select
  the next strongest locally unblocked root-cause target.

Follow-up queue:

- None until Worker 215 reports.

Acceptance criteria:

- Example app runs or has documented environment blockers.
- Published package metadata has no consumer lifecycle hook that depends on repo-local scripts or local workspace layout.
- A temporary tarball consumer install passes with scripts enabled and without Bun on `PATH`.
- A temporary packed-package TypeScript consumer compile passes against public entrypoints and the `jsxImportSource` lowercase intrinsic-node contract.
- Android/iOS build paths are verified to the extent available locally.
- Cleanup removes stale subagents, abandoned worktrees, and temporary build outputs.

## Open Questions for Workers

- Which current failures block the fastest useful feedback loop?
- Are the generated Nitro artifacts current with `src/specs/*`?
- Is Yoga ownership/lifetime safe across JS, C++, and native view teardown?
- Does the public JSX/runtime API match what React Native users will naturally import?
- Which unsupported style/command props should fail loudly versus be removed or redesigned?
