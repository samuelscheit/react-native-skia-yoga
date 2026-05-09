# Worker 025 Lint-CI Root Config

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Fix root lint-ci configuration and formatter wiring.`
- The original worker reproduced the root `lint-ci` failure, added the initial root ESLint configuration and package script wiring, fixed the lint-backed `YogaCanvas` hook cleanup findings, obtained a completed nested read-only reviewer result, and then hit a Codex usage limit before final verification/report.
- Fixup worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize root lint-ci configuration and formatter wiring after usage exhaustion.`
- The fixup worker reviewed the partial patch, ran the verification matrix, obtained a second completed nested read-only reviewer result, and then hit a Codex usage limit before writing this report.
- This report was recovered by orchestration from the accepted tmux worker logs after both workers failed only at report writing.

## Root cause

- The root package had `lint` and `lint-ci` scripts but no root ESLint configuration.
- `npm run lint-ci` therefore failed before source analysis with `ESLint couldn't find a configuration file`.
- `lint-ci` also referenced `@jamesacarr/github-actions`, which was not installed or resolvable.
- Installing the missing formatter alone would have patched a later symptom while leaving ESLint unable to load a root config.

## Changes

- Added [`.eslintrc.js`](../.eslintrc.js):
  - uses the installed ESLint 8-compatible `@react-native` shareable config
  - resolves the TypeScript parser from the React Native config package to keep parser/plugin versions coherent
  - ignores dependency, generated, build, coverage, native generated, and worker-progress artifacts
  - keeps root source files, scripts, example source, and config files in lint scope
- Updated [`package.json`](../package.json):
  - includes `.mjs` files in root lint scope so verifier scripts are linted
  - removes the missing `@jamesacarr/github-actions` formatter from `lint-ci`
  - adds `--resolve-plugins-relative-to ./node_modules/@react-native/eslint-config` so ESLint resolves the React Native config's plugin stack consistently
- Updated [`src/YogaCanvas.tsx`](../src/YogaCanvas.tsx):
  - renamed the inner `node` binding to `rootNode` to avoid shadowing
  - captured animation tracking sets inside the cleanup effect before returning cleanup, satisfying hook dependency analysis without changing the ref objects' behavior

## Nested subagent results

- Original worker reviewer recommended:
  - use `.eslintrc.js`, not flat config, because installed ESLint is 8.x and `@react-native/eslint-config@0.80.1` documents `extends: "@react-native"`
  - keep `lint-ci` on ESLint's built-in/default formatter instead of preserving the missing `@jamesacarr/github-actions`
  - add `--resolve-plugins-relative-to ./node_modules/@react-native/eslint-config`
  - resolve the TypeScript parser from the React Native config package
- Fixup reviewer confirmed:
  - `package.json` lint scope still includes `.eslintrc.js` and `**/*.{js,mjs,ts,tsx}`, so source and example files are still covered
  - `.eslintrc.js` excludes dependencies, generated outputs, native build outputs, and worker-progress artifacts without hiding source directories
  - active `lint-ci` no longer references `@jamesacarr/github-actions`

## Verification

- `npm run lint-ci`: passed. It now exits `0` and reports source warnings instead of failing before config load.
- `npm run typecheck`: passed.
- `bun run check:install-isolation`: passed.
- `bun run check:package-lifecycle`: passed.
- `bun run check:android-skia-archives`: passed.
- `bun run check:yoganode-native-runtime`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `git diff --check`: passed.
- `npm pack --dry-run --json`: passed with `entryCount: 87`.
- `find . -maxdepth 1 -name '*.tgz' -print`: no output.
- `npm run lint` was not used as a verifier because the current script includes `--fix` and is intentionally mutating.

## Quality/maintainability/performance/security review

- Quality: `lint-ci` is now a real source feedback loop instead of failing at config discovery or formatter resolution.
- Maintainability: the config uses the project's existing React Native lint dependency and keeps parser/plugin resolution aligned with that shareable config.
- Performance: generated, dependency, worker-progress, coverage, and native build outputs are ignored while source and example files remain in scope.
- Security: no new dependency was added; removing the missing third-party formatter avoids introducing a package solely to preserve stale script wiring.

## Remaining risks/blockers

- `lint-ci` currently passes with warnings. If CI later uses `--max-warnings=0`, the warning backlog becomes a separate implementation target.
- `npm run lint` still mutates through `--fix`; use it intentionally, not as a read-only check.
- Full iOS/Android build-run verification remains blocked by local toolchain prerequisites documented by prior workers.

## Files changed

- [`.eslintrc.js`](../.eslintrc.js)
- [`package.json`](../package.json)
- [`src/YogaCanvas.tsx`](../src/YogaCanvas.tsx)
- [`worker-progress/worker-025-lint-ci-root-config.md`](worker-025-lint-ci-root-config.md)

## Final git status

- `## worker/025-lint-ci-root-config`
- `M package.json`
- `M src/YogaCanvas.tsx`
- `?? .eslintrc.js`
- `?? worker-progress/worker-025-lint-ci-root-config.md`
