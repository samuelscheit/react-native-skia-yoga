# Worker 127 - ParagraphStyle Scalar toJSI

## Summary

Implemented bounded `ParagraphStyle` `toJSI(...)` serialization for the public/parser-compatible scalar fields:

- `disableHinting`
- `replaceTabCharacters`
- `textDirection`
- `textHeightBehavior`

Expanded the native command/render verifier so direct `ParagraphStyle` conversion and representative `NodeCommand` paragraph payload round trips preserve those fields while retaining existing `TextStyle`, `fontFeatures`, `textAlign`, `maxLines`, paragraph `heightMultiplier`, `ellipsis`, and flattened default text-style assertions.

## Files Changed

- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-127-paragraphstyle-scalar-tojsi.md`

## Implementation Details

- Confirmed installed RN Skia parser accepts `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior` in `node_modules/@shopify/react-native-skia/cpp/api/JsiSkParagraphStyle.h`.
- Confirmed installed Skia `ParagraphStyle` getters in `node_modules/@shopify/react-native-skia/cpp/skia/modules/skparagraph/include/ParagraphStyle.h`.
- Serialized `disableHinting` as `!arg.hintingIsOn()` because the native parser only turns hinting off when the public `disableHinting` value is truthy.
- Serialized `replaceTabCharacters` from `arg.getReplaceTabCharacters()`.
- Serialized `textDirection` and `textHeightBehavior` as numeric enum values matching the existing `fromJSI(...)` parser shape.
- Did not add `strutStyle`, nested `paragraphStyle.textStyle` preservation, `fontVariations`, sampling changes, TypeScript contract changes, generated Nitro spec changes, example changes, or package metadata changes.

## Verification

- `git diff --check` - passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed.
- `npm run check:yoganode-native-commands-render` - passed.
- `npm run check:feasible-matrix` - passed, including its matrix-owned `npm run check:yoganode-nitro-materialization` run.

Not run separately:

- `npm run check:yoganode-nitro-materialization` outside the matrix, because this slice did not edit materialized-wrapper assertions or shared generated wrapper behavior. The feasible matrix did run it and it passed.
- `npm run typecheck`, `cd example && bun run typecheck`, `npm run check:package-typescript-consumer`, and `bun run specs` were not run as standalone commands because no TS/generated/example/package surfaces were edited. The feasible matrix ran those checks and they passed.

## Proof Boundary

Proven:

- Direct host-JSC/native `JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(...) -> toJSI(...) -> fromJSI(...)` preserves the selected scalar fields.
- Representative flattened `paragraph.paragraphStyle` `NodeCommand` `toJSI(...) -> fromJSI(...)` preserves the selected scalar fields.
- Existing value-bearing `TextStyle` serialization assertions, including `fontFeatures`, remain covered by the verifier.

Not claimed:

- Exact typography, shaping, font fallback, or paragraph render fidelity.
- React Native bridge delivery.
- Nitro registry install in an app.
- iOS/Android platform app build/run, simulator/device launch, or native presentation.
- UI-runtime Worklets/Reanimated behavior.
- Unsupported `SkParagraphStyle` fields outside this bounded slice.

## Risks And Follow-Up

- The serializer now emits these four paragraph scalar fields for every `ParagraphStyle` object. That matches parser-compatible public keys and round-trip needs, but it may expose default values that were previously omitted.
- `disableHinting` remains asymmetric at the parser API level because RN Skia exposes `turnHintingOff()` but no matching public setter to force hinting on after it has been disabled. The implemented `toJSI(...)` correctly serializes current native state as the inverse boolean.
- Future bounded slices can address `strutStyle`, nested `paragraphStyle.textStyle` shape preservation, or broader paragraph defaults separately.

## Cleanup And Status

Final `git status --short --ignored`:

```text
 M cpp/JSIConverter+SkParagraphStyle.hpp
 M scripts/verify-yoganode-native-commands-render.mjs
?? worker-progress/worker-127-paragraphstyle-scalar-tojsi.md
!! example/node_modules
!! node_modules
```

Ignored dependency/generated local artifacts `node_modules/` and `example/node_modules/` were left untouched.

Goal finished.
