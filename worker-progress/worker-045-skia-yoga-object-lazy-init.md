# Worker 045: SkiaYogaObject lazy native initialization

## Goal lifecycle

- `create_goal` objective: `Fix SkiaYogaObject import-time native/global side effects.`
- First visible gate after goal creation: `GOAL_CREATED: Fix SkiaYogaObject import-time native/global side effects.`
- Goal remains active until implementation, report, final `git diff --check`, final status capture, cleanup checks, and final update are complete.

## Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-045-skia-yoga-object-lazy-init`
- Branch: `worker/045-skia-yoga-object-lazy-init`
- HEAD at start: `93a669cfe618cd4ae8c025963d9d11c4b4aa6cc7`
- Initial `git status --short --branch`: `## worker/045-skia-yoga-object-lazy-init`
- Initial ignored local state from `git status --short --ignored`: `!! example/node_modules`, `!! node_modules`
- No unrelated tracked local changes were present at the start.

## Root cause

Before this change, `src/YogaCanvas.tsx` imported the internal `SkiaYoga` binding from `./SkiaYogaObject` as part of the public `YogaCanvas` module path. Since `src/index.ts` exports `YogaCanvas`, importing the supported public entrypoint could evaluate `src/SkiaYogaObject.ts`.

The pre-change `src/SkiaYogaObject.ts` executed native/global work at module load: `TurboModuleRegistry.getEnforcing("SkiaYoga")`, `turboModule.install()`, an initialization `console.log`, `NitroModules.createHybridObject("SkiaYoga")`, and `globalThis.SkiaYoga = SkiaYoga`. That made import-only/package tooling paths depend on native availability and mutated global state before any caller actually used `YogaCanvas`.

Current source references:

- `src/YogaCanvas.tsx:14` imports `getSkiaYoga` instead of an already-created hybrid object.
- `src/SkiaYogaObject.ts:9` exports the explicit lazy accessor.
- `src/SkiaYogaObject.ts:45` defers the TurboModule lookup until native access.

## Product decision

Supported public use remains `YogaCanvas`.

The native module lookup, native install, and `SkiaYoga` hybrid-object creation are now lazy and idempotent behind `getSkiaYoga()`. Importing `src/SkiaYogaObject.ts`, `src/YogaCanvas.tsx`, or the source barrel no longer performs those operations.

The previous `globalThis.SkiaYoga` mutation was removed rather than delayed. Repo-wide search found no repo-owned JS/native call site that reads `globalThis.SkiaYoga`, and supported `YogaCanvas` behavior can use the returned hybrid object directly. Removing the global write avoids ambient state and makes the negative import-side-effect guard stricter.

Static imports of `react-native` and `react-native-nitro-modules` remain in `src/SkiaYogaObject.ts`; the change is scoped to native lookup/install/hybrid creation/logging/global mutation, not to hiding required runtime files or weakening source-first package entrypoints.

## Implementation

Changed files:

- `src/SkiaYogaObject.ts`
  - Replaced top-level native initialization with `getSkiaYoga()`.
  - Added `nativeBindingsInstalled` and `skiaYoga` caches.
  - Added explicit error messages for missing TurboModule, failed native install, and failed hybrid creation.
  - Removed import-time logging and `globalThis.SkiaYoga` mutation.
- `src/YogaCanvas.tsx`
  - Replaced `SkiaYoga` object import with `getSkiaYoga`.
  - Calls the accessor only inside runtime callbacks/effects that actually need native behavior: profile sampling, animation sync, render requests, layout root attachment, and cleanup.
- `scripts/verify-skia-yoga-object-lazy-init.mjs`
  - New focused verifier using TypeScript transpilation plus stubbed React Native/Nitro modules.
  - Imports `src/index.ts` under stubs and asserts no SkiaYoga TurboModule lookup, install, hybrid creation, initialization logging, or `globalThis.SkiaYoga` write during import.
  - Imports `src/SkiaYogaObject.ts` directly and asserts explicit `getSkiaYoga()` access initializes exactly once across repeated calls.
  - Verifies native-missing failure is deferred until `getSkiaYoga()` and includes a clear `YogaCanvas`/linking error.
- `package.json`
  - Added `check:skia-yoga-object-lazy-init`.
- `worker-progress/worker-045-skia-yoga-object-lazy-init.md`
  - This report.

## Verifier coverage

The new verifier is a negative import-side-effect proof for this target:

- `scripts/verify-skia-yoga-object-lazy-init.mjs:22` imports the public source entrypoint and asserts no `TurboModuleRegistry.getEnforcing`, native `install`, `NitroModules.createHybridObject`, console initialization logging, or `globalThis.SkiaYoga` mutation occurred.
- `scripts/verify-skia-yoga-object-lazy-init.mjs:58` calls `getSkiaYoga()` twice and asserts exactly one TurboModule lookup, one install, one hybrid creation, no log, no global write, and stable object identity.
- `scripts/verify-skia-yoga-object-lazy-init.mjs:110` configures `getEnforcing` to throw and proves the error happens only at explicit access.

