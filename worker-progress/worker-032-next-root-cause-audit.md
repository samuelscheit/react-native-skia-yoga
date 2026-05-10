# Worker 032 Next Root-Cause Audit

## Goal Lifecycle

- Goal created: `Finalize worker 032 next root-cause audit report from completed evidence.`
- Scope: report-only finalizer after the original worker hit a usage limit.
- Constraint honored: no product/source/config files were edited.
- Required deliverable: one report file at `worker-progress/worker-032-next-root-cause-audit.md`.
- Nested challenge result reused from completed log item `item_64`.

## Current Baseline

- The strongest next unblocked repo-owned target is native package publish-surface completeness.
- This is not a failing lint, typecheck, or specs issue.
- The remaining mismatch is between the package manifest surface and the native source files required by the podspec and Android build.
- Platform-native build/run work is still locally blocked by missing machine prerequisites, so that path is not the best next repo-owned target.

## Candidate Targets Considered

1. Fix native package publish-surface completeness.
1. Retest lint/typecheck/specs/package-lifecycle only.
1. Wait for platform-native prerequisites.
1. Chase a broader native build/run investigation.

## Recommended Next Worker

- Recommended target: publish-surface completeness and metadata cleanup.
- Scope this as worker 033 with clear ownership of:
  - `package.json`
  - `RNSkiaYoga.podspec`
  - a package publish-surface verifier under `scripts/` or the existing check harness
- Required outcomes for that worker:
  - add `cpp/` to the published files surface
  - correct the stale podspec source metadata to the canonical repository
  - extend verification so `npm pack --dry-run --json` asserts required native paths are present in the packed manifest, especially `cpp/`, podspec, Android/iOS/native/generated entrypoints
- Verification scope for that worker:
  - `npm pack --dry-run --json --ignore-scripts`
  - `bun run check:package-lifecycle`
  - `npm run lint-ci`
  - `npm run typecheck`
  - `bun run specs`
  - `git diff --check`

## Nested Subagent Results

- Completed nested result `item_64` confirmed the recommendation.
- Core conclusion from the challenger:
  - `package.json.files` omits `cpp/`
  - `npm pack --dry-run --json --ignore-scripts` produced 87 entries with zero `cpp/*` files
  - `RNSkiaYoga.podspec` includes `cpp/**/*.{hpp,cpp}` and force-includes `cpp/polyfill.h`
  - `android/CMakeLists.txt` globs `../cpp` sources and include dirs
  - `RNSkiaYoga.podspec` still points `s.source` at stale `mrousavy/nitro`
- The challenger explicitly found no stronger unblocked target.
- The challenger also noted that retesting lint/typecheck/specs/package-lifecycle alone is weak because worker 031 already has those green, and current package checks do not assert native source presence in the packed manifest.

## Verification / Probe Results

- Baseline repo state:
  - `git status --short --branch` was clean before this report was written.
  - `git diff --check` passed before this report was written.
  - `find . -maxdepth 1 -name '*.tgz' -print` returned nothing.
- Manifest probe results:
  - `cpp/missing`
  - `ios/present`
  - `android/present`
  - `nitrogen/generated/present`
  - `src/present`
  - `entryCount=87`
  - `cppEntries=0`
  - `podspec=RNSkiaYoga.podspec`
- Package surface evidence:
  - `package.json` `files` includes `src`, `nitrogen`, Android/iOS files, shims, podspec, and README.
  - `package.json` does not include `cpp/`.
- Native build metadata evidence:
  - `RNSkiaYoga.podspec` includes `cpp/**/*.{hpp,cpp}` in `s.source_files`.
  - `RNSkiaYoga.podspec` force-includes `cpp/polyfill.h`.
  - `RNSkiaYoga.podspec` still points `s.source` at `mrousavy/nitro`.
  - `android/CMakeLists.txt` globs `../cpp` sources and adds the include directory.

## Quality / Maintainability / Performance / Security Review

- Quality: the published package currently omits native C++ sources that the podspec and Android build expect, so the consumer contract is incomplete.
- Maintainability: stale source metadata in the podspec and a missing `cpp/` publish surface increase upgrade and release fragility.
- Performance: no runtime performance regression was identified from the audit evidence.
- Security: no direct security issue was identified, but an incomplete publish surface can create release-time ambiguity around what native code is actually shipped.

## Remaining Risks / Blockers

- Full native build/run validation still depends on local Xcode, CocoaPods, Java, Android SDK, Gradle, ADB, CMake, and Ninja prerequisites that are not present in the current environment.
- The package verifier still needs an explicit assertion for native source presence, otherwise the `npm pack` path can keep passing while `cpp/` remains absent.
- If the package surface is updated without a verifier, the regression could recur later.

## Files Changed

- `worker-progress/worker-032-next-root-cause-audit.md`

## Final Git Status

- `git status --short --branch`: `## worker/032-next-root-cause-audit`
- No `.tgz` artifacts were present at the repo root.
