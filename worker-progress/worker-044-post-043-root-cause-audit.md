# Worker 044 Post-043 Root-Cause Audit

## Goal lifecycle

- `create_goal` objective: `Audit post-worker-043 state and rank the next root-cause target.`
- First visible gate message: `GOAL_CREATED: Audit post-worker-043 state and rank the next root-cause target.`
- `update_goal(status="complete")` is reserved until this report, final `git diff --check`, final status capture, and cleanup checks are complete.

## Scope and read-only status

- Scope was read-only for product source, package metadata, generated files, example files, and dependency manifests.
- Only repository edit made by this worker: this report at `worker-progress/worker-044-post-043-root-cause-audit.md`.
- No commit was made.
- Verification created ignored root `tsconfig.tsbuildinfo`; it was removed as verifier cleanup.
- No temporary package tarballs, external consumer dirs, lifecycle dirs, or Expo export output remain.

## Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-044-post-043-root-cause-audit`
- Branch: `worker/044-post-043-root-cause-audit`
- HEAD: `af90d301bf2d6844e290ed079cbfd581be0a65d0`
- `git show --stat --oneline --decorate -1`: `af90d30 (HEAD -> worker/044-post-043-root-cause-audit) Merge worker 043 public boundary cleanup`; stat covered `index.d.ts`, JSX runtime declarations, package verifier scripts, `src/Reconciler.ts`, `src/index.ts`, `src/internalTypes.ts`, `src/util.ts`, and worker 043's report.
- `git diff --name-status main...HEAD`: no output, because this worker branch starts at current `main`.
- Initial `git status --short --branch --ignored`:
  - `## worker/044-post-043-root-cause-audit`
  - `!! example/node_modules`
  - `!! node_modules`

## Worker 043 boundary audit

Worker 043 closed the public declaration/export boundary issue.

- `index.d.ts:1-45` is now an explicit public allowlist. It exports `YogaCanvas`, `YogaCanvasProfileSample`, public JSX/intrinsic/style/prop types, and public interaction event/handler types. It no longer wildcard re-exports `./src/index`.
- `src/index.ts:1-45` mirrors that explicit allowlist for the source-first runtime barrel. It no longer wildcard-exports implementation modules.
- `jsx-runtime.d.ts:1-16` and `jsx-dev-runtime.d.ts:1-16` now re-export the React JSX runtimes directly and define the package `JSX` namespace through `YogaJSX`, preserving `jsx: "react-jsx"` plus `jsxImportSource: "react-native-skia-yoga"`.
- `src/internalTypes.ts:1-13` is the internal-only home for `YogaNodeFinal`.
- `src/Reconciler.ts:12` and `src/util.ts:2` import `YogaNodeFinal` from `./internalTypes`, no longer through the public source barrel.
- Known internals are no longer exposed from the top-level package: `reconciler`, `createYogaNode`, `SkiaYoga`, `YogaNodeFinal`, `YogaRootContainer`, `SkiaYogaHostContext`, `YogaInteractionRegistry`, `YogaNodeInteractionConfig`, and `YogaNormalizedHitSlop`.

What remains intentionally source-first:

- `package.json:5-9` still points `main`, `module`, `react-native`, and `source` at `src/index`; `package.json:10-32` still publishes `src`.
- `scripts/verify-package-surface.mjs:28-33` and `scripts/verify-package-surface.mjs:101-109` intentionally require source-first runtime files such as `src/Reconciler.ts`, `src/SkiaYogaObject.ts`, and `src/util.ts` to remain packed.
- Public declarations still resolve through source helper modules such as `./src/YogaCanvas`, `./src/jsx`, `./src/interactivity`, and `./src/jsx-runtime-types`. That is consistent with the current React Native source-first package shape, but it remains a future hardening target if the project wants generated declarations.

## Verifier audit

- `scripts/verify-package-surface.mjs:130-196` checks the root declaration and JSX runtime declaration boundaries: public names must be present, wholesale source re-exports must be absent, and internal modules such as Reconciler/util/SkiaYogaObject must not be exposed from root declarations.
- `scripts/verify-package-surface.mjs:198-236` checks the source barrel boundary: `src/index.ts` must explicitly publish `YogaCanvas`, contain no `export *`, and not expose known implementation/internal names.
- `scripts/verify-package-surface.mjs:87-124` runs `npm pack --dry-run --json --ignore-scripts` and distinguishes physical publication of source-first runtime files from supported public API.
- `scripts/verify-package-typescript-consumer.mjs:23-33` creates an OS temp root with separate tarball and consumer dirs.
- `scripts/verify-package-typescript-consumer.mjs:107-132` runs a real `npm pack --json --ignore-scripts --pack-destination <temp>/tarball`.
- `scripts/verify-package-typescript-consumer.mjs:134-214` writes a standalone external TypeScript consumer with no `paths` or `baseUrl`; it installs the package from the tarball file URL and gives the consumer only `@types/react` and `typescript` as dev dependencies.
- `scripts/verify-package-typescript-consumer.mjs:223-307` compiles public package entrypoints, lowercase intrinsic JSX, `react-native-skia-yoga/jsx-runtime`, and `react-native-skia-yoga/jsx-dev-runtime`.
- `scripts/verify-package-typescript-consumer.mjs:310-344` uses meaningful `@ts-expect-error` assertions to reject internal top-level runtime/type exports including `reconciler`, `createYogaNode`, `SkiaYoga`, `YogaInteractionRegistry`, `YogaNodeFinal`, `YogaRootContainer`, `SkiaYogaHostContext`, `YogaNodeInteractionConfig`, and `YogaNormalizedHitSlop`.
- `scripts/verify-package-typescript-consumer.mjs:347-363` rejects symlink installs and package installs whose real path resolves inside the repo.
- `scripts/verify-package-typescript-consumer.mjs:103-105` removes the temp root in `finally`.

