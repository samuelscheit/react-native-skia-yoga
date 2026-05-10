# Worker 038 Post-037 Root-Cause Audit

## Goal lifecycle: exact `create_goal` objective and exact visible gate

- `create_goal` objective: `Audit post-worker-037 state and rank the next root-cause target.`
- Required visible gate emitted immediately after goal creation:
  `GOAL_CREATED: Audit post-worker-037 state and rank the next root-cause target.`
- `update_goal(status="complete")` is reserved until this report, final `git diff --check`, final status capture, and cleanup checks are complete.

## Scope/read-only status

- Scope was read-only for product source, package metadata, generated Nitro files, orchestration docs, lockfiles, and example files.
- Only repository edit made by this worker: this report at `worker-progress/worker-038-post-037-root-cause-audit.md`.
- No commit was made.
- Pre-existing ignored local state was documented and left untouched:
  - `node_modules`
  - `example/node_modules`
- No generated matrix output required manual deletion.

## Baseline: branch, HEAD, status

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-038-post-037-root-cause-audit`
- Branch: `worker/038-post-037-root-cause-audit`
- HEAD: `2cc8c6bf3680691017729b531fcefbf72c583e8b`
- Initial `git status --short --branch`: `## worker/038-post-037-root-cause-audit`
- Initial `git status --ignored --short`: `!! example/node_modules` and `!! node_modules`

## Worker 037 coverage audit: what the new code and verifier do, and any gaps

- `src/YogaCanvas.tsx` now imports `CanvasProps` from the top-level `@shopify/react-native-skia` package only, imports `allocateYogaCanvasNativeId` from `./nativeId`, and no longer imports RN Skia `src/`, `lib/typescript/src/`, or `SkiaViewNativeId` internals.
- `src/YogaCanvas.tsx` still preserves the existing native-ID contract shape: `nativeId` is numeric for `SkiaYoga.*` calls and is passed to the native view as `nativeID={`${nativeId}`}`.
- `src/nativeId.ts` allocates IDs from `1_000_000_000` through `2_000_000_000`, then wraps to the start. That stays below Java `int` max and is far from the previously documented RN Skia `SkiaViewNativeId.current = 1000` seed.
- `package.json` exposes `check:rn-skia-imports` as `node ./scripts/verify-rn-skia-imports.mjs`.
- `scripts/verify-rn-skia-imports.mjs` scans `git ls-files`, excludes `worker-progress/` and Markdown, keeps tracked source-like extensions, and fails on:
  - literal `@shopify/react-native-skia/src/`
  - literal `@shopify/react-native-skia/lib/typescript/src/`
  - `@shopify/react-native-skia/lib/module/...SkiaViewNativeId`
  - `@shopify/react-native-skia/lib/commonjs/...SkiaViewNativeId`
- Coverage conclusion: the verifier covers the worker-037 acceptance requirement for direct tracked-source references to RN Skia `src/`, RN Skia `lib/typescript/src/`, and the private `SkiaViewNativeId` build-output deep paths.
- Guard gaps and caveats:
  - It is a regex/content scanner, not an import parser. It can false-positive comments and can be bypassed by constructed strings or aliases.
  - It intentionally ignores untracked files, Markdown, and worker reports.
  - It does not ban every possible RN Skia `lib/module` or `lib/commonjs` deep import; it bans the requested private `SkiaViewNativeId` deep paths there.
  - Historical mentions remain in reports and master docs, which is expected because planning/report Markdown is not source evidence.
- Additional source search found no matching private RN Skia source paths under `src`, `scripts`, `package.json`, `example`, `android`, `ios`, or `cpp`.

## Verification matrix: exact commands and results

- `git diff --check`: passed with no output.
- `npm run check:rn-skia-imports`: passed. It reported tracked source does not import private RN Skia internals and that worker progress reports/Markdown notes were not scanned.
- `npm run typecheck`: passed.
- `npm run lint-ci`: passed.
- `cd example && bun run typecheck`: passed.
- `bun run specs`: passed. Nitrogen generated 2/2 HybridObjects and left git status clean.
- `npm run check:example-bundle`: passed. Expo iOS export completed to `/tmp/rnskia-example-export.rSQuTY`, bundled successfully, and the verifier reported temporary output was cleaned.
- `npm run check:package-surface`: passed. It reported 119 packed files, all 30 `cpp/` files, representative iOS/Android/Nitrogen/package entrypoint files, and canonical podspec source metadata.
- `bun run check:install-isolation`: passed. It reported root dependency resolution stays in root `node_modules`.
- `bun run check:android-skia-archives`: passed. It reported the current optional package archives are complete under `node_modules/react-native-skia-android/libs` for all expected Android ABIs.
- `bun run check:yoganode-native-lifetime`: passed. It reported `clang++ -fsyntax-only` accepted the retained-descendant/reparenting probe and source invariants passed.
- `bun run check:yoganode-native-runtime`: passed. It compiled and linked the host executable against real `YogaNode.cpp`, Yoga sources, RN Skia macOS archives, and helper sources, then executed retained-descendant teardown and reparent ownership assertions.
- `perl -e 'alarm shift; exec @ARGV' 300 bun run check:package-lifecycle`: passed. It reported Bun hidden from `PATH`, dry-run pack kept private scripts out, packed package.json has no lifecycle hooks, and a temporary consumer install succeeded with lifecycle scripts enabled.
- Non-blocking npm warning observed on npm scripts: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Cleanup evidence

- Pre-matrix `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
- Pre-matrix `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' -o -name '*.tgz' \) -print`: no output.
- Post-matrix `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
- Post-matrix `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' -o -name '*.tgz' \) -print`: no output.
- `git status --short --branch` after the matrix and before this report was written remained clean: `## worker/038-post-037-root-cause-audit`.

