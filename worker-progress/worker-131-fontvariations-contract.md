# Summary

- Removed `fontVariations` from the public Yoga text-style authoring type.
- Prevented `YogaParagraphStyle` from reintroducing RN Skia's raw nested `SkParagraphStyle["textStyle"]`; flattened paragraph text-style fields and nested `paragraphStyle.textStyle` now use the Yoga text-style contract.
- Added explicit native rejection for unsupported `fontVariations` payloads before unsupported data can silently no-op through local text overlays or RN Skia paragraph parsing.
- Added TypeScript and host-JSC/native verifier proof for the unsupported contract.

# Changed files

- `src/jsx.ts`
  - `YogaTextStyle` now omits `fontVariations`.
  - `YogaParagraphStyle` now omits raw `SkParagraphStyle["textStyle"]` and replaces it with `textStyle?: YogaTextStyle`.
- `cpp/JSIConverter+SkTextStyle.hpp`
  - Added a shared unsupported `fontVariations` guard and call it from `applyTextStyle(...)`.
- `cpp/JSIConverter+SkParagraphStyle.hpp`
  - Added pre-parse rejection for flattened `ParagraphStyle.fontVariations` and nested `ParagraphStyle.textStyle.fontVariations`.
- `scripts/verify-package-typescript-consumer.mjs`
  - Added packed-consumer JSX negatives for `<text textStyle={{ fontVariations: ... }}>`, flattened `<paragraph paragraphStyle={{ fontVariations: ... }}>`, and nested `<paragraph paragraphStyle={{ textStyle: { fontVariations: ... } }}>`.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added direct `TextStyle`, direct `ParagraphStyle`, `text.textStyle`, flattened `paragraph.paragraphStyle`, and nested `paragraph.paragraphStyle.textStyle` rejection assertions.
  - Updated verifier output/proof-boundary text to name unsupported-key rejection without claiming support.
- `worker-progress/worker-131-fontvariations-contract.md`
  - This report.

# Commands run

- `sed -n '1,240p' WORKER_BRIEF.md`
- `git status --short --branch`
- `rg -n "fontVariations|YogaTextStyle|YogaParagraphStyle|SkTextStyle|SkParagraphStyle|strutStyle|fontFeatures" src/jsx.ts cpp scripts`
- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `git diff --check`
- `npm run check:package-typescript-consumer`
- `npm run typecheck`
- `npm run check:yoganode-native-commands-render`
- `cd example && bun run typecheck`
- `npm run check:feasible-matrix`
- Final cleanup inspection:
  - `git status --short`
  - `git diff --check`
  - `git diff --stat`
  - `git diff -- src/jsx.ts cpp/JSIConverter+SkTextStyle.hpp cpp/JSIConverter+SkParagraphStyle.hpp scripts/verify-package-typescript-consumer.mjs scripts/verify-yoganode-native-commands-render.mjs`

# Evidence

- `npm run check:package-typescript-consumer` passed and printed that packed-consumer TypeScript rejected unsupported `fontVariations` authoring on `text.textStyle`, flattened `paragraph.paragraphStyle`, and nested `paragraph.paragraphStyle.textStyle`.
- `npm run check:yoganode-native-commands-render` passed and printed that the host executable asserted explicit unsupported `fontVariations` rejection while preserving existing selected `SkTextStyle`, `SkParagraphStyle`, `fontFeatures`, and `strutStyle` coverage.
- The native verifier includes negative assertions for:
  - direct `JSIConverter<skia::textlayout::TextStyle>::fromJSI(...)`
  - direct `JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(...)`
  - `NodeCommand` `text.textStyle`
  - `NodeCommand` flattened `paragraph.paragraphStyle.fontVariations`
  - `NodeCommand` nested `paragraph.paragraphStyle.textStyle.fontVariations`
- `npm run typecheck`, `cd example && bun run typecheck`, and `npm run check:feasible-matrix` passed.
- `npm run check:feasible-matrix` also reran the packed consumer, native command/render verifier, root typecheck, lint, example typecheck, specs generation, materialization, bundle, and native-generation checks; it reported no remaining new tracked artifacts after cleanup.

# Proof boundary/overclaim risks

- This proves the public TypeScript contract rejects `fontVariations` at representative packed-consumer authoring sites and the host-native JSI converters reject representative `as any` payloads clearly.
- This does not implement variable-font support, preserve `fontVariations`, or prove platform-native typography/rendering behavior.
- This does not prove exact typography, font fallback correctness, paragraph shaping fidelity, React Native bridge delivery, iOS/Android app runtime, simulator/device launch, or UI-runtime Worklets/Reanimated/RNGH delivery.
- The native proof is host-JSC/macOS C++ verifier coverage against selected direct converters and command payload paths.
- Nested `paragraphStyle.textStyle` proof is limited to unsupported-key rejection; it does not claim broader nested style shape preservation.

# Cleanup

- No `node_modules` edits.
- No generated specs or materialization files were intentionally changed.
- The feasible matrix ran `bun run specs` internally and reported no newly created tracked artifacts after cleanup.
- Final `git status --short` showed only the intended source/script/report files changed before commit.

# Quality/maintainability/performance/security review

- Quality: the public type and native parser now agree on the unsupported contract instead of allowing a public no-op field.
- Maintainability: the unsupported-key check is centralized for text styles and reused by paragraph-style pre-parse validation.
- Performance: the new runtime check is a constant-time property presence guard on style conversion paths only.
- Security: no new external input execution path, dependency, or filesystem/network behavior was added.

# Recommended next tasks

- If variable-font support becomes a product requirement, scope it as a separate native implementation with RN Skia/parser support and rendering proof.
- Keep future paragraph text-style additions aligned across public JSX types, local native overlays, and host-JSC verifier coverage.

Goal finished.
