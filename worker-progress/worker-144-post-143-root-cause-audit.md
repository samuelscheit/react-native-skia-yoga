# Worker 144 - Post-worker-143 root-cause audit

## Summary

This was a report-only post-worker-143 audit. Worker 143 closed the
example-owned nested paragraph target: the example type fixture, animate tab,
and paragraph command demo now use nested `paragraphStyle.textStyle` while
simple `<text textStyle>` examples remain limited to `fontSize` and `color`.

Selected next target: bounded style serializer field-inventory and proof-boundary
cleanup. The current native converters and verifiers cover the important
post-worker-139 text/paragraph style paths, and I did not find a concrete
missing public style field. The next strongest locally unblocked task is to make
that field inventory explicit and keep verifier proof-boundary text aligned with
the current RN Skia public type surface, without expanding unsupported simple
`TextCmd` rich styling or platform-runtime claims.

## Changed files

- `worker-progress/worker-144-post-143-root-cause-audit.md`

No product source, examples, README docs, package metadata, generated specs,
master planning files, or dependency directories were changed.

## Baseline

- Worktree:
  `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-144-post-143-root-cause-audit`
- Branch: `worker/144-post-143-root-cause-audit`
- Baseline commit reviewed: `975523c`
- Initial and post-matrix status before writing this report: clean except
  ignored dependency directories `node_modules/` and `example/node_modules/`.
- Worker 143 evidence accepted: `git diff --check`, example typecheck, root
  typecheck, example bundle export, package TypeScript consumer,
  Reconciler animated bindings, and the full 28-command feasible matrix passed.

## Evidence inspected

Required context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-142-post-141-root-cause-audit.md`
- `worker-progress/worker-143-example-nested-paragraph-demo.md`

Relevant source, verifier, example, docs, and installed dependency files
reviewed:

- `README.md`
- `src/jsx.ts`
- `src/specs/commands.ts`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/YogaNode.cpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-feasible-matrix.mjs`
- `example/types/skiayoga-typecheck.tsx`
- `example/app/(tabs)/animate.tsx`
- `example/app/(tabs)/components/paragraph.tsx`
- `node_modules/@shopify/react-native-skia/src/skia/types/Paragraph/TextStyle.ts`
- `node_modules/@shopify/react-native-skia/src/skia/types/Paragraph/ParagraphStyle.ts`
- `node_modules/@shopify/react-native-skia/src/skia/types/Image/Image.ts`

Key local evidence:

- `src/jsx.ts:38` through `:50` defines rich `YogaTextStyle` by widening
  color fields and omitting unsupported `fontVariations`.
- `src/jsx.ts:52` limits simple `YogaSimpleTextStyle` to `fontSize` and
  `color`; `src/jsx.ts:167` through `:170` exposes only that simple style shape
  for `<text />`.
- `src/jsx.ts:54` through `:57` preserves rich paragraph styling plus nested
  `textStyle?: YogaTextStyle`; `src/jsx.ts:173` through `:178` exposes that
  rich shape for `<paragraph />`.
- `README.md:67` through `:97` now documents the simple text versus rich
  paragraph split and the unsupported `fontVariations` boundary.
- Worker 143's example refresh is present in
  `example/types/skiayoga-typecheck.tsx:149` through `:158`,
  `example/app/(tabs)/animate.tsx:75` through `:82`, and
  `example/app/(tabs)/components/paragraph.tsx:22` through `:32`.
- Installed RN Skia public `SkTextStyle` currently exposes
  `backgroundColor`, `color`, decoration fields, `fontFamilies`,
  `fontFeatures`, `fontSize`, `fontStyle`, `fontVariations`,
  `foregroundColor`, `heightMultiplier`, `halfLeading`, `letterSpacing`,
  `locale`, `shadows`, `textBaseline`, and `wordSpacing`.
- Installed RN Skia public `SkParagraphStyle` currently exposes
  `disableHinting`, `ellipsis`, `heightMultiplier`, `maxLines`,
  `replaceTabCharacters`, `strutStyle`, `textAlign`, `textDirection`,
  `textHeightBehavior`, and `textStyle`; `SkStrutStyle` exposes the current
  font family/style/size/height/leading/force fields.
- Installed RN Skia public `SamplingOptions` is only
  `CubicResampler | FilterOptions`, with cubic `B`/`C` or `filter`/`mipmap`.
- `cpp/JSIConverter+SkTextStyle.hpp:193` through `:230` serializes the current
  supported public text-style fields, and `:233` through `:340` parses the same
  supported shape while rejecting `fontVariations`.
- `cpp/JSIConverter+SkParagraphStyle.hpp:82` through `:121` builds the
  paragraph-owned base object, `:123` through `:153` applies nested
  `textStyle`, `:155` through `:171` preserves the local strut-family overlay,
  and `:259` through `:298` emits paragraph fields plus nested and flattened
  text-style output.
- `cpp/JSIConverter+NodeCommand.hpp:340` through `:388` rejects rich simple
  `text.textStyle` keys, and `:390` through `:401` serializes simple text
  style as only `fontSize` and `color`.
