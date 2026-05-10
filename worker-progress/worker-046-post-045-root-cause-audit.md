# Worker 046: Post-worker-045 root-cause audit

## Goal lifecycle

- `create_goal` objective: `Audit post-worker-045 state and rank the next root-cause target.`
- First visible gate after goal creation: `GOAL_CREATED: Audit post-worker-045 state and rank the next root-cause target.`
- Goal remains active until this report, final `git diff --check`, final status capture, cleanup checks, and final `update_goal(status: "complete")` are complete.

## Scope and baseline

- Scope: read-only audit of product/source/package/generated/example files. The only intended repository edit is this report.
- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-046-post-045-root-cause-audit`
- Branch: `worker/046-post-045-root-cause-audit`
- HEAD: `41ebfaca3d3d9b547fcf71722bbe4b35e12dddaf`
- `git log --oneline --decorate -8` showed `41ebfac (HEAD -> worker/046-post-045-root-cause-audit) Merge worker 045 SkiaYogaObject lazy init` at the worker branch tip. The main worktree later advanced to `0802554 Record worker 045 acceptance and launch worker 046`.
- Initial `git status --short --branch`: `## worker/046-post-045-root-cause-audit`
- Initial `git status --short --branch --ignored=matching`: clean tracked state with ignored `example/node_modules` and `node_modules`.
- Initial cleanup probes for repo, OS tmpdir, and `/tmp` found no matching `.tgz`, package-consumer, package-lifecycle, or example-export temp artifacts.

## Worker 045 lazy-init audit

Worker 045 closed the target it claimed.

- `src/SkiaYogaObject.ts:1-8` now has only imports and module-local cache flags at import time.
- `src/SkiaYogaObject.ts:9-25` exports `getSkiaYoga()` as the explicit accessor. Repeated calls return the cached object.
- `src/SkiaYogaObject.ts:27-54` defers `TurboModuleRegistry.getEnforcing("SkiaYoga")`, `install()`, and `NitroModules.createHybridObject("SkiaYoga")` until explicit accessor use.
- No import-time initialization `console.log` and no `globalThis.SkiaYoga` mutation remain.
- Missing TurboModule, failed install, and failed hybrid creation are wrapped with messages that mention linking/native bindings and `YogaCanvas`.
- `src/YogaCanvas.tsx:14` imports `getSkiaYoga`; runtime paths call it only when native behavior is needed: profile sampling, animation sync, render request, root attachment, and cleanup.
- `src/index.ts` and `index.d.ts` keep a public allowlist and do not expose a supported top-level `SkiaYoga` object. `npm run check:package-typescript-consumer` also rejects `PublicRuntime.SkiaYoga`.

## Verifier challenge

`scripts/verify-skia-yoga-object-lazy-init.mjs` is a focused verifier for the worker 045 target.

- It imports `src/index.ts` under a VM harness and fails if public source import calls `TurboModuleRegistry.getEnforcing`, installs native bindings, creates a hybrid object, logs initialization, or writes `globalThis.SkiaYoga`.
- It imports `src/SkiaYogaObject.ts` directly and proves `getSkiaYoga()` performs exactly one TurboModule lookup, one install, and one `SkiaYoga` hybrid creation across two calls.
- It proves a missing TurboModule failure is deferred until `getSkiaYoga()` and includes `SkiaYoga`, linking, `YogaCanvas`, and the original native error.

Intentional limits:

- The harness stubs unrelated heavy project modules including `src/Reconciler.ts`, `src/util.ts`, `src/specs/SkiaYoga.nitro.ts`, `src/specs/SkiaYogaViewNativeComponent.ts`, and `src/useCanvasGestures.ts`.
- Because `src/util.ts` is stubbed, the verifier does not claim that every supported public source import is free of every native/Nitro side effect. In particular, it intentionally does not catch the existing `src/util.ts:5` top-level `NitroModules.box(NitroModules)`.
- It proves native-missing deferral through a failing `getEnforcing` path. The implementation also wraps install/create failures, but the verifier does not separately simulate failed `install()` or failed `createHybridObject()`.

