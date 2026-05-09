# Install Isolation Report: worker-004

## Goal lifecycle
- Goal created successfully with the exact required objective: `Verify, complete, and report the install-isolation patch in the worker-004 worktree after the previous worker hit a usage limit.`
- Goal remained active until implementation and verification were complete.
- Goal can be marked complete after this report is written and the final status is delivered.

## Root cause
- The original postinstall sync logic in `scripts/sync-example-links.mjs` treated the example package tree as a source of dependency links for the root install tree.
- That allowed example-owned resolution to overwrite root-owned dependency namespaces and binaries, including `node_modules/.bin`.
- The result was cross-tree contamination: root `node_modules/.bin` could resolve into `example/node_modules/.bin`, which redirected execution to the wrong toolchain.

## Changes
- Removed the root-clobbering behavior from `scripts/sync-example-links.mjs`.
- Kept the header-patching behavior for both the root and example `@shopify/react-native-skia` installs.
- Added `scripts/verify-install-isolation.mjs` to assert that root package resolution stays in the root `node_modules` tree.
- Added `check:install-isolation` to `package.json` so the isolation check is runnable directly.

## Nested subagent results
- No nested subagents were needed.
- The bug was reproducible and the root cause was confirmed locally by install and resolution checks, so additional delegation would not have reduced uncertainty.

## Verification
- `bun install` at the repo root passed.
- `bun install` in `example/` passed.
- `node ./scripts/verify-install-isolation.mjs` passed after each install flow.
- Manual resolution checks confirmed:
  - `node_modules/.bin` stays rooted in the root tree.
  - `node_modules/eslint` stays rooted in the root tree.
  - `node_modules/typescript` stays rooted in the root tree.
  - `node_modules/nitrogen` stays rooted in the root tree.
  - `node_modules/@types` stays rooted in the root tree.
- Initial verification failed before the clean reinstall, which reproduced the contamination and confirmed the bug was real rather than a false alarm.

## Quality, maintainability, performance, security review
- Quality: the isolation contract is now explicit and testable instead of being implied by install side effects.
- Maintainability: the verifier makes future regressions obvious, and the sync script no longer mutates unrelated package ownership.
- Performance: the fix avoids unnecessary root/example tree churn from cross-linking.
- Security: removing cross-tree symlink redirection reduces the chance of silently executing binaries from the wrong dependency tree.

## Files changed
- `package.json`
- `scripts/sync-example-links.mjs`
- `scripts/verify-install-isolation.mjs`
- `worker-progress/worker-004-install-isolation.md`

## Remaining risks
- The example install script still shells out to `rm` and `ln -s` for the local `react-native-skia-yoga` link; that is outside this task’s scope but still worth keeping in mind for future hardening.
- I did not run the broader package validation suite here because this task is narrowly about install isolation, not the package-entrypoint work assigned to other workers.