## Packed TypeScript consumer evidence

`npm run check:package-typescript-consumer` passed and printed:

```text
Packed package TypeScript consumer verifier passed:
- npm pack created a real tarball outside the repository.
- A temporary consumer installed react-native-skia-yoga from that tarball.
- Consumer TypeScript used jsx: react-jsx and jsxImportSource: react-native-skia-yoga.
- Public package entrypoints and lowercase intrinsic JSX compiled from the installed package.
- Public package boundary rejected internal top-level exports such as reconciler, createYogaNode, and SkiaYoga.
- Temporary consumer devDependencies: @types/react, typescript (no @types/react-reconciler).
- Packed dependency react-reconciler: 0.31.0.
- Packed dependency @types/react-reconciler: ^0.32.1.
```

Interpretation: the consumer evidence is meaningful. It uses a real packed artifact outside the repo, installs into an external temp consumer, avoids workspace links and TypeScript path shortcuts, exercises the public JSX runtime contract, and rejects accidental internal top-level exports.

## Verification matrix

- `git diff --check`: PASS, no output.
- `npm run check:package-typescript-consumer`: PASS; output summarized above.
- `npm run check:package-surface`: PASS. It reported 120 packed files, all 30 `cpp/` files, representative iOS/Android/Nitrogen/package entrypoint files, canonical podspec source metadata, and explicit source/declaration public allowlists.
- `npm run typecheck`: PASS. It created ignored `tsconfig.tsbuildinfo`, which was removed afterward.
- `npm run lint-ci`: PASS.
- `cd example && bun run typecheck`: PASS. Tool command was run with `example` as cwd; output was `tsc -p tsconfig.skiayoga.json --noEmit`.
- `bun run specs`: PASS. Nitrogen generated 2/2 HybridObjects under `./nitrogen/generated`; no tracked drift remained.
- `npm run check:example-bundle`: PASS. Expo iOS export completed and temporary output was cleaned.
- `bun run check:install-isolation`: PASS. It reported root dependency resolution stays in root `node_modules`.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: PASS. It reported the PATH shim exposes node/npm/tar while keeping Bun unavailable, dry-run pack kept private scripts out, packed `package.json` has no lifecycle hooks, and a temporary consumer install succeeded with lifecycle scripts enabled.
- `npm run check:rn-skia-imports`: PASS. It reported tracked source does not import private RN Skia internals and worker progress/Markdown planning notes were not scanned.
- `bun run check:android-skia-archives`: PASS. It reported complete optional RN Skia Android archives for all expected ABIs and guarded Android CMake archive discovery.
- `bun run check:yoganode-native-lifetime`: PASS. It reported `clang++ -fsyntax-only` accepted retained-descendant teardown and reparenting probes, and source invariants passed.
- `bun run check:yoganode-native-runtime`: PASS. It compiled, linked, and executed a host runtime smoke against real `YogaNode.cpp`, upstream Yoga sources, RN Skia macOS archives, and helper sources; retained-descendant teardown, post-teardown mutation safety, and reparent ownership assertions passed.
- Npm-run commands printed the non-blocking warning: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Platform-native blocker evidence

- `xcode-select -p`: `/Library/Developer/CommandLineTools`
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `command -v pod || true`: no output.
- `java -version`: failed with `Unable to locate a Java Runtime`.
- `command -v gradle || true`: no output.
- `command -v adb || true`: no output.
- `command -v cmake || true`: no output.
- `command -v ninja || true`: no output.
- `printenv ANDROID_HOME ANDROID_SDK_ROOT`: no output, exit code 1.
- `git ls-files example/ios example/android`: no output.

Interpretation: full iOS/Android native build-run verification remains blocked by external prerequisites and absent tracked example native projects, not by a newly observed repo-owned failure.

## Next root-cause ranking

