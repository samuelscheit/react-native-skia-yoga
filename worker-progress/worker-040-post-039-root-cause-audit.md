# Worker 040 Post-039 Root-Cause Audit

## Goal lifecycle

- `create_goal` objective: `Audit post-worker-039 state and rank the next root-cause target.`
- Required visible gate emitted immediately after goal creation:
  `GOAL_CREATED: Audit post-worker-039 state and rank the next root-cause target.`
- `update_goal(status="complete")` is reserved until this report, final `git diff --check`, final status capture, and cleanup checks are complete.

## Scope and read-only status

- Scope was read-only for product source, package metadata, generated Nitro files, example files, lockfiles, and orchestration docs.
- Only repository edit made by this worker: this report at `worker-progress/worker-040-post-039-root-cause-audit.md`.
- No commit was made.
- Verification commands created one ignored root `tsconfig.tsbuildinfo` artifact during TypeScript checking; it was removed because it was not present in the initial ignored status.
- No temp tarball, temp consumer, Expo export output, or generated matrix output remains.

## Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-040-post-039-root-cause-audit`
- Branch: `worker/040-post-039-root-cause-audit`
- HEAD: `8845b51039a9e1cea2a423a18543f4173dca1bb3`
- `git show --stat --oneline --decorate -1`: `8845b51 (HEAD -> worker/040-post-039-root-cause-audit, main) Record worker 039 package TypeScript consumer smoke`; commit stat was `MASTER_PLAN.md` and `MASTER_PROGRESS.md`, 41 insertions and 5 deletions.
- `git diff --name-status main...HEAD`: no output, because this worker branch starts at current `main`.
- Initial `git status --short --branch`: `## worker/040-post-039-root-cause-audit`
- Initial `git status --short --branch --ignored`:
  - `## worker/040-post-039-root-cause-audit`
  - `!! example/node_modules`
  - `!! node_modules`

## Worker 039 coverage audit

The new `check:package-typescript-consumer` verifier is meaningful for the package artifact path:

- `scripts/verify-package-typescript-consumer.mjs:23-34` creates an OS temp root, separate tarball and consumer dirs, packs the package, and writes a standalone consumer.
- `scripts/verify-package-typescript-consumer.mjs:84-108` runs `npm pack --json --ignore-scripts --pack-destination <temp>/tarball`, so the test uses a real tarball outside the repo rather than a workspace link.
- `scripts/verify-package-typescript-consumer.mjs:117-143` installs `react-native-skia-yoga` from a `file:` URL for that tarball plus peer/runtime packages, not from repo `paths` or source imports.
- `scripts/verify-package-typescript-consumer.mjs:146-178` uses `jsx: "react-jsx"` and `jsxImportSource: "react-native-skia-yoga"` and asserts the consumer tsconfig has no `paths` or `baseUrl`.
- `scripts/verify-package-typescript-consumer.mjs:188-269` compiles public imports from `react-native-skia-yoga`, the `react-native-skia-yoga/jsx-runtime` subpath, `YogaCanvas`, exported public types, and lowercase intrinsic JSX (`rect`, `group`, `rrect`, `circle`, `text`).
- `scripts/verify-package-typescript-consumer.mjs:272-297` rejects symlink installs and rejects installed package real paths that resolve inside the repo.
- `scripts/verify-package-typescript-consumer.mjs:80-82` removes the whole temp root in `finally`, covering success and failure cleanup.

What it does not prove:

- It does not prove that a consumer succeeds without `@types/react-reconciler`; the verifier explicitly installs that package at `scripts/verify-package-typescript-consumer.mjs:137-142`.
- It does not prove the package declares every runtime dependency it imports directly. `react-reconciler` is not declared by this package, even though `src/Reconciler.ts` imports it directly.
- It does not prove generated declaration publishing, because `package.json:7` points `types` at `index.d.ts`, and `index.d.ts:1` re-exports `./src/index`.
- It does not prove native iOS/Android build/run behavior.
- It does not cover `src/SkiaYogaObject.ts` import-time side effects.

## Hidden reconciler dependency analysis

The hidden dependency is real and repo-owned.

- `package.json:69-79` declares `@types/react-reconciler` only as a root dev dependency.
- `package.json:81-88` declares peer dependencies, but there is no `react-reconciler` peer.
- `package.json:112-114` declares only `react-native-nitro-modules` as a production dependency.
- `index.d.ts:1` re-exports `./src/index`, so package types resolve into published source.
- `src/index.ts:16-20` re-exports `./Reconciler`, `./jsx`, `./util`, and `./YogaCanvas`.
- `src/Reconciler.ts:10-11` directly imports `react-reconciler` and `react-reconciler/constants`.
- `src/Reconciler.ts:33-46` uses `ReturnType<typeof Reconciler>` in the type of the exported reconciler path, so TypeScript needs declarations for that module while resolving the package surface.
- `src/Reconciler.ts:1167` exports `reconciler`, which keeps that implementation detail on the public package surface through `src/index.ts`.
- `rg --files lib` failed because there is no generated `lib` declaration output in this worktree, and `package.json:10-32` publishes `src` plus hand-written entrypoint `.d.ts` files rather than a generated declaration tree.

