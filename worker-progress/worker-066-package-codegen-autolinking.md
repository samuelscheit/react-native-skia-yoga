# Worker 066 - Packed-package RN codegen/autolinking verifier

## Goal lifecycle
- `create_goal` objective: `Add packed-package React Native codegen and autolinking verification from an installed tarball.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Add packed-package React Native codegen and autolinking verification from an installed tarball.`
- Pre-report `get_goal` evidence showed status `active`, objective `Add packed-package React Native codegen and autolinking verification from an installed tarball.`, `tokensUsed: 254366`, and `timeUsedSeconds: 680`.
- `update_goal(status: "complete")` is deferred until after this report, verification, cleanup, final status capture, and nested-agent cleanup are complete.

## Baseline
- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-066-package-codegen-autolinking`
- Branch: `worker/066-package-codegen-autolinking`
- Starting point from prompt: current main at `dc06030 Merge worker 065 post-064 audit`.
- Initial `git status --short --branch`: `## worker/066-package-codegen-autolinking`.
- Worker 065 identified the gap: repo-root RN codegen schema, package surface, packed TypeScript consumer, and linked-example `react-native config` were covered, but RN codegen/autolinking from a tarball-installed package was not.
- Full iOS/Android native app build/run was not attempted; this worker did not prove local platform prerequisites changed and the task explicitly excluded generated native projects and full native builds.

## Implementation summary
- Added `scripts/verify-package-codegen-autolinking.mjs`.
- Added package script `check:package-codegen-autolinking`.
- The verifier reuses the existing external temp tarball/install pattern:
  - creates `rnskia-package-codegen-autolinking-*` under `node:os.tmpdir()`;
  - runs `npm pack --json --ignore-scripts --pack-destination`;
  - installs the real tarball into a temporary consumer outside the repository with install scripts disabled;
  - removes the temp root in a `finally` block.
- Initial local run exposed a verifier-only macOS path canonicalization issue for generated Android CMake metadata (`/var` versus `/private/var`); the final verifier compares that path against the real installed Android source directory.
- Product/runtime source was unchanged.

## Verifier assertions
- Proves the tarball is a real file outside the repository.
- Proves `consumer/node_modules/react-native-skia-yoga` is an extracted directory, not a symlink, and its realpath is outside the repository.
- Reads the installed package's `package.json` and asserts:
  - `codegenConfig.name: "RNSkiaYogaSpec"`
  - `codegenConfig.type: "all"`
  - `codegenConfig.jsSrcsDir: "./src/specs"`
  - Android `javaPackageName: "com.margelo.nitro.skiayoga"`
  - iOS `componentProvider.SkiaYogaView: "SkiaYogaView"`
- Resolves `codegenConfig.jsSrcsDir` inside the installed package, asserts it does not resolve inside the repo, and passes that installed path to local React Native codegen.
- Asserts installed-package RN codegen admits exactly:
  - `src/specs/NativeSkiaYoga.ts`
  - `src/specs/SkiaYogaViewNativeComponent.ts`
- Documents and ignores the known non-RN-codegen spec support files:
  - `src/specs/SkiaYoga.nitro.ts`
  - `src/specs/commands.ts`
  - `src/specs/style.ts`
- Asserts installed-package schema:
  - `NativeSkiaYoga` is a NativeModule named `SkiaYoga` with required `install(): void`.
  - `SkiaYogaView` is a component with `ReactNativeCoreViewProps`, expected props, no commands, and no events.
- Runs `react-native config` from the temporary consumer and asserts React Native CLI metadata for the installed package:
  - dependency root resolves to the installed package, outside the repo;
  - iOS `podspecPath` resolves to installed `RNSkiaYoga.podspec`;
  - Android `sourceDir` resolves to installed `android`;
  - `packageImportPath` is `import com.margelo.nitro.skiayoga.SkiaYogaPackage;`;
  - `packageInstance` is `new SkiaYogaPackage()`;
  - `libraryName` is `RNSkiaYogaSpec`;
  - `componentDescriptors` is `["SkiaYogaViewComponentDescriptor"]`;
  - generated `cmakeListsPath` is derived from the installed Android source directory.

## Files changed
- `package.json`: added `check:package-codegen-autolinking`.
- `scripts/verify-package-codegen-autolinking.mjs`: new packed-package RN codegen/autolinking verifier.
- `worker-progress/worker-066-package-codegen-autolinking.md`: this report.