1. `src/SkiaYogaObject.ts` import-time native/global side effects.
   - Top target. It is repo-owned, unblocked, and now the strongest remaining root-cause candidate after worker 043 closed the public export boundary.
   - Evidence: supported public use imports `YogaCanvas`; `src/YogaCanvas.tsx:14` imports `SkiaYoga` from `./SkiaYogaObject` at module load.
   - `src/SkiaYogaObject.ts:6-24` performs `TurboModuleRegistry.getEnforcing`, throws if the native module is unavailable, calls `turboModule.install()`, logs initialization, creates the `SkiaYoga` hybrid object, and writes `globalThis.SkiaYoga` at import time.
   - Current verifiers compile, pack, and bundle the package, but none proves import-only behavior is safe, idempotent, lazy, or free of global mutation before a mounted `YogaCanvas` actually needs native access.
   - Acceptance direction: evaluate a lazy/guarded initialization API for `SkiaYoga` with idempotent install, clear native-missing errors, and a verifier that import-only package access does not install or mutate globals unless that behavior is intentionally documented.
2. Remaining source-first declaration coupling.
   - `index.d.ts` and JSX runtime declarations still resolve through published source helper modules. This is intentionally compatible with the current React Native source-first package, and the packed-consumer verifier passes.
   - It is worth hardening later with generated declarations or declaration helper files if the project wants to further isolate implementation modules from consumer type resolution.
3. Package subpath/export-map hardening.
   - `package.json` has no `exports` map, and published `src` deep imports remain physically possible. Adding an export map could harden unsupported subpaths, but it can also break Metro/React Native source-first resolution if done without a compatibility design.
   - Rank stays below import-time side effects because the current top-level public API is now asserted and green.
4. Additional RN Skia/private import guard broadening.
   - `scripts/verify-rn-skia-imports.mjs:11-28` blocks `@shopify/react-native-skia/src/`, `lib/typescript/src/`, and private `SkiaViewNativeId` build-output paths; the command passes.
   - A stricter public-subpath allowlist could be useful, but no active private-import failure was found.
5. Platform-native build/run verification.
   - High value once prerequisites exist, but still blocked by full Xcode/CocoaPods/Java/Android SDK/Gradle/ADB/CMake/Ninja and absent tracked example native projects.
6. No stronger unblocked repo-owned target was found during this audit.

## Nested challenger results

- Initial two managed challenger spawn attempts failed before creation because full-history forks cannot override `agent_type` in this environment.
- Successful read-only challenger `/root/boundary_challenger` was spawned with `agent_type="explorer"` and `fork_turns="none"`.
  - Prompt summary: inspect post-worker-043 public declaration/export boundary across `index.d.ts`, source barrels, JSX runtime declarations, internal type plumbing, package scripts, and verifier scripts; include file/line references and commands; do not edit files.
  - Result: stalled. It remained at `completed: null` after two wait windows and was closed. No acceptance evidence is claimed.
- Successful read-only challenger `/root/ranking_challenger` was spawned with `agent_type="explorer"` and `fork_turns="none"`.
  - Prompt summary: independently rank the next repo-owned target after worker 043, considering `SkiaYogaObject` import-time side effects, declaration coupling, export-map hardening, RN Skia guard broadening, and platform-native blockers; do not edit files.
  - Result: stalled. It remained at `completed: null` after two wait windows and was closed. No acceptance evidence is claimed.

## Cleanup evidence

The required cleanup probes produced no output:

- `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

After removing verifier-created `tsconfig.tsbuildinfo`, pre-report `git status --short --branch --ignored` returned only the initial ignored dependency directories.

## Quality, maintainability, performance, and security review

- Quality: the full feasible local matrix is green, including the packed external TypeScript consumer and host-side native lifetime/runtime smoke checks.
- Maintainability: worker 043 improved the public API contract by replacing wildcard exports with allowlists. The main maintainability risk is now hidden import-time behavior rather than public type ambiguity.
- Performance: no verifier showed runtime regression. Lazy or guarded `SkiaYoga` initialization should preserve hot-path access after first use while avoiding unnecessary native work on import-only paths.
- Security/safety: removing internals from top-level exports reduced accidental native API exposure. Remaining concern is the import-time `globalThis.SkiaYoga` write and native install side effects before explicit component use.
- Compatibility: source-first packaging remains intentional for React Native. Deep imports into `src` are physically possible but not supported public API.

## Final status and remaining risks

- Final post-report `git diff --check`: PASS, no output.
- Final post-report `git status --short --branch`:
  - `## worker/044-post-043-root-cause-audit`
  - `?? worker-progress/worker-044-post-043-root-cause-audit.md`
- Final post-report `git status --short --branch --ignored` adds only the initial ignored dependency directories:
  - `!! example/node_modules`
  - `!! node_modules`
- Final cleanup probes for repository, Node OS temp dir, and `/tmp` tarball/consumer/lifecycle/export patterns all returned no output.
- Remaining risk: `SkiaYogaObject` import-time native/global initialization may still affect import-only tooling, tests, docs, or runtime paths before a `YogaCanvas` mount.
- Remaining risk: public declarations still depend on source helper modules by design.
- Remaining risk: package export-map hardening could improve deep-import clarity but needs React Native compatibility design.
- Remaining risk: full iOS/Android platform-native build-run verification remains externally blocked.
- Remaining risk: nested challenger acceptance evidence is unavailable because both read-only challengers stalled.
