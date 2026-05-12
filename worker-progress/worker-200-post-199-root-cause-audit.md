# Worker 200 - Post-Worker 199 Root-Cause Audit

## Summary

Worker 199's public/Reconciler dynamic layout-style proof should be accepted.

The merged Worker 199 work accurately closes the selected local gap: public
packed-package TypeScript authoring now accepts representative dynamic layout
style `SharedValue` props from an installed tarball, and the source-level
Reconciler verifier proves top-level layout style `SharedValue` listener
delivery through the JS style path.

This is meaningful coverage, but it is intentionally not an end-to-end React
Native runtime proof and not a native Yoga setter proof.

## Worker 199 Acceptance Assessment

Accepted.

Worker 199's report boundary is accurate. The new package-consumer cases prove
public JSX/type authoring for representative dynamic layout style fields across
the packed package boundary. The new Reconciler cases prove listener
registration, initial snapshot resolution, update delivery, full-style rebuilds,
static sibling preservation, invalidation, `commitUpdate` cleanup, ignored late
emits, and native-command-mirror avoidance in the Node VM harness.

I found no overclaim in the accepted report. The report explicitly excludes
actual React Native bridge delivery, Nitro registry installation in a React
Native runtime, UI-runtime Worklets/Reanimated delivery, iOS/Android build/run,
native Yoga setter execution, exact Yoga conformance, exhaustive layout
combinations, and render fidelity.

## Changed Files

- `worker-progress/worker-200-post-199-root-cause-audit.md`

No product runtime/source files, verifier scripts, package metadata, generated
artifacts, or existing worker reports were modified.

## Commands Run

- `git status --short --branch`: clean branch header at start.
- `sed -n '1,220p' WORKER_BRIEF.md`: reviewed worker rules and report
  requirements first.
- Read `worker-progress/worker-199-dynamic-layout-style-proof.md`.
- Read and searched `scripts/verify-package-typescript-consumer.mjs`.
- Read and searched `scripts/verify-reconciler-animated-bindings.mjs`.
- Read relevant `src/specs/style.ts`, `src/jsx.ts`, `src/Reconciler.ts`,
  recent worker reports, and current master docs.
- `git log --oneline -8 --decorate`: confirmed the Worker 199 implementation,
  merge, acceptance, and Worker 200 prep commits.
- `git show --stat 40406d8`, `git show --stat b88f56a`,
  `git show --stat 3faa14a`: confirmed touched file scope.
- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 5m 6s.

Platform reprobe commands:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is a
  Command Line Tools instance, not full Xcode.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `xcrun simctl list runtimes available`: failed because `simctl` is not
  available through the active developer tools.
- `pod --version` via `command -v`: `pod: not found`.
- `gradle --version` via `command -v`: `gradle: not found`.
- `adb version` via `command -v`: `adb: not found`.
- `cmake --version` via `command -v`: `cmake: not found`.
- `ninja --version` via `command -v`: `ninja: not found`.
- `java -version`: failed with `Unable to locate a Java Runtime`.
- Android/JDK env probe: `ANDROID_HOME`, `ANDROID_SDK_ROOT`,
  `ANDROID_NDK_HOME`, `ANDROID_NDK_ROOT`, and `JAVA_HOME` are unset.

## Evidence Gathered

- `scripts/verify-package-typescript-consumer.mjs` now declares
  `PublicStyleField<K extends keyof YogaNodeStyle>` and compiles dynamic layout
  `SharedValue` props for width/height, min/max constraints, flex basis, gaps,
  flex grow/shrink, align/wrap/direction/display/box sizing, position and edge
  fields, insets, and margin auto/percent cases through a packed tarball
  consumer.
- The packed consumer renders those props through lowercase JSX in the smoke
  tree, using `jsx: react-jsx` and
  `jsxImportSource: react-native-skia-yoga`.
- `scripts/verify-reconciler-animated-bindings.mjs` now covers 30
  representative top-level layout keys: `width`, `height`, `minWidth`,
  `maxWidth`, `minHeight`, `maxHeight`, `flexBasis`, `gap`, `rowGap`,
  `columnGap`, `flexGrow`, `flexShrink`, `alignContent`, `alignSelf`,
  `flexWrap`, `direction`, `display`, `boxSizing`, `position`, `top`, `right`,
  `bottom`, `left`, `start`, `end`, `marginLeft`, `marginRight`, `inset`,
  `insetHorizontal`, and `insetVertical`.
