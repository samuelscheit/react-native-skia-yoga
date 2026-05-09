# Worker 019 Package Lifecycle Hygiene

## Goal lifecycle

- Goal created first and emitted the required visible line:
  `GOAL_CREATED: Finalize package lifecycle hygiene after worker 019 usage exhaustion.`
- The goal is now complete: the root consumer-facing install hook was removed, the example workflow was hardened, lifecycle regression coverage was added, and the required verification passed.

## Baseline context

- Re-read before editing:
  - [`package.json`](../package.json)
  - [`example/package.json`](../example/package.json)
  - [`scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs)
  - [`scripts/verify-install-isolation.mjs`](../scripts/verify-install-isolation.mjs)
  - [`worker-progress/worker-018-next-backlog-audit.md`](worker-018-next-backlog-audit.md)
- Inherited evidence from the previous challenger run:
  - root `package.json` still exposed `postinstall: bun ./scripts/sync-example-links.mjs`
  - `package.json.files` still omitted `scripts/`
  - `scripts/sync-example-links.mjs` was local workspace repair logic that patched root and example `node_modules`
  - tarball install with lifecycle scripts enabled and Bun hidden from `PATH` failed because the packed `postinstall` still tried to invoke `bun ./scripts/sync-example-links.mjs`

## Root cause analysis

- The package lifecycle bug was not a missing tarball file. It was the consumer-facing root `postinstall` hook itself.
- That hook made the published package depend on repo-local install-time repair logic.
- The local header patching workflow is valid for development, but it must remain explicit and private, or be constrained to the example-only bootstrap path.
- `nitrogen` is codegen-only in this repo:
  - `specs` invokes it for local generation
  - the package already publishes generated `nitrogen/` artifacts
  - moving it to `devDependencies` removes an unnecessary runtime dependency without affecting published entrypoints
- `react-native-nitro-modules` remains in runtime `dependencies` because the native entrypoints still need it.

## Nested subagent results

- No new nested subagent or explorer was spawned in this finalizer.
- Inherited challenger result from thread `019e0e9d-f334-7303-acd6-09e5ff4dc266`:
  - removing the root `postinstall` removes the primary package-owned root cause
  - adding `scripts/` to `files` would be a symptom patch
  - `check:install-isolation` is necessary but insufficient
  - decisive proof is extracted packed-manifest lifecycle assertions plus a temporary tarball consumer install with scripts enabled and Bun hidden from `PATH`
  - local header sync should be private, explicit, or example-only, and constrained to repo-local known targets
- Review-fix worker `rnskia-worker-019-package-lifecycle-review-fix` passed the visible goal gate and used nested read-only check `019e0eab-948a-71d0-9e7f-629e9c7e37e7` to validate the PATH-shim approach for hiding Bun. It hit a usage limit before editing; the accepted follow-up patch was applied by a tmux shell worker with `apply_patch`.

## Changes

- Removed the root consumer-facing `postinstall` from [`package.json`](../package.json).
- Added an explicit private root command:
  - `sync:example-links`
  - it now runs `node ./scripts/sync-example-links.mjs --root --example`
- Added `check:package-lifecycle` to [`package.json`](../package.json) and created [`scripts/verify-package-lifecycle.mjs`](../scripts/verify-package-lifecycle.mjs).
- Hardened [`scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs):
  - switched it to `#!/usr/bin/env node`
  - made scope selection explicit with `--root`, `--example`, or `--all`
  - made the example bootstrap example-only unless the caller explicitly asks for root patching
  - replaced the example `rm`/`ln -s` shell one-liner with guarded symlink management
  - fixed dangling symlink handling by using `lstatSync`-based path inspection instead of `existsSync` before replacement
- Updated [`example/package.json`](../example/package.json) so the example postinstall only runs the example-only bootstrap path.
- Moved `nitrogen` from runtime `dependencies` to `devDependencies` in [`package.json`](../package.json).
- Refreshed [`bun.lock`](../bun.lock) after the dependency-category change.
- Strengthened [`scripts/verify-package-lifecycle.mjs`](../scripts/verify-package-lifecycle.mjs) with a temporary PATH shim that exposes `node`, `npm`, and `tar`, excludes directories containing an executable `bun`, and asserts `bun --version` is unavailable before running the consumer install.

