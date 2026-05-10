# Worker 034 Next Root-Cause Audit

## Goal lifecycle

- Original worker goal was created first with objective: `Audit post-worker-033 backlog and select the next root-cause target.`
- Original required visible goal gate was emitted before any repository inspection:
  `GOAL_CREATED: Audit post-worker-033 backlog and select the next root-cause target.`
- Original worker scope was honored before this finalizer: no product/source/config files were edited.
- Original managed nested challenger attempts stalled:
  - `/root/challenger` did not return a completed verdict after repeated waits and was closed with previous status `{"completed": null}`.
  - `/root/challenger_retry` also did not return a completed verdict after repeated waits and was closed with previous status `{"completed": null}`.
- A separate top-level tmux read-only challenger completed afterward and wrote
  `worker-progress/worker-034-next-root-cause-audit-tmux-challenger.md`.
- This finalizer goal was created first with objective:
  `Finalize worker 034 next root-cause audit report from completed tmux challenger evidence.`
- This finalizer emitted the required visible gate:
  `GOAL_CREATED: Finalize worker 034 next root-cause audit report from completed tmux challenger evidence.`
- Finalizer scope honored: updated only this report file and left the completed tmux challenger report unchanged.
- Deliverable status: complete. The completed top-level tmux challenger supersedes the original managed nested challenger blocker.

## Current baseline after worker 033

- Branch/worktree baseline: `worker/034-next-root-cause-audit`.
- Current HEAD evidence from the original worker: `6f5ca2c Record native package publish surface fix`.
- Worker 033 closed the strongest previous package-surface issue:
  - `package.json.files` includes `cpp` and `android/fix-prefab.gradle`.
  - `RNSkiaYoga.podspec` points at `https://github.com/SamuelScheit/react-native-skia-yoga.git`.
  - `check:package-surface` asserts required package/native files in the actual `npm pack --dry-run --json --ignore-scripts` manifest.
- The feasible verification matrix is green across package surface, lint, typecheck, specs, install isolation, Android archive discovery, YogaNode native checks, and example config/typecheck probes.
- Platform-native app build/run remains locally blocked by machine prerequisites and absent generated native project folders, not by new evidence from this audit.

## Evidence and commands

All command results below are from this worktree unless noted.

- `git diff --check`: passed.
- `find . -maxdepth 1 -name '*.tgz' -print`: no root tarballs.
- `npm run check:package-surface`: passed.
  - Manifest includes 118 files.
  - All 30 files under `cpp/` are published.
  - Representative iOS, Android, Nitrogen, and package entrypoint files are published.
  - Podspec source metadata points at the canonical repository.
- Direct `npm pack --dry-run --json --ignore-scripts` parse: passed.
  - `entryCount=118`
  - `missing=[]`
  - `cppEntries=30`
  - `androidEntries=12`
  - `iosEntries=9`
  - `nitrogenEntries=41`
  - Required sampled paths include `cpp/SkiaYoga.cpp`, `cpp/YogaNode.cpp`, `cpp/polyfill.h`, `android/fix-prefab.gradle`, `RNSkiaYoga.podspec`, and generated Nitro headers.
- `perl -e 'alarm shift; exec @ARGV' 240 bun run check:package-lifecycle`: passed.
  - Packed package has no lifecycle hooks.
  - Temporary consumer install succeeded with lifecycle scripts enabled and Bun hidden from `PATH`.
- `npm run lint-ci`: passed with no output warnings/errors.
- `npm run typecheck`: passed.
- `bun run specs`: passed and generated 2/2 HybridObjects.
- `bun run check:install-isolation`: passed.
- `bun run check:android-skia-archives`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `bun run check:yoganode-native-runtime`: passed.
- `cd example && bun --bun ./node_modules/.bin/expo install --check`: passed, `Dependencies are up to date`.
- `cd example && bun --bun ./node_modules/.bin/react-native config`: passed.
  - `project.ios=null` and `project.android=null` because no native project folders are tracked/generated in this worktree.
  - `react-native-skia-yoga` autolinking metadata is present:
    `RNSkiaYoga.podspec`, Android `sourceDir` ending in `/android`, `new SkiaYogaPackage()`, `libraryName=RNSkiaYogaSpec`, and `SkiaYogaViewComponentDescriptor`.
