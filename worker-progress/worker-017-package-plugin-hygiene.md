# Worker 017 Package Plugin Hygiene

## Goal lifecycle

- Goal created first with objective: `Finalize worker 017 package plugin hygiene after usage exhaustion.`
- Goal was marked complete after the manifest edit and required verification checks passed.

## Baseline context

- Worktree: `worker-017-package-plugin-hygiene`
- Branch: `worker/017-package-plugin-hygiene`
- Inherited evidence from the original worker and challenger was re-checked locally before editing.
- The inherited challenger thread concluded:
  - No real Expo config plugin contract exists in this package.
  - Native autolinking covers iOS and Android through `react-native.config.js`, `RNSkiaYoga.podspec`, `android/build.gradle`, and generated Nitrogen autolinking files.
  - `example/app.json` does not register `react-native-skia-yoga` as an Expo plugin.
  - Root `package.json.files` contains a stale `app.plugin.js` entry, but no actual `app.plugin.js` implementation exists.
  - The durable fix is to remove only the stale `app.plugin.js` entry from `package.json.files`.

## Root cause analysis

- The package manifest was advertising a file that does not exist.
- That stale `files` entry is packaging hygiene debt, not a runtime plugin contract.
- The real integration surface is native autolinking:
  - `react-native.config.js` exposes the library to the React Native CLI.
  - `RNSkiaYoga.podspec` publishes the iOS podspec and Nitrogen-generated registration.
  - `android/build.gradle` applies the Android library and Nitrogen-generated autolinking.
- Example app metadata confirms the package is consumed as a linked native library, not as an Expo config plugin.

## Nested subagent results

- No new subagent was spawned in this finalizer.
- The inherited challenger already proved the key hypothesis and its conclusion was adopted here without re-running that delegation:
  - remove the stale `app.plugin.js` package entry only.

## Changes

- Removed the stale `"app.plugin.js",` entry from root [`package.json`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-017-package-plugin-hygiene/package.json).

## Verification

- `git diff --check` passed.
- `npm pack --dry-run` passed and left no `.tgz` artifact behind.
- `npm run typecheck` passed.
- `bun run check:install-isolation` passed.
- `cd example && bun --bun ./node_modules/.bin/expo install --check` passed.
- `cd example && bun --bun ./node_modules/.bin/react-native config` passed.
- `cd example && bun --bun ./node_modules/.bin/expo config --type introspect --json` passed.
- Confirmed no generated `example/ios` or `example/android` folders remain in this worktree.

## Quality/maintainability/performance/security review

- Quality: the manifest now matches the package contents.
- Maintainability: the fix is minimal and durable; no shim or compatibility hack was added.
- Performance: unchanged.
- Security: unchanged.

## Files changed

- [`package.json`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-017-package-plugin-hygiene/package.json)
- [`worker-progress/worker-017-package-plugin-hygiene.md`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-017-package-plugin-hygiene/worker-progress/worker-017-package-plugin-hygiene.md)

## Remaining risks

- The repo still depends on autolinking and generated Nitrogen metadata behaving consistently in consumer installs.
- The strongest end-to-end regression test remains a tarball consumer install, which is beyond the scoped checks required here.

## Final git status

- `package.json` modified.
- `worker-progress/worker-017-package-plugin-hygiene.md` added.
- No generated `example/ios` or `example/android` folders are present in this worktree.
