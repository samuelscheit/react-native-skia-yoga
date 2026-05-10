# Worker 068 - Example native-generation verifier

## Goal lifecycle
- `create_goal` objective: `Add repo-owned Node-run Expo CNG native-generation verification for the example.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Add repo-owned Node-run Expo CNG native-generation verification for the example.`
- Initial `get_goal` evidence immediately after the gate showed status `active`, objective `Add repo-owned Node-run Expo CNG native-generation verification for the example.`, `tokensUsed: 0`, and `timeUsedSeconds: 0`.
- Pre-report `get_goal` evidence showed status `active`, the same objective, `tokensUsed: 350534`, and `timeUsedSeconds: 625`.
- Final `update_goal(status: "complete")` evidence showed status `complete`, the same objective, `tokensUsed: 387872`, and `timeUsedSeconds: 865`.

## Summary
- Added a repo-owned root script, `check:example-native-generation`, for the previously manual worker 016 Node-run Expo CNG/native-generation proof.
- Added `scripts/verify-example-native-generation.mjs`.
- The verifier runs Expo prebuild through Node, not Bun, with `CI=1`, `EXPO_NO_TELEMETRY=1`, `--no-install`, `--clean`, and `--platform all`.
- It verifies generated iOS project integrity, generated Android project presence/metadata, React Native CLI autolinking metadata, and Expo `react-native-config` autolinking metadata for `react-native-skia-yoga`.
- It does not run CocoaPods, Gradle, simulator/device launch, native compilation, or app runtime checks.

## Changed files
- `package.json`: added `check:example-native-generation`.
- `scripts/verify-example-native-generation.mjs`: new bounded Node-run Expo CNG verifier.
- `worker-progress/worker-068-example-native-generation-verifier.md`: this report.

## Implementation details
- The verifier refuses to run under Bun by checking `process.versions.bun`, requires a Node executable, and invokes Expo with `process.execPath`.
- It resolves `@expo/cli`, `@react-native-community/cli`, `expo-modules-autolinking`, and the optional `xcode` parser from the example package context.
- It starts from a clean generated-native state:
  - if `example/ios` or `example/android` is absent, it proceeds;
  - if one exists, it must be a non-symlink directory, contain no tracked files, and be empty or have expected generated-native markers;
  - ambiguous pre-existing native directories are refused and preserved.
- After the pre-clean succeeds, the verifier marks `example/ios` and `example/android` as worker-owned for cleanup, including partial output from failed prebuilds.
- It removes `example/.expo` only when that cache did not exist before the verifier started.
- iOS checks assert:
  - generated `example/ios` exists;
  - exactly `reactnativeskiayogaexample.xcodeproj/project.pbxproj` exists;
  - `project.pbxproj` has zero NUL bytes;
  - the project parses with the installed `xcode` package when available;
  - generated `Podfile`, `Podfile.properties.json`, `Info.plist`, and `Supporting/Expo.plist` exist or include expected autolinking hooks.
- Android checks assert:
  - generated `example/android` exists;
  - `settings.gradle`, `app/build.gradle`, `gradle.properties`, `AndroidManifest.xml`, and `gradlew` exist as expected;
  - `settings.gradle` uses Expo autolinking and `expoAutolinking.rnConfigCommand`;
  - app namespace/applicationId and `newArchEnabled=true`/`hermesEnabled=true` are present.
- Autolinking checks assert both RN CLI config and Expo `react-native-config` include `react-native-skia-yoga` with iOS `RNSkiaYoga.podspec`, Android source/package metadata, `new SkiaYogaPackage()`, `RNSkiaYogaSpec`, and `SkiaYogaViewComponentDescriptor`.

