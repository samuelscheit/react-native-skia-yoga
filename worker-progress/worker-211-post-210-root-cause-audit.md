# Worker 211: Post-210 Root-Cause Audit

## Summary

Audited Worker 210's accepted finite-number validation from the isolated
`worker/211-post-210-root-cause-audit` worktree.

Worker 210 is accepted. Its implementation is correctly scoped to selected
numeric paint/border style fields: the border-width family, `strokeMiter`, and
`opacity`. The validation runs before `invalidateLayout()`, `_style`
replacement, Yoga reset, paint reset, layer reset, clip reset, or matrix reset,
and the generated materialized Nitro verifier proves rejected NaN/Infinity
values preserve prior native state.

The accepted proof is not exhaustive numeric style validation. The next
strongest locally unblocked root-cause target is finite-number validation for
the remaining numeric Yoga layout style fields.

## Worker 210 Acceptance Decision

Accepted.

Evidence inspected:

- Merge commit `90253ea Merge worker 210 numeric style finite validation`.
- Acceptance docs commit `1018cc0 Accept worker 210 numeric finite validation`.
- Implementation commit `29fe602 Validate finite numeric YogaNode style fields`.
- Worker report `worker-progress/worker-210-numeric-style-finite-validation.md`.
- Key paths: `cpp/YogaNode.cpp`,
  `scripts/verify-yoganode-nitro-materialization.mjs`,
  `src/specs/style.ts`, and `nitrogen/generated/shared/c++/NodeStyle.hpp`.

The acceptance docs commit only changed `MASTER_PLAN.md` and
`MASTER_PROGRESS.md`. The product/verifier implementation is in `29fe602`.

## Verification Commands

- `git diff --check HEAD~2 HEAD` - passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed. The focused
  verifier output includes generated materialized `setStyle(...)` rejection for
  non-finite border-width family values, `strokeMiter`, and `opacity`, with
  preservation of prior `_style`, `_paint`, Yoga border state, clip, layer, and
  matrix state.
- `npm run check:feasible-matrix` - passed all 28 commands in `5m 47s`.
  Cleanup removed newly created `tsconfig.tsbuildinfo` and the matrix-owned
  temp parent; remaining new tracked artifacts were none.

Platform blocker reprobes:

- `xcode-select -p` returned `/Library/Developer/CommandLineTools`.
- `xcodebuild -version` failed because full Xcode is not selected.
- `xcrun --sdk iphonesimulator --show-sdk-path` failed because the simulator
  SDK cannot be located.
- `xcrun simctl list devices available` failed because `simctl` is unavailable.
- `pod --version`, `gradle --version`, `adb version`, `cmake --version`, and
  `ninja --version` failed with command not found.
- `java -version` failed because no Java Runtime is available.
- Android/JDK environment probe found no `ANDROID_HOME`, `ANDROID_SDK_ROOT`,
  `ANDROID_NDK_HOME`, `ANDROID_NDK_ROOT`, `JAVA_HOME`, or `JDK_HOME`.

## Proof Boundary

Accepted:

- Native finite-number validation for `borderBottomWidth`, `borderEndWidth`,
  `borderLeftWidth`, `borderRightWidth`, `borderStartWidth`,
  `borderTopWidth`, `borderWidth`, `borderHorizontalWidth`,
  `borderVerticalWidth`, `strokeMiter`, and `opacity`.
- Validation is pre-mutation in `YogaNode::setStyle(...)`: after layout-string
  and background-color validation, before layout invalidation and all native
  state replacement/reset paths.
- Generated materialized Nitro `setStyle(...)` negative coverage proves JS-facing
  rejection and preservation of previous style, paint, Yoga border, layer,
  clip, and matrix state.
- The Worker 210 report and verifier output avoid claiming exhaustive numeric
  validation.

Rejected as overclaim if implied:

- Exhaustive numeric style validation.
- Numeric Yoga layout finite validation.
- Radius, `SkPoint`, matrix array, transform leaf, or other non-string numeric
  validation.
- Range semantics such as opacity clamping or non-negative dimensions.
- React Native bridge delivery, Nitro registry install in a React Native
  runtime, iOS/Android app build/run, simulator/device launch, UI-runtime
  Worklets execution, Reanimated delivery, or RNGH delivery.

