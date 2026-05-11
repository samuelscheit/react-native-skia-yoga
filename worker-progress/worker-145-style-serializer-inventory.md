# Worker 145 - Style serializer inventory

## Summary

Added a bounded source-level field inventory to
`scripts/verify-yoganode-native-commands-render.mjs` for the currently installed
RN Skia public `SkTextStyle`, `SkParagraphStyle`, `SkStrutStyle`, and
`SamplingOptions` surfaces. The verifier now reads the installed type files,
checks each public field or union member against an explicit bucket, and fails
with a drift message if the installed public surface changes without inventory
classification.

No product runtime/source behavior was changed.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-145-style-serializer-inventory.md`

## Commands run

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed before the path-literal
  hygiene fix and passed again after it.
- `npm run check:package-typescript-consumer`: passed before and after the final
  verifier edit.
- `npm run check:rn-skia-imports`: passed after replacing scanner-unfriendly
  RN Skia type source path literals with segmented path construction.
- `npm run check:feasible-matrix`: first run failed at `check:rn-skia-imports`
  because the new inventory contained tracked source text matching the private
  RN Skia deep-import scanner pattern.
- `npm run check:feasible-matrix`: rerun passed all 28 commands in 4m 26s.
- `git diff --check`: passed after this report was written.

## Evidence gathered

- `src/jsx.ts` still preserves the public split:
  simple `<text textStyle>` is limited to `fontSize` and `color`, while
  `<paragraph paragraphStyle>` keeps rich flattened and nested text style
  authoring with `fontVariations` omitted from the public Yoga text style.
- Installed RN Skia `SkTextStyle` exposes:
  `backgroundColor`, `color`, `decoration`, `decorationColor`,
  `decorationThickness`, `decorationStyle`, `fontFamilies`, `fontFeatures`,
  `fontSize`, `fontStyle`, `fontVariations`, `foregroundColor`,
  `heightMultiplier`, `halfLeading`, `letterSpacing`, `locale`, `shadows`,
  `textBaseline`, and `wordSpacing`.
- Installed RN Skia `SkParagraphStyle` exposes:
  `disableHinting`, `ellipsis`, `heightMultiplier`, `maxLines`,
  `replaceTabCharacters`, `strutStyle`, `textAlign`, `textDirection`,
  `textHeightBehavior`, and `textStyle`.
- Installed RN Skia `SkStrutStyle` exposes:
  `strutEnabled`, `fontFamilies`, `fontStyle`, `fontSize`,
  `heightMultiplier`, `halfLeading`, `leading`, and `forceStrutHeight`.
- Installed RN Skia `SamplingOptions` is the public union
  `CubicResampler | FilterOptions`, with `CubicResampler` fields `B`/`C` and
  `FilterOptions` fields `filter`/`mipmap`.
- `cpp/JSIConverter+SkTextStyle.hpp` parses and serializes all current
  supported public text style fields, normalizes color-like CSS string authoring
  to numeric SkColor output, and rejects `fontVariations`.
- `cpp/JSIConverter+SkParagraphStyle.hpp` parses and serializes the current
  paragraph style fields, applies nested `textStyle`, preserves flattened
  precedence, emits strut style when non-default, and rejects flattened/nested
  `fontVariations`.
- `cpp/JSIConverter+SkSamplingOptions.hpp` keeps sampling as value-bearing
  filter/mipmap or cubic B/C object transport only.

## Proof boundary and overclaim risks

The updated verifier proves an installed-source field-inventory check plus
host-native value-bearing converter coverage for the currently inventoried
supported fields. It also preserves explicit unsupported `fontVariations`
rejection and the simple text rich-key rejection.

The proof still does not claim future RN Skia fields that are absent from the
installed inventory, nested `SharedValue` leaves inside opaque
`SamplingOptions`, `fontVariations` native support or preservation, rich simple
`TextCmd` typography rendering, CSS color string preservation, exact typography,
font fallback, paragraph shaping fidelity, platform app runtime, or exact render
fidelity.

## Cleanup status

The feasible matrix removed its generated `tsconfig.tsbuildinfo` artifact and
its matrix-owned temp parent. No generated product/runtime files were changed.
The only tracked changes are the verifier script and this progress report.

## Recommended next tasks

- Keep this inventory in lockstep with RN Skia upgrades; new public fields should
  be classified before the verifier proof wording is widened.
- Platform-native iOS/Android build/run remains an environment/toolchain task,
  separate from this local host-native proof.
- Rich simple `TextCmd` text styling should remain a deliberate feature change,
  not a cleanup item.

Goal finished.
