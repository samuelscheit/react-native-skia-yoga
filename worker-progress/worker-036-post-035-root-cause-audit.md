# Worker 036 Post-035 Root-Cause Audit

## Goal lifecycle

- `create_goal` objective: `Audit post-worker-035 state and rank the next root-cause target.`
- Required visible gate emitted before repository inspection or planning:
  `GOAL_CREATED: Audit post-worker-035 state and rank the next root-cause target.`
- Scope honored: this was a read-only root-cause audit for product/source/config files.
- Only repository edit made: this report at `worker-progress/worker-036-post-035-root-cause-audit.md`.
- `update_goal(status="complete")` is reserved until after this report is written and final status/diff-check evidence is captured.

## Current baseline after worker 035

- Branch/worktree: `worker/036-post-035-root-cause-audit`.
- Initial `git status --short --branch`: clean, showing only `## worker/036-post-035-root-cause-audit`.
- Initial `git diff --check`: passed with no output.
- `MASTER_PLAN.md` records worker 035 as accepted: root `check:example-bundle`, `scripts/verify-example-bundle-export.mjs`, removal of the `example/metro.config.js` full-config console dump, and worker reports under `worker-progress/`.
- Root `package.json` now includes `check:example-bundle`, `check:package-surface`, package lifecycle, install isolation, Android archive, YogaNode native lifetime/runtime, lint, typecheck, and specs scripts.
- `example/metro.config.js` now exports `finalConfig` without the old `console.log(finalConfig)` dump.
- No tracked `example/ios` or `example/android` folders are present.

## Commands and outcomes

- `npm run check:example-bundle`: passed.
  - Exported iOS bundle to `/tmp/rnskia-example-export.DayRBm`.
  - Bundled 998 modules in 1347 ms and wrote a 4 MB iOS bundle.
  - Verifier reported successful cleanup.
- Cleanup probes after bundle check:
  - `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
  - `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' -o -name '*.tgz' \) -print`: no output.
- `npm run lint-ci`: passed.
- `npm run typecheck`: passed.
- `bun run specs`: passed, generated 2/2 HybridObjects, and left git status clean.
- `npm run check:package-surface`: passed.
  - Manifest includes 118 files.
  - All 30 files under `cpp/` are published.
  - Representative iOS, Android, Nitrogen, and package entrypoint files are published.
  - Podspec source metadata points at the canonical repository.
- `cd example && bun run typecheck`: passed.
- `bun run check:install-isolation`: passed.
- `bun run check:android-skia-archives`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `bun run check:yoganode-native-runtime`: passed.
- `perl -e 'alarm shift; exec @ARGV' 240 bun run check:package-lifecycle`: passed.
- Post-native/package cleanup probes:
  - no repo `dist`, `.expo`, `rnskia-example-export.*`, or `.tgz` artifacts at depth 2.
  - no `/tmp/rnskia-example-export.*`, `/tmp/rnskia-package-lifecycle-*`, or `/tmp/rnskia-package-consumer-*` artifacts.
- Observed non-blocking npm warning: `Unknown user config "minimum-release-age"`.

## RN Skia private import evidence

- Current source still has the only tracked RN Skia private/deep imports:
  - `src/YogaCanvas.tsx:2` imports `@shopify/react-native-skia/lib/typescript/src/views/api.d.ts`.
  - `src/YogaCanvas.tsx:50-51` requires `@shopify/react-native-skia/src/views/SkiaViewNativeId` and types it through `@shopify/react-native-skia/lib/typescript/src/views/SkiaViewNativeId`.
  - `src/YogaCanvas.tsx:88-90` increments the imported counter.
  - `src/YogaCanvas.tsx:351` passes the generated value as `nativeID`.
- Fresh Node resolution probe:
  - `@shopify/react-native-skia/package.json` resolved from the example install.
  - `@shopify/react-native-skia` resolved to `lib/module/index.js`.
  - `@shopify/react-native-skia/src/views/SkiaViewNativeId` failed with `MODULE_NOT_FOUND`.
  - `@shopify/react-native-skia/src/views/SkiaViewNativeId.ts` resolved.
  - `@shopify/react-native-skia/lib/typescript/src/views/SkiaViewNativeId` failed with `MODULE_NOT_FOUND`.
  - `@shopify/react-native-skia/lib/typescript/src/views/SkiaViewNativeId.d.ts` resolved.
  - `@shopify/react-native-skia/lib/typescript/src/views/api.d.ts` resolved.
- Locally discoverable package facts for `@shopify/react-native-skia@2.4.18`:
  - `package.json` has no `exports` map.
  - It publishes `src/**` and `lib/**`.
  - Root types are `lib/typescript/index.d.ts`, which exports `./src`.
  - `lib/typescript/src/index.d.ts` exports `./views`, but `lib/typescript/src/views/index.d.ts` exports only `SkiaPictureView` and `types`; it does not export `SkiaViewNativeId` or `api`.
  - Root JS exports `./views`, and `lib/module/views/index.js` also exports only `SkiaPictureView` and `types`.
  - Build-output deep paths such as `@shopify/react-native-skia/lib/module/views/SkiaViewNativeId` and `@shopify/react-native-skia/lib/commonjs/views/SkiaViewNativeId` are Node-resolvable, but they are still private/deep package internals rather than a documented public API.
  - Public top-level `CanvasProps` is available and already used as a type import. No supported public native-ID allocator was discoverable locally.
- Native coupling evidence:
  - `cpp/SkiaYoga.cpp` looks up views through `RNSkia::ViewRegistry` by numeric native ID.
  - iOS `SkiaYogaViewManager.mm` forwards React Native `nativeID` into `SkiaUIView setNativeId`.
  - Android `SkiaYogaViewManager` inherits RN Skia's `SkiaBaseViewManager`, whose `setNativeId` parses the string and calls `registerView`.
  - RN Skia's own `Canvas` also allocates native IDs through `SkiaViewNativeId.current++`.
