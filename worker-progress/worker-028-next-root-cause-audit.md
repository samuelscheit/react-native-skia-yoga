# Worker 028 Next Root-Cause Audit

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Audit the next unblocked root-cause target after React Native deep-import cleanup.`
- The original worker gathered the required verification/probe matrix, classified the lint backlog, and received a completed nested read-only challenger result, then hit a Codex usage limit before writing this report.
- Finalizer worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 028 next root-cause audit report after usage exhaustion.`
- The finalizer used a smaller model because the original `gpt-5.5` worker exhausted usage before completion. This finalizer recovered the accepted tmux log evidence and the completed nested challenger recommendation, then finished the report only.
- No product code was edited in this finalizer. The only intended repo change is this report file.

## Current baseline

- The feasible verification matrix remained green in the original worker log:
  - `npm run lint-ci`: 178 warnings, 0 errors, product-source clean
  - `npm run typecheck`
  - `bun run specs`
  - `bun run check:install-isolation`
  - `bun run check:package-lifecycle`
  - `bun run check:android-skia-archives`
  - `bun run check:yoganode-native-runtime`
  - `bun run check:yoganode-native-lifetime`
  - `npm pack --dry-run --json`
- Example readiness checks also passed:
  - `cd example && bun --bun ./node_modules/.bin/expo install --check`
  - `cd example && bun --bun ./node_modules/.bin/react-native config`
  - `cd example && bun run typecheck`
  - `cd example && bun --bun ./node_modules/.bin/expo config --type introspect --json`
- Lint classification from the original worker log:
  - 178 warnings total
  - 0 errors
  - all 178 warnings live under `example/`
  - by rule: 168 `react-native/no-inline-styles`, 6 `react/no-unstable-nested-components`, 3 `no-void`, 1 `no-unused-vars`
  - product source has 0 warnings
- Platform/toolchain blockers remain local and machine-owned:
  - `xcode-select -p` points to CommandLineTools and `xcodebuild -version` fails
  - `pod` is missing
  - `/usr/bin/java` exists but `java -version` fails, so no Java runtime is installed
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` are empty
  - `adb`, `gradle`, `cmake`, and `ninja` are missing
  - no tracked `example/ios` or `example/android` directory is present

## Candidate targets considered

- Option 1: address the remaining example/demo lint warnings
  - Strongest unblocked repo-owned work.
  - The backlog is concentrated in example/demo screens, not product source.
  - The nested challenger explicitly recommended a combination weighted toward lint-contract scoping and targeted leftovers, not bulk style churn.
- Option 2: pursue another package/native feedback-loop target
  - Weaker right now because the feasible package/native verifier matrix is already green.
  - The remaining platform-native path is still blocked by local toolchain prerequisites.
- Option 3: wait for iOS/Android toolchain availability
  - Not justified because there is still actionable repo-owned work in `example/`.

## Recommended next worker

- Objective: keep example files linted, but make the lint contract match file purpose by scoping `react-native/no-inline-styles` for demo/typecheck-fixture paths, then clean the small real leftovers.
- Likely owned files/modules:
  - `example/.eslintrc*` or root ESLint overrides that scope example/demo rules
  - `example/app/(tabs)/_layout.tsx`
  - `example/app/(tabs)/styles/layout-demos.tsx`
  - `example/app/(tabs)/styles/spacing-demos.tsx`
  - `example/types/skiayoga-typecheck.tsx`
  - `example/babel.config.js`
  - `example/app/(tabs)/styles/registry.ts`
- Non-goals:
  - Do not move all demo inline styles into constants just to appease the linter.
  - Do not patch product source; `src/` is already clean.
  - Do not wait for missing native toolchain prerequisites.
  - Do not broaden the task into unrelated example refactors.
- Suggested verification commands:
  - `npm run lint-ci`
  - `npm run typecheck`
  - `bun run specs`
  - `git diff --check`
- Why this is root-cause work rather than a symptom patch:
  - The warning backlog is mostly intentional example/demo code that uses inline style objects as part of the documentation surface.
  - A blanket conversion to constants would obscure the examples without addressing the underlying lint-contract mismatch.
  - Scoping the rule to the file purpose fixes the contract, while the few real leftovers can be cleaned directly.
- Why rejected candidates are weaker right now:
  - A package/native target is weaker because the package/native verifier matrix is already passing.
  - Waiting on toolchain prerequisites is weaker because it stalls progress despite having an unblocked repository-owned target.
  - Treating the example backlog as pure code cleanup is weaker because most of the warnings are expected in style-showcase/demo files.

## Nested subagent results

- The completed nested read-only challenger in the original worker log selected option 1: address the remaining example/demo lint warnings.
- The challenger recommended a combination weighted toward lint-contract scoping/overrides, not bulk code cleanup.
- The challenger specifically advised:
  - keep example files linted
  - make the lint contract match file purpose
  - scope or disable `react-native/no-inline-styles` for demo/typecheck fixture paths
  - then clean the small real leftovers: the tab icon nested components, intentional `void` sentinels, and the stale unused `__dirname`
- The challenger also rejected a stronger unblocked package/native target and concluded that platform-native build/run remains toolchain-blocked.

## Verification/probe results

- `npm run lint-ci`:
  - passed with 178 warnings and 0 errors
  - all warnings under `example/`
  - product source clean
- `npm run typecheck`:
  - passed
- `bun run specs`:
  - passed
- `bun run check:install-isolation`:
  - passed
- `bun run check:package-lifecycle`:
  - passed
- `bun run check:android-skia-archives`:
  - passed
- `bun run check:yoganode-native-runtime`:
  - passed
- `bun run check:yoganode-native-lifetime`:
  - passed
- `npm pack --dry-run --json`:
  - passed
- Example readiness checks:
  - `cd example && bun --bun ./node_modules/.bin/expo install --check`: passed
  - `cd example && bun --bun ./node_modules/.bin/react-native config`: passed
  - `cd example && bun run typecheck`: passed
  - `cd example && bun --bun ./node_modules/.bin/expo config --type introspect --json`: passed
- Platform probes:
  - `xcode-select -p` points to CommandLineTools
  - `xcodebuild -version` fails
  - `pod` missing
  - `java -version` fails
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` empty
  - `adb`, `gradle`, `cmake`, and `ninja` missing
  - no tracked `example/ios` or `example/android`

## Quality/maintainability/performance/security review

- Quality: this recommendation preserves the example as a real documentation surface instead of forcing it into a false production-style lint contract.
- Maintainability: scoping rule behavior to demo and fixture paths is more durable than converting every illustrative style object into helper constants.
- Performance: the suggested change should not affect runtime behavior; it is a contract and lint-scope correction.
- Security: no security issue was identified in the example warning backlog itself; the main risk is accidental over-scoping that hides real source regressions.

## Remaining risks/blockers

- The example warning backlog is still present and must be addressed by the next worker.
- The exact ESLint override shape has not yet been changed in this worktree.
- Full iOS/Android build/run verification remains blocked by local toolchain prerequisites.

## Files changed

- [`worker-progress/worker-028-next-root-cause-audit.md`](worker-028-next-root-cause-audit.md)

## Final git status

- `## worker/028-next-root-cause-audit`
- `?? worker-progress/worker-028-next-root-cause-audit.md`
