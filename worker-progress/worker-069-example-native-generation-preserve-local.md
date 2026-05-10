# Worker 069 - Example native-generation preserve local artifacts

## Goal lifecycle
- `create_goal` objective: `Harden the example native-generation verifier to preserve pre-existing local native artifacts.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Harden the example native-generation verifier to preserve pre-existing local native artifacts.`
- Pre-report `get_goal` evidence showed status `active`, objective `Harden the example native-generation verifier to preserve pre-existing local native artifacts.`, `tokensUsed: 255090`, and `timeUsedSeconds: 605`.
- Final `update_goal(status: "complete")` evidence is recorded in the tmux log: status complete, `tokensUsed: 264254`, and `timeUsedSeconds: 655`.

## Summary
- Hardened `scripts/verify-example-native-generation.mjs` so Expo CNG/native generation runs in an isolated temporary workspace instead of the launched checkout's `example/` directory.
- The verifier still runs Expo prebuild through Node with `--no-install`, `--clean`, and `--platform all`, still uses bounded process execution, and still avoids package install, CocoaPods, Gradle, native build, simulator/device launch, or app runtime claims.
- Added a focused sentinel probe mode, `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`, that creates pre-existing local sentinel artifacts under launched-checkout `example/ios`, `example/android`, and `example/.expo`, runs the verifier, proves the sentinels remain unchanged, and removes only the probe-owned fixtures.

## Files changed
- `scripts/verify-example-native-generation.mjs`
- `worker-progress/worker-069-example-native-generation-preserve-local.md`

## Safety design
- The verifier creates a temporary workspace under `/tmp/rnskia-example-native-generation-*`.
- It copies the package/example source needed for Expo CNG while explicitly excluding launched-checkout `node_modules`, `example/node_modules`, `example/ios`, `example/android`, `example/.expo`, `worker-progress`, tarballs, and `tsconfig.tsbuildinfo`.
- It symlinks root `node_modules` from the local dependency state and builds a temp `example/node_modules` overlay that points dependencies at the existing install while forcing `example/node_modules/react-native-skia-yoga` to resolve to the temporary package root.
- Expo prebuild runs with `cwd` set to the temporary `example`, so `--clean` can only remove generated native output inside the temp workspace.
- React Native CLI and Expo `react-native-config` assertions now require the generated project roots and package podspec/source metadata to resolve inside the temporary workspace.
- Cleanup removes the whole temporary workspace, not launched-checkout native/cache directories.

This is safer and simpler than in-place backup/restore because the verifier never has to classify user-owned native artifacts as disposable.

## Verification commands and results
- `node --check scripts/verify-example-native-generation.mjs`: passed.
- `git diff --check`: passed.
- `npm run check:example-native-generation`: passed from a clean worker native-artifact state. Output confirmed Node-run Expo prebuild in `/tmp/rnskia-example-native-generation-*`, generated iOS `project.pbxproj` was NUL-free and parser-readable, generated Android metadata was present, RN CLI and Expo autolinking metadata included `react-native-skia-yoga`, and the temp workspace was removed.
- `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`: passed. It created sentinel fixtures under launched-checkout `example/ios`, `example/android`, and `example/.expo`, ran the verifier, proved sentinels were preserved and non-sentinel top-level entries did not change, then removed the probe-owned sentinel fixtures.
- `npm run check:package-codegen-autolinking`: passed.
- `npm run check:yogacanvas-lifecycle-runtime`: passed.
- `npm run check:gesture-interaction-runtime`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:skia-yoga-object-lazy-init`: passed.
- `npm run check:rn-codegen-schema`: passed.
- `npm run check:package-surface`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run typecheck`: passed; generated ignored `tsconfig.tsbuildinfo`, removed during cleanup.
- `npm run lint-ci`: passed after the final verifier edit.
- `cd example && bun run typecheck`: passed.
- `bun run specs`: passed and generated matching Nitrogen output with no tracked diff.
- `node node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js src/specs/NativeSkiaYoga.ts src/specs/SkiaYogaViewNativeComponent.ts`: passed and printed the expected `NativeSkiaYoga` NativeModule and `SkiaYogaView` component schema.
- Expected inherited npm warning on npm commands: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Nested challenger documentation
- Initial nested challenger spawn attempt used a full-history fork plus `agent_type: "explorer"` and was rejected by the tool before an agent was created.
- First actual nested read-only challenger prompt: inspect the current package/script shape and challenge the proposed temp-workspace plus dependency-overlay design against artifact preservation, Node-run Expo enforcement, cleanup safety, and proof-boundary wording. Result: stalled. `wait_agent` timed out after 60 seconds and `close_agent` returned `previous_status.completed: null`; no acceptance evidence is claimed.
- Retry nested read-only challenger prompt: inspect only `scripts/verify-example-native-generation.mjs` and `package.json`, challenge the patched verifier's temp workspace, dependency overlay, metadata assertions, cleanup, and sentinel probe. Result: stalled. `wait_agent` produced only a status notification with `completed: null`; `close_agent` returned `previous_status.completed: null`; no acceptance evidence is claimed.