- `cd example && bun run typecheck`: passed.
- `cd example && bun --bun ./node_modules/.bin/expo config --type introspect --json`: passed.
  - `newArchEnabled=true`.
  - Plugins are Expo-owned entries only; no stale `react-native-skia-yoga` config-plugin entry.
- JS-only example bundle/export probe:
  - Original clean rerun command:
    `cd example && tmpdir=$(mktemp -d /tmp/rnskia-example-export.XXXXXX); perl -e 'alarm shift; exec @ARGV' 180 bun --bun ./node_modules/.bin/expo export --platform ios --output-dir "$tmpdir" --no-bytecode --no-minify; rc=$?; printf 'EXPORT_TMP=%s\n' "$tmpdir"; rm -rf "$tmpdir"; exit $rc`
  - Passed on rerun and cleaned the temporary output.
  - Bundled iOS in 1076 ms on the cached rerun, with 1684 modules and a 7.5 MB JS bundle.
  - The first wrapper failed only because it used zsh's read-only `status` variable; the bundle completed, temporary output was later cleaned, and the rerun using `rc` exited 0.
  - The probe exposed a repo-owned hygiene issue: `example/metro.config.js` prints the full Metro config from `console.log(finalConfig)`.
- Tmux challenger live export probe:
  - `cd example && perl -e 'alarm shift; exec @ARGV' 180 bun --bun ./node_modules/.bin/expo export --platform ios --output-dir "$tmp" --no-bytecode --no-minify`
  - Passed with exit 0, bundled 1744 modules, wrote output under `/tmp`, and removed the temp output.
  - The same full Metro config dump appeared before bundling, including absolute local paths.
- Current code evidence:
  - `example/metro.config.js` builds `finalConfig`, logs it with `console.log(finalConfig)`, then exports it.
  - Root `package.json` has checks for package surface, package lifecycle, install isolation, Android archive discovery, YogaNode native lifetime/runtime, lint, typecheck, and specs, but no example bundle/export smoke script.
  - `example/package.json` has no bundle/export smoke script.
  - `src/YogaCanvas.tsx` imports private RN Skia paths:
    `@shopify/react-native-skia/lib/typescript/src/views/api.d.ts`
    and `@shopify/react-native-skia/src/views/SkiaViewNativeId`.
  - `node -p "require.resolve('@shopify/react-native-skia/src/views/SkiaViewNativeId')"` failed, while resolving the `.ts` path succeeded; current Metro export still passes because Metro resolves TS source extensions.

Native toolchain blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed with `tool 'xcodebuild' requires Xcode` because the active developer directory is Command Line Tools.
- `pod --version`: `command not found: pod`.
- `java -version`: failed with `Unable to locate a Java Runtime`.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: empty.
- `gradle --version`: `command not found: gradle`.
- `adb version`: `command not found: adb`.
- `cmake --version`: `command not found: cmake`.
- `ninja --version`: `command not found: ninja`.
- `git ls-files example/ios example/android`: no tracked native folders.
- `git status --short --ignored example/ios example/android`: no generated native folders in this worker worktree.

## Challenger results

- Original worker managed nested challenger attempt 1 stalled and produced no completed verdict.
- Original worker managed nested challenger retry also stalled and produced no completed verdict.
- Separate top-level tmux challenger completed read-only review and wrote
  `worker-progress/worker-034-next-root-cause-audit-tmux-challenger.md`.
- Tmux challenger verdict: keep the original top target, narrowly defined as example JS bundle feedback-loop hygiene.
- Tmux challenger rationale:
  - the JS-only Expo export is the only currently working app-level feedback loop;
  - root `package.json` and `example/package.json` do not provide a script guarding that path;
  - export output is polluted by the full Metro config dump, including absolute local paths;
  - adding a bounded verifier makes later product-source work safer;
  - RN Skia private import cleanup is real product debt, but changing native ID allocation without native app build/run coverage is riskier.
