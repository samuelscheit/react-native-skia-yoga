# Worker 018 Next Backlog Audit

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Audit remaining react-native-skia-yoga backlog after worker 017 and identify the next root-cause task.`
- That worker gathered the backlog audit evidence, ran the feasible verification, documented the inherited challenger result, and then hit a usage limit before writing the report.
- This finalizer did not spawn a new nested subagent. It only recovered the original log, rechecked the current repo state, and wrote this report.
- Finalizer goal for this handoff was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 018 backlog audit report after usage exhaustion.`

## Context reviewed

- Inherited worker log:
  - [`../worker-logs/worker-018-next-backlog-audit.jsonl`](../worker-logs/worker-018-next-backlog-audit.jsonl)
- Repo metadata and install hook surface:
  - [`package.json`](../package.json#L10)
  - [`scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs#L10)
- Prior worker progress notes:
  - [`worker-progress/worker-014-platform-runtime-readiness.md`](worker-progress/worker-014-platform-runtime-readiness.md)
  - [`worker-progress/worker-015-example-workspace-readiness.md`](worker-progress/worker-015-example-workspace-readiness.md)
  - [`worker-progress/worker-016-platform-native-verification.md`](worker-progress/worker-016-platform-native-verification.md)
  - [`worker-progress/worker-017-package-plugin-hygiene.md`](worker-progress/worker-017-package-plugin-hygiene.md)

## Current verification snapshot

- Before this report was added, `git status --short --branch` was clean on `worker/018-next-backlog-audit`.
- After this report was added, the only change is the new report file itself.
- `git diff --check` passed with no output.
- `find . -maxdepth 1 -name '*.tgz' -print` returned no tarball artifacts.
- `npm pack --dry-run` from the inherited worker passed and printed a tarball manifest that includes the published `package.json` with the consumer-facing `postinstall` hook while omitting `scripts/`.
- `npm run typecheck` passed with only the local npm `minimum-release-age` warning noted in the inherited log.
- `bun run check:install-isolation` passed.
- `bun run check:yoganode-native-lifetime` passed.
- `bun --bun ./node_modules/.bin/expo install --check` passed from the worker root and reported dependencies up to date.
- `bun run typecheck` passed.
- Parsed `react-native config` passed and confirmed:
  - iOS podspec path for `react-native-skia-yoga`
  - Android `sourceDir`
  - Android `packageInstance = new SkiaYogaPackage()`
- The inherited worker also captured a runtime verification blocker:
  - `bun run check:yoganode-native-runtime` failed because `node_modules/@shopify/react-native-skia/libs/macos` is missing in the current symlinked install layout.
  - The package version itself is present at `@shopify/react-native-skia@2.4.18`, so this is a local dependency-artifact/install-layout blocker rather than the next root-cause task.

## Toolchain blocker re-check

- The local native toolchain blockers remain unchanged from the inherited audit:
  - CocoaPods is unavailable.
  - `xcode-select` points at CommandLineTools rather than a full Xcode build path.
  - Java is unavailable.
  - `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` are unset.
  - `adb`, `gradle`, `cmake`, and `ninja` are absent.
- Those blockers still prevent full iOS/Android build-run verification, but they do not block the package lifecycle audit recommendation.

## Remaining backlog audit

- The strongest remaining root-cause task is package install lifecycle hygiene.
- Root [`package.json`](../package.json#L32) currently declares:
  - `postinstall: bun ./scripts/sync-example-links.mjs`
- Root [`package.json`](../package.json#L10) also omits `scripts/` from `files`, which means the install hook points at local workspace logic that is not part of the published tarball contract.
- [`scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs#L10) is clearly dev-local workspace code:
  - it targets both root and example `node_modules`
  - it patches installed `@shopify/react-native-skia` headers in place
- That combination is the root cause:
  - the package is publishing a consumer install hook that depends on repo-local layout and local patching behavior
  - adding `scripts/` to the tarball would only patch the symptom by shipping the installer implementation, not by removing the consumer-facing lifecycle coupling
- The inherited challenger result from thread `019e0e97-11ba-7580-8d4b-d47b88549e29` agreed this is real root-cause work, not blocked by the native toolchain, and stronger than the other unblocked alternatives.

## Nested subagent results

- No new nested subagent or explorer was spawned in this finalizer.
- Inherited challenger result from thread `019e0e97-11ba-7580-8d4b-d47b88549e29`:
  - Root cause is the consumer-facing `postinstall` lifecycle hook in root [`package.json`](../package.json#L42), not a missing file in the tarball.
  - [`scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs#L18) patches local RN Skia headers under both root and example installs, so it is dev-local workspace behavior.
  - Shipping `scripts/` in the tarball would be a symptom patch.
  - The stronger fix is to remove the dev-local root consumer `postinstall` from the published package contract and make any local example/header sync explicit and example-only.
  - The challenger recommended proving the fix with package metadata checks and a temporary tarball consumer install with scripts enabled and Bun hidden from `PATH`.

## Recommended next worker

- Own these files/modules:
  - [`package.json`](../package.json)
  - [`example/package.json`](../example/package.json)
  - [`scripts/sync-example-links.mjs`](../scripts/sync-example-links.mjs)
  - a new or updated package lifecycle verifier under [`scripts/`](../scripts)
  - the next worker report under [`worker-progress/`](../worker-progress)
- Implement the root-cause fix:
  - remove the dev-local root consumer `postinstall` from the published package contract
  - make local example/header sync an explicit dev command or example-only command with safer behavior
  - keep consumer tarballs free of repo-local install coupling
- Verify the fix with:
  - `npm pack --dry-run --json`
  - extracted packed `package/package.json` lifecycle assertions
  - a temporary tarball consumer install with scripts enabled and Bun hidden from `PATH`
  - `npm run typecheck`
  - `bun run check:install-isolation`
  - `bun run check:yoganode-native-lifetime`
  - `npm pack --dry-run` with no tarball left on disk
  - `bun --bun ./node_modules/.bin/expo install --check`
  - parsed `react-native config`

## Alternatives

- Lower-value alternatives would be:
  - adding `scripts/` to the package tarball
  - preserving the root `postinstall` hook and just making it less fragile
  - moving the install-time patching deeper into consumer onboarding
- Those options still keep a consumer-facing install hook in place and do not remove the root cause.
- The only alternative worth considering is a narrowly scoped example-only bootstrap command if the example truly needs header patching during local development.

## Quality/maintainability/performance/security review

- Quality: the current package metadata mixes a published package contract with local workspace repair logic, which is difficult to reason about and easy to misuse in consumer installs.
- Maintainability: the `postinstall` hook is brittle because it depends on repository layout, symlinked installs, and patching files in third-party packages in place.
- Performance: install-time patching adds hidden work to every install and makes package setup slower and less predictable.
- Security: consumer install hooks are a higher-trust surface than ordinary runtime code; removing unnecessary lifecycle execution reduces surprise and limits the blast radius of packaging mistakes.

## Files changed

- [`worker-progress/worker-018-next-backlog-audit.md`](worker-progress/worker-018-next-backlog-audit.md)

## Remaining risks

- The package lifecycle fix is still unimplemented.
- The local native build toolchain remains incomplete, so full iOS/Android build-run verification is still blocked.
- The `check:yoganode-native-runtime` blocker will continue until the `@shopify/react-native-skia` install layout is normalized or the verifier is adjusted to the expected local topology.
- If the next worker broadens the fix too much, it could accidentally preserve the same consumer install coupling under a different command name.

## Final git status

- `## worker/018-next-backlog-audit`
- `?? worker-progress/worker-018-next-backlog-audit.md`