Read-only probes:

- External packed consumer without `@types/react-reconciler`: installed successfully, then `tsc` failed with TS7016 for `node_modules/react-native-skia-yoga/src/Reconciler.ts(10,24)` and `(11,38)`, reporting missing declarations for `react-reconciler` and `react-reconciler/constants`. The temp root was removed and printed `cleanup_exists=false`.
- `npm ls react-reconciler --all` from the root succeeded only because local/example dependency topology resolves `react-reconciler@0.31.0` via `@shopify/react-native-skia` and extraneous workspace links. That is not this package's contract.
- `npm ls @types/react-reconciler --all` from the root succeeded because the root dev dependency is installed.
- `npm ls @types/react-reconciler --all` from `example/` exited 1 with extraneous/invalid local workspace state around `@types/react-reconciler@0.32.1`, further confirming that the local workspace topology is not clean consumer evidence.

Conclusion: the next strongest target is package-surface dependency hygiene around the direct `react-reconciler` import and its type declarations. Generated declaration publishing is related, but not the first isolated fix because generated declarations alone may still expose `reconciler` unless the public export boundary is narrowed, and it would not address the direct runtime import contract.

## Verification matrix

- `git diff --check`: passed with no output.
- `npm run check:package-typescript-consumer`: passed. Output confirmed real tarball creation outside the repository, temporary consumer install from that tarball, `jsx: react-jsx` plus `jsxImportSource: react-native-skia-yoga`, and public entrypoints/lowercase intrinsic JSX compiling from the installed package.
- `npm run typecheck`: passed. It created ignored `tsconfig.tsbuildinfo`, which was removed afterward.
- `npm run lint-ci`: passed.
- `cd example && bun run typecheck`: passed. Tool command was run with `example` as cwd and output was `tsc -p tsconfig.skiayoga.json --noEmit`.
- `bun run specs`: passed. Nitrogen generated 2/2 HybridObjects and `git status --short --branch` immediately afterward stayed clean.
- `npm run check:example-bundle`: passed. Expo iOS export completed and the verifier reported temporary output was cleaned.
- `npm run check:package-surface`: passed. It reported 119 packed files, all 30 `cpp/` files, representative iOS/Android/Nitrogen/package entrypoint files, and canonical podspec source metadata.
- `bun run check:install-isolation`: passed. It reported root dependency resolution stays in root `node_modules`.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: passed. It reported the PATH shim exposes node/npm/tar while keeping Bun unavailable, dry-run pack kept private scripts out, packed `package.json` has no root lifecycle hooks, and a temporary consumer install succeeded with lifecycle scripts enabled.
- `npm run check:rn-skia-imports`: passed. It reported tracked source does not import private RN Skia internals and worker progress/Markdown notes were not scanned.
- `bun run check:android-skia-archives`: passed. It reported complete optional RN Skia Android archives for all expected ABIs and guarded Android CMake archive discovery.
- `bun run check:yoganode-native-lifetime`: passed. It reported `clang++ -fsyntax-only` accepted the retained-descendant teardown/reparenting probe and source invariants passed.
- `bun run check:yoganode-native-runtime`: passed. It compiled, linked, and executed a host runtime smoke against real `YogaNode.cpp`, Yoga sources, RN Skia macOS archives, and helper sources; retained-descendant teardown, post-teardown mutation safety, and reparent consistency assertions passed.
- Non-blocking npm warning observed on npm commands: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Cleanup evidence

- The worker-039 package TypeScript consumer verifier removes its temp root in `finally`.
- The external hidden-reconciler scratch probe printed `cleanup_exists=false prefix=rnskia-hidden-reconciler-cGU1fs` after removing its temp root.
- `find . -maxdepth 2 -name '*.tgz' -print`: no output.
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-hidden-reconciler-*' -o -name 'rnskia-example-export.*' \) -print`: no output.
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-hidden-reconciler-*' -o -name 'rnskia-example-export.*' \) -print`: no output.
- After removing `tsconfig.tsbuildinfo`, `git status --short --branch --ignored` returned only the initial ignored dependency directories plus the clean branch line before this report was written.

## Platform-native blocker evidence

- `xcode-select -p`: `/Library/Developer/CommandLineTools`
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `command -v pod || true`: no output.
- `java -version`: failed with no Java Runtime located.
- `command -v gradle || true`: no output.
- `command -v adb || true`: no output.
- `command -v cmake || true`: no output.
- `command -v ninja || true`: no output.
- `printenv ANDROID_HOME ANDROID_SDK_ROOT`: no output, exit code 1.
- `git ls-files example/ios example/android`: no output.