## Verification commands and results
- `git diff --check`: passed.
- `npm run check:example-native-generation`: passed. Output confirmed Node-run Expo prebuild, NUL-free parser-readable iOS project, Android generated project metadata, RN CLI and Expo autolinking metadata, and cleanup of `example/ios`, `example/android`, and generated `example/.expo`.
- `npm run check:package-codegen-autolinking`: passed.
- `npm run check:yogacanvas-lifecycle-runtime`: passed.
- `npm run check:gesture-interaction-runtime`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:skia-yoga-object-lazy-init`: passed.
- `npm run check:rn-codegen-schema`: passed.
- `npm run check:package-surface`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run typecheck`: passed; ignored `tsconfig.tsbuildinfo` was removed.
- `npm run lint-ci`: passed after the final verifier edits.
- `cd example && bun run typecheck`: passed.
- `bun run specs`: passed and regenerated matching Nitrogen output with no tracked generated diff.
- `node node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js src/specs/NativeSkiaYoga.ts src/specs/SkiaYogaViewNativeComponent.ts`: passed and printed the expected `NativeSkiaYoga` NativeModule and `SkiaYogaView` component schemas.
- Focused cleanup safety probe: passed. A temporary ambiguous `example/ios/NOT_GENERATED` directory was refused by the verifier, preserved after failure, then removed by the probe cleanup.
- Expected inherited npm warning on npm commands: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Nested challenger outcome
- First nested read-only challenger prompt: asked an `explorer` agent to challenge whether the planned verifier proved a meaningful root-cause boundary beyond worker 016, whether cleanup was safe, whether Node-run Expo was enforced, and whether proof-boundary wording avoided native build/run overclaiming.
- First result: stalled. `wait_agent` timed out after 60 seconds, `close_agent` returned `previous_status.completed: null`, and no acceptance evidence is claimed.
- Retry nested read-only challenger prompt: asked an `explorer` agent to inspect only `package.json` and `scripts/verify-example-native-generation.mjs` and challenge the actual patch against the same four criteria.
- Retry result: stalled. `wait_agent` timed out after 60 seconds, `close_agent` returned `previous_status.completed: null`, and no acceptance evidence is claimed.
- Nested-agent cleanup evidence: `list_agents` after closing both challengers showed only `/root` running.

## Proof boundary
- Proven: the example Expo CNG path can generate iOS and Android native projects through Node-run Expo prebuild in this worktree.
- Proven: generated iOS `project.pbxproj` is present, has zero NUL bytes, and parses with the installed project parser.
- Proven: generated Android project files and core CNG metadata are present.
- Proven: generated/configured RN CLI and Expo `react-native-config` autolinking metadata include `react-native-skia-yoga` for iOS and Android with the expected podspec, Android source/package metadata, `RNSkiaYogaSpec`, and `SkiaYogaViewComponentDescriptor`.
- Not proven: CocoaPods install, Gradle sync/build, iOS/Android native compilation, simulator/device launch, native Skia rendering, native Worklets UI-runtime behavior, RNGH native event delivery, or app runtime behavior.
- This check complements worker 016 by turning its manual Node-run proof into a repo-owned repeatable verifier; it does not expand the proof boundary into native build/run.

## Cleanup evidence
- `git status --short --ignored example/ios example/android example/.expo`: empty output after the final verifier run.
- `find . -maxdepth 3 -name 'tsconfig.tsbuildinfo' -print | sort`: empty output after removing the ignored TypeScript build-info file.
- Repo-local artifact probe returned empty output:
  - `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' -o -name 'rnskia-example-native-generation-*' \) -print | sort`
- `/tmp` artifact probe returned empty output for the same package/export/native-generation patterns plus `react-native-skia-yoga-*.tgz`.
- `node:os.tmpdir()` artifact probe returned empty output for the same package/export/native-generation patterns plus `react-native-skia-yoga-*.tgz`.
- Final ignored status before writing this report showed only known dependency directories in ignored output: `example/node_modules` and `node_modules`.

## Quality, maintainability, performance, and security review
- Quality: the verifier asserts concrete generated project files and autolinking metadata instead of only checking Expo CLI exit status.
- Maintainability: the script follows existing repo verifier patterns, uses project-local tool resolution, and keeps product runtime source unchanged.
- Performance: the check is bounded with a 300 second prebuild timeout and 120 second metadata command timeouts; it avoids package install, Pods, Gradle, builds, and app launch.
- Security: commands are spawned without shell interpolation; cleanup is restricted to exact generated example paths after validation or worker ownership is established.

## Residual risks and recommended next tasks
- Full native build/run proof remains blocked until the local environment has full Xcode/CocoaPods and Java/Android SDK/Gradle/ADB/CMake/Ninja prerequisites.
- The verifier depends on current Expo/RN CLI metadata shapes; future Expo or React Native CLI changes may require assertion updates.
- A future matrix aggregator could reduce repeated manual command sequencing, but this worker intentionally focused on the unguarded CNG/native-generation boundary.

## Final status
- Intentional changes before this report: `package.json` and `scripts/verify-example-native-generation.mjs`.
- Expected final status after this report: `package.json`, `scripts/verify-example-native-generation.mjs`, and this worker report, plus known ignored dependency directories `example/node_modules` and `node_modules`.
