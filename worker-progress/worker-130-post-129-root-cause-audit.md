# Summary

This was a report-only post-worker-129 audit. I changed only this report:

- `worker-progress/worker-130-post-129-root-cause-audit.md`

The post-worker-129 feasible baseline is green. Worker 129's bounded `ParagraphStyle.strutStyle` work is present in the current converters and verifier: local `strutStyle.fontFamilies` preservation, public-shaped strut serialization, direct `ParagraphStyle fromJSI -> toJSI -> fromJSI` proof, and representative `paragraph.paragraphStyle` `NodeCommand toJSI -> fromJSI` proof all remain covered by the full feasible matrix.

Selected next target: close the unsupported public `fontVariations` contract by narrowing/rejecting it for Yoga text and paragraph styles, with packed-consumer type negatives and host-JSC/native converter rejection proof. Do not attempt to claim variable-font rendering or full `SkFontArguments` serialization in that worker.

# Baseline verification

Worktree:

- `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-130-post-129-root-cause-audit`
- Branch: `worker/130-post-129-root-cause-audit`
- HEAD at audit: `60a9d23 Accept worker 129 and queue next audit`

Required commands:

- `git diff --check`: passed before report writing with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `5m 10s`.
  - Matrix-owned temp parent: `/tmp/rnskia-feasible-matrix-FHlsBP`.
  - Cleanup removed newly created tracked artifact `tsconfig.tsbuildinfo`.
  - Remaining new tracked artifacts after matrix cleanup: none.

Notable matrix evidence:

- `check:yoganode-native-commands-render` passed and reported selected value-bearing `SkTextStyle` including `fontFeatures`, selected `SkParagraphStyle` fields including `disableHinting`, `replaceTabCharacters`, `textDirection`, `textHeightBehavior`, and selected public-shaped `strutStyle` fields.
- `check:yoganode-nitro-materialization` passed and still proves host-JSC `YogaNode::toObject(...)`, generated wrapper/prototype materialization, generated `setCommand(...)`, generated `setStyle(...)`, `computeLayout(...)`, layout getter, and returned-child identity.
- Package codegen/autolinking, package TypeScript consumer, package surface/lifecycle, RN codegen schema, lazy-init, Reconciler animated bindings, gesture/lifecycle runtimes, RN Skia import guard, Android archive guard, host-native YogaNode runtime/hit-testing/commands, raw methods, RNSkYogaView runtime, root typecheck, lint, example typecheck, specs generation, example bundle export, and isolated example native generation all passed.

Warnings and environment blockers observed:

- Existing npm `minimum-release-age` config warnings appeared during npm commands.
- Expo export printed the existing bytecode advisory.
- Expo prebuild printed the existing Android `EDGE_TO_EDGE_PLUGIN` warning.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because full Xcode is not selected.
- `pod`, `adb`, `cmake`, `ninja`, and `gradle`: unavailable on `PATH`.
- `java -version`: failed because no Java runtime is installed.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

# Current proof surface

Post-worker-129 source/proof state:

- `cpp/JSIConverter+SkParagraphStyle.hpp:82` now applies a local `strutStyle.fontFamilies` overlay after RN Skia paragraph parsing.
- `cpp/JSIConverter+SkParagraphStyle.hpp:101` serializes selected public-shaped `strutStyle` fields, and `cpp/JSIConverter+SkParagraphStyle.hpp:183` emits `strutStyle` only when native strut state differs from default.
- `scripts/verify-yoganode-native-commands-render.mjs:1214` asserts native strut getter state, including `fontFamilies`; `scripts/verify-yoganode-native-commands-render.mjs:1260` asserts serialized paragraph `strutStyle`; `scripts/verify-yoganode-native-commands-render.mjs:2124` and `scripts/verify-yoganode-native-commands-render.mjs:2135` cover direct paragraph style round trips and the no-height-override strut case.
- `scripts/verify-yoganode-native-commands-render.mjs:168` through `scripts/verify-yoganode-native-commands-render.mjs:178` documents the current command/render proof boundary, explicitly excluding `fontVariations` preservation and nested `paragraphStyle.textStyle` shape preservation.
- `scripts/verify-yoganode-nitro-materialization.mjs:168` through `scripts/verify-yoganode-nitro-materialization.mjs:179` proves generated wrapper materialization and delivery, but only at selected generated-wrapper side-effect breadth.

