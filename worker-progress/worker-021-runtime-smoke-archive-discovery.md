# Worker 021 Runtime Smoke Archive Discovery

## Goal lifecycle
- Original worker goal gate line in `../worker-logs/worker-021-runtime-smoke-archive-discovery.jsonl` was exactly: `GOAL_CREATED: Restore check:yoganode-native-runtime archive discovery for current RN Skia macOS packaging.`
- The original worker completed the focused verification matrix, then hit a usage limit before it could write the report.
- This finalizer created the handoff goal `Finalize worker 021 runtime smoke archive discovery after usage exhaustion.` and finished the remaining review, edit, verification, and reporting work.

## Context reviewed
- Reviewed the current diff in `scripts/verify-yoganode-native-runtime-smoke.mjs`.
- Confirmed the installed archive layout in this workspace:
  - `node_modules/react-native-skia-apple-macos/libs/*.xcframework/macos-arm64_x86_64/*.a`
  - basenames: `libskia.a`, `libskottie.a`, `libskparagraph.a`, `libsksg.a`, `libskshaper.a`, `libskunicode_core.a`, `libskunicode_libgrapheme.a`, `libsvg.a`
- Confirmed `node_modules/@shopify/react-native-skia/libs/apple/macos` is not present in this checkout, so the optional package is the live source of archives here.
- Confirmed the worker log capture already contained the inherited nested reviewer concern about stale legacy layout selection.

## Root cause
- `skiaArchivePaths()` was selecting the first layout with any matching `.a` files.
- That let a stale or partial legacy `@shopify/react-native-skia/libs/macos` tree win ahead of the package actually paired with the installed RN Skia archives.
- The old logic had no validation that the candidate archive set actually contained the expected RN Skia macOS archives.

## Nested subagent results
- I did not launch any additional nested subagent in this finalizer.
- The inherited read-only reviewer had already identified the real risk:
  - first-match archive discovery could silently choose the wrong legacy tree
  - reporting should include matched paths, missing expected archives, checked roots, and resolved roots
  - archive roots should be validated before selection
- I used that inherited result to shape the fix rather than adding more agent churn.

## Changes
- Updated `scripts/verify-yoganode-native-runtime-smoke.mjs`.
- Reordered archive layout preference so the optional `react-native-skia-apple-macos` xcframework layout and the current bundled xcframework layout are checked before the legacy fallback.
- Added validation against the expected RN Skia macOS archive basenames before a layout can be selected.
- Kept the legacy `@shopify/react-native-skia/libs/macos` layout as a fallback for older installs.
- Expanded failure reporting to include:
  - checked root
  - resolved root
  - expected archive pattern
  - matched basenames
  - missing expected archives
  - actual matched archive paths

## Verification
- Passed `bun run check:yoganode-native-runtime`
- Passed `bun run check:yoganode-native-lifetime`
- Passed `npm run typecheck`
- Passed `bun run check:install-isolation`
- Passed `bun run check:package-lifecycle`
- Passed `git diff --check`
- Did not run `npm pack --dry-run --json` because the package surface was not touched

## Quality, maintainability, performance, security review
- The change removes an unsafe first-match heuristic and replaces it with explicit validation, which is the right root-cause fix.
- Error output is more actionable now and should shorten future triage when a workspace has mixed legacy/current Skia layouts.
- Performance impact is negligible because the archive discovery set is tiny and the extra basename validation is linear over a handful of files.
- Security risk is unchanged; the script only reads local package layout and links against local static archives.

## Files changed
- `scripts/verify-yoganode-native-runtime-smoke.mjs`

## Remaining risks
- If a future install ships a valid-but-wrong archive set with the expected basenames, the verifier will still accept it; the script now prevents stale legacy fallback selection, but it does not cryptographically verify archive provenance.
- The optional-package-first ordering matches this workspace and the inherited reviewer guidance, but if upstream packaging changes again the discovery order may need another adjustment.

## Final git status
- Branch: `worker/021-runtime-smoke-archive-discovery`
- Modified files:
  - `scripts/verify-yoganode-native-runtime-smoke.mjs`