- `scripts/verify-package-typescript-consumer.mjs:361` through `:398` accepts
  static and dynamic nested `paragraphStyle.textStyle` authoring, while `:400`
  through `:438` rejects unsupported nested sampling leaves, rich simple text
  fields, and unsupported paragraph `fontVariations`.
- `scripts/verify-reconciler-animated-bindings.mjs:163` through `:235` covers
  JS command listener rebuild behavior for dynamic nested
  `paragraphStyle.textStyle.color` and `fontSize`.
- `scripts/verify-yoganode-native-commands-render.mjs:166` through `:178`
  prints broad host-native command/render proof, including selected
  text/paragraph/sampling serialization and explicit boundaries for platform
  runtime, exact typography, rich simple `TextCmd`, and every-field style proof.

Delegated read-only checks that affected the conclusion:

- `style_boundary_challenge` recommended style serializer cleanup only as a
  bounded field-inventory or verifier-message target. It found no concrete
  missing public style field, confirmed rich simple `TextCmd` is intentionally
  unsupported, confirmed sampling is already bounded, and syntax-checked
  `scripts/verify-yoganode-native-commands-render.mjs`,
  `scripts/verify-package-typescript-consumer.mjs`, and
  `scripts/verify-reconciler-animated-bindings.mjs`.
- `platform_toolchain_challenge` confirmed platform-native iOS/Android
  build/run remains locally blocked. It also confirmed the positive repo-owned
  path still works through example Expo/RN config metadata, including
  `react-native-skia-yoga` iOS podspec and Android package/codegen metadata.

## Verification commands

- `/usr/bin/time -p git diff --check`: passed, `real 0.03`.
- `/usr/bin/time -p node --check scripts/verify-yoganode-native-commands-render.mjs`:
  passed, `real 0.04`.
- `/usr/bin/time -p node --check scripts/verify-package-typescript-consumer.mjs`:
  passed, `real 0.05`.
- `/usr/bin/time -p node --check scripts/verify-reconciler-animated-bindings.mjs`:
  passed, `real 0.05`.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands,
  matrix duration `4m 31s`, `/usr/bin/time` `real 271.66`.

Notable feasible-matrix evidence:

- `check:package-typescript-consumer` passed and printed that packed consumer
  TypeScript accepts simple `text.textStyle` `color`/`fontSize`, rejects rich
  simple-text fields, preserves rich paragraph styling, accepts static and
  dynamic nested `paragraphStyle.textStyle` CSS color/fontSize, and rejects
  nested `image.sampling` SharedValue leaves.
- `check:reconciler-animated-bindings` passed and printed JS command listener
  coverage for `paragraph.paragraphStyle.textStyle.color` and
  `paragraph.paragraphStyle.textStyle.fontSize`.
- `check:yoganode-native-commands-render` passed and printed selected
  value-bearing `SkSamplingOptions`, `SkTextStyle`, and `SkParagraphStyle`
  serialization proof, nested paragraph text-style conversion/output proof,
  rich simple-text rejection, unsupported `fontVariations` rejection, and
  bounded render evidence.
- `check:example-bundle`, `cd example && bun run typecheck`, and
  `check:example-native-generation` passed, confirming the example feedback loop
  remains feasible up to isolated native project generation.
- Matrix cleanup removed generated `tsconfig.tsbuildinfo`, removed the
  matrix-owned temp parent `/tmp/rnskia-feasible-matrix-p51XYX`, and reported no
  remaining new tracked artifacts.

Platform/toolchain probes:

- `git ls-files example/ios example/android`: no tracked native example
  folders.
