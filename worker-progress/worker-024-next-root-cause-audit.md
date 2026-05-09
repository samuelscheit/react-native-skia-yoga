# Worker 024 Next Root-Cause Audit

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Audit the next unblocked root-cause target after Android archive discovery.`
- The original worker ran the required feasible verification matrix, reproduced the current `lint-ci` failure, completed a nested read-only challenger, and then hit a Codex usage limit before writing this report.
- Finalizer worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 024 next root-cause audit report after usage exhaustion.`
- The finalizer reproduced the `lint-ci` failure, completed another nested read-only challenger, and then hit a Codex usage limit before writing this report.
- This report was recovered by orchestration from the accepted tmux worker logs after both tmux workers failed only at report writing. No product code was edited by orchestration.

## Current baseline

- The post-worker-023 green-path matrix passed in the worker worktree:
  - `bun run check:android-skia-archives`
  - `bun run check:yoganode-native-runtime`
  - `bun run check:yoganode-native-lifetime`
  - `npm run typecheck`
  - `bun run check:install-isolation`
  - `bun run check:package-lifecycle`
  - `bun run specs`
  - `npm pack --dry-run --json`
  - `git diff --check`
- `npm pack --dry-run --json` reported `entryCount: 87`.
- `bun run specs` regenerated Nitrogen outputs without leaving tracked diffs.
- `git status --short` stayed clean before this report was recovered.

## Candidate targets considered

- `lint-ci` is now the strongest unblocked repo-owned root-cause target.
- Full iOS/Android build-run verification remains machine-owned:
  - `xcode-select -p` points at `/Library/Developer/CommandLineTools`
  - `pod` is unavailable
  - `java -version` cannot locate a Java runtime
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset
  - `adb`, `gradle`, `cmake`, and `ninja` are missing from `PATH`
  - `git ls-files example/ios example/android` returned no tracked native projects
- RN Skia archive-discovery candidates are no longer the next target:
  - macOS runtime smoke archive discovery was fixed by worker 021
  - Android CMake archive discovery was fixed by worker 023
- `nativeID/nativeId` remains plausible but unproven. No accepted report currently exposes a failing verifier or platform-native reproduction that makes it a stronger next target than the deterministic `lint-ci` failure.

## Recommended next worker

- Objective: fix the root `lint-ci` contract so CI linting reaches source lint feedback instead of failing before configuration load.
- Likely owned files/modules:
  - [`package.json`](../package.json)
  - a new root ESLint config, likely `.eslintrc.js` if staying on ESLint 8 and `@react-native/eslint-config`
  - `bun.lock` only if dependency or script wiring changes
  - `worker-progress/worker-025-lint-ci-root-config.md`
- Root-cause framing:
  - root `lint` and `lint-ci` scripts exist
  - no root ESLint config exists for those scripts to load
  - `lint-ci` also references `@jamesacarr/github-actions`, and formatter resolution probes found it missing
  - adding only the formatter would patch a later symptom while leaving the primary config-load failure unresolved
- Suggested next implementation:
  - add a root ESLint configuration that matches the existing ESLint 8-era root dependency set and the project source shape
  - either add the missing formatter dependency intentionally or switch `lint-ci` to an installed/standard formatter that works in CI
  - keep lint scope deliberate so source linting is meaningful without linting generated or dependency folders
- Non-goals:
  - full native build/run
  - RN Skia macOS or Android archive discovery
  - `nativeID/nativeId` API work without a failing repro
  - broad formatting churn
  - hiding lint failures by narrowing the source set too aggressively
- Suggested verification:
  - `npm run lint-ci`
  - `npm run lint` only if safe/non-mutating, otherwise document that it mutates because the current script uses `--fix`
  - `npm run typecheck`
  - `bun run check:install-isolation`
  - `bun run check:package-lifecycle`
  - `bun run check:android-skia-archives`
  - `bun run check:yoganode-native-runtime`
  - `bun run check:yoganode-native-lifetime`
  - `git diff --check`
  - `npm pack --dry-run --json` if package metadata changes

## Nested subagent results

- Original worker nested challenger agreed that `npm run lint-ci` is the next unblocked root-cause target after worker 023.
- The challenger explicitly warned not to treat the fix as merely installing `@jamesacarr/github-actions`; the primary root cause is missing root ESLint configuration plus stale formatter wiring.
- Finalizer nested challenger independently confirmed:
  - no root `.eslintrc*`, `eslint.config.*`, or `.eslintignore` was found
  - root `package.json` has `lint` and `lint-ci`, with `lint-ci` using `-f @jamesacarr/github-actions`
  - that formatter is not declared in root `devDependencies`
  - a root ESLint config is the correct next implementation target, with formatter repair as a secondary part of the same root-cause fix

## Verification/probe results

- `npm run lint-ci` failed before source linting:
  - ESLint version: `8.57.1`
  - failure: `ESLint couldn't find a configuration file`
  - searched from the worker worktree and ancestors
- Formatter resolution probes:
  - `@jamesacarr/github-actions -> MISSING: MODULE_NOT_FOUND`
  - `eslint-formatter-@jamesacarr/github-actions -> MISSING: MODULE_NOT_FOUND`
  - `@jamesacarr/eslint-formatter-github-actions -> MISSING: MODULE_NOT_FOUND`
- Root ESLint config search found no config files; the only lint-related manifests found were `package.json` and `example/package.json`.
- Platform prerequisite probes remain blocked by local machine state, not repository state.
- Final light checks:
  - `git diff --check`: passed
  - `find . -maxdepth 1 -name '*.tgz' -print`: no output

## Quality/maintainability/performance/security review

- Quality: fixing `lint-ci` now would restore a useful CI feedback loop that currently fails before analyzing source.
- Maintainability: wiring an explicit root ESLint config is more durable than relying on implicit config discovery or formatter installation alone.
- Performance: linting scope should avoid generated and dependency folders so the check remains practical.
- Security: a working linter can catch unsafe patterns, but the implementation should avoid adding unnecessary third-party formatter dependencies if a standard CI-compatible formatter is sufficient.

## Remaining risks/blockers

- The exact lint rule fallout is unknown until a root config is added and ESLint reaches source files.
- `npm run lint` currently includes `--fix`, so the next worker must treat it as mutating and either run it intentionally or use a non-mutating lint command for verification.
- Full platform-native build/run remains blocked by local toolchain prerequisites.

## Files changed

- [`worker-progress/worker-024-next-root-cause-audit.md`](worker-024-next-root-cause-audit.md)

## Final git status

- `## worker/024-next-root-cause-audit`
- `?? worker-progress/worker-024-next-root-cause-audit.md`