Those limits are acceptable for worker 045's scoped `SkiaYogaObject` target, but they are the reason the next root-cause target should move from the internal object accessor to broader public import-only side effects.

## Verification matrix

All required matrix commands exited 0.

- `git diff --check`: passed with no output.
- `npm run check:skia-yoga-object-lazy-init`: passed; public source import did not look up/install native bindings, create the `SkiaYoga` hybrid object, log, or mutate `globalThis.SkiaYoga`; explicit access initialized exactly once; missing native failure was deferred to accessor call time.
- `npm run check:package-typescript-consumer`: passed; packed temporary consumer compiled public entrypoints/JSX and rejected internal top-level exports including `SkiaYoga`.
- `npm run check:package-surface`: passed; npm pack dry-run included 120 files, all 30 `cpp/` files, representative native files, and source-first runtime files.
- `npm run typecheck`: passed.
- `npm run lint-ci`: passed.
- `cd example && bun run typecheck`: passed via `tsc -p tsconfig.skiayoga.json --noEmit`.
- `bun run specs`: passed; Nitrogen generated 2/2 HybridObjects and left no tracked generated-file drift.
- `npm run check:example-bundle`: passed; Expo iOS export completed and temporary output was cleaned up.
- `bun run check:install-isolation`: passed.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: passed; packed package has no root lifecycle hooks and temporary consumer install succeeded with Bun hidden.
- `npm run check:rn-skia-imports`: passed.
- `bun run check:android-skia-archives`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `bun run check:yoganode-native-runtime`: passed; host executable compiled/linked and exercised native lifetime/reparenting behavior.

NPM commands emitted the existing warning: `Unknown user config "minimum-release-age"`.

## Platform-native blockers

Concrete probes show full platform-native app build/run verification is still blocked by local prerequisites, not by a newly found repo change.

- `xcode-select -p`: `/Library/Developer/CommandLineTools`
- `xcodebuild -version`: exit 1, `tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance`
- `command -v pod || true`: no output
- `java -version`: exit 1, unable to locate a Java Runtime
- `command -v gradle || true`: no output
- `command -v adb || true`: no output
- `command -v cmake || true`: no output
- `command -v ninja || true`: no output
- `printenv ANDROID_HOME ANDROID_SDK_ROOT`: exit 1, no output
- `git ls-files example/ios example/android`: no output

## Next root-cause ranking

Top target: lazy-init `src/util.ts` and add a public import-only verifier that does not stub it.

Evidence:

- `src/index.ts:1` exports `YogaCanvas`.
- `src/YogaCanvas.tsx:18` imports `createYogaNode` from `./util`.
- `src/YogaCanvas.tsx:13` imports `reconciler` from `./Reconciler`, and `src/Reconciler.ts:23` also imports `createYogaNode` from `./util`.
- `src/util.ts:5` runs `NitroModules.box(NitroModules)` at module import time.

Why it is strongest:

- It is on the supported public source-first path, unlike unsupported deep imports.
- It is directly analogous to worker 045: import-only evaluation still touches Nitro machinery before `YogaCanvas` actually creates nodes.
- It is repo-owned and unblocked by platform-native prerequisites.
- A fix can be narrow: move boxing behind a small lazy accessor used by `createYogaNode()`, keep `YogaNode` hybrid creation at explicit node creation time, and add verifier coverage that imports the public source entrypoint without stubbing `util`.

Alternatives considered:

