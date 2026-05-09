# Worker 026 Next Root-Cause Audit

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Audit the next unblocked root-cause target after lint-ci repair.`
- The original worker gathered the required matrix, lint-warning, platform-prerequisite, and example-readiness evidence. It launched a nested read-only explorer, but hit a Codex usage limit before a completed nested result or report.
- Finalizer worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 026 next root-cause audit report after usage exhaustion.`
- The finalizer used a smaller model because the original `gpt-5.5` worker had exhausted usage before completion. It recovered the original evidence, reran light checks, obtained a completed nested read-only challenge result, and then hit a usage limit before completing its own turn.
- This report was recovered by orchestration from the accepted tmux worker logs and the report draft after the finalizer failed only after the completed nested result/report stage.
- No product code was changed. The only intended repo change from this worker is this report file.

## Current baseline

- Required context reviewed:
  - [../ORCHESTRATOR.md](../ORCHESTRATOR.md)
  - [MASTER_PLAN.md](../MASTER_PLAN.md)
  - [MASTER_PROGRESS.md](../MASTER_PROGRESS.md)
  - [worker-progress/worker-024-next-root-cause-audit.md](worker-024-next-root-cause-audit.md)
  - [worker-progress/worker-025-lint-ci-root-config.md](worker-025-lint-ci-root-config.md)
  - [../worker-logs/worker-026-next-root-cause-audit.jsonl](../worker-logs/worker-026-next-root-cause-audit.jsonl)
- `npm run lint-ci` now passes with warnings instead of failing at config discovery.
- Live lint distribution from the current worktree:
  - 180 total warnings
  - 0 errors
  - 178 warnings in `example/`
  - 2 warnings in `src/`
- The only product-source warnings are in [`src/specs/SkiaYogaViewNativeComponent.ts`](../src/specs/SkiaYogaViewNativeComponent.ts).
- Those two warnings are `@react-native/no-deep-imports` on:
  - `react-native/Libraries/Utilities/codegenNativeComponent`
  - `react-native/Libraries/Types/CodegenTypes`
- The installed React Native typings already expose the supported top-level exports in `node_modules/react-native/types/index.d.ts`:
  - `export {default as codegenNativeComponent} ...`
  - `export * as CodegenTypes ...`
