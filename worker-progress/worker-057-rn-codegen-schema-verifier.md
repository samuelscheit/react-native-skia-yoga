# Worker 057 - React Native codegen schema verifier

## Goal lifecycle
- `create_goal` objective: `Add automated React Native codegen schema verification for the package codegen surface.`
- Exact first visible gate text emitted: `GOAL_CREATED: Add automated React Native codegen schema verification for the package codegen surface.`
- `update_goal(status: "complete")`: final lifecycle step after implementation, this report, required verification, cleanup, final status capture, and nested-agent cleanup are complete.

## Baseline
- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-057-rn-codegen-schema-verifier`
- Branch: `worker/057-rn-codegen-schema-verifier`
- Starting HEAD: `568d309a59a7b87b655cf35926dffc7f03c20d8f` (`568d309 Merge worker 056 post-055 audit`)
- Initial status: `git status --short --branch` showed only `## worker/057-rn-codegen-schema-verifier`.
- Required context inspected: worker 056 and 055 reports, `package.json`, `src/specs/NativeSkiaYoga.ts`, `src/specs/SkiaYogaViewNativeComponent.ts`, `src/specs/SkiaYoga.nitro.ts`, package verification scripts, and local `@react-native/codegen` combine/parser files.

## Design decision
- Added a repo-owned `check:rn-codegen-schema` script that reads `package.json.codegenConfig` as the source of truth.
- The verifier resolves `codegenConfig.jsSrcsDir`, requires it to stay inside the package root, and passes that configured directory to local `@react-native/codegen` `combineSchemasInFileList`.
- The verifier passes `codegenConfig.name` as the schema library name and asserts the returned schema uses that value.
- The current RN codegen contract is intentionally exact: only `NativeSkiaYoga.ts` and `SkiaYogaViewNativeComponent.ts` are admitted under the configured source directory.
- Non-RN-codegen files under `src/specs` are explicitly classified: `SkiaYoga.nitro.ts`, `commands.ts`, and `style.ts`.
- No product runtime behavior was changed and no dependencies were added.

## Files changed
- `scripts/verify-rn-codegen-schema.mjs`
  - New verifier for the package React Native codegen schema surface.
  - Uses local `@react-native/codegen/lib/cli/combine/combine-js-to-schema` and `combine-utils` behavior.
  - Validates admitted files, documented ignored files, and exact schema shape.
- `package.json`
  - Added `check:rn-codegen-schema`.
- `worker-progress/worker-057-rn-codegen-schema-verifier.md`
  - This report.

## Verifier coverage
- Package config usage:
  - Reads `codegenConfig.name` and `codegenConfig.jsSrcsDir` from `package.json`.
  - Resolves `jsSrcsDir` to the directory passed to RN codegen rather than hard-coding `src/specs` as the parser input.
  - Asserts `schema.libraryName === codegenConfig.name`.
  - Asserts `codegenConfig.type === "all"` for the current package contract.
- Spec admission:
  - Uses RN codegen's local `filterJSFile` behavior to confirm only the current RN files are admitted.
  - Fails on any unclassified JS/TS file under the configured codegen directory.
  - Fails if documented ignored files become RN-codegen-admitted.
- `NativeSkiaYoga` schema:
  - Asserts `type: "NativeModule"`.
  - Asserts `moduleName: "SkiaYoga"`.
  - Asserts only method `install` is emitted.
  - Asserts `install` is required, has no params, and returns `VoidTypeAnnotation`.
- `SkiaYogaView` schema:
  - Asserts `type: "Component"` with component key `SkiaYogaView`.
  - Asserts it extends `ReactNativeCoreViewProps`.
  - Asserts no unexpected events or commands.
  - Asserts exact props `colorSpace`, `debug`, `opaque`, and `pointerEvents` with expected type/default/enum shape.

## Nested challenger outcome
- First challenger: read-only `explorer`, `fork_turns: "none"`, asked to inspect the new verifier, package `codegenConfig`, RN codegen behavior, and the worker 055 regression boundary.
- First result: stalled. Repeated `wait_agent` timed out, and `close_agent` returned `previous_status.completed: null`.
- Retry challenger: read-only default agent, `fork_turns: "none"`, with a tighter prompt limited mostly to `package.json` and `scripts/verify-rn-codegen-schema.mjs`.
- Retry result: stalled. `wait_agent` timed out, and `close_agent` returned `previous_status.completed: null`.
- No nested challenger acceptance evidence is claimed.

## Checks run
- `git diff --check`: passed.
- `npm run check:rn-codegen-schema`: passed. Output confirmed `codegenConfig.name: RNSkiaYogaSpec`, `codegenConfig.jsSrcsDir: ./src/specs`, 2 admitted package spec files, `NativeSkiaYoga` schema, `SkiaYogaView` schema, and 3 documented non-RN-codegen files.
- `npm run check:skia-yoga-object-lazy-init`: passed.
- `npm run check:package-surface`: passed. Pack manifest includes 120 files and all 30 files under `cpp/`.
- `npm run check:package-typescript-consumer`: passed. Temporary packed consumer compiled public entrypoints/lowercase JSX and rejected internal top-level exports without consumer-side `@types/react-reconciler`.
- `npm run typecheck`: passed. It generated ignored `tsconfig.tsbuildinfo`, which was removed before final status.
- `npm run lint-ci`: passed after fixing one `no-shadow` warning in the new verifier.
- `cd example && bun run typecheck`: passed.
- `bun run specs`: passed and regenerated matching Nitrogen output with no tracked diff.
- Expected warning: npm commands still emit `Unknown user config "minimum-release-age"`.

## Cleanup evidence
- Removed generated ignored `tsconfig.tsbuildinfo` before final status.
- Repo-local cleanup probe returned empty output:
  - `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `/tmp` cleanup probe returned empty output:
  - `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `node:os.tmpdir()` cleanup probe returned empty output:
  - `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

## Quality and security review
- Quality: the verifier closes the manual RN codegen proof gap identified by worker 056 and keeps assertions tied to the package's declared codegen surface.
- Maintainability: the exact admitted-file and schema assertions should fail loudly when the RN codegen contract intentionally changes, forcing the contract and verifier to be updated together.
- Security/reliability: `codegenConfig.jsSrcsDir` is required to resolve inside the package root before it is walked or passed to codegen.
- Performance: the script does not install dependencies, pack the package, or generate native artifacts; it reads local files and invokes local codegen parser/schema logic in-process.

## Selected residual risks
- The verifier uses local private `@react-native/codegen` CLI modules, matching the repo's installed RN codegen behavior but still depending on internal file paths.
- This proves local parser/schema shape, not a full iOS or Android native app build.
- The exact schema assertions will need intentional updates if new RN codegen methods, props, commands, events, or files are added.
- Nested challenger agents stalled twice, so no independent acceptance evidence is available.

## Final status
- Intentional tracked changes: `package.json`, `scripts/verify-rn-codegen-schema.mjs`, and this report.
- No product runtime files, lockfiles, Nitrogen generated files, or unrelated orchestration docs were edited.
- Final `git diff --check`: passed.
- Final `git status --short`: `M package.json`, `?? scripts/verify-rn-codegen-schema.mjs`, and `?? worker-progress/worker-057-rn-codegen-schema-verifier.md`.
- Final `git status --short --ignored --untracked-files=all`: the same intentional changes plus known ignored `example/node_modules` and `node_modules`.
- Final cleanup probes for repo-local, `/tmp`, and `node:os.tmpdir()` package/export artifacts returned empty output.
