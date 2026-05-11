# Worker 142 - Post-worker-141 root-cause audit

## Summary

This was a report-only post-worker-141 audit. Worker 141 closed the README/API
documentation target: the README now explains the simple `<text textStyle>`
versus rich `<paragraph paragraphStyle>` split, includes nested
`paragraphStyle.textStyle`, and preserves the unsupported `fontVariations`
boundary.

Selected next target: refresh the example-owned nested paragraph type/demo
surface. The package, Reconciler, generated-wrapper, and native command/render
proofs already cover nested `paragraphStyle.textStyle`, but the example
fixtures and demos still use only flattened paragraph styling. This is the
strongest locally unblocked root-cause target because it aligns the user-facing
example feedback loop with the now-documented public API without expanding
unsupported text or platform-runtime claims.

## Changed files

- `worker-progress/worker-142-post-141-root-cause-audit.md`

No product, README, example, source, generated, package, or master planning files
were changed.

## Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-142-post-141-root-cause-audit`
- Branch: `worker/142-post-141-root-cause-audit`
- Baseline commit reviewed: `cd1748d`
- Initial status: clean on the worker branch.
- Post-check status before writing this report: ignored dependency directories
  only after removing the ignored `tsconfig.tsbuildinfo` generated/refreshed by
  local TypeScript checks.
- Worker 141 evidence accepted: `git diff --check`,
  `npm run check:package-typescript-consumer`, and the 28-command feasible
  matrix passed, with Worker 141 reporting the matrix at 5m 2s.

## Evidence inspected

Required context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `README.md`
- `worker-progress/worker-140-post-139-root-cause-audit.md`
- `worker-progress/worker-141-readme-text-paragraph-docs.md`

Relevant source, verifier, and example files reviewed:

- `src/jsx.ts`
- `src/Reconciler.ts`
- `src/specs/commands.ts`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/YogaNode.cpp`
- `cpp/YogaNode.hpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-feasible-matrix.mjs`
- `example/types/skiayoga-typecheck.tsx`
- `example/app/(tabs)/animate.tsx`
- `example/app/(tabs)/components/paragraph.tsx`
- `example/app/(tabs)/components/text.tsx`
- `example/app/(tabs)/components/registry.ts`

Key local evidence:

- `README.md:67` through `README.md:97` now documents the simple text versus
  rich paragraph styling split, nested `paragraphStyle.textStyle`, and the
  unsupported `fontVariations` boundary.
- `src/jsx.ts:52` limits `YogaSimpleTextStyle` to `fontSize` and `color`.
- `src/jsx.ts:54` through `src/jsx.ts:57` preserves rich paragraph styling and
  nested `textStyle?: YogaTextStyle`.
- `src/jsx.ts:170` exposes simple text style on `<text />`; `src/jsx.ts:175`
  through `src/jsx.ts:177` exposes rich paragraph style on `<paragraph />`.
- `scripts/verify-package-typescript-consumer.mjs:361` through `:398` accepts
  rich paragraph style plus static and dynamic nested
  `paragraphStyle.textStyle` package-consumer fixtures.
- `scripts/verify-reconciler-animated-bindings.mjs:163` through `:235` proves
  JS-listener rebuild behavior for dynamic nested
  `paragraphStyle.textStyle.color` and `paragraphStyle.textStyle.fontSize`.
- `scripts/verify-yoganode-native-commands-render.mjs:170` through `:178`
  reports native command/render proof for selected nested paragraph text-style
  conversion, dual flat/nested serialization shape, distinct paragraph/text
  height preservation, rich simple-text rejection, and explicit proof
  boundaries.
- `scripts/verify-yoganode-nitro-materialization.mjs:927` through `:933` builds
  a generated-wrapper paragraph command with nested `paragraphStyle.textStyle`;
  `:1451` through `:1456` asserts generated `setCommand(paragraph)` installs a
  real `ParagraphCmd` and builds a paragraph from nested text style.
- `example/types/skiayoga-typecheck.tsx:148` through `:155` still
  compile-checks only flattened dynamic `paragraphStyle.fontSize`.
- `example/app/(tabs)/animate.tsx:71` through `:80` still demonstrates
  flattened paragraph `fontSize` and describes it as
  `nested paragraphStyle.fontSize`, not the newer recommended
  `paragraphStyle.textStyle.fontSize` shape.
- `example/app/(tabs)/components/paragraph.tsx:18` through `:26` only demos flat
  `color` and `fontSize`, so the example component page does not show the rich
  nested paragraph path now documented in the README.
- `cpp/JSIConverter+NodeCommand.hpp:340` through `:388` rejects rich
  `text.textStyle` fields and states that `TextCmd` supports `fontSize` and
  `color`.
- `cpp/YogaNode.cpp:1559` through `:1576` shows `TextCmd::updateProps` applies
  text, font, `fontSize`, and fallback color only.
- `cpp/JSIConverter+SkTextStyle.hpp:193` through `:230` and
  `cpp/JSIConverter+SkParagraphStyle.hpp:259` through `:298` serialize selected
  public-shaped text/paragraph fields, including nested paragraph `textStyle`.
- `cpp/JSIConverter+SkSamplingOptions.hpp:26` through `:45` serializes the
  currently selected sampling shapes: cubic `{ B, C }` or `{ filter, mipmap }`.

Delegated read-only checks that affected the conclusion:

- `nested_paragraph_example_probe` recommended the example refresh first. It
  cited the new README section, public type support, package/Reconciler nested
  paragraph proof, and the lagging example type/demo files. It also ran
  read-only syntax/status checks: `git diff --check` and `node --check` for the
  package consumer, Reconciler binding, and native command/render verifier
  scripts; all passed.
- `serializer_sampling_platform_probe` challenged the alternatives and found
  none that should outrank the example refresh. Its nested checks classified
  style serializer work as broad proof-boundary cleanup, sampling as an
  already-bounded public contract with intentional nested-leaf rejection, rich
  simple `TextCmd` as intentionally unsupported, and platform-native build/run
  as still locally blocked by toolchain prerequisites.

Platform/blocker evidence inspected locally:

- `git ls-files example/ios example/android`: no tracked native example folders.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is
  Command Line Tools, not full Xcode.
- `java -version`: failed with no Java runtime available.
- `command -v pod`, `gradle`, `adb`, `cmake`, and `ninja`: all exited with no
  tool in `PATH`.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`: unset.

