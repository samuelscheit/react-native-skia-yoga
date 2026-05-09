# Verification Baseline Report: react-native-skia-yoga

## 1. Goal lifecycle
- Visible goal gate passed in v3 at `worker-logs/worker-003-verification-baseline-v3.jsonl:3`.
- Visible goal gate passed again in v4 at `worker-logs/worker-003-verification-report-v4.jsonl:3`.
- v4 hit a usage limit before it could write this report or perform cleanup.
- This worker only wrote the baseline report and removed worker-owned generated artifacts.

## 2. Commands run by v3/v4/v5 with status
- `bun install --frozen-lockfile` at repo root: failed because the lockfile would change.
- `bun install --no-save` at repo root: passed.
- `bun install` in `example/`: passed and ran `postinstall`.
- `bun run specs`: failed with `nitrogen: command not found`.
- `lint-ci`: failed under ESLint 9/no flat config, and it also references missing formatter `@jamesacarr/github-actions` in `package.json:37`.
- `expo lint`: passed far enough to create `example/eslint.config.js`, but emitted warnings for custom React JSX props.
- Example typecheck: failed because package types and JSX intrinsic elements were unresolved.

## 3. Toolchain versions and missing tools
- Bun 1.3.13
- Node v26.0.0
- npm 11.12.1
- Ruby 2.6.10
- Missing or blocked: Java runtime, CocoaPods `pod`, CMake, adb/sdkmanager/gradle, Android env vars, and full Xcode (`xcodebuild` was only available from CommandLineTools).

## 4. Failure output excerpts
- Root install: lockfile drift prevented frozen install.
- `bun run specs`: `nitrogen: command not found`, despite `node_modules/nitrogen/lib/index.js` existing.
- `lint-ci`: ESLint 9 flat-config mismatch plus missing formatter `@jamesacarr/github-actions`.
- Example typecheck: unresolved package types and JSX intrinsic elements; config uses `jsxImportSource: react-native-skia-yoga` and package `types` points at `lib/index.d.ts`, but `lib/` is absent.

## 5. Root-cause hypotheses tested
- The main root cause is `scripts/sync-example-links.mjs:23-35` iterating example `node_modules` entries and `linkPath` removing root targets before symlinking at `scripts/sync-example-links.mjs:39-45`.
- That behavior clobbers root dependencies and binaries with example symlinks, including `.bin`, `@types`, `eslint`, and `typescript`.
- Nested subagent evidence from v3/v4 strongly supported this:
  - Root `.bin` became `../example/node_modules/.bin`.
  - Root `@types` became `../example/node_modules/@types`.
  - Root expected ESLint 8 and TypeScript 5.5-ish but resolved example ESLint 9 and TypeScript 5.9.
  - Root-only `@types/react-reconciler` and `@types/jest` disappeared from resolution.
- This explains why `specs` failed even though `nitrogen` was present in root `node_modules`: the root bin path was redirected into the example tree, where `nitrogen` is absent.

## 6. Generated/temp artifacts and cleanup
- Observed generated or worker-owned artifacts:
  - `node_modules/`
  - `example/node_modules/`
  - `example/eslint.config.js`
  - `tsconfig.tsbuildinfo`
- Cleanup performed:
  - Removed `node_modules/`
  - Removed `example/node_modules/`
  - Removed `example/eslint.config.js`

## 7. Minimal reliable verification command set
- `bun install --frozen-lockfile` at repo root
- `bun run typecheck`
- `bun run lint-ci`
- `bun run specs`
- `bun install` in `example/` only if the example tree is intentionally exercised

## 8. Prioritized fixes for trustworthy verification
- Fix `scripts/sync-example-links.mjs` so example linking never rewrites root dependency and bin resolution.
- Add a guardrail that keeps root `node_modules/.bin` and root package namespaces isolated from the example tree.
- Decide whether `lint-ci` should target ESLint 8 flat-config compatibility, or update the repo to a single ESLint 9 configuration story.
- Restore or remove the missing formatter reference `@jamesacarr/github-actions` in `package.json`.
- Make the package type story explicit so `lib/index.d.ts` is generated or the `types` field points somewhere real.

## 9. Quality, maintainability, performance, security notes
- Quality: verification is currently non-trustworthy because dependency resolution is being mutated by the example sync script.
- Maintainability: the root/example coupling is too implicit; the sync mechanism needs clear ownership boundaries.
- Performance: the current failure mode also wastes time by reusing the wrong toolchain versions across trees.
- Security: symlink-driven clobbering of dependency trees is risky because it can silently redirect execution to unintended binaries.

## 10. Final worktree status
- `git status --short` currently shows only `?? worker-progress/`.
- Removed cleanup artifacts: `node_modules/`, `example/node_modules/`, and `example/eslint.config.js`.
- `tsconfig.tsbuildinfo` was observed but not removed because it was not proven worker-owned and should be treated as pre-existing or ambiguous unless separately assigned.
- Product code changes: none.