- Interpretation: Metro currently papers over the runtime import by resolving the `.ts` source file, and `npm run check:example-bundle` confirms that path still bundles. Node, Jest-style, or package-consumer tooling that does not resolve extensionless TypeScript source paths can fail before runtime. Replacing the current path with another `lib/module`/`lib/commonjs` deep import would improve Node resolution but would not remove the private API root cause.

## Native toolchain recheck

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `pod --version`: `command not found`.
- `java -version`: no Java Runtime located.
- `ANDROID_HOME=` and `ANDROID_SDK_ROOT=`.
- `gradle --version`: `command not found`.
- `adb version`: `command not found`.
- `cmake --version`: `command not found`.
- `ninja --version`: `command not found`.
- `git ls-files example/ios example/android`: no output.
- Platform-native app build/run remains externally blocked by local prerequisites. Fresh evidence does not show a repo-owned native app build/run blocker ahead of the RN Skia import cleanup.

## Challenger result

- Nested managed challenger objective:
  `challenge the preliminary ranking that the next unblocked repo-owned root-cause target after worker 035 should be RN Skia private import cleanup in src/YogaCanvas.tsx; compare against stronger package/native/example readiness gaps; verify the RN Skia private import evidence and locally discoverable alternatives; return a concise verdict and scope without edits.`
- Tool used: `spawn_agent` with `agent_type="explorer"`, task `/root/ranking_challenger`.
- Result: stalled. Two waits timed out, `list_agents` showed `completed: null`, and `close_agent` returned previous status `{"completed": null}`.
- This is documented as a blocker for challenger evidence. It is not treated as acceptance evidence for the recommendation.

## Ranked next-target recommendation

1. RN Skia private import cleanup in `src/YogaCanvas.tsx`.
   - Final recommendation.
   - Rationale: all stronger recent package/example/native smoke candidates are green, platform-native app build/run remains externally blocked, and this is the remaining product-source dependency on RN Skia internals with fresh Node resolution failure evidence.
   - This should be treated as a root-cause cleanup, not as a one-line path rewrite to another private deep import.
2. Platform-native build/run verification.
   - Higher value than an import cleanup when prerequisites exist, but still blocked locally by full Xcode/CocoaPods/Java/Android SDK/Gradle/ADB/CMake/Ninja and absent native project folders.
3. Package/native publish surface and lifecycle checks.
   - Not selected because `check:package-surface`, package lifecycle, install isolation, Android archive discovery, and YogaNode native smoke checks are all green.
4. Example feedback loop readiness.
   - Not selected because worker 035's root `check:example-bundle` now passes, cleans temp output, and the Metro config dump is gone. Example typecheck also passes.
5. Broader `SkiaYogaObject.ts` import-side-effect audit.
   - Still plausible product debt, but no fresh failing probe makes it stronger than the direct RN Skia private import evidence.

## Proposed next implementation scope

- Own `src/YogaCanvas.tsx` and, if needed, a tiny local helper under `src/` for Yoga view native ID allocation.
- Remove the side-effect import of `@shopify/react-native-skia/lib/typescript/src/views/api.d.ts` unless a fresh typecheck proves it is still required.
- Remove the runtime require of `@shopify/react-native-skia/src/views/SkiaViewNativeId`.
- Do not replace it with another RN Skia private/deep path as the final fix.
- Design a repo-owned native ID allocator that avoids practical collisions with RN Skia's current `SkiaViewNativeId.current = 1000` sequence while staying inside Java `int` range and preserving iOS/Android `nativeID` parsing.
- Add focused verification that no tracked source imports RN Skia `src/`, `lib/typescript/src/`, `lib/module/views/SkiaViewNativeId`, or `lib/commonjs/views/SkiaViewNativeId`.
- Verify at minimum:
  - `npm run lint-ci`
  - `npm run typecheck`
  - `bun run specs`
  - `npm run check:example-bundle`
  - `npm run check:package-surface`
  - `cd example && bun run typecheck`
  - cleanup probes for `/tmp/rnskia-example-export.*` and repo export artifacts
  - `git diff --check`
- If the implementation touches native ID semantics, explicitly document the remaining limitation that JS bundle/type checks do not prove full native runtime behavior while platform prerequisites remain missing.

## Remaining risks and blockers

- The recommended cleanup must preserve RN Skia `ViewRegistry` lookup behavior. A naive independent counter starting at the same seed as RN Skia would create collision risk when both RN Skia `Canvas` and `YogaCanvas` are used in one app.
- Locally discoverable RN Skia build-output deep imports are Node-resolvable but remain private internals, so they are not an adequate root-cause fix by themselves.
- `check:example-bundle` proves Metro bundling, not iOS/Android native runtime registration.
- Full platform-native build/run remains blocked by local prerequisites listed above.
- The managed nested challenger stalled, so the ranking rests on direct evidence rather than completed challenger validation.

## Final status evidence

- `git diff --check`: passed with no output after this report was written.
- Final cleanup probes returned no output for:
  - `/tmp/rnskia-example-export.*`
  - `/tmp/rnskia-package-lifecycle-*`
  - `/tmp/rnskia-package-consumer-*`
  - repo `dist`, `.expo`, `rnskia-example-export.*`, and `*.tgz` artifacts at max depth 2
- Final `git status --short --branch`:

```text
## worker/036-post-035-root-cause-audit
?? worker-progress/worker-036-post-035-root-cause-audit.md
```
