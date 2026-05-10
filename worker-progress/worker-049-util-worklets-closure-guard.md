# Worker 049 - util Worklets closure guard

## Goal lifecycle
- `create_goal` objective: `Add Worklets transform guard for util lazy Nitro closure.`
- Required visible gate emitted exactly: `GOAL_CREATED: Add Worklets transform guard for util lazy Nitro closure.`
- `update_goal(status: "complete")`: completed after this report, final `git diff --check`, final status capture, and cleanup checks completed. Worker reported time used: 673 seconds.

## Baseline
- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-049-util-worklets-closure-guard`
- Branch: `worker/049-util-worklets-closure-guard`
- HEAD at start: `ee0fae3078977e6e1407b721c8173cef2326e296`
- Initial tracked status: no tracked changes.
- Initial ignored local state: `example/node_modules` and `node_modules`.
- Required context inspected before editing:
  - `worker-progress/worker-048-post-047-root-cause-audit.md`
  - `src/util.ts`
  - `scripts/verify-skia-yoga-object-lazy-init.mjs`
  - `package.json`
  - `babel.config.js`
  - `example/babel.config.js`
  - `bun.lock`, `example/bun.lock`, and package dependency declarations

## Implementation summary
- Extended `scripts/verify-skia-yoga-object-lazy-init.mjs` instead of adding a separate command, keeping the public import-time lazy-init and explicit accessor checks in one verifier.
- Added a transform-level `createYogaNode()` guard that runs `@babel/core` with `@babel/plugin-transform-typescript` and `react-native-worklets/plugin` against `src/util.ts`.
- The new guard inspects Babel AST output for `createYogaNode.__closure` and parses the Worklets `initData.code` string to check the transformed worklet body.
- Added direct root devDependencies for `@babel/core`, `@babel/plugin-transform-typescript`, and `react-native-worklets`; updated `bun.lock`.

Changed files:
- `scripts/verify-skia-yoga-object-lazy-init.mjs`
- `package.json`
- `bun.lock`
- `worker-progress/worker-049-util-worklets-closure-guard.md`

## Dependency decision
- Added root `devDependencies`:
  - `@babel/core`: `^7.28.0`
  - `@babel/plugin-transform-typescript`: `^7.28.0`
  - `react-native-worklets`: `0.5.1`
- Rationale: the verifier directly imports Babel and the Worklets plugin. Keeping them only as peer/transitive packages would make the guard depend on accidental install layout.
- `bun install --lockfile-only` updated `bun.lock`. The package entries already existed in the root lock; the lock update makes them direct root dev dependencies and adjusts Bun's nested `semver` resolution entries.
- Local resolution probe in this shared workspace resolved:
  - `@babel/core@7.29.0` from shared `example/node_modules`
  - `@babel/plugin-transform-typescript@7.28.6` from shared `example/node_modules`
  - `react-native-worklets@0.5.1` from shared root `node_modules`
  The manifest and lock now make clean root installs explicit.

## Verifier coverage
- Catches direct `NitroModules` closure capture by asserting `createYogaNode.__closure` does not include `NitroModules`.
- Catches losing `lazyNitroModulesBox` by asserting the transformed closure includes it.
- Catches extra/bypass captures by asserting the transformed closure is exactly `["lazyNitroModulesBox"]`.
- Catches losing `lazyNitroModulesBox.current.unbox()` by parsing the Worklets `initData.code` body and requiring that call shape.
- Catches a transformed worklet body that directly references `NitroModules`.
- Preserves existing public import-time lazy-init coverage: importing `src/index.ts` and `src/util.ts` still must not box/unbox Nitro, create hybrids, install/look up native bindings, log init, or write `globalThis.SkiaYoga`.
- Does not claim device/UI-runtime Worklets proof. This is transform-level evidence only; runtime serialization/cloning behavior remains unproven in the local platform environment.

## Verification
- `git diff --check`: passed with no output.
- `npm run check:skia-yoga-object-lazy-init`: passed. Output included the new line `Worklets transform kept createYogaNode() on lazyNitroModulesBox.current.unbox().`
- Dependency resolution probe: passed and printed the local package versions/paths listed in the dependency decision.
- `npm run check:package-typescript-consumer`: passed; packed consumer compiled public entrypoints/lowercase JSX and rejected internal exports including `createYogaNode`.
- `npm run check:package-surface`: passed; npm pack manifest included 120 files, all 30 `cpp/` files, and representative native/Nitrogen/package files.
- `npm run typecheck`: passed.
- `npm run lint-ci`: passed.
- `cd example && bun run typecheck`: passed.
- `bun run specs`: passed; regenerated matching Nitrogen output with no tracked generated diffs.
- `npm run check:example-bundle`: passed; Expo iOS export completed and cleaned `/tmp/rnskia-example-export.O8ebDu`.
- `bun run check:install-isolation`: passed; root dependency resolution stays in root `node_modules`.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: passed; install succeeded with Bun hidden from `PATH`.
- `npm run check:rn-skia-imports`: passed.
- `bun run check:android-skia-archives`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `bun run check:yoganode-native-runtime`: passed.
- `npm run ...` commands emitted the existing npm warning: `Unknown user config "minimum-release-age"`.

## Cleanup evidence
- Post-matrix repo cleanup probe returned empty output:
  - `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- Post-matrix OS tmpdir cleanup probe returned empty output:
  - `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- Post-matrix `/tmp` cleanup probe returned empty output:
  - `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `npm run typecheck` generated ignored `tsconfig.tsbuildinfo`; it was removed before final status capture.

## Nested challenger
- First prompt: read-only challenger asked to review whether the guard catches direct `NitroModules` closure capture, losing `lazyNitroModulesBox`, losing `lazyNitroModulesBox.current.unbox()`, dependency explicitness, preservation of public import-time lazy-init coverage, and cleanup probe sufficiency.
- First spawn settings: `fork_turns: "none"` with no model override.
- First result: stalled. `wait_agent` timed out twice; `close_agent` returned no challenger review message.
- Retry prompt: same read-only challenger request.
- Retry spawn settings: `fork_turns: "none"` with no agent/model override.
- Retry result: stalled. `wait_agent` timed out; `close_agent` returned no challenger review message.
- No nested challenger acceptance evidence is claimed.

## Quality review
- Quality: the check asserts the actual transformed closure and Worklets code string, so it targets the worker 048 residual risk directly.
- Maintainability: the guard stays inside the existing lazy-init verifier and uses Babel AST inspection instead of broad string matching. The dependency contract is explicit in `package.json` and `bun.lock`.
- Performance: verifier-only change; no runtime source was changed and no production path cost was added.
- Security: no new runtime dependency or native access path was added. The verifier continues to fail on import-time native binding lookup/install, Nitro boxing/unboxing, hybrid creation, logging, and `globalThis.SkiaYoga` writes.

## Final status and remaining risks
- Intentional tracked changes: `bun.lock`, `package.json`, `scripts/verify-skia-yoga-object-lazy-init.mjs`, and this report.
- Ignored local state after cleanup: `example/node_modules` and `node_modules`.
- Remaining risk: this is not device/UI-runtime Worklets proof. The transform contract is now repo-owned, but actual Worklets runtime serialization behavior still needs platform tooling that is not available in this local environment.
