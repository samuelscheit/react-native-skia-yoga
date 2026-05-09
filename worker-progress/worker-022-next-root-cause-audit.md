# Worker 022 Next Root-Cause Audit

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Audit the next unblocked root-cause target after runtime smoke archive discovery.`
- That worker gathered the backlog audit evidence, verified the current native/package state, documented the inherited challenger result, and then hit a usage limit before it could write the report.
- This finalizer did not spawn a new nested subagent or explorer. It recovered the original log, rechecked the current repo state, and wrote this report.
- Finalizer goal for this handoff was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 022 next root-cause audit report after usage exhaustion.`

## Context reviewed

- Inherited worker log:
  - [`../worker-logs/worker-022-next-root-cause-audit.jsonl`](../worker-logs/worker-022-next-root-cause-audit.jsonl)
- Master planning and progress:
  - [`MASTER_PLAN.md`](../MASTER_PLAN.md)
  - [`MASTER_PROGRESS.md`](../MASTER_PROGRESS.md)
- Prior audit and hygiene reports:
  - [`worker-progress/worker-018-next-backlog-audit.md`](worker-progress/worker-018-next-backlog-audit.md)
  - [`worker-progress/worker-020-next-root-cause-audit.md`](worker-progress/worker-020-next-root-cause-audit.md)
  - [`worker-progress/worker-021-runtime-smoke-archive-discovery.md`](worker-progress/worker-021-runtime-smoke-archive-discovery.md)
- Current Android/native and verifier surfaces:
  - [`android/CMakeLists.txt`](../android/CMakeLists.txt)
  - [`scripts/verify-yoganode-native-runtime-smoke.mjs`](../scripts/verify-yoganode-native-runtime-smoke.mjs)
  - [`scripts/verify-install-isolation.mjs`](../scripts/verify-install-isolation.mjs)
  - [`package.json`](../package.json)

## Baseline/toolchain state

- The current installed RN Skia package is `@shopify/react-native-skia@2.4.18`, as captured in the inherited log and the current workspace state.
- Worker 021 already fixed the macOS runtime smoke archive discovery on `main` at `d0dcadb`.
- The Android CMake file still links RN Skia archives from the old layout:
  - `${NODE_MODULES_DIR}/@shopify/react-native-skia/libs/android/${ANDROID_ABI}/*.a`
- The actual Android archives in this checkout live under:
  - `node_modules/react-native-skia-android/libs/${ANDROID_ABI}/*.a`
- The local native toolchain remains incomplete for full app build/run work:
  - CocoaPods is unavailable.
  - `xcode-select -p` points at CommandLineTools rather than a full Xcode build path.
  - Java is unavailable.
  - `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` are unset.
  - `adb`, `gradle`, `cmake`, `sdkmanager`, and `ninja` are missing.
- Those blockers still prevent full iOS/Android build-run verification, but they do not block the next root-cause recommendation.

## Verification probes

- From the inherited worker log and prior reports:
  - `npm run typecheck` passed.
  - `bun run check:install-isolation` passed.
  - `bun run check:package-lifecycle` passed.
  - `bun run check:yoganode-native-lifetime` passed.
  - `bun run check:yoganode-native-runtime` passed on the inherited worker only after archive-root discovery was corrected for macOS packaging.
  - `bun run specs` passed and left no tracked diff.
  - `npm pack --dry-run --json` passed and showed 87 packed files, with the known npm `minimum-release-age` warning.
  - `cd example && bun --bun ./node_modules/.bin/expo install --check` passed.
  - Parsed `cd example && bun --bun ./node_modules/.bin/react-native config` passed and confirmed iOS and Android autolinking, the local podspec path, Android `sourceDir`, `new SkiaYogaPackage()`, `RNSkiaYogaSpec`, and `SkiaYogaViewComponentDescriptor`.
- Finalizer checks required by this handoff:
  - `git status --short --branch`
  - `git diff --check`
  - `find . -maxdepth 1 -name '*.tgz' -print`
- Current finalizer results:
  - `git status --short --branch` is clean on `worker/022-next-root-cause-audit`.
  - `git diff --check` passed with no output.
  - `find . -maxdepth 1 -name '*.tgz' -print` returned no tarball artifacts.