## Platform-native blocker evidence

- `xcode-select -p`: `/Library/Developer/CommandLineTools`
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `command -v pod || true`: no output.
- `java -version`: failed; no Java Runtime was located.
- `command -v gradle || true`: no output.
- `command -v adb || true`: no output.
- `command -v cmake || true`: no output.
- `command -v ninja || true`: no output.
- `printenv ANDROID_HOME ANDROID_SDK_ROOT`: no output, exit code 1.
- `git ls-files example/ios example/android`: no output.
- Interpretation: full platform-native build/run remains externally blocked by local toolchain and generated native-project prerequisites, not by a newly observed repo-owned failure.

## Next root-cause ranking: top target, alternatives considered, why the top target is the strongest unblocked repo-owned task

1. Top target: add a packed-package TypeScript consumer smoke for public entrypoints and the JSX runtime contract.
   - Why: the current matrix proves source typecheck, example typecheck, package installation, package contents, bundle export, and native smoke paths. It does not prove that a fresh TypeScript consumer can install the packed package and compile `import { YogaCanvas } from "react-native-skia-yoga"` with `jsx: "react-jsx"` and `jsxImportSource: "react-native-skia-yoga"`.
   - Evidence: `example/tsconfig.skiayoga.json` maps `react-native-skia-yoga` to `../`, so example typecheck exercises the local source/workspace topology rather than the packed package as a consumer sees it.
   - Evidence: `scripts/verify-package-lifecycle.mjs` creates a temporary consumer and installs the packed tarball, but it stops after install; it does not run a TypeScript compile against package entrypoints or JSX declarations.
   - Evidence: `check:package-surface` checks the pack manifest, but manifest presence is weaker than resolving and compiling the published type/runtime declarations from a consumer project.
   - This is unblocked locally by the available TypeScript/package tooling and does not require Xcode, CocoaPods, Java, Android SDK, Gradle, ADB, CMake, Ninja, or generated native app folders.
2. Platform-native build/run verification.
   - Higher value once prerequisites exist, but currently blocked by local tools and absent tracked `example/ios`/`example/android`.
3. `src/SkiaYogaObject.ts` product import side-effect audit.
   - Real follow-up candidate: root `src/index.ts` re-exports `SkiaYoga`, and `src/SkiaYogaObject.ts` performs `turboModule.install()`, logs `react-native-skia-yoga initialized`, creates a hybrid object, and writes `globalThis.SkiaYoga` at import time.
   - Not top-ranked because `turboModule.install()` and Nitro initialization are likely required behavior; removing the log/global write should be preceded by a narrower design/usage audit and has no current failing verifier.
4. Additional RN Skia import guard broadening.
   - Not top-ranked because `check:rn-skia-imports` covers the direct worker-037 requirement. Broadening to all RN Skia `lib/module`/`lib/commonjs` internals could be useful later, but no current source occurrence or failure makes it stronger than the consumer typecheck gap.
5. Broader product runtime/API semantics work.
   - Examples include remaining design debt areas, but the accepted origin/animated-type and reset-semantics work already closed the clearest earlier API mismatches. Stronger native or runtime claims need platform prerequisites or a more focused failing probe.

## Nested challenger/subagent results

- First managed nested challenger spawn attempt used `fork_turns="all"` with `agent_type="explorer"`. The router rejected that shape with: `Full-history forked agents inherit the parent agent type, model, and reasoning effort; omit agent_type, model, and reasoning_effort, or spawn without a full-history fork.`
- Second managed nested read-only challenger spawned successfully as `/root/coverage_challenger` with `fork_turns="none"` and `agent_type="explorer"`.
- The challenger was asked to inspect the RN Skia import guard coverage and independently rank the next unblocked repo-owned target.
- It did not return a completed verdict after the initial wait window.
- A follow-up message asked it to stop exploration and return only the concise verdict.
- `list_agents` still showed `/root/coverage_challenger` with `completed: null`.
- The agent was closed; `close_agent` returned previous status `{"completed":null}`.
- Result: nested managed subagent stalled. This report does not claim nested acceptance evidence for the verifier conclusion or ranking.

## Quality, maintainability, performance, and security review

- Quality: the post-worker-037 state is green across the feasible matrix, and the new RN Skia import guard matches the direct acceptance requirement.
- Maintainability: the guard is simple and repo-owned, but its regex scope should be extended if the project wants a broader "no RN Skia private internals" policy beyond the current `src/`, `lib/typescript/src/`, and `SkiaViewNativeId` paths.
- Performance: the worker-037 allocator is O(1) and runs once per `YogaCanvas` instance through the existing `useMemo`; this audit did not identify performance regressions.
- Security: removing RN Skia private/deep imports reduces package-layout and supply-chain ambiguity. The remaining import-time `globalThis.SkiaYoga` write in `src/SkiaYogaObject.ts` is a plausible security/hygiene follow-up, but it ranks below the unguarded consumer typecheck contract.

## Final status and remaining risks

- Final handoff status is report-only with no product/source/package/generated/example edits from worker 038.
- Remaining risk: the RN Skia verifier can be bypassed by constructed strings or untracked files; it is sufficient for direct tracked-source path regressions, not a full import-policy parser.
- Remaining risk: JS/package/bundle checks still do not prove full iOS/Android runtime behavior while the local platform-native prerequisites remain absent.
- Remaining risk: nested challenger evidence is unavailable because the managed subagent stalled.
- Expected final `git status --short --branch` after this report: `## worker/038-post-037-root-cause-audit` plus `?? worker-progress/worker-038-post-037-root-cause-audit.md`.
