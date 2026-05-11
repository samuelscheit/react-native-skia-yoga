# Summary

Implemented bounded value-bearing `toJSI(...)` serialization for `SkSamplingOptions`, `skia::textlayout::TextStyle`, and `skia::textlayout::ParagraphStyle`.

The host verifier now proves selected direct converter and `NodeCommand` serialization round trips for the new fields.

# Files Changed

- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-119-value-bearing-style-tojsi.md`

# Implementation Details

- `SkSamplingOptions::toJSI(...)` now emits parser-compatible shapes:
  - `{ B, C }` for cubic sampling.
  - `{ filter, mipmap }` for non-cubic sampling.
- `TextStyle::toJSI(...)` now emits selected stable public fields:
  - `fontSize`
  - numeric `color`
  - `fontFamilies`
  - `heightMultiplier` when `getHeightOverride()` is true
  - `halfLeading`
  - `letterSpacing`
  - `wordSpacing`
  - `locale` when non-empty
- `ParagraphStyle::toJSI(...)` now emits selected stable paragraph controls:
  - numeric `textAlign`
  - `maxLines` when not unlimited
  - paragraph `heightMultiplier` when non-zero
  - `ellipsis`, including UTF-16 ellipsis conversion back to UTF-8
  - flattened default text-style fields through the shared TextStyle serialization helper, excluding TextStyle `heightMultiplier` to avoid colliding with ParagraphStyle's public `heightMultiplier` key.
- `canConvert(...)` behavior was not broadened.
- TypeScript contracts were not changed.
- CSS color strings are not preserved by serialization; they round trip as numeric colors.

# Verification

Required commands run and passed:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`
- `git diff --check`

Additional evidence from `npm run check:feasible-matrix`:

- All 28 matrix commands passed.
- Matrix reran `npm run check:yoganode-native-commands-render` successfully with the new assertions.
- Matrix reran `npm run check:yoganode-nitro-materialization` successfully.
- Matrix cleanup removed its temporary parent and its generated `tsconfig.tsbuildinfo`.

The updated command/render verifier now asserts:

- Direct `SkSamplingOptions` filter/mipmap and cubic B/C `toJSI(...) -> fromJSI(...)` round trips.
- Direct `TextStyle` selected-field `toJSI(...) -> fromJSI(...)` round trip.
- Direct `ParagraphStyle` selected-field `toJSI(...) -> fromJSI(...)` round trip.
- `NodeCommand` image sampling `filter`/`mipmap` serialization and round trip.
- `NodeCommand` text `textStyle` selected-field serialization and round trip.
- `NodeCommand` paragraph `paragraphStyle` selected paragraph controls and flattened text-style serialization and round trip.

# Proof Boundary

Proven:

- Host-JSC/native converter behavior for selected value-bearing fields.
- Host-JSC/native `NodeCommand` serialization shape and selected `toJSI(...) -> fromJSI(...)` round trips for image sampling, text style, and paragraph style.

Not proven:

- Full Skia style parity or every Skia field.
- `SkSamplingOptions::maxAniso` preservation; the current parser shape does not accept it.
- CSS color string preservation.
- Exact typography, font fallback correctness, paragraph shaping fidelity, render fidelity, platform build/run, RN bridge delivery, Nitro install in app, UI-runtime Worklets/Reanimated delivery, image loading, or texture-backed behavior.

# Risks And Follow-Up

- ParagraphStyle and flattened TextStyle both use the public key `heightMultiplier`; this implementation serializes paragraph height flat and intentionally avoids emitting TextStyle height through the flattened ParagraphStyle helper to prevent false independent-state claims.
- Additional TextStyle fields such as decoration, paints, font features, shadows, baseline, and font style remain un-serialized pending a narrower field-by-field proof.
- Sampling anisotropy remains un-serialized until the accepted JS parser shape supports it.

# Cleanup And Status

Cleanup notes:

- Matrix-owned temporary directories were removed by `npm run check:feasible-matrix`.
- Ignored dependency artifacts were left untouched, as required: `node_modules/` and `example/node_modules/`.
- No generated native/example directories were left by this work.

Final `git status --short --ignored`:

```text
 M cpp/JSIConverter+SkParagraphStyle.hpp
 M cpp/JSIConverter+SkSamplingOptions.hpp
 M cpp/JSIConverter+SkTextStyle.hpp
 M scripts/verify-yoganode-native-commands-render.mjs
?? worker-progress/worker-119-value-bearing-style-tojsi.md
!! example/node_modules
!! node_modules
```

Goal finished.