## Verification matrix
- `git diff --check`: passed.
- `npm run check:package-codegen-autolinking`: passed. Output confirmed the external tarball install, non-symlink/outside-repo package root, installed `src/specs` codegen path, exact admitted/ignored spec files, installed schema shape, and React Native CLI podspec/Android/package/codegen metadata.
- `npm run check:yogacanvas-lifecycle-runtime`: passed.
- `npm run check:gesture-interaction-runtime`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:skia-yoga-object-lazy-init`: passed.
- `npm run check:rn-codegen-schema`: passed.
- `npm run check:package-surface`: passed and still reported 120 packed files plus all 30 `cpp/` files.
- `npm run check:package-typescript-consumer`: passed.
- `npm run typecheck`: passed; it created ignored `tsconfig.tsbuildinfo`, which was removed before final status.
- `npm run lint-ci`: passed.
- `cd example && bun run typecheck`: passed with `tsc -p tsconfig.skiayoga.json --noEmit`.
- `bun run specs`: passed and regenerated matching Nitrogen output with no tracked generated diff.
- `node node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js src/specs/NativeSkiaYoga.ts src/specs/SkiaYogaViewNativeComponent.ts`: passed and printed the expected `NativeSkiaYoga` NativeModule plus `SkiaYogaView` component schema.
- Expected inherited npm warning on npm commands: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Nested challenger outcome
- First nested read-only challenger: `explorer`, `fork_turns: "none"`, asked to challenge whether the verifier proves installed-tarball RN codegen/autolinking instead of repo-root or linked-example evidence.
- First result: stalled. `wait_agent` timed out after 60 seconds and `close_agent` returned `previous_status.completed: null`.
- Retry nested read-only challenger: `explorer`, `fork_turns: "none"`, with a tighter prompt limited to `package.json` and `scripts/verify-package-codegen-autolinking.mjs`.
- Retry result: stalled. `wait_agent` timed out after 60 seconds and `close_agent` returned `previous_status.completed: null`.
- No nested challenger acceptance evidence is claimed.
- Nested-agent cleanup evidence after both closes: `list_agents` showed only `/root` running.

## Cleanup evidence
- Removed generated ignored `tsconfig.tsbuildinfo` after `npm run typecheck`.
- Final repo-local `tsconfig.tsbuildinfo` probe returned empty output:
  - `find . -maxdepth 3 -name 'tsconfig.tsbuildinfo' -print | sort`
- Repo-local cleanup probe returned empty output:
  - `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `/tmp` cleanup probe returned empty output:
  - `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `node:os.tmpdir()` cleanup probe returned empty output:
  - `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

## Proof boundary
- Proven: a real packed tarball can be installed into an external temporary React Native consumer and its installed package root is used for RN codegen schema/admission checks.
- Proven: React Native CLI config, run from that temporary consumer, resolves this package's iOS podspec and Android autolinking/codegen metadata from the installed package path, not from the sibling workspace symlink or linked example.
- Proven: the installed package metadata matches the current RN codegen NativeModule/component contract.
- Not proven: native iOS or Android project generation, CocoaPods install, Gradle sync/build, simulator/device launch, native Skia drawing, real Worklets UI-runtime execution, RNGH native delivery, or native-thread timing.
- Not proven: future React Native CLI/codegen version behavior beyond the versions installed by the temporary consumer and root dev dependency set.

## Residual risks
- The verifier uses root-installed `@react-native/codegen` libraries while passing the installed package's `jsSrcsDir`; it proves the package path boundary, not that a separate consumer-installed codegen binary is used.
- React Native CLI metadata is asserted without generating or compiling native projects, so missing platform toolchain/build issues can still exist.
- Both nested challenger attempts stalled, so there is no independent challenger acceptance evidence.

## Final status
- Final `git diff --check`: passed after report writing.
- Final `git status --short --branch --untracked-files=all`:
  - `## worker/066-package-codegen-autolinking`
  - ` M package.json`
  - `?? scripts/verify-package-codegen-autolinking.mjs`
  - `?? worker-progress/worker-066-package-codegen-autolinking.md`
- Final `git status --short --branch --ignored --untracked-files=all`: same intentional changes plus known ignored `example/node_modules` and `node_modules`.
- Final `git diff --name-only`: `package.json`; the new verifier and this report are untracked new files.
- Final `find . -maxdepth 3 -name 'tsconfig.tsbuildinfo' -print | sort`: empty output.
- Final nested-agent status: only `/root` running.
- Final cleanup probes for repo-local, `/tmp`, and `node:os.tmpdir()` package/export/codegen artifacts returned empty output.
- Final worktree contains only intentional changes for worker 066 plus known ignored dependency directories.