- `src/specs/NativeSkiaYoga.ts:8` default export still performs `TurboModuleRegistry.getEnforcing("SkiaYoga")` at import time. This is real, but current repo-owned runtime imports it only as a type from `SkiaYogaObject`, so TypeScript erases it; the risk is mostly unsupported deep import/codegen convention. Rank: second.
- Remaining source-first declaration coupling through published source helper modules is still present: root `.d.ts` files point into `./src/...`, and JSX runtime declarations import `./src/jsx-runtime-types`. This is package-contract work, but current package TypeScript consumer coverage passes. Rank: third.
- Package subpath/export-map hardening could reduce unsupported deep imports, but adding an `exports` map can conflict with Metro/React Native source-first compatibility and should follow the current public import-side-effect cleanup. Rank: fourth.
- Unsupported deep-import compatibility risk from removing the old internal `SkiaYoga` object export is lower priority because the public top-level boundary rejects `SkiaYoga`, worker 045 preserved supported `YogaCanvas`, and direct `src/SkiaYogaObject` consumers were already outside the supported API. Rank: fifth.
- Broader package/runtime import-only verification across public entrypoints is valuable and should be part of the top target, but the root cause it should expose first is `src/util.ts`. Rank: support work for first target.
- Platform-native build/run verification remains blocked until full Xcode, CocoaPods, Java, Android SDK/Gradle/ADB, CMake/Ninja, and tracked `example/ios`/`example/android` projects exist. Rank: blocked.

## Nested challenger

Read-only challenger prompt:

`Read-only challenge for repo at /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-046-post-045-root-cause-audit. Do not edit files or run destructive commands. Audit post-worker-045 lazy-init state: inspect src/SkiaYogaObject.ts, src/YogaCanvas.tsx, public entrypoints/exports, and scripts/verify-skia-yoga-object-lazy-init.mjs. Report whether import-time native/global side effects are gone; whether explicit access is lazy/idempotent and errors have YogaCanvas/linking context; whether any supported top-level public API exposes a SkiaYoga object; what the verifier proves and misses; and your ranked next root-cause target after this fix. Include exact file/line refs and command names you used. Do not make changes.`

Result:

- First `spawn_agent` attempt with `agent_type: explorer` and the default full-history fork failed before starting because full-history forked agents inherit parent agent type/model/reasoning effort.
- Retry `lazy_init_challenger` used `fork_turns: none` with the same read-only prompt and started.
- It did not return a completed verdict after waits of 10s and 60s, then was closed with previous status `{ completed: null }`.
- No nested acceptance evidence is claimed.

## Cleanup evidence

Initial and post-matrix cleanup probes all produced empty output:

- `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

Final cleanup probes after this report write remained empty; the only tracked/untracked repository file created by this worker is `worker-progress/worker-046-post-045-root-cause-audit.md`.

`npm run typecheck` left an ignored `tsconfig.tsbuildinfo` after the matrix. It was removed before final status capture because it was generated during this audit and was not part of the baseline ignored state.

## Quality review

- Maintainability: worker 045's accessor boundary is simple and localized. The next `src/util.ts` target should follow the same pattern instead of adding broad abstractions.
- Performance: worker 045 removes import-time native lookup/install/hybrid creation and caches first runtime access. Lazy-boxing `src/util.ts` would further reduce import-only overhead.
- Security/global state: `globalThis.SkiaYoga` removal reduces ambient mutable global state, and the verifier guards against reintroducing it.
- Compatibility: supported `YogaCanvas` usage remains intact. The main compatibility risk is unsupported deep imports of internal source files, especially `src/SkiaYogaObject` and `src/specs/NativeSkiaYoga`.

## Final status and remaining risks

Final `git status --short --branch`: branch header plus only `?? worker-progress/worker-046-post-045-root-cause-audit.md`.

Remaining risks:

- The public source-first path still evaluates `src/util.ts` and runs top-level `NitroModules.box(NitroModules)`.
- `src/specs/NativeSkiaYoga.ts` still has a top-level `TurboModuleRegistry.getEnforcing` default export for direct imports.
- Public import-only verification is still fragmented; worker 045's verifier intentionally stubs unrelated modules.
- Full platform-native build/run verification remains blocked by missing local platform prerequisites and absent tracked example native projects.
