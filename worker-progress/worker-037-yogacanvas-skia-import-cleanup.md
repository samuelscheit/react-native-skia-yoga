# Worker 037 YogaCanvas RN Skia Import Cleanup

## Goal lifecycle

- `create_goal` objective: `Remove YogaCanvas RN Skia private imports and add native ID guard coverage.`
- Required visible gate emitted before repository inspection or planning:
  `GOAL_CREATED: Remove YogaCanvas RN Skia private imports and add native ID guard coverage.`
- Scope honored: implementation was limited to `src/YogaCanvas.tsx`, a small `src/nativeId.ts` helper, one verifier script, `package.json`, and this worker report.
- `update_goal(status="complete")` is reserved until this report, final cleanup probes, `git diff --check`, and final status capture are complete.

## Summary of implementation

- Removed the YogaCanvas side-effect import of `@shopify/react-native-skia/lib/typescript/src/views/api.d.ts`.
- Removed the YogaCanvas runtime require/type import of `@shopify/react-native-skia/src/views/SkiaViewNativeId` and its `lib/typescript/src` type path.
- Added `allocateYogaCanvasNativeId()` in `src/nativeId.ts` using the dedicated range `1_000_000_000` through `2_000_000_000`.
  - This is clearly separated from RN Skia's locally observed `SkiaViewNativeId.current = 1000`.
  - The range stays below Java `int` max `2_147_483_647`.
  - The wrap point would require roughly one billion YogaCanvas allocations before reuse.
- Preserved existing native API behavior:
  - `nativeId` remains a number.
  - `SkiaYoga` calls still receive `nativeId`.
  - `SkiaYogaViewNativeComponent` still receives `nativeID={`${nativeId}`}`.
- Added `scripts/verify-rn-skia-imports.mjs` and package script `check:rn-skia-imports`.
  - It scans `git ls-files` source/code files.
  - It excludes `worker-progress/` and Markdown planning/report files.
  - It fails on RN Skia `src/`, RN Skia `lib/typescript/src/`, and private `SkiaViewNativeId` deep paths under `lib/module/` or `lib/commonjs/`.
- Fresh typecheck passed after removing the `api.d.ts` side-effect import, so no repo-owned replacement declaration was needed.

## Files changed

- `src/YogaCanvas.tsx`
- `src/nativeId.ts`
- `scripts/verify-rn-skia-imports.mjs`
- `package.json`
- `worker-progress/worker-037-yogacanvas-skia-import-cleanup.md`

## Verification results

- `npm run check:rn-skia-imports`: passed.
  - Reported tracked source does not import private RN Skia internals.
  - Reported worker progress and Markdown planning notes were not scanned.
- `npm run lint-ci`: passed.
- `npm run typecheck`: passed.
- `bun run specs`: passed.
  - Generated 2/2 HybridObjects.
- `npm run check:example-bundle`: passed.
  - Exported the iOS example bundle.
  - Cleaned temporary output.
- `npm run check:package-surface`: passed.
  - npm pack dry-run manifest includes 119 files.
  - All 30 files under `cpp/` are published.
  - Representative iOS, Android, Nitrogen, and package entrypoint files are published.
  - Podspec source metadata points at the canonical repository.
- `cd example && bun run typecheck`: passed.
- `git diff --check`: passed before this report was written.
- `git diff --check`: passed after this report was written.
- Cleanup probes before this report was written:
  - `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
  - `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' -o -name '*.tgz' \) -print`: no output.
- Cleanup probes after this report was written:
  - `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
  - `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' -o -name '*.tgz' \) -print`: no output.
- Observed non-blocking npm warning during npm scripts:
  - `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Nested challenger results

- First read-only nested challenger:
  - Task: review private import removal, allocator collision range, guard coverage, and cleanup probes.
  - Spawned as `/root/nested_challenger`.
  - Result: stalled. It did not return a completed verdict after repeated waits.
  - Closed with previous status `{"completed": null}`.
- Required retry:
  - Spawned as `/root/nested_challenger_retry` with no full-history fork and no model or agent-type override.
  - Result: stalled. It did not return a completed verdict after repeated waits, including a 300 second wait.
  - Closed with previous status `{"completed": null}`.
- No nested challenger completed a verdict. This report does not claim nested review acceptance evidence.

## Quality, maintainability, performance, and security review

- Quality: YogaCanvas no longer depends on RN Skia private package internals for native view ID allocation.
- Maintainability: the allocator is isolated in a repo-owned helper with a small API surface.
- Performance: native ID allocation remains O(1) and happens once per YogaCanvas instance through the existing `useMemo`.
- Security/supply-chain: removing private deep imports reduces package-layout coupling to RN Skia internals.
- Guard coverage: the new verifier checks tracked source for the requested private RN Skia import shapes and avoids using worker reports as source evidence.

## Remaining risks/blockers

- Platform-native app build/run remains out of scope and locally blocked by the previously documented missing prerequisites.
- The verifier scans tracked source via `git ls-files`; untracked local scratch files are intentionally not treated as source evidence.
- The managed nested challenger requirement was attempted and retried as required, but no completed nested verdict was returned.

## Final git status

```text
## worker/037-yogacanvas-skia-import-cleanup
 M package.json
 M src/YogaCanvas.tsx
?? scripts/verify-rn-skia-imports.mjs
?? src/nativeId.ts
?? worker-progress/worker-037-yogacanvas-skia-import-cleanup.md
```
