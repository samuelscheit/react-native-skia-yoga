# Worker 023 Android RN Skia Archive Discovery

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Fix Android RN Skia archive discovery for the current optional-package layout.`
- The original worker completed the root-cause patch work, then hit a usage limit before it could finish verification and write the report.
- A first fixup was rejected because its first visible gate line had a trailing newline in the JSON text, so the gate evidence was not accepted.
- Fixup-v2 passed the gate, ran verification, and spawned a nested read-only subagent to challenge the verifier design.
- Fixup-v2 then hit a usage limit before it could write the report.
- Fixup-v3 passed the gate, applied the verifier parser/list assertion fix, and then hit a usage limit before it could finish verification and report writing.
- Finalizer goal for this handoff was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 023 Android RN Skia archive discovery verification and report.`

## Root cause

- `android/CMakeLists.txt` still assumed the old in-package RN Skia Android archive layout.
- The current checkout uses the optional-package layout under `node_modules/react-native-skia-android/libs/${ANDROID_ABI}`.
- The old directory under `node_modules/@shopify/react-native-skia/libs/android/${ANDROID_ABI}` is absent here, so the build path needed explicit discovery rather than a single stale glob.
- The root cause was packaging/layout drift, not a downstream link symptom.

## Changes

- `android/CMakeLists.txt` now:
  - prefers `${NODE_MODULES_DIR}/react-native-skia-android/libs/${ANDROID_ABI}`
  - falls back to `${RN_SKIA_DIR}/libs/android/${ANDROID_ABI}`
  - validates the exact expected RN Skia Android archive basenames before linking
  - fails with a clear fatal error when neither complete layout exists
  - keeps the RN Skia include-path behavior unchanged
- `package.json` now exposes `check:android-skia-archives`.
- `scripts/verify-android-skia-archives.mjs` now:
  - parses the actual CMake `set(...)` lists for `RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES` and `RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIRS`
  - asserts the exact expected values and order
  - keeps filesystem checks for the optional-package archive layout
  - verifies the current optional-package archive directories are complete for all Android ABIs

## Nested subagent results

- Fixup-v2 spawned a read-only subagent that found two verifier robustness issues:
  - the verifier was using whole-file string search instead of parsing the CMake list bodies
  - the verifier could miss stale fallback preference regressions for the same reason
- Fixup-v3 applied the parser/list assertion fix before hitting its usage limit.
- The final verifier now checks the CMake list bodies directly, so the earlier review findings are addressed.

## Verification

- `bun run check:android-skia-archives` passed.
- `git diff --check` passed.
- `bun run check:yoganode-native-runtime` passed.
- `bun run check:yoganode-native-lifetime` passed.
- `npm run typecheck` passed.
- `bun run check:install-isolation` passed.
- `bun run check:package-lifecycle` passed.
- `bun run specs` passed and regenerated the Nitrogen outputs without leaving tracked diffs.
- `npm pack --dry-run --json` passed with the usual npm `minimum-release-age` warning.

## Quality/maintainability/performance/security review

- Quality: the Android archive discovery path is now explicit and ABI-aware instead of relying on a stale glob.
- Maintainability: the verifier checks the actual CMake list sources, which makes future layout drift easier to catch.
- Performance: the added lookup logic is bounded to a small static archive set, so build-time overhead is negligible.
- Security: clear failure modes reduce the chance of silently linking the wrong archive set or masking a packaging regression.

## Remaining risks/blockers

- Full Android build-run verification is still blocked by missing local Android toolchain prerequisites.
- The verifier still relies on source-level inspection plus filesystem probes, so future layout changes will need the same explicit update discipline.
- No further product-code issue was exposed by the verification matrix.

## Files changed

- [`android/CMakeLists.txt`](../android/CMakeLists.txt)
- [`package.json`](../package.json)
- [`scripts/verify-android-skia-archives.mjs`](../scripts/verify-android-skia-archives.mjs)

## Final git status

- `## worker/023-android-skia-archive-discovery`
- `M android/CMakeLists.txt`
- `M package.json`
- `?? scripts/verify-android-skia-archives.mjs`
- `?? worker-progress/worker-023-android-skia-archive-discovery.md`