- The completed tmux challenger supersedes the original blocker. The final ranking below is accepted, not provisional.

## Ranked next-target recommendation

1. Example JS bundle feedback-loop hygiene / Metro config console cleanup.
   - Final recommendation.
   - Next implementation worker scope should be exactly:
     - add a repo-owned bounded Expo export/bundle smoke command;
     - make the command write export output to a temporary directory;
     - ensure temporary output is always cleaned up on success or failure;
     - remove the repo-owned `console.log(finalConfig)` Metro config dump in `example/metro.config.js`;
     - keep this verifier separate from full native build/run;
     - verify the new scope with the new bundle smoke plus the relevant existing checks.
   - Acceptance should not require CocoaPods, full Xcode app builds, Java, Android SDK, Gradle, ADB, CMake, Ninja, or generated native projects.
2. RN Skia private import cleanup in `src/YogaCanvas.tsx`.
   - Real maintainability and upgrade risk.
   - Current code depends on RN Skia private source/declaration paths for the shared native view ID counter.
   - Rank second because current Metro export passes and changing ID allocation could regress native `ViewRegistry` behavior without full native app build/run coverage.
3. `src/SkiaYogaObject.ts` product import side effects.
   - The file installs the native module, logs initialization, creates the hybrid object, and mutates `globalThis` at import time.
   - Worth a later focused audit, but lower priority because current package/example checks and bundle export do not fail on it.
4. Platform-native build/run verification.
   - High value, but still blocked by local prerequisites listed above.

## Why higher-seeming alternatives are blocked or lower priority

- Full iOS/Android build/run is blocked by exact local prerequisites: full Xcode selection, CocoaPods, Java runtime, Android SDK environment/tooling, Gradle, ADB, CMake, Ninja, and native project folders.
- Retesting worker 033 package-surface completeness alone is lower priority because `check:package-surface`, direct pack parsing, and package lifecycle verification are green.
- Android and host-native archive/link smoke work is lower priority because `check:android-skia-archives`, `check:yoganode-native-lifetime`, and `check:yoganode-native-runtime` all pass.
- RN Skia private import hardening is important, but the current export path does not fail and the replacement strategy needs explicit native-ID collision/regression analysis.
- `src/SkiaYogaObject.ts` import side effects may be product debt, but `turboModule.install()` and Nitro initialization need narrower design work before changing global exposure.
- The Metro config dump is smaller than a native runtime bug, but it is an observed repo-owned defect in an unblocked feedback loop, and the missing script means that working feedback loop is not guarded by the repo.

## Quality / maintainability / performance / security review

- Quality: adding a JS bundle smoke covers the currently unguarded layer between typecheck/spec generation and full native build/run.
- Maintainability: owning the bundle/export command removes reliance on one-off shell probes and creates a repeatable acceptance check for later `YogaCanvas` and example integration work.
- Performance: the check should stay bounded and single-platform. Removing `console.log(finalConfig)` only reduces command/log overhead and does not change runtime behavior.
- Security: the Metro config dump exposes absolute local paths and resolver internals in logs. This is low severity but repo-owned and easy to eliminate.

## Remaining risks/blockers

- JS-only export validates bundling, not native runtime behavior.
- The new verifier will not replace iOS/Android app build/run validation once local prerequisites are available.
- RN Skia private import cleanup remains open and should be the next product-source target after the bundle verifier exists.
- Platform-native verification remains blocked locally until full Xcode/CocoaPods/Java/Android SDK and related tools are available.

## Files changed

- `worker-progress/worker-034-next-root-cause-audit.md`
- Existing completed challenger artifact intentionally left unchanged:
  `worker-progress/worker-034-next-root-cause-audit-tmux-challenger.md`

## Final git status

```text
## worker/034-next-root-cause-audit
?? worker-progress/worker-034-next-root-cause-audit-tmux-challenger.md
?? worker-progress/worker-034-next-root-cause-audit.md
```
