# Worker 020 Next Root-Cause Audit

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Audit the next unblocked root-cause target after package lifecycle hygiene.`
- That worker gathered the audit evidence, ran the feasible verification, documented the inherited challenger result, and then hit a usage limit before writing the report.
- This finalizer did not spawn a new nested subagent or explorer. It recovered the original log, rechecked the current repo state, and wrote this report.
- Finalizer goal for this handoff was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 020 next root-cause audit report after usage exhaustion.`

## Context reviewed

- Inherited worker log:
  - [`../worker-logs/worker-020-next-root-cause-audit.jsonl`](../worker-logs/worker-020-next-root-cause-audit.jsonl)
- Master planning and progress:
  - [`MASTER_PLAN.md`](../MASTER_PLAN.md)
  - [`MASTER_PROGRESS.md`](../MASTER_PROGRESS.md)
- Prior audit and hygiene reports:
  - [`worker-progress/worker-018-next-backlog-audit.md`](worker-progress/worker-018-next-backlog-audit.md)
  - [`worker-progress/worker-019-package-lifecycle-hygiene.md`](worker-progress/worker-019-package-lifecycle-hygiene.md)
- Current verifier and package wiring:
  - [`scripts/verify-yoganode-native-runtime-smoke.mjs`](../scripts/verify-yoganode-native-runtime-smoke.mjs#L123)
  - [`package.json`](../package.json#L32)

## Baseline/toolchain state

- The current installed RN Skia package is `@shopify/react-native-skia@2.4.18`, as captured in the inherited log and example lockfile context.
- The runtime smoke verifier still hard-codes the old archive root at `node_modules/@shopify/react-native-skia/libs/macos` in [`scripts/verify-yoganode-native-runtime-smoke.mjs`](../scripts/verify-yoganode-native-runtime-smoke.mjs#L123).
- The current install exposes macOS archives through the optional package layout `react-native-skia-apple-macos/libs/*.xcframework/.../*.a`, not the stale in-package `libs/macos` layout.
- A temp-only probe that changed only the archive root made the runtime smoke pass, which isolates the failure to verifier path discovery rather than to the native runtime logic itself.
- The local native toolchain remains incomplete for full app build/run work:
  - CocoaPods is unavailable.
  - `xcode-select -p` points at CommandLineTools rather than a full Xcode build path.
  - Java is unavailable.
  - `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` are unset.
  - `adb`, `gradle`, `cmake`, `sdkmanager`, and `ninja` are missing.
- Those blockers still prevent full iOS/Android build-run verification, but they do not block the higher-signal runtime smoke root-cause fix.

## Verification probes

- From the inherited worker log and worker reports:
  - `npm run typecheck` passed.
  - `bun run check:install-isolation` passed.
  - `bun run check:package-lifecycle` passed.
  - `bun run check:yoganode-native-lifetime` passed.
  - `bun run specs` passed and left no tracked diff.
  - `npm pack --dry-run --json` passed and showed 87 packed files.
  - `cd example && bun --bun ./node_modules/.bin/expo install --check` passed.
  - Parsed `cd example && bun --bun ./node_modules/.bin/react-native config` passed and confirmed the local package podspec, Android `sourceDir`, `new SkiaYogaPackage()`, library name, and component descriptor.
- From the inherited worker log and runtime smoke evidence:
  - `bun run check:yoganode-native-runtime` failed before compile because the verifier hard-coded the stale RN Skia macOS archive layout.
  - A temp-only adjusted probe that changed only the archive root made the runtime smoke pass.
- Finalizer checks required by this handoff:
  - `git status --short --branch`
  - `git diff --check`
  - `find . -maxdepth 1 -name '*.tgz' -print`

## Candidate targets considered

- `check:yoganode-native-runtime` was the top recommendation because it restores real host-native regression coverage from worker 013 without needing CocoaPods, full Xcode app builds, Java, Android SDK, Gradle, CMake, or device/simulator prerequisites.
- `lint-ci` was considered but is weaker right now because it currently fails from missing ESLint config rather than from a higher-signal native regression path.
- `nativeID/nativeId` was considered but is less compelling because Android inherits RN Skia native-id handling and iOS mirrors RN Skia handling.
- Package lifecycle work was considered but is already the completed worker 019 scope, so it is not the next root-cause target.
- Full iOS/Android build-run work remains important, but it is blocked by local toolchain prerequisites and is not the best next unblocked root-cause task.

## Nested subagent results

- No new nested subagent or explorer was spawned in this finalizer.
- Inherited challenger result from thread `019e0eb4-cb20-70c2-af58-e5ac352a05bd`:
  - `scripts/verify-yoganode-native-runtime-smoke.mjs` hard-codes RN Skia archives at `node_modules/@shopify/react-native-skia/libs/macos`.
  - The current install exposes archives through `react-native-skia-apple-macos/libs/*.xcframework/.../*.a`.
  - A temp-only adjusted probe that changed only the archive root made the smoke pass.
  - The runtime smoke re-enables real host-native coverage from worker 013 without CocoaPods, Xcode app builds, Java, Android SDK, Gradle, CMake, or device/simulator prerequisites.
  - The challenger explicitly rejected `lint-ci` and `nativeID/nativeId` as weaker next targets.

## Recommended next worker

- Objective: restore and harden `check:yoganode-native-runtime` against current RN Skia macOS archive packaging.
- Likely owned files/modules:
  - [`scripts/verify-yoganode-native-runtime-smoke.mjs`](../scripts/verify-yoganode-native-runtime-smoke.mjs)
  - [`package.json`](../package.json) if check wiring needs adjustment
  - the next worker report under [`worker-progress/`](../worker-progress)
- Likely root-cause fix:
  - discover both the old in-package RN Skia `libs/macos` archive layout and the current optional-package `react-native-skia-apple-macos/libs/*.xcframework/.../*.a` layout
  - emit clear errors when neither layout is present
  - keep the verifier anchored to the real runtime smoke path rather than a temp-only probe
- Suggested verification:
  - `bun run check:yoganode-native-runtime`
  - `bun run check:yoganode-native-lifetime`
  - `npm run typecheck`
  - `bun run check:install-isolation`
  - `bun run check:package-lifecycle`
  - `git diff --check`
  - `npm pack --dry-run --json` only if package surface is touched
- Explicit non-goals:
  - full iOS/Android app build-run
  - package lifecycle changes
  - `lint-ci` repair
  - API/nativeID work

## Quality/maintainability/performance/security review

- Quality: the current verifier fails for a packaging-layout reason, not because the runtime smoke itself is invalid.
- Maintainability: hard-coded archive roots make the verifier brittle across package layout changes.
- Performance: the host-native smoke is still a good choice because it keeps high-signal coverage without requiring full app builds.
- Security: clearer verifier discovery reduces the risk of silently validating the wrong archive set or falling back to an underspecified local layout.

## Remaining blockers

- The verifier fix is still unimplemented.
- Full iOS/Android build-run remains blocked by missing local native prerequisites.
- If the next worker broadens scope beyond archive discovery, it could waste the strongest available feedback loop.

## Files changed

- [`worker-progress/worker-020-next-root-cause-audit.md`](worker-progress/worker-020-next-root-cause-audit.md)

## Final git status

- `## worker/020-next-root-cause-audit`
- `?? worker-progress/worker-020-next-root-cause-audit.md`
