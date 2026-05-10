# React Native Skia Yoga Master Plan

Last updated: 2026-05-10

## Mission

Build `react-native-skia-yoga` into a React Native C++ library that combines Yoga layout with Skia rendering for declarative, complex, animated, and interactive UI.

Breaking changes are acceptable when they remove root causes instead of preserving weak contracts.

## Operating Model

- The orchestrator owns planning, worker coordination, merge hygiene, and root-cause prioritization.
- Product code changes are delegated to isolated workers.
- Top-level workers must run as tmux-backed Codex subprocesses using separate git worktrees.
- Tool-managed or in-process agents are not valid replacements for top-level workers.
- The orchestrator must not call tool-managed worker/subagent tools for project work; nested subagents must be spawned and documented by tmux workers themselves.
- Every top-level worker must call `create_goal` before any planning, research, installs, tests, or edits.
- A worker is invalid unless its tmux log or progress report proves the initial `create_goal` call and exact objective.
- Workers must keep their own progress files under `worker-progress/`.
- Workers must review quality, maintainability, performance, and security before reporting completion.
- Workers must use nested subagents/explorers when testing uncertain root-cause hypotheses, and must document those subagent results in their progress files.
- Finished worker branches are reviewed, verified, merged into `main`, then their tmux session/worktree is cleaned up.

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

- Each accepted worker is a tmux worker with verified `create_goal` evidence.
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

Status: active; platform readiness audit accepted, prebuild-safe example workspace blockers fixed, Node-run CNG native generation verified, package metadata/install lifecycle hygiene resolved, Android RN Skia archive discovery fixed with source-level verification, root lint-ci configuration/formatter wiring repaired, React Native deep-import cleanup integrated, example lint-contract cleanup integrated, README/API contract drift fixed, native package publish-surface completeness fixed, example bundle feedback-loop hygiene fixed, post-worker-035 root-cause audit accepted, RN Skia private import cleanup integrated, post-worker-037 root-cause audit accepted, packed-package TypeScript consumer smoke coverage integrated, post-worker-039 root-cause audit accepted, `react-reconciler` package-surface dependency hygiene integrated, post-worker-041 root-cause audit accepted, public declaration/export boundary cleanup integrated, post-worker-043 root-cause audit accepted, `SkiaYogaObject` lazy initialization integrated, post-worker-045 root-cause audit accepted, `src/util.ts` Nitro boxing lazy-init integrated, post-worker-047 root-cause audit accepted, Worklets transform/closure verification integrated, post-worker-049 root-cause audit accepted, example/Expo Worklets transform verification integrated, public-import graph verifier hardening integrated, direct `NativeSkiaYoga` deep-import hardening integrated, post-worker-056 codegen-schema audit accepted, RN codegen schema verifier integrated, post-worker-058 root-cause audit accepted, Reconciler/gesture Worklets transform verification integrated, post-worker-060 root-cause audit accepted, Reconciler animated binding runtime verifier integrated, YogaCanvas gesture/interaction runtime verifier integrated, post-worker-062 root-cause audit accepted, YogaCanvas lifecycle runtime verifier integrated, post-worker-065 root-cause audit accepted, packed-package RN codegen/autolinking verification integrated, post-worker-067 root-cause audit accepted, example native-generation verifier integrated, local-artifact preservation hardening integrated, post-worker-069 root-cause audit accepted, aggregate feasible-matrix verifier integrated, post-worker-071 root-cause audit accepted, host-native YogaNode hit-testing verifier integrated, and post-worker-073 root-cause audit active

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

Current next step:

- Monitor active worker 074 post-worker-073 root-cause audit, then accept or reject it based on its tmux goal gate, report scope, 23-command feasible-matrix evidence, local toolchain blocker evidence, next-target reasoning, nested challenger documentation, and cleanup state.

Acceptance criteria:

- Example app runs or has documented environment blockers.
- Published package metadata has no consumer lifecycle hook that depends on repo-local scripts or local workspace layout.
- A temporary tarball consumer install passes with scripts enabled and without Bun on `PATH`.
- A temporary packed-package TypeScript consumer compile passes against public entrypoints and the `jsxImportSource` lowercase intrinsic-node contract.
- Android/iOS build paths are verified to the extent available locally.
- Cleanup removes stale worktrees, tmux sessions, logs, and temporary build outputs.

## Open Questions for Workers

- Which current failures block the fastest useful feedback loop?
- Are the generated Nitro artifacts current with `src/specs/*`?
- Is Yoga ownership/lifetime safe across JS, C++, and native view teardown?
- Does the public JSX/runtime API match what React Native users will naturally import?
- Which unsupported style/command props should fail loudly versus be removed or redesigned?
