# Worker 209: Post-208 Root-Cause Audit

## Summary

Audited the post-Worker-208 state from the isolated Worker 209 worktree.

Worker 208's accepted proof boundary is accurate. `YogaNode::setStyle(...)`
validates string `style.backgroundColor` immediately after layout-unit string
validation and before layout invalidation, `_style` assignment, Yoga reset,
paint reset, layer reset, clip reset, matrix reset, or later native setter
application. The generated materialized Nitro verifier covers valid CSS-string
delivery, deterministic invalid-string rejection, and preservation of previous
native style/paint state after rejection.

The initial Worker 209 subagent and a recovery subagent both stalled without
writing a report or tracked files. Orchestration closed both agents and
completed this report-only recovery in the assigned isolated worktree.

## Changed Files

- `worker-progress/worker-209-post-208-root-cause-audit.md`

No product source, verifier script, package metadata, generated artifact, or
master coordination document was modified by this worker branch.

## Commands Run

- `git merge --ff-only main`
- `git status --short --branch --ignored=matching`
- `git diff --check`
- `node --check scripts/verify-feasible-matrix.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- Platform blocker reprobes:
  `xcode-select -p`, `xcodebuild -version`,
  `xcrun --sdk iphonesimulator --show-sdk-path`,
  `xcrun simctl list runtimes available`, `pod --version`,
  `gradle --version`, `adb version`, `cmake --version`,
  `ninja --version`, `java -version`, and an Android/JDK environment probe.
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`

## Evidence Gathered

- The worker branch was fast-forwarded from `6dbd733` to current `main`
  `468f19f` before local recovery, so the report is based on the latest
  Worker 208 and coordination-doc state.
- `cpp/YogaNode.cpp` defines `validateBackgroundColorString(...)`, which only
  inspects `std::string` `backgroundColor` variants, preserves `SkPaint`
  variants, and throws `std::invalid_argument` with the rejected value when
  `parseCssColor(...)` fails.
- `YogaNode::setStyle(...)` calls `validateYogaLayoutUnitStrings(style)` and
  then `validateBackgroundColorString(style)` before `invalidateLayout()`,
  `_style = style`, `resetYogaStyle(_node)`, `_paint = SkPaint()`,
  `_layerPaint.reset()`, clip reset, and matrix reset.
- The valid string path still stores the original string in
  `_style.backgroundColor` and parses the color into `_paint`.
- `src/specs/style.ts` still exposes `backgroundColor?: string | SkColorNative`;
  generated native `NodeStyle` still transports it as
  `std::variant<std::string, SkPaint>`. Worker 208 did not narrow public
  TypeScript or Nitro transport shape; it made invalid runtime strings fail
  deterministically at native style application.
- `scripts/verify-yoganode-nitro-materialization.mjs` includes
  `assertGeneratedCssBackgroundColorStringValidation(...)`, invoked from the
  generated-materialized `setStyle(...)` probe. It asserts:
  - valid `#123456` delivery into `_style.backgroundColor`;
  - parsed RGB delivery into `_paint`;
  - paint scalar delivery for border width, cap, join, miter, dither,
    antiAlias, and opacity;
  - generated-wrapper rejection of `not-a-css-color`;
  - preservation of previous `_style.backgroundColor`, `_paint` RGB, stroke
    width, stroke cap, stroke join, stroke miter, dither, antiAlias, and alpha
    after rejection.
- `npm run check:yoganode-nitro-materialization` passed and its proof-boundary
  output explicitly includes generated CSS-string `backgroundColor` delivery
  and invalid-string rejection preserving previous `_style.backgroundColor` and
  `_paint` state.
- `npm run check:feasible-matrix` passed all 28 commands in `5m 7s`.
  Cleanup removed only newly created `tsconfig.tsbuildinfo` and the
  matrix-owned temp parent; remaining new tracked artifacts were none.
- Platform-native runtime proof remains blocked locally:
  - `xcode-select -p` points at `/Library/Developer/CommandLineTools`.
  - `xcodebuild -version` fails because full Xcode is not selected.
  - The iPhone simulator SDK cannot be located.
  - `simctl` is unavailable.
  - `pod`, `gradle`, `adb`, `cmake`, and `ninja` are not on `PATH`.
  - `java -version` cannot locate a Java runtime.
  - No `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or `JAVA_HOME` value is present.

## Proof Boundary And Overclaim Risks

Proven:

- Worker 208 deterministically rejects invalid string
  `style.backgroundColor` values before native `YogaNode` style, Yoga, paint,
  layer, clip, or matrix mutation.
- Valid CSS strings and existing `SkPaint` host-object `backgroundColor`
  behavior remain covered.
- The generated materialized Nitro wrapper path surfaces rejected strings as
  JS-facing errors and preserves prior style/paint state.
- The full feasible local package/source/example matrix remains green after
  Worker 208 and the coordination-doc updates.

Not proven:

- Actual React Native bridge delivery.
- Nitro registry installation inside a real React Native runtime.
- UI-runtime Worklets/Reanimated delivery.
- iOS/Android app build/run, simulator/device launch, or native platform
  presentation.
- Exhaustive CSS color syntax conformance beyond the shared project parser and
  selected verifier cases.
- Finiteness or range validation for numeric non-string style fields.

## Cleanup Status

- No platform tooling was installed.
- No native projects were generated in the launched checkout.
- The feasible matrix removed its matrix-owned temp parent.
- Ignored dependency symlinks remain untouched and expected:
  `node_modules` and `example/node_modules`.
- Both stalled Worker 209 managed subagents were closed before local recovery
  continued.

## Recommended Next Tasks

Strongest locally unblocked implementation target: deterministic finite-number
validation for native `YogaNode::setStyle(...)` numeric style scalars before
mutation, starting with public paint-associated fields such as `style.opacity`,
`borderWidth`, and `strokeMiter`.

Why this is root-cause level:

- Public style types accept ordinary JS numbers for paint/layout scalars.
- Generated Nitro conversion transports those numbers before native
  `YogaNode::setStyle(...)` applies them.
- Worker 206/207 explicitly left numeric non-string style finiteness outside
  their proof boundary.
- Current `YogaNode::setStyle(...)` still forwards numeric style values into
  Yoga and `SkPaint` setters after `_style` and paint reset without a
  pre-mutation non-finite guard.
- The existing materialized verifier already has positive paint-field coverage
  for `backgroundColor`, `borderWidth`, `strokeCap`, `strokeJoin`,
  `strokeMiter`, `dither`, `antiAlias`, and `opacity`, but no negative
  `NaN`/`Infinity` preservation proof for numeric style scalars.

Suggested Worker 210 scope:

- Add a narrow pre-mutation validation helper in `cpp/YogaNode.cpp` for
  selected numeric style fields with direct Yoga/paint side effects.
- Start with finite-number rejection, not broader semantic range changes,
  unless source evidence justifies a range contract.
- Extend `scripts/verify-yoganode-nitro-materialization.mjs` with generated
  materialized `setStyle(...)` negative coverage proving non-finite numeric
  style rejection preserves previous `_style`, `_paint`, and any selected Yoga
  state.
- Run `git diff --check`,
  `node --check scripts/verify-yoganode-nitro-materialization.mjs`,
  `npm run check:yoganode-nitro-materialization`, and
  `npm run check:feasible-matrix`.

Highest-value blocked target remains real React Native runtime/platform proof
once the local iOS/Android toolchain is available.

Goal finished.