## Remaining Gaps

- `src/specs/style.ts` still exposes many layout values as `number` or
  `number | Percentage`.
- Generated `NodeStyle.hpp` transports those as `std::optional<double>` or
  `std::optional<std::variant<std::string, double>>`.
- Nitro's `JSIConverter<double>` accepts any JS number and returns
  `arg.asNumber()`; it does not check finiteness.
- `validateYogaLayoutUnitStrings(...)` returns immediately for non-string
  variants, so numeric branches of `width`, `height`, margins, padding,
  positions, insets, and constraints are outside the string-validation guard.
- `setYGValueOrPercent(...)` and `setYGEdgeValue(...)` cast numeric doubles to
  `float` and forward them to Yoga setters. Direct layout scalars such as
  `aspectRatio`, `flex`, `flexGrow`, `flexShrink`, `gap`, `rowGap`, and
  `columnGap` are also cast and applied without finite checks.
- Radius fields, `SkPoint` corner radii, matrix arrays, and transform operation
  leaves remain separate unvalidated numeric style surfaces.
- Full platform-native app build/run and actual React Native runtime proof are
  still blocked locally by toolchain availability, not by new repo evidence.

## Next Recommended Target

Rank 1: finite-number validation for numeric Yoga layout style fields.

Recommended scope:

- Extend the pre-mutation native validation in `YogaNode::setStyle(...)` to the
  remaining Yoga layout numeric fields: `aspectRatio`, `flex`, `flexGrow`,
  `flexShrink`, `gap`, `rowGap`, `columnGap`, and numeric branches of
  `flexBasis`, `width`, `height`, min/max dimensions, position edges, margins,
  padding, and insets.
- Keep the existing string-unit validation behavior and avoid adding range
  semantics unless a separate source-confirmed contract requires it.
- Add generated materialized `setStyle(...)` negative coverage proving
  NaN/Infinity rejection before mutation and preservation of previous selected
  `_style` optionals and Yoga getter state.
- Add source guards so the public/generated/native numeric layout inventory
  cannot drift silently.
- Verify with `git diff --check`, `node --check
  scripts/verify-yoganode-nitro-materialization.mjs`, `npm run
  check:yoganode-nitro-materialization`, and `npm run check:feasible-matrix`.

Rationale:

- This is the same root-cause class Worker 206 and Worker 210 narrowed: public
  style values that TypeScript/Nitro cannot make finite at runtime must be
  rejected deterministically before native state mutation.
- It is source-confirmed in the current code and locally verifiable through the
  existing materialized Nitro harness.
- It is broader user-facing risk than transform/matrix/radius validation because
  layout numbers feed Yoga state and computed layout across nearly every node.

Rank 2: finite validation for clipping radii and `SkPoint` corner-radius
payloads, with render/hit-test state preservation proof.

Rank 3: finite validation for matrix-array and transform-operation numeric
leaves, with generated materialized state proof and bounded render/hit-test
proof where useful.

Highest-value blocked target: real React Native runtime/platform proof once
full Xcode/simulator/CocoaPods or Android Java/SDK/Gradle/ADB/CMake/Ninja
prerequisites are available.

## Quality, Maintainability, Performance, Security

- Quality: Worker 210 uses deterministic `std::invalid_argument` failures and
  places validation before native mutation. The focused verifier exercises the
  generated JS-facing path rather than only a raw C++ call.
- Maintainability: the selected numeric field list is manual. Future numeric
  style additions should either enter an inventory-backed validator or be
  documented as intentionally accepting all finite/non-finite values.
- Performance: the added optional finite checks are constant-time and negligible
  relative to style application and layout invalidation.
- Security: deterministic NaN/Infinity rejection reduces undefined native state
  propagation into Yoga and Skia. Remaining numeric layout/radius/transform
  surfaces keep the same class of risk until they are handled.

## Cleanup Status

- No product source, verifier script, package metadata, generated artifact, or
  master planning file was edited by Worker 211.
- The feasible matrix removed its matrix-owned temp parent and no generated
  tracked artifacts remain.
- Ignored `node_modules` and `example/node_modules` remain untouched.
- Before committing this report, `git status --short --ignored=matching` showed
  only the expected ignored dependency symlinks.

Goal finished.