## Candidate targets considered

- Android RN Skia archive discovery in `android/CMakeLists.txt` is the strongest next root-cause target.
- `lint-ci` is real, but it is second-priority follow-up work because it currently fails before useful source lint feedback due to missing root ESLint configuration and formatter wiring.
- Broad platform build readiness remains important, but it is still blocked by local native prerequisites and is not the best unblocked root-cause task.
- Package lifecycle work is already completed and is therefore not the next target.
- `nativeID/nativeId` work is lower-confidence than the Android archive-discovery failure.

## Nested subagent results

- No new nested subagent or explorer was spawned in this finalizer.
- Inherited challenger result from thread `019e0eca-2e80-78b1-a154-ce42e36bcdd3`:
  - The Android CMake file still links Skia archives only from the old in-package layout:
    - `@shopify/react-native-skia/libs/android/${ANDROID_ABI}/*.a`
  - That old layout is absent in this checkout.
  - The actual Android archives are under:
    - `react-native-skia-android/libs/${ANDROID_ABI}/*.a`
  - Probe results by ABI:
    - `arm64-v8a`: old layout `0` archives, optional layout `9` archives, missing optional archives `none`
    - `x86_64`: old layout `0` archives, optional layout `9` archives, missing optional archives `none`
    - `x86`: old layout `0` archives, optional layout `9` archives, missing optional archives `none`
    - `armeabi-v7a`: old layout `0` archives, optional layout `9` archives, missing optional archives `none`
  - Recommended implementation:
    - prefer `react-native-skia-android/libs/${ANDROID_ABI}`
    - keep legacy fallback
    - validate expected archive basenames per ABI
    - fail clearly when neither valid layout exists
  - Recommended adding a source-level verifier because local Android builds are still blocked.

## Recommended next worker

- Objective: fix Android RN Skia archive discovery in `android/CMakeLists.txt`.
- Likely owned files/modules:
  - [`android/CMakeLists.txt`](../android/CMakeLists.txt)
  - a new or existing verifier script under [`scripts/`](../scripts)
  - [`package.json`](../package.json) only if adding a check script
  - the worker report under [`worker-progress/`](../worker-progress)
- Likely root-cause fix:
  - discover both the old in-package RN Skia Android archive layout and the current optional-package `react-native-skia-android/libs/${ANDROID_ABI}` layout
  - validate expected archive basenames per ABI
  - emit clear errors when neither valid layout exists
  - keep the change anchored in the Android native build path instead of patching the symptom elsewhere
- Suggested verification:
  - `bun run check:yoganode-native-runtime`
  - `bun run check:yoganode-native-lifetime`
  - `npm run typecheck`
  - `bun run check:install-isolation`
  - `bun run check:package-lifecycle`
  - `bun run specs`
  - `git diff --check`
  - `npm pack --dry-run --json` only if package surface is touched
- Explicit non-goals:
  - full iOS/Android app build-run
  - `lint-ci` repair
  - broad install-isolation cleanup
  - nativeID/nativeId API work
  - package lifecycle changes

## Quality/maintainability/performance/security review

- Quality: the Android build path is currently brittle because it still assumes an old archive layout that no longer matches the installed package topology.
- Maintainability: CMake archive discovery should be explicit and validated, not a single hard-coded glob that silently goes stale.
- Performance: the archive lookup set is small, so adding ABI-aware validation is low cost and should not materially affect build time.
- Security: clearer discovery and explicit failure modes reduce the risk of accidentally linking the wrong archive set or masking a packaging regression.
- `lint-ci` remains a real follow-up item, but it is not the best next root-cause target because the current failure is still tooling/configuration noise rather than product behavior.

## Remaining blockers

- The Android CMake root-cause fix is still unimplemented.
- Full iOS/Android build-run remains blocked by missing local native prerequisites.
- The runtime smoke and package checks are healthy, so the next worker should stay focused on Android archive discovery rather than widening scope.

## Files changed

- [`worker-progress/worker-022-next-root-cause-audit.md`](worker-progress/worker-022-next-root-cause-audit.md)

## Final git status

- `## worker/022-next-root-cause-audit`
- `?? worker-progress/worker-022-next-root-cause-audit.md`
