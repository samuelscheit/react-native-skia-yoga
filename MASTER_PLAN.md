# React Native Skia Yoga Master Plan

Last updated: 2026-05-09

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

Status: second implementation wave integrated through native parent lifetime, reparenting fixes, focused native lifetime verifier coverage, and linked native runtime smoke coverage

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

Status: active; platform readiness audit accepted, prebuild-safe example workspace blockers fixed, Node-run CNG native generation verified, and package plugin hygiene resolved

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

Next root-cause target:

- Continue deeper platform-native build/run verification when local prerequisites are available.

Acceptance criteria:

- Example app runs or has documented environment blockers.
- Android/iOS build paths are verified to the extent available locally.
- Cleanup removes stale worktrees, tmux sessions, logs, and temporary build outputs.

## Open Questions for Workers

- Which current failures block the fastest useful feedback loop?
- Are the generated Nitro artifacts current with `src/specs/*`?
- Is Yoga ownership/lifetime safe across JS, C++, and native view teardown?
- Does the public JSX/runtime API match what React Native users will naturally import?
- Which unsupported style/command props should fail loudly versus be removed or redesigned?
