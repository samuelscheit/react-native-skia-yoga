# Worker 141 - README text/paragraph style docs

## Summary

Updated the README to document the supported styling split:

- Simple `<text textStyle={...}>` is for labels and is limited to the currently rendered simple fields `fontSize` and `color`.
- Richer typography belongs on `<paragraph text="..." paragraphStyle={...}>`.
- Paragraph styling can use rich root `paragraphStyle` fields and nested `paragraphStyle.textStyle`.
- `fontVariations` remains unsupported unless future implementation and proof expand the contract.

## Changed files

- `README.md`
  - Added a Text Styling section after the Usage example.
  - Added a concise `<paragraph>` example with flattened `paragraphStyle` fields and nested `paragraphStyle.textStyle`.
- `worker-progress/worker-141-readme-text-paragraph-docs.md`
  - Added this progress and verification report.

## Commands run

- `git diff --check`
  - Passed with no output.
- `npm run check:package-typescript-consumer`
  - Passed.
  - Confirmed packed consumer TypeScript accepts simple `text.textStyle` `color`/`fontSize`, rejects rich simple-text fields including `fontFamilies`, `fontFeatures`, `fontStyle`, `letterSpacing`, and `fontVariations`, and accepts static and dynamic nested `paragraphStyle.textStyle` CSS color/fontSize authoring.
- `npm run check:feasible-matrix`
  - Passed all 28 feasible local checks in 5m 2s.
  - Included package TypeScript consumer proof, Reconciler nested paragraph text-style binding coverage, and native command/render proof for simple `TextCmd` fields, rich simple-text rejection, nested paragraph CSS color conversion, and unsupported paragraph `fontVariations` rejection.

## Evidence gathered

- `README.md:67` through `README.md:97` now states the simple text boundary, rich paragraph path, nested `paragraphStyle.textStyle` example, and `fontVariations` unsupported boundary.
- `src/jsx.ts:52` defines `YogaSimpleTextStyle` as only `fontSize` and `color`.
- `src/jsx.ts:54` through `src/jsx.ts:57` defines `YogaParagraphStyle` as rich text/paragraph style plus nested `textStyle?: YogaTextStyle`.
- `cpp/JSIConverter+NodeCommand.hpp:340` through `cpp/JSIConverter+NodeCommand.hpp:351` throws when unsupported rich fields are sent to `text.textStyle`, with an error that only `fontSize` and `color` are rendered by `TextCmd`.
- `cpp/JSIConverter+NodeCommand.hpp:364` through `cpp/JSIConverter+NodeCommand.hpp:383` lists rich simple-text keys rejected by `TextCmd`, including `fontFamilies`, `fontFeatures`, `fontStyle`, `fontVariations`, `letterSpacing`, decorations, shadows, locale, and height fields.
- `scripts/verify-package-typescript-consumer.mjs:110` through `scripts/verify-package-typescript-consumer.mjs:113` prints the packed package proof summary for simple text acceptance, rich simple-text rejection, and nested paragraph style acceptance.
- `scripts/verify-package-typescript-consumer.mjs:361` through `scripts/verify-package-typescript-consumer.mjs:398` contains accepted rich paragraph and nested `paragraphStyle.textStyle` package consumer fixtures.
- `scripts/verify-package-typescript-consumer.mjs:405` through `scripts/verify-package-typescript-consumer.mjs:438` contains rejected simple-text rich-field and paragraph `fontVariations` fixtures.

## Proof boundary and overclaim risks

- Proven locally: README wording matches the TypeScript API, packed package consumer proof, and host-native command/render proof for the simple text versus rich paragraph styling split.
- Proven locally: simple `<text textStyle>` supports `fontSize` and `color`; rich simple-text fields are rejected; paragraph styling supports rich root and nested text-style authoring; nested paragraph CSS color/fontSize authoring is accepted; `fontVariations` remains rejected.
- Not claimed: platform-native app build/run, CocoaPods install, Gradle build, simulator/device launch, native platform presentation, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual native bridge delivery, RNGH native delivery, CSS color string preservation after native normalization, exact typography/shaping, font fallback correctness, exact render fidelity, every rich text/paragraph style field, variable-font support, or rich simple `TextCmd` text-style rendering.
- Main overclaim risk avoided: the README does not imply rich `<text textStyle>` rendering or `fontVariations` support.

## Cleanup status

- No product/source/example files were changed.
- `npm run check:feasible-matrix` removed its matrix-owned temp parent and reported no remaining new tracked artifacts after cleanup.
- Current intended diff is limited to `README.md` and this worker progress report.

## Recommended next tasks

- No follow-up is required for this docs target.
- If examples are refreshed later, keep nested paragraph style examples compile-checked and avoid implying UI-runtime animation or platform-native runtime proof.
- Keep rich simple `TextCmd` rendering and variable-font support as separate implementation/proof tasks if they become product goals.

Goal finished.
