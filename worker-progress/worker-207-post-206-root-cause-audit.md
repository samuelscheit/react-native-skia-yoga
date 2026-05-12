# Worker 207: Post-206 Root-Cause Audit

## Summary

Audited the post-Worker-206 state from the isolated Worker 207 worktree.

Worker 206's accepted proof boundary is accurate. The native validation in
`YogaNode::setStyle(...)` runs before layout invalidation, `_style` mutation,
Yoga reset, paint reset, clip reset, matrix reset, and subsequent native setter
application. The generated materialized verifier exercises positive layout
unit strings and representative invalid strings through the JS-facing generated
`setStyle(...)` wrapper, then asserts rejected strings preserve previous Yoga
width and height state.

Both managed Worker 207 subagents stalled without writing files. Orchestration
closed them and completed this report-only recovery in the assigned worker
worktree.

## Changed Files

- `worker-progress/worker-207-post-206-root-cause-audit.md`

No product source, verifier scripts, package metadata, generated artifacts, or
master coordination docs were modified in this worker branch.

## Commands Run

- `git status --short --branch --ignored=matching`
- `git diff --check`
- `node --check scripts/verify-feasible-matrix.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- Platform blocker reprobe:
  `xcode-select -p`, `xcodebuild -version`,
  `xcrun --sdk iphonesimulator --show-sdk-path`,
  `xcrun simctl list runtimes available`, `pod --version`,
  `gradle --version`, `adb version`, `cmake --version`,
  `ninja --version`, `java -version`, and Android/JDK env probe.
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`

## Evidence Gathered

- `cpp/YogaNode.cpp` validates layout unit strings with
  `validateYogaLayoutUnitStrings(style)` at the start of
  `YogaNode::setStyle(...)`, before `invalidateLayout()`, `_style = style`,
  `resetYogaStyle(_node)`, `_paint = SkPaint()`, `_layerPaint.reset()`,
  clipping resets, and matrix reset.
- `validateYogaLayoutUnitStrings(...)` covers `flexBasis`, width/height,
  min/max constraints, position edges, margins, padding, and inset aliases.
  Width admits only finite percentages, `auto`, and width-only
  `fit-content` / `max-content` / `stretch`; padding rejects `auto`; min/max
  constraints reject `auto`.
- `parseYogaPercent(...)` requires a trailing `%`, validates full-string
  decimal/exponent text, and rejects NaN/Infinity/overflow by checking both the
  parsed double and converted float are finite.
- `scripts/verify-yoganode-nitro-materialization.mjs` calls
  `assertGeneratedLayoutUnitValidation(*runtime)` from generated C++ `main()`.
  The verifier covers positive percentages, allowed `auto`, exponent
  percentages, width specials, and invalid cases such as `left: "10px"`,
  `padding: "auto"`, `minWidth: "auto"`, `width: "bogus"`,
  `height: "fit-content"`, partial numeric parses, duplicate percent signs,
  `NaN%`, `Infinity%`, and overflow percentage text.
- `npm run check:yoganode-nitro-materialization` passed. Its output confirms
  generated `setStyle(...)` layout unit validation through materialized
  YogaNodes and deterministic rejection of unsupported or malformed strings.
- `npm run check:feasible-matrix` passed all 28 commands in 4m 11s. Cleanup
  removed only newly created `tsconfig.tsbuildinfo` and the matrix-owned temp
  parent; remaining new tracked artifacts were none.
- Platform-native runtime proof remains blocked locally:
  `xcode-select -p` points at `/Library/Developer/CommandLineTools`,
  `xcodebuild -version` fails because full Xcode is not selected,
  the iPhone simulator SDK and `simctl` are unavailable, `pod`, `gradle`,
  `adb`, `cmake`, and `ninja` are not on PATH, `java -version` cannot locate a
  Java runtime, and no Android/JDK environment variables are set.

## Proof Boundary And Overclaim Risks

Proven:

- Worker 206 deterministically rejects unsupported or malformed layout unit
  strings before native `YogaNode` style/Yoga/paint/clip/matrix mutation.
- The generated materialized Nitro wrapper path delivers accepted layout unit
  strings and surfaces rejected strings as JS-facing errors.
- The full feasible local package/source/example matrix remains green after
  Worker 206.

Not proven:

- Actual React Native bridge delivery.
- Nitro registry installation inside a real React Native runtime.
- UI-runtime Worklets/Reanimated delivery.
- iOS/Android app build/run, simulator/device launch, or native platform
  presentation.
- Exhaustive Yoga conformance beyond selected asserted native state.
- Numeric non-string style values are not broadly validated for finiteness by
  Worker 206.

## Cleanup Status

- No platform tooling was installed.
- No native projects were generated in this worktree.
- The feasible matrix removed its matrix-owned temp parent.
- Ignored dependency symlinks remain untouched and expected:
  `node_modules` and `example/node_modules`.

## Recommended Next Tasks

Strongest locally unblocked implementation target: deterministic validation for
string `style.backgroundColor` in `YogaNode::setStyle(...)`.

Why this is root-cause level:

- Public `style.backgroundColor` accepts `string | SkColorNative`.
- Generated `NodeStyle` accepts arbitrary strings for `backgroundColor`.
- `YogaNode::setStyle(...)` currently stores an invalid background color string
  in `_style.backgroundColor`, calls `parseCssColor(str)`, and silently does
  nothing when parsing fails.
- Because render fallback checks only `_style.backgroundColor.has_value()`, an
  invalid background color string can also suppress command fallback paint
  color while leaving `_paint` at default or prior reset state.
- Text and paragraph color converters already reject invalid CSS strings with
  explicit errors, so the current `YogaNode` style behavior is inconsistent
  with nearby color contracts.

Suggested Worker 208 scope:

- Update `cpp/YogaNode.cpp` so invalid string `style.backgroundColor` throws a
  deterministic JS-facing error before `_style` and `_paint` mutation, while
  preserving valid CSS strings and `SkPaint` host-object behavior.
- Add generated materialized `setStyle(...)` proof in
  `scripts/verify-yoganode-nitro-materialization.mjs` for valid CSS string
  background colors, invalid string rejection, and preservation of previous
  `_style.backgroundColor` / `_paint` state after rejection.
- Run `git diff --check`,
  `node --check scripts/verify-yoganode-nitro-materialization.mjs`,
  `npm run check:yoganode-nitro-materialization`, and
  `npm run check:feasible-matrix`.

Highest-value blocked target remains real React Native runtime/platform proof
once the local iOS/Android toolchain is available.

Goal finished.
