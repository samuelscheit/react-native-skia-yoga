# Summary

Implemented bounded `ParagraphStyle.strutStyle` conversion coverage for the native JSI converter.

- Added a local post-RN-Skia parse overlay that preserves `strutStyle.fontFamilies` without editing `node_modules`.
- Added `ParagraphStyle` `toJSI` emission for public-shaped `strutStyle` fields: `strutEnabled`, `fontFamilies`, `fontStyle`, `fontSize`, `heightMultiplier` when native height override is set, `halfLeading`, `leading`, and `forceStrutHeight`.
- Kept the existing paragraph scalar, ellipsis, and flattened default text-style output paths intact.
- Extended the host-JSC/native command/render verifier to assert direct `ParagraphStyle fromJSI -> toJSI -> fromJSI` preservation and representative `NodeCommand paragraph.paragraphStyle toJSI -> fromJSI` preservation for selected strut fields, including non-empty `fontFamilies`.

# Changed files

- `cpp/JSIConverter+SkParagraphStyle.hpp`
  - Added `applyParagraphStyleStrutStyleOverlay(...)` to restore `fontFamilies` after RN Skia parsing.
  - Added `strutStyleToJSI(...)` and bounded default-strut omission logic.
  - Emits `strutStyle` only when native strut state differs from a default `StrutStyle`.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added serialized/public strut shape assertions.
  - Added native `getStrutStyle()` getter assertions because `ParagraphStyle::operator==` does not compare strut state.
  - Added direct no-height-override coverage proving `heightMultiplier` is omitted when `StrutStyle::getHeightOverride()` is false.
  - Updated verifier evidence strings and proof boundary text.
- `worker-progress/worker-129-paragraphstyle-strutstyle-tojsi.md`
  - Added this report.

# Commands run

- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed.
- `npm run check:yoganode-native-commands-render` - passed.
- `git diff --check` - passed.
- `npm run check:feasible-matrix` - passed, 28/28 commands, total command duration 4m 41s.

`npm run check:yoganode-nitro-materialization` was not run standalone because `scripts/verify-yoganode-nitro-materialization.mjs` and generated-wrapper assertions were not changed; it did pass as command 20/28 inside `npm run check:feasible-matrix`.

# Evidence

- Direct host-JSC/native converter proof:
  - `paragraphStyleSerializationObject(...)` now includes value-bearing `strutStyle` with non-empty `fontFamilies`.
  - `expectSerializedParagraphStyle(...)` asserts public `strutStyle` shape on `toJSI`.
  - `expectParagraphStyleState(...)` calls `expectStrutStyleState(...)`, which checks native `getStrutStyle()` getters for `strutEnabled`, `fontFamilies`, `fontStyle`, `fontSize`, `heightMultiplier`, `halfLeading`, `leading`, and `forceStrutHeight`.
  - A second direct case omits input `strutStyle.heightMultiplier` and asserts native `getHeightOverride()` is false and serialized `heightMultiplier` is absent.
- Representative `NodeCommand` proof:
  - Existing `paragraphSerializationCommand(...)` now carries the value-bearing paragraph style.
  - `assertNodeCommandToJSISerializationSymmetry(...)` asserts `paragraph.paragraphStyle` `toJSI` shape and `toJSI -> fromJSI` native state through the same strut getter checks.
- Regression proof:
  - Existing TextStyle/fontFeatures assertions still run in the same native verifier.
  - Existing paragraph scalar, ellipsis, and flattened default text-style assertions still run in the same direct and NodeCommand paths.
  - The feasible matrix reran package, source, native, generated-wrapper, TypeScript, lint, Nitrogen, bundle, and native-generation checks successfully.

# Proof boundary/overclaim risks

This proves selected host-native macOS JSC converter and `NodeCommand` serialization behavior for the requested strut fields only. It does not claim full TextStyle or ParagraphStyle parity, `fontVariations` preservation, nested `paragraphStyle.textStyle` shape preservation, CSS string preservation, SkSamplingOptions `maxAniso`, exact typography/render fidelity, app build/run, React Native bridge delivery, Nitro registry install in an app runtime, UI-runtime Worklets/Reanimated behavior, image loading, or platform runtime behavior.

# Cleanup

- Did not edit `node_modules`.
- Did not edit generated files, TypeScript surfaces, example app files, or package metadata.
- Feasible matrix cleanup removed its temporary parent and the generated `tsconfig.tsbuildinfo` it created.
- Remaining intentional tracked changes are limited to the two scoped source/verifier files and this report.

# Quality/maintainability/performance/security review

- Quality: The overlay is intentionally narrow and exists only to compensate for RN Skia's dropped `fontFamilies` assignment after its parser has handled the rest of `strutStyle`.
- Maintainability: Serialization reuses existing font-family and font-style JSI helpers, keeping strut output aligned with current public text-style shapes where the field types match.
- Performance: Work is proportional to the small `fontFamilies` array during conversion and does not affect render-time loops.
- Security: No new filesystem, process, network, or unchecked external-input side effects were introduced; invalid JSI shapes continue to fail through existing JSI object/array/string conversions.

# Recommended next tasks

- Consider a separate, explicitly scoped worker for broader ParagraphStyle parity if future product requirements need nested `textStyle`, `fontVariations`, or additional Skia paragraph fields.
- Keep generated-wrapper and app-runtime claims separate unless a future task adds direct app/runtime proof.

Goal finished.
