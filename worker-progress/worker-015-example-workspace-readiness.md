# Worker 015 Example Workspace Readiness

## Goal lifecycle

- Goal created: `Finalize worker 015 example workspace readiness fixes after GPT-5.5 usage exhaustion.`
- Finalizer scope honored: only example dependency metadata, `example/bun.lock`, `example/tsconfig.skiayoga.json`, and this report were changed.
- Goal remained active through local reproduction, fixes, and verification.

## Baseline context

- Worktree started clean.
- The example is Expo CNG only; `example/ios` and `example/android` are not committed. They were absent in the worker worktree and were kept absent there.
- Confirmed baseline failures before edits:
  - `cd example && bun --bun ./node_modules/.bin/expo install --check` reported stale Expo/RN package versions.
  - `cd example && bun --bun ./node_modules/.bin/react-native config` failed because `@react-native-community/cli` was missing.
  - `cd example && bun run typecheck` failed because:
    - `example/tsconfig.skiayoga.json` removed Expo's DOM globals by overriding `lib` to `["ESNext"]`.
    - package source imported through the example resolved React Native types from the root install instead of `example/node_modules`.

## Root cause

- The example's dependency metadata had drifted from the Expo SDK 55 compatibility set, so workspace readiness checks failed before native generation.
- The example lacked `@react-native-community/cli`, which is required for `react-native config`.
- The dedicated example typecheck config redefined compiler settings too narrowly:
  - it dropped DOM globals required by current source (`queueMicrotask`, `performance`),
  - it did not pin peer/runtime package resolution to `example/node_modules` for source files reached through the linked package,
  - a first pass that mapped `react` to `./node_modules/react` was incorrect because it bypassed `@types/react`; the final fix maps `react` and JSX runtime imports to the example's type package instead.

## Nested subagent results

- No new managed nested agent was spawned in this finalizer because the recovery instructions explicitly prohibited it.
- Inherited attempted nested checks:
  - original nested thread: `019e0e69-8d14-70c2-95cc-7e0f610c6e73`
  - fixup nested thread: `019e0e6e-53a5-7101-bb16-369cd6375930`
- Neither inherited nested attempt produced a completed captured result before stalling / usage exhaustion.
- Final status in this report is based on fresh local reproduction and local verification only.

## Changes

- Updated `example/package.json` to the Expo-expected SDK 55 dependency set:
  - `@shopify/react-native-skia` -> `2.4.18`
  - `expo` -> `~55.0.23`
  - `expo-blur` -> `~55.0.14`
  - `expo-constants` -> `~55.0.16`
  - `expo-font` -> `~55.0.7`
  - `expo-haptics` -> `~55.0.14`
  - `expo-image` -> `~55.0.10`
  - `expo-linking` -> `~55.0.15`
  - `expo-router` -> `~55.0.14`
  - `expo-splash-screen` -> `~55.0.20`
  - `expo-status-bar` -> `~55.0.6`
  - `expo-symbols` -> `~55.0.8`
  - `expo-system-ui` -> `~55.0.17`
  - `expo-web-browser` -> `~55.0.15`
  - `react-native` -> `0.83.6`
  - `react-native-worklets` -> `0.7.4`
- Added `@react-native-community/cli@20.1.3` to `example/devDependencies`.
- Kept `@types/react` specified as `~19.2.10`; Bun resolved `19.2.14` in `example/bun.lock`, which satisfies that range and passed Expo's compatibility check.
- Regenerated `example/bun.lock` with `cd example && bun install --minimum-release-age=0`.
- Updated `example/tsconfig.skiayoga.json` to:
  - preserve Expo's inherited DOM libs by removing the `lib` override,
  - keep `jsx` and `jsxImportSource`,
  - preserve `@/*` and `react-native-skia-yoga` aliases,
  - add explicit path mappings so source typechecked through the example resolves `react`, `react-native`, `@shopify/react-native-skia`, `react-native-reanimated`, `react-native-worklets`, `react-native-nitro-modules`, and `react-native-gesture-handler` from `example/node_modules`.
- No product API or source files under `src/`, `ios/`, or `android/` were changed.

## Verification

- `git diff --check`
  - Passed.
- `bun run check:install-isolation`
  - Passed: `Install isolation verified: root dependency resolution stays in root node_modules.`
- `cd example && bun --bun ./node_modules/.bin/expo install --check`
  - Passed: `Dependencies are up to date`.
- `cd example && bun --bun ./node_modules/.bin/react-native config`
  - Passed and returned config JSON with `project.ios` and `project.android` both `null` in the worker worktree, consistent with Expo CNG and no generated native folders in that isolated checkout.
- `cd example && bun run typecheck`
  - Passed.
- `npm run typecheck`
  - Passed.
- `npm pack --dry-run`
  - Passed and printed the expected dry-run tarball name `react-native-skia-yoga-0.0.1.tgz`.
  - Verified no tarball remained on disk afterward.
- `test ! -d example/ios && test ! -d example/android`
  - Passed in the worker worktree.

## Quality/maintainability/performance/security review

- Quality: fixes are constrained to example metadata/config and avoid masking the root causes in product source.
- Maintainability: explicit type-resolution paths remove accidental dependence on whichever React Native install happens to be closest in the filesystem.
- Performance: no runtime code paths changed.
- Security: no new network/runtime surface was added; dependency updates align the example with the Expo SDK's supported set.

## Files changed

- `example/bun.lock`
- `example/package.json`
- `example/tsconfig.skiayoga.json`
- `worker-progress/worker-015-example-workspace-readiness.md`

## Remaining risks

- `npm run typecheck` and `npm pack --dry-run` emit `npm warn Unknown user config "minimum-release-age"` from the local npm environment. This did not block verification, but the warning is external to this worktree.
- `@types/react` resolved to `19.2.14` rather than `19.2.10`; this is within the declared `~19.2.10` range and was accepted by Expo's compatibility check.

## Final git status

- `M example/bun.lock`
- `M example/package.json`
- `M example/tsconfig.skiayoga.json`
- `A worker-progress/worker-015-example-workspace-readiness.md`
