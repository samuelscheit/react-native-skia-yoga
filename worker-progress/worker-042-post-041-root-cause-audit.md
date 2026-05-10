# Worker 042 Post-041 Root-Cause Audit

## Goal lifecycle

- `create_goal` objective: `Audit post-worker-041 state and rank the next root-cause target.`
- Required visible gate emitted immediately after goal creation:
  `GOAL_CREATED: Audit post-worker-041 state and rank the next root-cause target.`
- `update_goal(status="complete")` is reserved until this report, final `git diff --check`, final status capture, and cleanup checks are complete.

## Scope and read-only status

- Scope was read-only for product source, package metadata, lockfiles, generated Nitro files, example files, and orchestration docs.
- Only repository edit made by this worker: this report at `worker-progress/worker-042-post-041-root-cause-audit.md`.
- No commit was made.
- Verification created ignored root `tsconfig.tsbuildinfo`; it was not present in the initial ignored status and was removed as verifier cleanup.
- No temp tarballs, temp consumers, or Expo export output remain.

## Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-042-post-041-root-cause-audit`
- Branch: `worker/042-post-041-root-cause-audit`
- HEAD: `cb5b8903d2b9812b9c2e5d5bafdf70568df6cbb5`
- `git show --stat --oneline --decorate -1`: `cb5b890 (HEAD -> worker/042-post-041-root-cause-audit) Merge worker 041 reconciler dependency hygiene`; stat was `bun.lock`, `package.json`, `scripts/verify-package-typescript-consumer.mjs`, and `worker-progress/worker-041-reconciler-dependency-hygiene.md`, with 217 insertions and 13 deletions.
- `git diff --name-status main...HEAD`: no output, because this worker branch starts at current `main`.
- Initial `git status --short --branch`: `## worker/042-post-041-root-cause-audit`
- Initial `git status --short --branch --ignored`:
  - `## worker/042-post-041-root-cause-audit`
  - `!! example/node_modules`
  - `!! node_modules`

## Worker 041 dependency-hygiene audit

Worker 041 closed the package-surface dependency hygiene issue for the direct Reconciler dependency.

- `package.json:111-115` publishes direct dependencies `react-reconciler: "0.31.0"` and `@types/react-reconciler: "^0.32.1"` alongside `react-native-nitro-modules`.
- `package.json:69-79` no longer has `@types/react-reconciler` in root `devDependencies`; a read-only Node probe printed `dev_has_types=false`, `dep_reconciler=0.31.0`, and `dep_types=^0.32.1`.
- `bun.lock:5-11` mirrors the root workspace dependency graph with both published Reconciler dependencies.
- `bun.lock:935` records `react-reconciler@0.31.0` with dependency `scheduler: ^0.25.0`, `bun.lock:973` records `scheduler@0.25.0`, and `bun.lock:1237` keeps the separate `react-native/scheduler` entry at `scheduler@0.26.0`.
- `scripts/verify-package-typescript-consumer.mjs:157-160` now gives the temporary consumer only `@types/react` and `typescript` dev dependencies.
- `scripts/verify-package-typescript-consumer.mjs:197-200` asserts the temporary consumer must not declare `@types/react-reconciler`.
- `scripts/verify-package-typescript-consumer.mjs:300-336` reads the installed packed package from the external consumer, rejects symlinks/repo paths, and asserts the packed `package.json` declares both `react-reconciler` and `@types/react-reconciler`.
- `scripts/verify-package-typescript-consumer.mjs:83-99` prints the temporary consumer dev dependencies and the packed dependency versions on success.

What remains intentionally source-first:

- `package.json:5-9` still points `main`, `module`, `react-native`, and `source` at `src/index`; `package.json:7` points `types` at `index.d.ts`.
- `index.d.ts:1` still re-exports `./src/index`.
- `src/index.ts:16-20` still exports `./Reconciler`, `./jsx`, `./util`, and `./YogaCanvas`; `src/index.ts:6` exports `SkiaYoga` from `./SkiaYogaObject`.
- `src/Reconciler.ts:10-11` directly imports `react-reconciler` and `react-reconciler/constants`, and `src/Reconciler.ts:1167` exports `reconciler`.
- `npm pack --json --dry-run --ignore-scripts` reported `file_count=119` and confirmed `index.d.ts`, `src/index.ts`, `src/Reconciler.ts`, `src/SkiaYogaObject.ts`, and `jsx-runtime.d.ts` are still published.

## Packed-package TypeScript consumer evidence