- Platform-native prerequisites are still machine-owned blockers, not repo-state blockers:
  - `xcode-select -p` => `/Library/Developer/CommandLineTools`
  - `pod` unavailable
  - Java runtime unavailable
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` unset
  - `adb`, `gradle`, `cmake`, and `ninja` unavailable
  - no tracked `example/ios` or `example/android`

## Candidate targets considered

- Option 1: fix only the two product-source React Native deep imports in `src/specs/SkiaYogaViewNativeComponent.ts`
  - Strongest repo-owned source target.
  - Smallest change that removes a public API contract drift.
  - Directly aligns the package source with the supported React Native surface.
- Option 2: clean the broader 178 example lint warnings
  - Large backlog, but it is overwhelmingly example/demo code.
  - This would mostly be symptom cleanup in the integration example, not the package contract.
- Option 3: pursue a different unblocked repo-owned target
  - I did not find a stronger unblocked repo-owned target than the two source warnings.
  - The package/native verifier matrix is green and the remaining platform work is machine-blocked.
- Option 4: wait for platform-native toolchain prerequisites
  - Not justified.
  - There is still unblocked repo-owned work in source control, so waiting would stall progress unnecessarily.

## Recommended next worker

- Objective: replace the deprecated React Native deep imports in [`src/specs/SkiaYogaViewNativeComponent.ts`](../src/specs/SkiaYogaViewNativeComponent.ts) with the supported top-level `react-native` exports, then verify the source still lints and typechecks cleanly.
- Likely owned files/modules:
  - [`src/specs/SkiaYogaViewNativeComponent.ts`](../src/specs/SkiaYogaViewNativeComponent.ts)
  - Only generated Nitrogen output if the spec change unexpectedly affects emitted artifacts
- Non-goals:
  - Do not clean the 178 example warnings in this worker.
  - Do not wait for CocoaPods, Java, Android SDK, Gradle, CMake, or Ninja to appear.
  - Do not broaden the fix into unrelated example/demo lint churn.
  - Do not touch runtime behavior beyond the import surface unless a verifier proves a real contract break.
- Suggested verification commands:
  - `npm run lint-ci`
  - `npm run typecheck`
  - `bun run specs`
  - `git diff --check`
- Why this is a root-cause target rather than a symptom patch:
  - The warnings point to public-source code importing deprecated internal React Native paths.
  - React Native 0.80.1 already exposes supported top-level exports, so the fix is to align the package source with the supported contract rather than preserve an internal dependency path.
  - Cleaning the 178 example warnings would mostly reduce demo backlog and would not address the package-level contract drift.

## Nested subagent results

- Original worker nested explorer was launched, but the log does not prove a completed result before the original worker hit a usage limit.
- Finalizer nested challenger completed and agreed with option 1: fix only the two product-source React Native deep imports in `src/specs/SkiaYogaViewNativeComponent.ts`.
- Evidence from the completed challenge and recovered finalizer checks:
  - `example/` owns 178 of 180 warnings.
  - `src/` owns exactly 2 warnings.
  - The two `src/` warnings are both `@react-native/no-deep-imports`.
  - The top-level React Native exports are already available in the installed types, so the warning is a real contract drift, not a missing capability.
- Disagreement:
  - None on the recommendation.
  - The only nuance was whether to treat the broad example backlog as a candidate target at all; I resolved that by ranking the public-source contract issue higher because it is smaller, repo-owned, and directly tied to the supported API surface.

## Verification/probe results

- `npm run lint-ci -- --format json -o /tmp/worker026-lint.json`
  - 180 warnings
  - 0 errors
  - 178 warnings under `example/`
  - 2 warnings under `src/`
- `./node_modules/.bin/eslint --resolve-plugins-relative-to ./node_modules/@react-native/eslint-config src/specs/SkiaYogaViewNativeComponent.ts -f json`
  - Confirmed the two `@react-native/no-deep-imports` warnings.
  - One warning is auto-fixable to `import {codegenNativeComponent} from 'react-native';`.
- `rg -n 'codegenNativeComponent|CodegenTypes' node_modules/react-native/types/index.d.ts ...`
  - Confirmed the supported top-level React Native exports are present.
- Platform probe:
  - `xcode-select -p` => `/Library/Developer/CommandLineTools`
  - `pod` missing
  - Java runtime missing
  - Android toolchain env vars unset
  - `adb`, `gradle`, `cmake`, and `ninja` missing
- `git diff --check`
  - Passed.
- `git ls-files example/ios example/android`
  - No tracked native example folders.

## Quality, maintainability, performance, security review

- Quality: fixing the deep imports removes a deprecated public-source dependency path and keeps the package aligned with the supported React Native surface.
- Maintainability: the source file becomes less coupled to internal RN library paths, which reduces upgrade fragility.
- Performance: no runtime performance change is expected from the import swap itself.
- Security: no direct security issue was found, but avoiding internal deep imports reduces supply-chain and upgrade ambiguity around unsupported entrypoints.

## Remaining risks/blockers

- The broad example warning backlog still exists and may need a separate follow-up.
- If React Native’s top-level export surface changes in a future upgrade, the spec file may need a corresponding update.
- Full native build/run work remains blocked by local machine prerequisites, so those checks should stay deferred until the environment is ready.

## Files changed

- [`worker-progress/worker-026-next-root-cause-audit.md`](worker-026-next-root-cause-audit.md)

## Final git status

- `## worker/026-next-root-cause-audit`
- `?? worker-progress/worker-026-next-root-cause-audit.md`
