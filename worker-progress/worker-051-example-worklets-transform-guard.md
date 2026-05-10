# Worker 051 - example Worklets transform guard

## Goal lifecycle
- `create_goal` objective: `Add example/Expo Babel-config Worklets transform guard for package source path.`
- Required visible gate emitted exactly: `GOAL_CREATED: Add example/Expo Babel-config Worklets transform guard for package source path.`
- `update_goal(status: "complete")`: final lifecycle step after implementation, this report, final `git diff --check`, final status capture, and cleanup probes are complete.

## Baseline
- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-051-example-worklets-transform-guard`
- Branch: `worker/051-example-worklets-transform-guard`
- HEAD at start: `8af0c40ca36f02b1590ed4536c4c7abcaa9ed88b`
- Initial tracked status: clean.
- Initial ignored local state: `example/node_modules` and `node_modules`.
- Required context read: `MASTER_PLAN.md`, `MASTER_PROGRESS.md`, `worker-progress/worker-049-util-worklets-closure-guard.md`, `worker-progress/worker-050-post-049-root-cause-audit.md`, `src/util.ts`, `scripts/verify-skia-yoga-object-lazy-init.mjs`, `package.json`, `bun.lock`, `babel.config.js`, `example/babel.config.js`, `example/package.json`, and `example/bun.lock`.

## Implementation summary
- Extended `scripts/verify-skia-yoga-object-lazy-init.mjs` instead of adding a companion command, keeping the root Worklets transform guard, public import-only checks, and the new example-config transform proof in one cohesive verifier.
- Added `verifyCreateYogaNodeExampleWorkletsTransformUsesLazyAccessor()`, which transforms package source `src/util.ts` with Babel loaded through `example/package.json`.
- Reused a shared AST assertion helper for both root and example transforms so the closure/body contract stays identical across contexts.

Changed files:
- `scripts/verify-skia-yoga-object-lazy-init.mjs`: adds the example Babel/Expo transform path and shared Worklets contract assertions.
- `worker-progress/worker-051-example-worklets-transform-guard.md`: this report.

## Example config and dependency context
- The example guard creates `exampleRequire` with `createRequire(path.join(exampleDir, "package.json"))`, so `@babel/core` resolves from the example dependency context. Local symlinked installs may resolve to the shared dependency target, but the resolution base is the example package.
- The transform explicitly sets:
  - `configFile: path.join(exampleDir, "babel.config.js")`
  - `cwd: exampleDir`
  - `root: exampleDir`
  - `filename: projectPath("src/util.ts")`
  - `babelrc: false`
- That exercises the committed example Babel config, including `babel-preset-expo`, rather than duplicating the root `plugins: [@babel/plugin-transform-typescript, react-native-worklets/plugin]` verifier path.
- No extra environment variables were required for this transform; the example config's `api.cache(true)` path loaded deterministically in the verifier process.

## Assertion coverage
- Existing root Worklets transform guard remains intact and still uses root `react-native-worklets@0.5.1`.
- Existing public import-only lazy-init checks remain intact: public source import still must not box/unbox NitroModules, look up/install native bindings, create native hybrid objects, log init, or mutate `globalThis.SkiaYoga`.
- The new example Babel/Expo transform asserts `createYogaNode.__closure` exists through `findCreateYogaNodeClosureKeys()`.
- It asserts the closure includes `lazyNitroModulesBox`, excludes direct `NitroModules`, and is exactly `["lazyNitroModulesBox"]`.
- It parses the transformed Worklets `initData.code` body and asserts there is no direct `NitroModules` identifier.
- It asserts the parsed worklet body keeps the `lazyNitroModulesBox.current.unbox()` call shape.

## Proof boundary
- This is transform/config proof only: Babel plus the example Expo config preserves the lazy Nitro closure contract for the package source path.
- It is not device proof, UI-runtime proof, simulator proof, native app build proof, or Worklets runtime serialization proof.

## Verification matrix
- `git diff --check`: passed.
- `npm run check:skia-yoga-object-lazy-init`: passed. Output included the new line `Example Babel/Expo transform kept createYogaNode() on lazyNitroModulesBox.current.unbox().`
- `npm run check:package-surface`: passed. Manifest includes 120 files and all 30 `cpp/` files.
- `npm run check:package-typescript-consumer`: passed. Packed external consumer compiled public entrypoints/lowercase JSX and rejected internal top-level exports.
- `npm run typecheck`: passed.
- `cd example && bun run typecheck`: passed.
- `npm run lint-ci`: passed.
- `bun run specs`: passed and left no tracked generated diff.
- `npm run check:example-bundle`: passed. Expo iOS export wrote to `/tmp/rnskia-example-export.karrT7` and cleaned it.
- `bun run check:install-isolation`: passed.
- Note: npm commands still emit the existing `Unknown user config "minimum-release-age"` warning.

## Cleanup evidence
- Repo cleanup probe returned empty output:
  - `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- OS tmpdir cleanup probe returned empty output:
  - `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `/tmp` cleanup probe returned empty output:
  - `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `npm run typecheck` generated ignored `tsconfig.tsbuildinfo`; it was removed before final status capture.

## Nested reviewer
- Prompt: read-only review asked to inspect the verifier, example Babel config, package manifests, and current diff; challenge whether the new path really uses the example config/dependency context; verify requested closure/body assertions; and flag quality, maintainability, performance, or security concerns.
- Spawn settings: `agent_type: "explorer"`, `fork_turns: "none"`, no model override.
- Result: stalled. `wait_agent` timed out twice, and `close_agent` returned `previous_status.completed: null`.
- No nested reviewer acceptance evidence is claimed.

## Quality review
- Quality: the guard tests the actual transformed Babel AST and parsed Worklets code string for the package source path under both root and example contexts.
- Maintainability: the assertion logic is shared between root and example transforms; the example-specific part is limited to explicit Babel config/dependency-context setup.
- Performance: verifier-only change. It adds one Babel transform to `check:skia-yoga-object-lazy-init` and adds no runtime/package code cost.
- Security: no runtime dependencies, native calls, global writes, or temp outputs were added. The existing lazy-init negative checks continue to guard import-time native side effects.

## Final status
- Intentional tracked changes: `scripts/verify-skia-yoga-object-lazy-init.mjs` and this report.
- Final `git diff --check`: passed.
- Final `git status --short`: `M scripts/verify-skia-yoga-object-lazy-init.mjs` and `?? worker-progress/worker-051-example-worklets-transform-guard.md`.
- Final `git status --short --ignored`: intentional tracked changes plus known ignored `example/node_modules` and `node_modules`.
- Cleanup probes for repo-local, OS tmpdir, and `/tmp` package/export artifacts returned empty output.
- Only intentional files changed.
