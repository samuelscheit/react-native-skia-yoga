# Worker 033 Native Package Publish Surface

## Goal lifecycle

- Original goal: fix native package publish-surface completeness for `react-native-skia-yoga`.
- Original worker implemented the first package-surface patch and ran the required checks successfully, then stalled while waiting for a managed nested challenger.
- Continuation goal: complete the worker 033 report, inspect the current patch, evaluate the completed read-only challenger evidence, fix any real issue, rerun verification, and close the goal.
- Continuation result: completed. The read-only challenger found one real Android package-surface gap, which was fixed and verified.

## Root cause

- `package.json.files` omitted the shared `cpp` directory even though Android CMake compiles from `../cpp` and the podspec includes `cpp/**/*.{hpp,cpp}` plus `cpp/polyfill.h`.
- `RNSkiaYoga.podspec` still used the stale Nitro template source repository instead of this package repository.
- The first package-surface verifier did not cover `android/fix-prefab.gradle`, even though `android/build.gradle` applies it with `apply from: "./fix-prefab.gradle"`. Without publishing that file, Android consumers would fail during Gradle configuration.

## Changes

- Added `cpp` to `package.json.files` so shared native C++ sources are present in the npm tarball.
- Added `android/fix-prefab.gradle` to `package.json.files` so the Gradle script applied by `android/build.gradle` is present for consumers.
- Added `check:package-surface` to `package.json`.
- Updated `RNSkiaYoga.podspec` source metadata to `https://github.com/SamuelScheit/react-native-skia-yoga.git`.
- Added `scripts/verify-package-surface.mjs` to parse `npm pack --dry-run --json --ignore-scripts` and assert the publish surface includes package entrypoints, representative iOS/Android/Nitrogen files, all files under `cpp/`, and the Android prefab Gradle helper.
- The verifier also asserts the podspec source URL, the podspec C++ source and `cpp/polyfill.h` usage, Android CMake's `../cpp` source wiring, and `android/build.gradle`'s `fix-prefab.gradle` apply line.

## Nested/challenger results

- Original managed nested challenger: stalled. The original worker waited on the managed challenger and did not receive a completed review before handoff.
- Tmux read-only challenger: completed. It confirmed the shared `cpp` package-surface fix and verifier design were mostly sound, but found a real blocking gap: `android/fix-prefab.gradle` was omitted from both the npm publish surface and the verifier contract while `android/build.gradle` applies it.
- Continuation action: fixed the challenger finding by publishing `android/fix-prefab.gradle` and asserting it in the verifier.

## Verification

Original worker full-check evidence before the continuation fix, all exit 0:

- `npm run check:package-surface`
- `git diff --check`
- `find . -maxdepth 1 -name '*.tgz' -print`
- `npm pack --dry-run --json --ignore-scripts`
- `perl -e 'alarm shift; exec @ARGV' 180 bun run check:package-lifecycle`
- `npm run lint-ci`
- `npm run typecheck`
- `bun run specs`

Continuation verification after fixing `android/fix-prefab.gradle`, all exit 0:

- `npm run check:package-surface`
  - Passed.
  - `npm pack` manifest includes 118 files.
  - All 30 files under `cpp/` are published.
  - Representative iOS, Android, Nitrogen, and package entrypoint files are published.
  - Podspec source metadata points at the canonical repository.
- `npm pack --dry-run --json --ignore-scripts`
  - Passed.
  - Manifest entry count is 118 and includes `android/fix-prefab.gradle`.
- `perl -e 'alarm shift; exec @ARGV' 180 bun run check:package-lifecycle`
  - Passed.
  - Packed package has no lifecycle hooks and temporary consumer install succeeded with Bun hidden from `PATH`.
- `npm run lint-ci`
  - Passed.
- `npm run typecheck`
  - Passed.
- `bun run specs`
  - Passed and regenerated Nitrogen outputs without leaving tracked generated-file changes.
- `git diff --check`
  - Passed.
- `find . -maxdepth 1 -name '*.tgz' -print`
  - Passed with no root tarballs present.

Note: npm printed the existing warning `Unknown user config "minimum-release-age"` during npm commands; it did not fail any verification.

## Quality/maintainability/performance/security review

- Quality: the publish contract is now executable and catches the specific native files required by iOS, Android, Nitrogen, and shared C++ consumers.
- Maintainability: the verifier derives all required `cpp/` files from the filesystem, avoiding a stale hand-maintained list for the shared C++ directory while still sampling key package entrypoints.
- Performance: changes only affect packaging metadata and a verification script; runtime performance is unchanged.
- Security: package lifecycle checks confirm the packed package does not introduce root install hooks, and no network-facing or credential-handling code was changed.

## Remaining risks/blockers

- No current blockers.
- Remaining risk: the verifier samples non-`cpp` native/package paths rather than walking every published native directory. It now covers the known Android Gradle helper gap and all shared C++ files, but future non-`cpp` packaging additions should extend the verifier when new required files are introduced.

## Files changed

- `package.json`
- `RNSkiaYoga.podspec`
- `scripts/verify-package-surface.mjs`
- `worker-progress/worker-033-native-publish-surface.md`

## Final git status

```text
 M RNSkiaYoga.podspec
 M package.json
?? scripts/verify-package-surface.mjs
?? worker-progress/worker-033-native-publish-surface.md
```