## Verification

- `git diff --check`
- `npm run typecheck`
- `bun run check:install-isolation`
- `bun run check:yoganode-native-lifetime`
- `bun run check:package-lifecycle`
- temp-directory `scripts/sync-example-links.mjs --example` regression covering root symlink, other-target symlink, dangling symlink, and non-symlink refusal
- `npm pack --dry-run --json`
- `npm pack --dry-run`
- `find . -maxdepth 1 -name '*.tgz' -print`
- `cd example && bun --bun ./node_modules/.bin/expo install --check`
- `cd example && bun --bun ./node_modules/.bin/react-native config`
- `git status --short --ignored example/ios example/android`

Verification results:

- `git diff --check` passed.
- `npm run typecheck` passed.
- `bun run check:install-isolation` passed.
- `bun run check:yoganode-native-lifetime` passed.
- `bun run check:package-lifecycle` passed and confirmed:
  - the verifier PATH shim keeps `bun` unavailable while preserving `node`, `npm`, and `tar`
  - the packed tarball manifest does not include private `scripts/` files
  - the packed `package.json` has no root `preinstall`, `install`, or `postinstall`
  - a temporary consumer install succeeded with lifecycle scripts enabled and Bun hidden from `PATH`
- The temp-directory sync regression passed without mutating real `example/node_modules`.
- `npm pack --dry-run --json` showed the published tarball contents and no lifecycle-coupling script files.
- `npm pack --dry-run` completed without creating a repo-root `.tgz`.
- `find . -maxdepth 1 -name '*.tgz' -print` returned nothing.
- `cd example && bun --bun ./node_modules/.bin/expo install --check` reported dependencies up to date.
- `cd example && bun --bun ./node_modules/.bin/react-native config` confirmed:
  - `react-native-skia-yoga` iOS `podspecPath`
  - `react-native-skia-yoga` Android `sourceDir`
  - `react-native-skia-yoga` Android `packageInstance = new SkiaYogaPackage()`
- `git status --short --ignored example/ios example/android` produced no output, which means those folders are still absent/clean in the expected managed state.

## Quality / Maintainability / Performance / Security Review

- Quality: the published package contract no longer contains a hidden install-time repair path.
- Maintainability: the example bootstrap is now explicit and scoped, which makes local repair behavior easier to reason about and easier to test.
- Performance: removing the consumer-facing `postinstall` removes unnecessary install-time work for consumers.
- Security: consumer installs no longer execute repo-local patching logic by default, which reduces surprise and narrows the trust boundary.

## Files changed

- [`/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-019-package-lifecycle-hygiene/package.json`](../package.json)
- [`/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-019-package-lifecycle-hygiene/example/package.json`](../example/package.json)
- [`/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-019-package-lifecycle-hygiene/scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs)
- [`/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-019-package-lifecycle-hygiene/scripts/verify-package-lifecycle.mjs`](../scripts/verify-package-lifecycle.mjs)
- [`/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-019-package-lifecycle-hygiene/bun.lock`](../bun.lock)

## Remaining risks

- Full native build/run verification is still blocked by the known local toolchain gaps from earlier workers.
- I did not rerun `bun run check:yoganode-native-runtime`; the earlier `@shopify/react-native-skia/libs/macos` artifact blocker is still the known reason to skip it here.
- The example bootstrap still depends on a symlinked local workspace layout, but it is now explicit, guarded, and example-scoped instead of being published as a consumer install hook.

## Final git status

- `M bun.lock`
- `M example/package.json`
- `M package.json`
- `M scripts/sync-example-links.mjs`
- `?? scripts/verify-package-lifecycle.mjs`
- `?? worker-progress/worker-019-package-lifecycle-hygiene.md`