Remaining style and public-contract gaps:

- Public `YogaTextStyle` inherits almost all RN Skia `SkTextStyle` fields via `src/jsx.ts:38`, and `YogaParagraphStyle` is `YogaTextStyle & SkParagraphStyle` at `src/jsx.ts:48`.
- RN Skia declares `fontVariations` in `node_modules/@shopify/react-native-skia/src/skia/types/Paragraph/TextStyle.ts:61`, and its web adapter forwards it at `node_modules/@shopify/react-native-skia/src/skia/web/JsiSkTextStyle.ts:33`.
- Local native text-style parsing and serialization in `cpp/JSIConverter+SkTextStyle.hpp:187` through `cpp/JSIConverter+SkTextStyle.hpp:323` covers many public-shaped fields but has no `fontVariations` path.
- Installed RN Skia native `JsiSkTextStyle` similarly parses `fontFamilies`, `fontFeatures`, `fontSize`, `fontStyle`, colors, height, spacing, locale, shadows, and baseline around `node_modules/@shopify/react-native-skia/cpp/api/JsiSkTextStyle.h:76` through `node_modules/@shopify/react-native-skia/cpp/api/JsiSkTextStyle.h:174`, with no `fontVariations` path.
- Skia exposes `TextStyle::setFontArguments(...)` and `getFontArguments()` at `node_modules/@shopify/react-native-skia/cpp/skia/modules/skparagraph/include/TextStyle.h:243`, but the returned `FontArguments` keeps variation coordinates private at `node_modules/@shopify/react-native-skia/cpp/skia/modules/skparagraph/include/FontArguments.h:28`, so full public-shaped `toJSI` serialization is not a bounded local add-on.
- RN Skia supports nested `SkParagraphStyle.textStyle` in `node_modules/@shopify/react-native-skia/src/skia/types/Paragraph/ParagraphStyle.ts:34` and parses it at `node_modules/@shopify/react-native-skia/cpp/api/JsiSkParagraphStyle.h:107`; local `ParagraphStyle::toJSI(...)` currently emits the default text style as flattened fields at `cpp/JSIConverter+SkParagraphStyle.hpp:182`.
- `<text textStyle>` accepts full `YogaTextStyle` at `src/jsx.ts:158`, but `TextCmd::updateProps(...)` currently applies only `fontSize` and fallback paint color from `textStyle` at `cpp/YogaNode.cpp:1559`; RN Skia simple text drawing uses `drawSimpleText(...)` with font and paint at `node_modules/@shopify/react-native-skia/cpp/api/recorder/Drawings.h:332`.
- Packed consumer coverage already has a pattern for public type negatives at `scripts/verify-package-typescript-consumer.mjs:353`, but it does not yet assert the `fontVariations` boundary.

Delegated read-only hypothesis check:

- Nested explorer `independent_style_gap_check` read the same worktree without edits.
- It ranked public `fontVariations` drift first, then the broader `<text textStyle>` over-promise, nested `paragraphStyle.textStyle` shape preservation, generated-wrapper rich-style materialization breadth, and package type-surface gaps.
- I agree with the top ranking because `fontVariations` is the narrowest isolated false public contract after worker 129. The `<text textStyle>` finding is real but broader: it likely needs either a public type split for simple text or richer text rendering semantics.

# Candidate next targets ranked

1. Close unsupported public `fontVariations` contract for Yoga text and paragraph styles.

Classification: strongest locally unblocked root-cause target.

