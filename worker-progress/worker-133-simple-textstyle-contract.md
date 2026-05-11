## Summary

Closed the simple `<text textStyle>` contract drift by narrowing public JSX authoring to the fields `TextCmd` actually renders (`fontSize` and `color`) and rejecting rich-only text style keys in text command native payloads. Paragraph text styling remains rich through `YogaParagraphStyle`, nested `paragraphStyle.textStyle`, and the existing direct native `TextStyle` / `ParagraphStyle` converters.

## Changed files

- `src/jsx.ts`
  - Added `YogaSimpleTextStyle = Pick<YogaTextStyle, "fontSize" | "color">`.
  - Switched `YogaAnimatedTextStyleProps` and `YogaTextProps.textStyle` to the simple style type.
  - Kept `YogaTextStyle` rich for `YogaParagraphStyle` and nested paragraph text styling.
- `cpp/JSIConverter+NodeCommand.hpp`
  - Added text-command-only rejection for rich `text.textStyle` keys including font families/features/style, spacing, decorations, shadows, foreground/background colors, baseline, locale, height, halfLeading, wordSpacing, and fontVariations.
  - Scoped the rejection to `NodeCommandKind::TEXT`; global `JSIConverter<skia::textlayout::TextStyle>` and paragraph parsing remain rich.
  - Changed text command `toJSI` serialization to emit only simple `fontSize` and `color`, avoiding self-serialized rich payloads that `TextCmd` now rejects.
- `scripts/verify-package-typescript-consumer.mjs`
  - Kept a packed-consumer positive for `<text textStyle={{ color, fontSize }}>`.
  - Added packed-consumer negatives for `text.textStyle` `fontFamilies`, `fontFeatures`, `fontStyle`, and `letterSpacing`, alongside existing `fontVariations` negatives.
  - Added a packed-consumer positive for rich paragraph authoring so paragraph styling is proven not to be narrowed.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added native host-JSC assertions for text-command rich-key rejection.
  - Adjusted text command serialization proof to expect simple text style payloads only.
  - Preserved direct rich `TextStyle`, paragraph, CSS color, `fontFeatures`, `strutStyle`, `fontVariations`, and text render assertions.

## Commands run

- `git diff --check` - passed.
- `node --check scripts/verify-package-typescript-consumer.mjs` - passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed.
- `npm run check:package-typescript-consumer` - passed.
- `npm run typecheck` - passed.
- `cd example && bun run typecheck` - passed through the final feasible matrix; also passed as a direct structured run from `example/`.
- `npm run check:yoganode-native-commands-render` - passed directly and through the final feasible matrix.
- `npm run check:feasible-matrix` - passed on the final files.

## Evidence

- Packed TypeScript consumer accepted simple `<text textStyle={{ color: "white", fontSize: 14 }}>`.
- Packed TypeScript consumer rejected rich simple-text fields: `fontFamilies`, `fontFeatures`, `fontStyle`, `letterSpacing`, and `fontVariations`.
- Packed TypeScript consumer accepted rich paragraph styling, including flattened `fontFamilies`, `fontFeatures`, `fontStyle`, `letterSpacing`, and nested `paragraphStyle.textStyle` rich fields.
- Native host-JSC verifier rejected rich-only `text.textStyle` payload keys with `text.textStyle.<key>` errors scoped to `NodeCommand conversion failed for type "text"`.
- Native host-JSC verifier kept rich direct `TextStyle` and paragraph conversion coverage green, including `fontFeatures`, `strutStyle`, and flattened/nested paragraph `fontVariations` rejection.
- Text command numeric/CSS/named color conversion and bounded raster assertions stayed green.

## Proof boundary/overclaim risks

- This proves host-JSC/native command conversion, scoped text command rejection, simple text command serialization, packed TypeScript package authoring, and bounded existing render assertions.
- This does not prove rich simple-text rendering; `TextCmd` still intentionally renders only `fontSize` and fallback paint color from `textStyle`.
- This does not prove exact typography, font fallback correctness, paragraph shaping fidelity, React Native bridge delivery, Nitro registry install in an RN runtime, iOS/Android app launch, simulator/device presentation, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading, or render fidelity beyond the existing host-native checks.

## Cleanup

- Did not edit `node_modules` or generated specs.
- The feasible matrix removed its `tsconfig.tsbuildinfo` and matrix-owned temporary directory.
- Final `git status --short` shows only the intended source/verifier/report changes.

## Quality/maintainability/performance/security review

- Quality: the public simple text type now matches rendered behavior; native rejection prevents silent acceptance of rich fields that `TextCmd` ignores.
- Maintainability: rejection is localized to `NodeCommandKind::TEXT`, with paragraph and direct text style converters left unchanged.
- Performance: the new native check is a small fixed list of `hasProperty` calls during command conversion only.
- Security: no new external input execution, filesystem access, network access, or dependency changes were introduced.

## Recommended next tasks

- Consider documenting the public split between simple `<text textStyle>` and rich `<paragraph paragraphStyle>` authoring in user-facing docs.
- If richer glyph styling is desired later, implement it in `TextCmd` first and then expand the simple text style contract with matching render proof.

Goal finished.