## Proof boundary
- Proven: the example Expo CNG path can generate iOS and Android native projects through Node-run Expo prebuild in an isolated temporary workspace.
- Proven: generated iOS `project.pbxproj` exists, has zero NUL bytes, and parses with the installed `xcode` parser.
- Proven: generated Android project files and core CNG metadata exist.
- Proven: React Native CLI and Expo `react-native-config` autolinking metadata include `react-native-skia-yoga` for iOS and Android with the expected podspec, Android source/package metadata, `new SkiaYogaPackage()`, `RNSkiaYogaSpec`, and `SkiaYogaViewComponentDescriptor`.
- Proven: launched-checkout `example/ios`, `example/android`, and `example/.expo` are not native-generation targets and sentinel artifacts under those paths are preserved.
- Not proven: CocoaPods install, Gradle sync/build, iOS/Android native compilation, simulator/device launch, native Skia rendering, Worklets UI-runtime behavior, RNGH native event delivery, or app runtime behavior.

## Cleanup evidence
- `git status --short --ignored=matching` after cleanup: only `M scripts/verify-example-native-generation.mjs`, this report, and ignored dependency symlinks `example/node_modules` and `node_modules`.
- `find . -maxdepth 3 \( -name 'tsconfig.tsbuildinfo' -o -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' -o -name 'rnskia-example-native-generation-*' \) -print | sort`: empty output.
- `find /tmp -maxdepth 1 \( -name 'rnskia-example-native-generation-*' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' -o -name 'react-native-skia-yoga-*.tgz' \) -print | sort`: empty output.
- `find "$(node -e 'process.stdout.write(require("node:os").tmpdir())')" -maxdepth 1 ...`: empty output for the same verifier/package temp patterns.

## Quality, maintainability, performance, and security review
- Quality: the verifier now proves the same generated native/config/autolinking contract without relying on generated-looking in-place directories being disposable.
- Maintainability: temp workspace creation, dependency overlay, verification, sentinel probing, and cleanup are separated into named helpers; package script wiring did not need to change.
- Performance: source copy excludes dependency directories and generated native/cache artifacts; prebuild remains bounded at 300 seconds and metadata commands remain bounded at 120 seconds.
- Security: commands are spawned without shell interpolation, dependency links are created from local resolved paths, cleanup is constrained to the verifier-owned temp workspace and probe-owned sentinel fixtures, and signal handling terminates active child process groups before cleanup.

## Residual risks
- The dependency overlay depends on the local `node_modules` state being present, matching the existing repo verifier pattern and the worker checkout setup.
- Future Expo or React Native CLI metadata shape changes may require assertion updates.
- Full native build/run proof remains blocked by the broader local platform prerequisites and is intentionally outside this verifier's proof boundary.