Evidence: `fontVariations` is public through `YogaTextStyle` and nested paragraph `textStyle`, but neither local native parsing/serialization nor installed RN Skia native parsing handles it. Web forwarding makes the cross-platform contract even more misleading. Full native preservation is not a small symmetric converter task because `TextStyle::getFontArguments()` exposes only an optional wrapper with private coordinate storage.

Why it ranks first: it is a single unsupported public field with a clear bounded fix: remove it from Yoga's public TypeScript surface and reject it explicitly in the local native converters so runtime payloads do not silently no-op.

2. Split or narrow `<text textStyle>` to what simple text actually renders.

Classification: real public/rendering semantic drift, but broader than the requested bounded follow-up.

Evidence: `<text>` accepts full `YogaTextStyle`, and command conversion preserves richer `TextStyle` state, but `TextCmd` render setup uses only font size and fallback color before RN Skia draws simple text with font and paint.

Why below candidate 1: the correct product direction is larger. The project can either narrow simple-text style types to font/color/font fields or move simple text toward paragraph/text-layout rendering. That is more disruptive than closing one unsupported field.

3. Preserve nested `paragraphStyle.textStyle` shape in addition to flattened Yoga-facing fields.

Classification: real parser/serializer shape gap with an API-policy edge.

Evidence: RN Skia accepts nested `paragraphStyle.textStyle`; local Yoga keeps flattened text-style fields for ergonomic JSX and serializes flattened output. The shared `heightMultiplier` key makes exact intent preservation ambiguous when both paragraph height and nested text height are authored.

Why below candidate 1: this should be designed deliberately as either flatten-only, nested-preserving, or dual-shape output. It is locally implementable, but less isolated than the `fontVariations` false contract.

4. Expand generated-wrapper materialization coverage for rich text/paragraph fields.

Classification: useful proof breadth, not a product-source root cause.

Evidence: direct command/render verifier proves rich converter paths; generated-wrapper materialization currently proves selected text/paragraph generated delivery with font size/color side effects.

Why below candidate 1: it would harden proof that generated wrappers deliver already-supported fields, but it would not close an unsupported public contract.

5. Platform-native app runtime, RN bridge delivery, Nitro registry install inside an app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading, exact typography, and exact render fidelity.

Classification: high value but currently blocked or overclaim-prone in this local environment.

Evidence: full Xcode, CocoaPods, Java, Android SDK, Android tooling, CMake, Ninja, and Gradle are unavailable. The feasible matrix explicitly excludes these claims.

# Selected next target with expected implementation shape

Select exactly one next implementation target:

> Close the unsupported public `fontVariations` contract for Yoga text and paragraph styles by narrowing the exported TypeScript types and adding explicit native rejection/proof for `fontVariations` payloads.

Expected implementation shape:

- Update `src/jsx.ts` so `YogaTextStyle` omits `fontVariations` in addition to the color fields it already customizes.
- Update `YogaParagraphStyle` so flattened paragraph text-style fields and nested `paragraphStyle.textStyle` both use the Yoga text-style contract without `fontVariations`; avoid reintroducing RN Skia's raw `SkTextStyle` through `SkParagraphStyle["textStyle"]`.
- Add packed-consumer negative coverage in `scripts/verify-package-typescript-consumer.mjs` for:
  - `YogaTextStyle["fontVariations"]` or `<text textStyle={{ fontVariations: ... }}>`.
  - `YogaParagraphStyle` flattened `fontVariations`.
  - Nested `YogaParagraphStyle["textStyle"].fontVariations`.
