# Summary

Fixed nested `paragraphStyle.textStyle.color` CSS string parsing for Yoga paragraph styles.

Root cause: `JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(...)` delegated the full paragraph object to RN Skia first. RN Skia parses nested `textStyle` before this package's CSS-aware `applyTextStyle(...)` overlay, and its direct `JsiSkColor::fromValue(...)` path expects a color object for raw values, so nested string colors aborted with `Value is a string, expected an Object`.

Implementation: the paragraph converter now delegates a sanitized paragraph object without `textStyle` to RN Skia for base paragraph fields, applies nested `paragraphStyle.textStyle` through the local CSS-capable `applyTextStyle(...)`, then applies flattened text-style fields last so flattened values keep public precedence over nested values.

# Changed Files

- `cpp/JSIConverter+SkParagraphStyle.hpp`
  - Added sanitized base paragraph delegation that excludes nested `textStyle`.
  - Added local nested text-style overlay before the existing flattened text-style overlay.
  - Preserved `strutStyle.fontFamilies` overlay and flattened-over-nested precedence.
- `scripts/verify-package-typescript-consumer.mjs`
  - Added packed consumer positive coverage for nested `paragraphStyle.textStyle` CSS color/fontSize authoring.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added direct `JSIConverter<ParagraphStyle>::fromJSI(...)` nested CSS color coverage.
  - Added flattened-over-nested precedence coverage.
  - Added `NodeCommand` paragraph conversion, `ParagraphCmd` state/measure, and bounded raster evidence for nested CSS color.
  - Added invalid nested CSS color rejection scoped to paragraph command conversion.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added generated `setCommand(paragraph)` materialization coverage using nested `paragraphStyle.textStyle.color`.

# Commands Run

- `npm run check:yoganode-native-commands-render` before the native fix: failed as expected with `facebook::jsi::JSError: Value is a string, expected an Object`.
- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run typecheck`: passed.
- `cd example && bun run typecheck`: passed.
- `npm run check:yoganode-native-commands-render`: passed after the fix.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 5m 36s.

# Evidence

- Pre-fix proof failed in the new native nested paragraph case with `Value is a string, expected an Object`, matching the suspected RN Skia nested `JsiSkColor::fromValue(...)` path.
- Post-fix native command/render verifier asserted direct nested `ParagraphStyle` CSS color conversion to `SK_ColorGREEN`.
- Post-fix native command/render verifier asserted flattened `fontSize` and flattened CSS `color` override nested `paragraphStyle.textStyle` values.
- Post-fix native command/render verifier asserted `JSIConverter<NodeCommand>::fromJSI(...)` accepts nested paragraph CSS color strings, installs a real `ParagraphCmd`, measures it, and renders bounded green-dominant glyph pixels.
- Post-fix native command/render verifier asserted invalid nested `paragraphStyle.textStyle.color: "not-a-css-color"` is rejected under `NodeCommand conversion failed for type "paragraph"` and reports the invalid CSS string.
- Packed consumer verifier accepted public JSX nested paragraph authoring with `paragraphStyle={{ textStyle: { color: "#00ff00", fontSize: 16 } }}`.
- Nitro materialization verifier delivered a generated JS-facing `setCommand(paragraph)` payload containing nested `paragraphStyle.textStyle.color` and built a paragraph successfully.

# Proof Boundary / Overclaim Risks

- This closes nested `paragraphStyle.textStyle` parsing for Yoga paragraph style conversion, paragraph NodeCommand conversion, generated Nitro materialization delivery, and bounded host-render evidence.
- It does not claim nested `toJSI` shape preservation; `ParagraphStyle::toJSI(...)` still emits flattened public text-style fields.
- It does not broaden simple `<text textStyle>` rich-key support or change `JSIConverter<skia::textlayout::TextStyle>` globally.
- It does not add native `fontVariations` support; flattened and nested fontVariations rejections remain covered.
- It does not prove iOS/Android app runtime, simulator/device launch, exact typography, font fallback correctness, or React Native bridge delivery beyond the existing feasible local matrix boundaries.

# Cleanup

- No `node_modules` edits.
- No generated specs, examples, package metadata, or unrelated files were left changed.
- The feasible matrix reported no remaining new tracked artifacts and removed its matrix-owned temp parent.
- Worktree changes are limited to the four intended files plus this report.

# Quality / Maintainability / Performance / Security Review

- Quality: the fix routes nested paragraph text style through the same local text-style parser already used for flattened paragraph styles, reducing parser divergence.
- Maintainability: base paragraph fields remain delegated to RN Skia through an explicit allowlist of RN Skia paragraph keys; nested text style is handled locally because it has Yoga-specific public value shapes.
- Performance: conversion adds one small JSI object allocation and a short fixed-key copy per paragraph style object; no render-time path changes.
- Security: no new IO, process execution, networking, or dynamic code paths were introduced. Invalid CSS strings still fail closed with a scoped conversion error.

# Recommended Next Tasks

- Keep nested `paragraphStyle.textStyle` `toJSI` shape preservation out of this change unless a future public API explicitly requires it.
- If RN Skia adds new paragraph-style fields, revisit the sanitized base-field allowlist so delegation continues to cover the intended base paragraph surface.

Goal finished.