## Verification commands

- `git diff --check`: passed.
- `cd example && bun run typecheck`: passed.
- `npm run check:example-bundle`: passed.
- `npm run typecheck`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 49s.

Notable feasible-matrix evidence:

- `check:package-typescript-consumer` passed and printed that packed consumer
  TypeScript accepts static and dynamic nested `paragraphStyle.textStyle`
  CSS color/fontSize authoring while rejecting rich simple-text fields and
  unsupported `fontVariations`.
- `check:reconciler-animated-bindings` passed and printed JS command listener
  coverage for `paragraph.paragraphStyle.textStyle.color` and
  `paragraph.paragraphStyle.textStyle.fontSize`.
- `check:yoganode-native-commands-render` passed and printed native
  command/render proof for nested paragraph CSS color conversion, dual
  flat/nested paragraph text-style output, selected paragraph/text style
  serialization, unsupported `fontVariations` rejection, and rich simple-text
  rejection.
- `check:yoganode-nitro-materialization` passed and printed generated
  `setCommand(paragraph)` wrapper proof using nested
  `paragraphStyle.textStyle`.
- `check:example-bundle`, `cd example && bun run typecheck`, and
  `check:example-native-generation` passed inside the matrix, confirming the
  example feedback loop remains locally feasible up to generated native project
  creation.

The platform/toolchain probes above intentionally exited nonzero where local
tools are missing; those are recorded as blockers, not verifier failures.

## Candidate ranking

1. Example-owned nested paragraph type/demo refresh.

Evidence: the README now recommends nested paragraph text styling, and package,
Reconciler, generated-wrapper, and native command/render verifiers prove that
shape. The example feedback surfaces lag behind that proof:
`example/types/skiayoga-typecheck.tsx:148` through `:155` uses flattened dynamic
`paragraphStyle.fontSize`; `example/app/(tabs)/animate.tsx:71` through `:80`
uses flattened `fontSize` and copy that does not name
`paragraphStyle.textStyle.fontSize`; `example/app/(tabs)/components/paragraph.tsx:18`
through `:26` only demonstrates flat `color`/`fontSize`.

Impact is moderate and user-facing: examples are the fastest feedback loop for
supported JSX authoring, and they should now mirror the documented rich
paragraph path. Feasibility is high because example typecheck and bundle export
already pass. Overclaim risk is manageable if the next worker keeps the scope to
compile-checked/demo alignment and does not claim UI-runtime Reanimated or
platform-native rendering.

2. Style serializer field-inventory/proof-boundary cleanup.

Evidence: the concrete nested `ParagraphStyle::toJSI(...)` shape issue selected
by worker 138 was closed by worker 139. Current converters serialize selected
fields in `JSIConverter+SkTextStyle.hpp` and `JSIConverter+SkParagraphStyle.hpp`,
and the native command/render verifier explicitly lists remaining exclusions at
`scripts/verify-yoganode-native-commands-render.mjs:178`.

This remains useful as an audit or documentation pass, but I did not find a
crisp public field mismatch stronger than the example drift. Treat this as
lower-priority unless a concrete missing parser/serializer field is selected.

3. Sampling option boundaries.

Evidence: worker 117 closed whole `SharedValue<SamplingOptions>` package type
support while keeping nested sampling leaves rejected. Worker 119 added selected
value-bearing sampling serialization. Current `JSIConverter+SkSamplingOptions`
serializes cubic or filter/mipmap shapes, and the command/render verifier
correctly excludes unsupported `maxAniso` preservation.

This is lower public-contract risk than the example target because current RN
Skia public `SamplingOptions` authoring is bounded and the package verifier
documents nested-leaf rejection.