Interpretation: platform-native build/run verification remains blocked by external prerequisites and absent tracked native example projects, not by a new repo-owned failure observed in this audit.

## Next root-cause ranking

1. Package-surface dependency hygiene for `react-reconciler` / `@types/react-reconciler`.
   - Strongest unblocked target. The package directly imports `react-reconciler` but does not declare it, and package type resolution reaches `src/Reconciler.ts` from `index.d.ts`.
   - Acceptance direction: make the package contract explicit, then remove the verifier's consumer-side `@types/react-reconciler` crutch. Viable fixes include declaring a compatible direct runtime dependency and making type availability explicit, or narrowing the public export/declaration boundary so consumers no longer resolve Reconciler internals.
   - This is repo-owned, locally reproducible, and already has a failing external-consumer probe.
2. Generated declaration publishing / public export boundary cleanup.
   - Valuable as part of a packaging hardening pass, but second-ranked because publishing generated declarations alone may still expose the exported `reconciler` type path and does not solve the direct runtime import contract.
3. `src/SkiaYogaObject.ts` import-time side effects.
   - Still a real hygiene/security candidate: `src/index.ts:6` re-exports `SkiaYoga`, and `src/SkiaYogaObject.ts:6-24` performs TurboModule lookup, `turboModule.install()`, a console log, hybrid object creation, and a `globalThis.SkiaYoga` write at import time.
   - Not top-ranked because install/hybrid initialization may be required by product runtime, and there is no current failing verifier showing it breaks consumers.
4. Additional RN Skia private import guard broadening.
   - Current `scripts/verify-rn-skia-imports.mjs:11-28` covers `@shopify/react-native-skia/src/`, `lib/typescript/src/`, and private `SkiaViewNativeId` build-output paths. Broader deep-import policy could be useful later, but current source search and verifier pass do not show an active failure.
5. Platform-native build/run verification.
   - High value once prerequisites exist, but currently blocked by full Xcode/CocoaPods/Java/Android SDK/Gradle/ADB/CMake/Ninja/native example project availability.

## Nested challenger results

- First managed nested challenger spawn attempt used `fork_turns="all"` with `agent_type="explorer"`. The router rejected that shape because full-history forked agents inherit parent agent type/model/reasoning effort.
- Second managed read-only challenger spawned successfully as `/root/package_boundary_challenger` with `fork_turns="none"` and `agent_type="explorer"`.
- Prompt summary: inspect post-worker-039 package TypeScript consumer coverage, hidden `react-reconciler` / `@types/react-reconciler` dependency evidence, and independently rank the next repo-owned target. The prompt explicitly prohibited edits and persistent output.
- Result: the challenger did not return a verdict after the wait window.
- Follow-up asked it to stop exploration and return only a concise verdict.
- It still did not complete; `close_agent` returned previous status `{"completed":null}`.
- No nested acceptance evidence is claimed.

## Quality, maintainability, performance, and security review

- Quality: the feasible matrix is green, and worker 039 closed a real artifact-consumer coverage gap. The remaining package-boundary failure is now sharper because the verifier had to add an explicit consumer-side type dependency workaround.
- Maintainability: relying on source `.ts` publication plus broad `export *` keeps internal implementation dependencies on the public type surface. A direct dependency fix is smaller; a curated declaration/export boundary is cleaner but larger.
- Performance: no performance regression was observed. The proposed top target is package metadata/declaration-surface work and should not affect runtime hot paths except by making module resolution deterministic.
- Security: reducing hidden transitive dependency reliance improves supply-chain clarity. `globalThis.SkiaYoga` remains a plausible import-time global mutation risk, but it is less immediate than the reproducible external-consumer type failure.

## Final status and remaining risks

- Pre-report status after cleanup returned to the initial ignored local state: clean branch plus `!! example/node_modules` and `!! node_modules`.
- Final post-report `git diff --check`: passed with no output.
- Final post-report `git status --short --branch`:
  - `## worker/040-post-039-root-cause-audit`
  - `?? worker-progress/worker-040-post-039-root-cause-audit.md`
- Final post-report `git status --short --branch --ignored` added only the initial ignored dependency directories:
  - `!! example/node_modules`
  - `!! node_modules`
- Final cleanup probes for repo `.tgz` files, Node OS temp `rnskia-package-typescript-consumer-*` / `rnskia-hidden-reconciler-*` / `rnskia-example-export.*` dirs, and `/tmp` equivalents all returned no output.
- Remaining risk: the exact compatible `react-reconciler` and `@types/react-reconciler` versions should be chosen against React/RN Skia compatibility rather than guessed from transitive local layout.
- Remaining risk: if the project instead chooses generated declarations, it should still audit whether `reconciler` belongs in the public API.
- Remaining risk: full native iOS/Android runtime verification remains externally blocked.
- Remaining risk: nested challenger evidence is unavailable because the managed subagent stalled.