The verifier intentionally stubs unrelated heavy local modules such as `Reconciler` and `util` so it can directly guard the SkiaYogaObject side-effect contract. It does not claim that all public source imports are free of every React Native or Nitro-module evaluation side effect outside this target.

## Verification

All commands below exited 0.

- `git diff --check`: no output.
- `npm run check:skia-yoga-object-lazy-init`: passed; import-only public source entrypoint did not look up/install native bindings, did not create the SkiaYoga hybrid object, did not log, and did not mutate `globalThis.SkiaYoga`; explicit `getSkiaYoga()` initialized exactly once; missing native failures were deferred to accessor call time.
- `npm run check:package-typescript-consumer`: passed; packed temporary consumer compiled public entrypoints/JSX and rejected internal top-level exports including `SkiaYoga`.
- `npm run check:package-surface`: passed; npm pack dry-run included 120 files, all 30 `cpp/` files, representative native files, and source-first runtime files.
- `npm run typecheck`: passed.
- `npm run lint-ci`: passed.
- `bun run typecheck` from `example/`: passed via `tsc -p tsconfig.skiayoga.json --noEmit`.
- `bun run specs`: passed; Nitrogen generated 2/2 HybridObjects with no tracked generated-file drift.
- `npm run check:example-bundle`: passed; Expo iOS export completed and temporary export output was cleaned up.
- `bun run check:install-isolation`: passed; root dependency resolution stays in root `node_modules`.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: passed; package has no root lifecycle hooks and temporary consumer install succeeded with Bun hidden.
- `npm run check:rn-skia-imports`: passed; tracked source does not import private RN Skia internals.
- `bun run check:android-skia-archives`: passed; Android RN Skia archives are complete and CMake archive checks remain intact.
- `bun run check:yoganode-native-lifetime`: passed; clang syntax and source invariants passed.
- `bun run check:yoganode-native-runtime`: passed; host executable compiled/linked and exercised native lifetime/reparenting behavior.

NPM commands emitted the existing warning: `Unknown user config "minimum-release-age"`.

## Cleanup evidence

Cleanup probes after the verification matrix produced empty output:

- `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

`tsc` briefly left ignored `tsconfig.tsbuildinfo`; it was removed because it was generated during this worker and was not part of the baseline ignored state.

## Nested challenger

Required read-only nested review was attempted.

Prompt summary: review the current working tree without edits or destructive commands; verify import-only paths are free of SkiaYoga native lookup/install/hybrid creation/logging/global mutation; verify explicit `YogaCanvas` runtime access initializes correctly; check idempotence and error clarity; evaluate whether the new verifier catches import-time regressions; evaluate empty cleanup probes.

Results:

- First spawn attempt: `lazy_init_challenger` with `agent_type: explorer` on a full-history fork failed before starting with the tool message that full-history forked agents inherit the parent agent type/model/reasoning effort.
- Required retry: `lazy_init_challenger_retry` was started with `fork_turns: none` and no model/agent overrides using the same review prompt.
- Retry status: no completed verdict was returned after waits of 30s, 120s, and 60s. The agent was closed with previous status `{ completed: null }`.

No nested acceptance evidence is claimed.

## Quality review

Maintainability: the native access boundary is now a small explicit accessor with localized caches and errors. `YogaCanvas` call sites remain direct and readable.

Performance: import-only paths avoid native lookup/install/hybrid creation. Runtime first access pays the same native initialization cost once; repeated calls return the cached hybrid object.

Security/global state: removing `globalThis.SkiaYoga` reduces ambient mutable global surface. The verifier guards against the global write returning.

Compatibility: supported `YogaCanvas` runtime behavior still calls `attachViewRoot`, `setViewAnimating`, `requestViewRender`, `consumeViewProfileSample`, and `detachViewRoot` on the same native hybrid type. Unsupported deep imports of `SkiaYoga` from `src/SkiaYogaObject` are no longer preserved as a named object export; worker 043 already closed the public top-level boundary, and this worker preserved the supported public `YogaCanvas` path.

Residual risks: the new verifier focuses on the SkiaYogaObject side-effect contract and stubs unrelated modules. Other source-first public import evaluations outside `SkiaYogaObject` were not redesigned in this worker.

## Final status

Intentional changes are limited to `package.json`, `src/SkiaYogaObject.ts`, `src/YogaCanvas.tsx`, `scripts/verify-skia-yoga-object-lazy-init.mjs`, and this report.

Remaining risk is limited to unsupported deep consumers that imported `SkiaYoga` directly from `src/SkiaYogaObject`; supported package entrypoints and `YogaCanvas` behavior are covered by the verification matrix above.