`npm run check:package-typescript-consumer` is meaningful external consumer evidence after worker 041.

- `scripts/verify-package-typescript-consumer.mjs:23-31` creates an OS temp root with separate `tarball` and `consumer` directories.
- `scripts/verify-package-typescript-consumer.mjs:104-128` runs `npm pack --json --ignore-scripts --pack-destination <temp>/tarball`, so the package is installed from a real tarball outside the repo.
- `scripts/verify-package-typescript-consumer.mjs:137-155` installs `react-native-skia-yoga` from the tarball file URL plus peer/runtime packages, not from workspace links.
- `scripts/verify-package-typescript-consumer.mjs:163-179` writes `jsx: "react-jsx"` and `jsxImportSource: "react-native-skia-yoga"`.
- `scripts/verify-package-typescript-consumer.mjs:182-195` rejects `paths` and `baseUrl` shortcuts in the consumer tsconfig.
- `scripts/verify-package-typescript-consumer.mjs:216-297` compiles public package imports, `react-native-skia-yoga/jsx-runtime`, `YogaCanvas`, exported public types, and lowercase intrinsic JSX (`rect`, `group`, `rrect`, `circle`, `text`).
- `scripts/verify-package-typescript-consumer.mjs:306-316` rejects symlink installs and rejects installed package real paths inside the repo.
- `scripts/verify-package-typescript-consumer.mjs:100-102` removes the entire temp root in `finally`.

The command passed and printed:

```text
Packed package TypeScript consumer verifier passed:
- npm pack created a real tarball outside the repository.
- A temporary consumer installed react-native-skia-yoga from that tarball.
- Consumer TypeScript used jsx: react-jsx and jsxImportSource: react-native-skia-yoga.
- Public package entrypoints and lowercase intrinsic JSX compiled from the installed package.
- Temporary consumer devDependencies: @types/react, typescript (no @types/react-reconciler).
- Packed dependency react-reconciler: 0.31.0.
- Packed dependency @types/react-reconciler: ^0.32.1.
```

## Verification matrix

- `git diff --check`: PASS, no output.
- `npm run check:package-typescript-consumer`: PASS. Output confirmed real external tarball packing, temporary external consumer install, `jsx: react-jsx`, `jsxImportSource: react-native-skia-yoga`, public entrypoints/lowercase JSX compilation, no consumer-side `@types/react-reconciler`, and packed `react-reconciler` / `@types/react-reconciler` dependency versions.
- `npm run typecheck`: PASS. It created ignored root `tsconfig.tsbuildinfo`, which was removed afterward.
- `npm run lint-ci`: PASS.
- `cd example && bun run typecheck`: PASS. Output was `tsc -p tsconfig.skiayoga.json --noEmit`.
- `bun run specs`: PASS. Nitrogen generated 2/2 HybridObjects in `./nitrogen/generated`.
- `npm run check:example-bundle`: PASS. Expo iOS export completed and temporary output was cleaned.
- `npm run check:package-surface`: PASS. It reported 119 packed files, all 30 `cpp/` files, representative iOS/Android/Nitrogen/package entrypoint files, and canonical podspec source metadata.
- `bun run check:install-isolation`: PASS. It reported root dependency resolution stays in root `node_modules`.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: PASS. It reported the PATH shim exposes node/npm/tar while keeping Bun unavailable, dry-run pack kept private scripts out, packed `package.json` has no lifecycle hooks, and a temporary consumer install succeeded with lifecycle scripts enabled.
- `npm run check:rn-skia-imports`: PASS. It reported tracked source does not import private RN Skia internals and worker progress/Markdown notes were not scanned.
- `bun run check:android-skia-archives`: PASS. It reported complete optional RN Skia Android archives for all expected ABIs and guarded Android CMake archive discovery.
- `bun run check:yoganode-native-lifetime`: PASS. It reported `clang++ -fsyntax-only` accepted retained-descendant teardown/reparenting and source invariants passed.
- `bun run check:yoganode-native-runtime`: PASS. It compiled, linked, and executed a host runtime smoke against real `YogaNode.cpp`, Yoga sources, RN Skia macOS archives, and helper sources; retained-descendant teardown, post-teardown mutation safety, and reparent ownership consistency assertions passed.
- Npm-run acceptance commands printed the non-blocking warning: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

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

Interpretation: full platform-native build/run verification is still blocked by external prerequisites and absent tracked native example projects, not by a newly observed repo-owned failure.