- The Reconciler harness asserts one listener per layout `SharedValue`, listener
  keys matching the top-level style keys, initial snapshot resolution into
  `node.setStyle`, one style rebuild per emit, static sibling preservation,
  invalidation on live emits, cleanup on `commitUpdate`, no post-cleanup rebuilds
  or invalidations, and no `createSynchronizable` / `setBlocking` usage.
- The Reconciler layout case table is guarded against source drift by checking
  that every case key exists in exported `NodeStyle` from `src/specs/style.ts`.
- `src/Reconciler.ts` supports this behavior through the existing style listener
  path: style `SharedValue`s are bound by `bindAnimatedValues`, values are
  stored in `styleAnimatedValues`, and updates call `instance.setStyle` with
  `getResolvedStyle(state)` followed by invalidation.
- `src/jsx.ts` still exposes `YogaAnimatedStyleObject` by mapping each
  `YogaNodeStyle` key to an animated style value, which explains why scalar and
  enum layout fields are type-safe as whole-field `SharedValue`s.
- The feasible matrix rerun reconfirmed the integrated baseline, including the
  Worker 199 focused checks, host-native command/render checks, Nitro
  materialization checks, example bundle export, and native-generation metadata
  checks. Matrix cleanup removed only `tsconfig.tsbuildinfo` and reported no
  remaining new tracked artifacts.

## Platform Blocker Reprobe

Local platform-native app build/run and real React Native bridge runtime proof
remain blocked by environment, not by a newly observed repo regression:

- Full Xcode is not selected; active tools are Command Line Tools only.
- iPhone simulator SDK and `simctl` are unavailable.
- CocoaPods is unavailable.
- Gradle, ADB, CMake, and Ninja are unavailable on `PATH`.
- Java runtime is unavailable.
- Android SDK and NDK environment variables are unset.

The locally feasible matrix remains healthy, but it still explicitly excludes
CocoaPods install, Gradle build, simulator/device launch, native app runtime,
UI-runtime Worklets execution, and RNGH native delivery.

## Next Target Recommendation

1. Dynamic layout-to-native Yoga setter update proof.

   This is the strongest locally unblocked next target. Worker 199 proves
   public authoring and Reconciler JS style-listener delivery, while Workers
   193/197 and the current materialization verifier prove generated
   materialized layout style delivery into native `_style`, selected Yoga
   getters, and selected computed layouts. The remaining useful local gap is a
   sequential update proof for dynamic layout payloads through the generated
   materialized `setStyle(...)` path: initial style, update style, cleanup/reset
   style, `computeLayout(...)`, and selected native/Yoga/layout assertions.

2. React Native runtime integration proof for dynamic layout `SharedValue`
   delivery through the real app bridge.

   This has higher end-to-end value, but it is not locally unblocked with the
   current toolchain. Keep it separate until full Xcode/simulator/CocoaPods or
   Android Java/SDK/Gradle/ADB/CMake/Ninja prerequisites are available.

3. Further public/Reconciler layout breadth only if tied to a concrete missing
   high-risk field or combination.

   Worker 199 was intentionally representative, and its selected proof already
   covers the main scalar/string layout categories. Generic breadth expansion is
   lower value than proving the next boundary in the chain.

## Proof Boundary And Overclaim Risks

Accepted claims:

- Packed-package public TypeScript/JSX authoring accepts representative dynamic
  layout style `SharedValue` props.
- Source-level Reconciler JS style listeners handle representative top-level
  layout style `SharedValue`s correctly under the Node VM harness.
- The feasible local matrix remains green after Worker 199.

Non-claims:

- No actual React Native bridge delivery proof.
- No Nitro registry installation proof inside a React Native runtime.
- No UI-runtime Worklets or real Reanimated delivery proof.
- No iOS/Android build/run, simulator/device launch, or native platform
  presentation proof.
- No native Yoga setter execution proof from Worker 199 itself.
- No exact Yoga conformance, exhaustive layout-combination coverage, or render
  fidelity proof.

## Cleanup Status

- No product files or verifier scripts were edited.
- No platform tooling was installed.
- No native projects were generated by this audit.
- The feasible matrix removed its matrix-owned temp parent and reported no
  remaining new tracked artifacts.
- Final `git status --short --branch` summary after this report-status
  correction:
  `## worker/200-post-199-root-cause-audit`
  and ` M worker-progress/worker-200-post-199-root-cause-audit.md`.

Goal finished.