- `find example -maxdepth 2 (example/ios or example/android)`: no local native
  folders in this worker worktree.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is
  Command Line Tools, not full Xcode.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `java -version`: failed with no Java runtime available.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`: unset.
- `pod`, `gradle`, `adb`, `cmake`, `ninja`, `sdkmanager`, and `emulator`: not
  found in `PATH`.

The platform/toolchain probes intentionally exited nonzero where local tools are
missing; those are recorded as blockers, not repo verification failures.

## Candidate ranking

1. Bounded style serializer field-inventory and proof-boundary cleanup.

Evidence: the text/paragraph style contract has been tightened across workers
131 through 143, and the current source/verifier surface is stronger than the
remaining proof wording suggests. The installed RN Skia public text/paragraph
type set is finite, local converters parse/serialize the current supported
fields, and the command/render verifier already exercises representative direct
converter and `NodeCommand` paths. However, the verifier output still frames this
as "selected" proof and excludes "every SkTextStyle/SkParagraphStyle field"
without an explicit inventory that explains which current public fields are
covered, intentionally unsupported, normalized, or outside runtime fidelity.

Impact is moderate and repo-owned: the recurring audits are now mostly sorting
real contract gaps from stale proof-boundary wording. A small field-inventory
verifier or verifier-output cleanup would make future selections less ambiguous,
especially when RN Skia upgrades change public type fields. This should not be a
runtime implementation task unless the inventory finds a concrete missing public
field.

2. Sampling boundary clarification.

Evidence: current RN Skia public `SamplingOptions` is only cubic `{ B, C }` or
`{ filter, mipmap }`, and local serialization covers those shapes. Package
TypeScript already rejects nested `image.sampling` SharedValue leaves while
allowing whole opaque sampling values. The only stale risk is wording around
unsupported native `maxAniso`, which is not part of the current installed RN Skia
public TypeScript contract. This is useful cleanup but smaller than the broader
style field-inventory target.

3. Platform-native iOS/Android build/run.

Evidence: generated native project creation, autolinking metadata, host-native
runtime probes, example typecheck, and example bundle export all pass. Full app
build/run remains externally blocked by Command Line Tools-only Xcode, missing
simulator SDK, missing CocoaPods, missing Java, unset Android SDK variables, and
absent Gradle/ADB/CMake/Ninja tooling. This should move up only after the local
toolchain changes.

4. Rich simple `TextCmd` text-style rendering.

Evidence: this is intentionally unsupported after workers 133 and 141.
`<text textStyle>` is publicly limited to `fontSize` and `color`, native command
conversion rejects rich simple-text keys, and README/docs direct rich typography
to `<paragraph />`. Expanding simple text would be a feature change, not a
current root-cause cleanup target.

5. Broad exact typography/render fidelity, image asset loading, every dynamic
command prop, or React Native bridge runtime.

Evidence: current local verifiers deliberately bound these areas. They are
valuable future product confidence targets, but they are broader, more
environment-dependent, and more overclaim-prone than the proof-boundary cleanup
above.

## Selected next target

Assign a bounded style serializer field-inventory and proof-boundary cleanup
worker.

Recommended scope:

- Add or update a lightweight source-level inventory for the current installed
  RN Skia public `SkTextStyle`, `SkParagraphStyle`, `SkStrutStyle`, and
  `SamplingOptions` fields.
- Map each field to one of the current contract buckets: supported and
  parse/serialized, supported with native normalization such as CSS colors,
  intentionally unsupported such as `fontVariations`, or outside render/fidelity
  proof such as exact typography.
- Update `scripts/verify-yoganode-native-commands-render.mjs` proof-boundary
  output so "selected" and "every field" wording is precise against that
  inventory.
- Keep runtime behavior unchanged unless the inventory exposes a concrete public
  field mismatch; if it does, stop and re-scope to that field-specific root
  cause.
- Preserve the current simple `<text textStyle>` boundary and do not add rich
  simple `TextCmd` rendering.
- Preserve sampling as an opaque whole-object contract; do not add nested
  `SharedValue` leaves or native-only `maxAniso` claims.
- Run at least `node --check scripts/verify-yoganode-native-commands-render.mjs`,
  `npm run check:yoganode-native-commands-render`, `npm run check:package-typescript-consumer`,
  and `npm run check:feasible-matrix`.

## Proof boundary/overclaim risks

- Proven now: package TypeScript accepts and rejects the current public
  simple-text, rich-paragraph, nested paragraph text-style, and opaque sampling
  authoring boundaries; Reconciler JS-mode listener proof covers dynamic nested
  paragraph text-style leaves; host-native command/render proof covers selected
  value-bearing sampling/text/paragraph serialization, nested paragraph
  conversion/output, unsupported `fontVariations` rejection, rich simple-text
  rejection, and bounded raster behavior.
- Not proven now: full iOS/Android app build/run, CocoaPods install, Gradle
  build, simulator/device launch, native platform presentation, React Native
  bridge delivery, Nitro registry install inside a running RN app, UI-runtime
  Worklets execution, real Reanimated delivery, RNGH native delivery, CSS color
  string preservation after native normalization, exact typography, font fallback
  correctness, paragraph shaping fidelity, exact render fidelity, image
  asset/loading/decoding, texture-backed image behavior, native-only
  `maxAniso` preservation, rich simple `TextCmd` styling, or every dynamic
  command prop.
- The next target must avoid turning a proof-boundary cleanup into a broad
  fidelity claim. Inventory wording should say exactly what the local host-native
  and TypeScript checks prove.
- If RN Skia's installed public type surface changes, the inventory should fail
  clearly instead of silently leaving stale proof text.

## Cleanup status

- No product/source/example/docs/generated/package files were edited.
- Ignored dependency directories were left untouched: `node_modules/` and
  `example/node_modules/`.
- The feasible matrix removed its generated `tsconfig.tsbuildinfo` and its
  matrix-owned temp parent.
- Final intended tracked change: this report only.

## Recommended next tasks

- Assign the bounded style serializer field-inventory/proof-boundary cleanup
  worker described above.
- Treat sampling wording cleanup as part of that inventory if it remains small;
  otherwise leave sampling as a lower-priority bounded proof-boundary task.
- Keep platform-native build/run verification queued until full Xcode/CocoaPods
  and Android Java/SDK/Gradle/ADB prerequisites are available locally.
- Keep rich simple `TextCmd` rendering as a separate feature proposal, not a
  cleanup task.

Goal finished.
