# Worker 157 - Materialized MatrixArray16

## Summary

Expanded the generated materialized `YogaNode.setStyle(...)` proof for
16-value `style.matrix` arrays.

The new proof uses a fresh `YogaNode::toObject(runtime)` materialized object,
invokes generated `setStyle(...)` through the JS object, and asserts the public
`MatrixArray16` payload is delivered into native `_style.matrix` and `_matrix`
as the expected `SkM44::RowMajor(values).asM33()` matrix.

No product C++ or TypeScript changes were needed.

## Changed files

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-157-materialized-matrix16.md`

## Proof added

- Added source guards for the public `MatrixArray16` style shape, generated
  `NodeStyle` matrix variant, `SkMatrix` converter length-16 support, and the
  native `SkM44::RowMajor(...).asM33()` conversion path.
- Added a 16-value matrix payload builder matching the public
  `MatrixArray16` tuple shape from `src/specs/style.ts`.
- Added `makeSkMatrix16(...)` expected-value construction using
  `SkM44::RowMajor(values).asM33()`.
- Added `assertGeneratedMatrix16Style(...)`, which materializes a fresh
  `YogaNode`, calls generated `setStyle(...)` through the materialized JS
  object, asserts `_style.matrix` holds `std::shared_ptr<SkMatrix>`, asserts
  the style matrix contents, and asserts native `_matrix` matches the same
  expected matrix.
- Updated verifier success text and proof-boundary text to include both
  9-value and 16-value matrix-array delivery without broadening the platform
  runtime claim.

## Verification run/results

- `git status --short --branch` - passed before edits with only
  `## worker/157-materialized-matrix16`; after verifier edits it showed only
  `scripts/verify-yoganode-nitro-materialization.mjs` modified; after report
  creation it showed that script plus this report.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed. The host-JSC probe
  compiled/linked and asserted generated materialized `setStyle(...)` delivery
  for the new MatrixArray16 case. npm printed the existing
  `minimum-release-age` warning.
- `npm run check:yoganode-native-hit-testing` - passed. npm printed the
  existing `minimum-release-age` warning.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 26s. The
  aggregate reran the updated materialization verifier as command 20/28,
  removed newly created `tsconfig.tsbuildinfo`, and removed matrix temp parent
  `/tmp/rnskia-feasible-matrix-5qhOaN`.
- `git diff --check` - passed after writing this report.

## Proof boundary/overclaim risks

This proof is limited to host-JSC Nitro `YogaNode::toObject(...)`
materialization, generated YogaNode prototype wrapper delivery, generated
`NodeStyle`/`SkMatrix` conversion for a public 16-value matrix array, and native
C++ state mutation into `_style.matrix` and `_matrix`.

It does not prove platform rendering, hit testing behavior for this new
materialized 16-value case, command rendering, React Native bridge delivery,
Nitro registry install in a React Native runtime, UI-runtime Worklets or
Reanimated delivery, iOS/Android app build/run, native presentation, pixel
rendering, or render fidelity.

The proof intentionally does not assert that JS arrays land in the tuple-16
variant. The generated variant tries `std::shared_ptr<SkMatrix>` first, and
that custom converter accepts 9- and 16-value arrays; the runtime assertion
therefore checks the actual generated materialized behavior.

## Nested subagent/explorer results

- `matrix16_explorer` confirmed the focused placement in
  `scripts/verify-yoganode-nitro-materialization.mjs`: add the array builder
  near `makeMatrixArray9`, add the style builder near `makeMatrixStyle`, add
  the assertion after `assertGeneratedMatrixStyle`, and call it before transform
  precedence.
- The explorer confirmed the public `MatrixArray16` shape in
  `src/specs/style.ts`, the generated matrix variant in `NodeStyle.hpp`, and
  the native state mutation path in `YogaNode.cpp`.
- The explorer also identified the important risk: do not over-assert the
  tuple-16 alternative because the generated `SkMatrixNative` branch accepts
  length-16 arrays first.

## Cleanup status

- Product C++/TypeScript files were left unchanged.
- Ignored dependency/native/example artifacts were preserved:
  `node_modules`, `example/node_modules`, `example/ios`, `example/android`,
  `example/.expo`, `lib`, `.DS_Store`, and `tsconfig.tsbuildinfo`.
- The feasible matrix removed its own `tsconfig.tsbuildinfo` and temp parent,
  leaving no new tracked artifacts after cleanup.

## Recommended next tasks

- Add optional coverage for `transform: []` matrix suppression if that edge is
  selected next.
- Consider a broader generated `NodeStyle` inventory guard if future work needs
  drift coverage across all public style fields.

Goal finished.