4. Rich simple `TextCmd` text-style expansion.

Evidence: this is intentionally unsupported after workers 133 and 141.
`src/jsx.ts` limits simple text style to `fontSize` and `color`, native
conversion rejects rich simple-text keys, `TextCmd::updateProps` only applies
font size and fallback color, and the README directs rich typography to
`<paragraph />`.

This would be a new feature expansion, not a current root-cause fix.

5. Platform-native iOS/Android build/run.

Evidence: feasible checks prove package metadata, autolinking, generated native
project creation, host-native runtime probes, and example bundle export. Full
iOS/Android app build/run remains externally blocked in this worker environment
by Command Line Tools-only Xcode selection, missing CocoaPods, missing Java,
unset Android SDK variables, absent Gradle/ADB/CMake/Ninja, and no tracked
native example folders.

This should move up only if local prerequisites change.

## Selected next target

Assign a small example-owned nested paragraph type/demo refresh.

Recommended scope:

- Update `example/types/skiayoga-typecheck.tsx` so the paragraph type fixture
  compile-checks dynamic nested `paragraphStyle.textStyle.color` and/or
  `paragraphStyle.textStyle.fontSize`, not only flattened
  `paragraphStyle.fontSize`.
- Update `example/app/(tabs)/animate.tsx` to demonstrate the nested
  `paragraphStyle.textStyle.fontSize` shape and correct the copy so it names the
  actual public path.
- Update `example/app/(tabs)/components/paragraph.tsx` to show a richer
  paragraph example using root paragraph style plus nested
  `paragraphStyle.textStyle`, consistent with the README.
- Keep `<text textStyle>` examples simple and limited to `fontSize`/`color`.
- Preserve the unsupported `fontVariations` boundary.
- Do not claim actual UI-runtime SharedValue delivery or platform-native
  render behavior from this example refresh.

Recommended verification for that worker:

- `git diff --check`
- `cd example && bun run typecheck`
- `npm run typecheck`
- `npm run check:example-bundle`
- `npm run check:package-typescript-consumer` if package-facing type fixtures are
  touched or copied into the example.
- `npm run check:reconciler-animated-bindings` if nested dynamic binding
  behavior is referenced in code or report.
- `npm run check:feasible-matrix`

## Proof boundary/overclaim risks

Proven locally now:

- README wording matches the package/native contract for simple text versus rich
  paragraph styling.
- Simple `<text textStyle>` accepts `fontSize` and `color`; rich simple-text
  fields and `fontVariations` are rejected in package and native proof.
- Rich paragraph authoring accepts root paragraph fields plus nested
  `paragraphStyle.textStyle`.
- Static and dynamic nested `paragraphStyle.textStyle.color` and `fontSize`
  compile from a packed package and rebuild command data in Reconciler
  JS-listener proof.
- Host-native command/render proof parses nested paragraph CSS color, preserves
  selected nested outbound shape, and rejects unsupported paragraph
  `fontVariations`.
- Generated materialized `YogaNode.setCommand(paragraph)` proof covers a nested
  paragraph text-style command payload.
- Example typecheck and example bundle export are locally green.
- Expo CNG native project generation and autolinking are locally green in a
  temporary workspace.

Not proven locally now:

- CocoaPods install.
- Gradle build.
- Simulator or device launch.
- Native platform presentation.
- Full iOS/Android app runtime.
- UI-runtime Worklets execution.
- Real Reanimated `SharedValue` delivery.
- Actual native bridge delivery.
- RNGH native delivery.
- CSS color string preservation after native normalization.
- Exact typography, paragraph shaping, font fallback correctness, or exact
  render fidelity.
- Every `SkTextStyle` or `SkParagraphStyle` field.
- `SkSamplingOptions maxAniso` preservation.
- Variable-font support.
- Rich simple `TextCmd` text-style rendering.

Main overclaim risk for the selected target: an example refresh can prove
compile-time/demo alignment and bundled example source health, but it does not
prove device runtime animation delivery or native platform rendering.

## Cleanup status

- No product, README, example, source, generated, package, or master planning
  files were edited.
- Ignored dependency directories were left untouched: `node_modules/` and
  `example/node_modules/`.
- `npm run check:feasible-matrix` removed its matrix-owned temp parent and
  reported no remaining new tracked artifacts after cleanup.
- `npm run typecheck` generated or refreshed ignored `tsconfig.tsbuildinfo`
  before the matrix observed it as pre-existing; I removed it before writing
  this report.
- Final intended tracked change is this report only.

## Recommended next tasks

- Assign the example-owned nested paragraph type/demo refresh described above.
- After that, run a fresh audit instead of assuming the serializer/sampling
  backlog order; the strongest remaining target should be chosen from concrete
  public mismatch evidence.
- Keep style serializer inventory work bounded to a selected public field or
  proof-boundary cleanup.
- Keep rich simple `TextCmd` rendering and variable-font support as explicit
  feature targets if they become product goals.
- Keep platform-native build/run verification queued until full Xcode/CocoaPods
  and Android Java/SDK tooling are available locally.

Goal finished.