## Next root-cause ranking

1. Public declaration/export boundary cleanup.
   - Top target. It is repo-owned, unblocked, and now the strongest remaining package-surface root cause after worker 041 closed the dependency hygiene defect.
   - Evidence: `package.json` still publishes `src`, `index.d.ts` re-exports `./src/index`, and the dry-run pack still includes `src/Reconciler.ts` and `src/SkiaYogaObject.ts`.
   - The current package contract makes consumers resolve implementation files such as `src/Reconciler.ts` unless that is an intentional public API. Worker 041 made those internals resolvable by declaring their dependencies, but did not decide whether they belong on the public surface.
   - Acceptance direction: define the intended public API, remove or isolate internal exports such as `reconciler` if not public, and add a package-surface/consumer assertion that public declarations no longer require source-first internal modules except intentionally exported subpaths.
2. `src/SkiaYogaObject.ts` import-time side effects.
   - Strong repo-owned follow-up. `src/index.ts:6` re-exports it, and `src/SkiaYogaObject.ts:6-24` performs TurboModule lookup, `turboModule.install()`, logging, hybrid object creation, and `globalThis.SkiaYoga` mutation at import time.
   - Ranked second because native initialization may be a deliberate runtime requirement, and no current verifier demonstrates it breaks supported consumers. It should be evaluated after the public surface is clarified so import-time behavior can be measured against intentional entrypoints.
3. Additional RN Skia private import guard broadening.
   - Current source imports from `@shopify/react-native-skia` are package-level imports; `scripts/verify-rn-skia-imports.mjs:11-28` already blocks `src/`, `lib/typescript/src/`, and private `SkiaViewNativeId` build-output paths.
   - Ranked third because the guard passes and no active private-import failure was found. A later broadening pass could define a stricter allowlist for public RN Skia subpaths.
4. Platform-native build/run verification.
   - High value, but still blocked by full Xcode/CocoaPods/Java/Android SDK/Gradle/ADB/CMake/Ninja and absent tracked native example projects.
5. No stronger unblocked repo-owned target was found during this audit.

## Nested challenger results

- First managed challenger spawn attempt failed before creation because I passed unsupported `yield_time_ms` / `max_output_tokens` fields to `spawn_agent`.
- Successful read-only challenger spawned as `/root/read_only_challenger` with `agent_type="explorer"` and `fork_turns="none"`.
- Prompt summary: audit post-worker-041 dependency hygiene closure, packed TypeScript consumer evidence/cleanup safety, and independently rank the next repo-owned target; no edits or persistent output allowed.
- A follow-up asked the challenger to stop exploration and return a concise verdict.
- The challenger did not return a verdict after the wait windows.
- `close_agent("read_only_challenger")` returned previous status `{"completed":null}`.
- No nested acceptance evidence is claimed.

## Cleanup evidence

- `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`: no output.
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`: no output.
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`: no output.
- After removing verifier-created `tsconfig.tsbuildinfo`, pre-report `git status --short --branch --ignored` returned only the initial ignored dependency directories.

## Quality, maintainability, performance, and security review

- Quality: the full feasible local matrix is green, and the package consumer verifier now directly proves the package owns the Reconciler dependency/type contract.
- Maintainability: the remaining risk is API-boundary clarity. Publishing source-first declarations keeps implementation modules and their dependencies in the consumer-visible contract.
- Performance: no performance regression was observed. The top-ranked declaration/export cleanup is packaging/API work and should not touch hot rendering paths if kept scoped.
- Security: explicit dependencies improve supply-chain clarity. `globalThis.SkiaYoga` and native install side effects at import time remain a plausible hardening target after entrypoint intent is clarified.

## Final status and remaining risks

- Final post-report `git diff --check`: PASS, no output.
- Final post-report `git status --short --branch`:
  - `## worker/042-post-041-root-cause-audit`
  - `?? worker-progress/worker-042-post-041-root-cause-audit.md`
- Final post-report `git status --short --branch --ignored` adds only the initial ignored dependency directories:
  - `!! example/node_modules`
  - `!! node_modules`
- Remaining risk: the public API intent is not encoded. If `reconciler` and source modules are intentionally public, the next worker should document and assert that; if not, the package surface should be narrowed.
- Remaining risk: import-time native/global side effects may still affect unsupported or tooling consumers.
- Remaining risk: full native iOS/Android runtime verification remains externally blocked.
- Remaining risk: nested challenger evidence is unavailable because the managed challenger stalled.