- Add native converter rejection in `cpp/JSIConverter+SkTextStyle.hpp` for `fontVariations` so direct `TextStyle` conversion and `text.textStyle` payloads fail clearly instead of silently ignoring the field.
- Add a paragraph-level check in `cpp/JSIConverter+SkParagraphStyle.hpp` before RN Skia parsing so both flattened `paragraphStyle.fontVariations` and nested `paragraphStyle.textStyle.fontVariations` fail clearly.
- Extend `scripts/verify-yoganode-native-commands-render.mjs` with focused negative host-JSC assertions for direct `TextStyle`, direct `ParagraphStyle`, representative `text.textStyle`, and representative `paragraph.paragraphStyle` payload rejection.
- Do not edit `node_modules`.
- Do not attempt to serialize `fontVariations` through `toJSI(...)` unless a new design proves public-shaped extraction from Skia's `FontArguments` and establishes a typography/rendering proof boundary.

# Expected files and verification for the next worker

Expected files:

- `src/jsx.ts`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/<next-worker-id>.md`

Expected verification:

- `git diff --check`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:package-typescript-consumer`
- `npm run check:yoganode-native-commands-render`
- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:feasible-matrix`

Optional verification if the next worker touches generated specs or materialization proof unexpectedly:

- `bun run specs`
- `npm run check:yoganode-nitro-materialization`

# Proof boundary

This audit proves:

- The assigned worktree is green under `git diff --check`, Node syntax checking for the command/render verifier, and the full feasible local matrix.
- Worker 129's `ParagraphStyle.strutStyle` parser/serializer proof remains part of the current host-JSC/native command/render verifier.
- Public `fontVariations` remains exposed through Yoga's TypeScript surface while unsupported by local and installed native parsers.
- The selected target is locally unblocked as a contract-closure task with type and native negative proof.

The selected next worker should prove only:

- Public package TypeScript rejects `fontVariations` for Yoga text style, flattened paragraph style, and nested paragraph `textStyle`.
- Local native conversion rejects `fontVariations` in direct `TextStyle`, direct `ParagraphStyle`, representative `text.textStyle`, and representative `paragraph.paragraphStyle` payloads.
- Existing supported text/paragraph fields, including worker 129's `strutStyle` coverage, remain green.

Do not claim:

- Variable-font rendering, exact typography, font fallback, glyph shaping, or paragraph shaping fidelity.
- `fontVariations` native support or preservation.
- Full `TextStyle` or `ParagraphStyle` parity.
- Nested `paragraphStyle.textStyle` shape preservation unless separately designed and tested.
- CSS color string preservation beyond existing numeric-normalization and rejection behavior.
- `SkSamplingOptions.maxAniso` preservation.
- iOS/Android app build/run, simulator/device launch, native platform presentation, real React Native bridge delivery, Nitro registry install inside a running app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading/decoding, asset resolution, texture-backed images, exact image fidelity, or exact render fidelity.

# Risks/follow-up

- Removing `fontVariations` from public Yoga types is a breaking type-level contract change, but it removes a field that native code currently ignores.
- Native rejection should use a clear error message so JavaScript payloads using `as any` do not silently lose authored intent.
- If future product goals require variable fonts, design a separate native support target around `SkFontArguments` construction, proof of native state, and honest typography/rendering boundaries. Do not mix that with this contract-closure target.
- `<text textStyle>` still over-promises broader rich style semantics. A later worker should decide whether simple text gets a narrower public style type or a richer rendering path.
- Nested `paragraphStyle.textStyle` remains a separate shape-preservation decision, especially around `heightMultiplier` collisions between paragraph and default text style.
- Generated-wrapper materialization could later be expanded for rich supported fields, but that is proof breadth after product-source contracts are honest.

# Cleanup/status

- Changed files: this report only.
- Required verification completed before report writing.
- Nested read-only explorer completed and was closed.
- The feasible matrix removed its matrix-owned temp parent and generated `tsconfig.tsbuildinfo`.
- Ignored dependency artifacts were left untouched: `node_modules/` and `example/node_modules/`.
- No generated native/example directories were left in the assigned worktree by the matrix.
- Before committing this report, expected tracked diff is limited to `worker-progress/worker-130-post-129-root-cause-audit.md`.

Goal finished.
