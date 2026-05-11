# Summary

This was a report-only post-worker-131 audit. I changed only this report:

- `worker-progress/worker-132-post-131-root-cause-audit.md`

The current baseline is green under the required checks and the full feasible matrix. Worker 129's bounded `ParagraphStyle.strutStyle` parser/serializer proof and Worker 131's unsupported `fontVariations` type/native rejection proof remain present in source and verifier output.

Selected next target: close the simple `<text textStyle>` contract drift. Public `<text>` authoring still accepts rich `YogaTextStyle` fields that are converted and serialized but do not affect `TextCmd` rendering; the smallest locally provable fix is to split/narrow the simple text style contract to the fields `TextCmd` actually renders and reject unsupported direct text command payloads.

# Baseline reviewed

- Current branch: `worker/132-post-131-root-cause-audit`.
- Current baseline commits reviewed: `ae699d8 Accept worker 131 and queue next audit` and `9ad7069 Merge worker 131 fontVariations contract closure`.
- Accepted reports reviewed:
  - `worker-progress/worker-129-paragraphstyle-strutstyle-tojsi.md`
  - `worker-progress/worker-130-post-129-root-cause-audit.md`
  - `worker-progress/worker-131-fontvariations-contract.md`
- Current source/proof files reviewed:
  - `src/jsx.ts`
  - `src/specs/commands.ts`
  - `cpp/JSIConverter+SkTextStyle.hpp`
  - `cpp/JSIConverter+SkParagraphStyle.hpp`
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `cpp/NodeCommand.hpp`
  - `cpp/YogaNode.hpp`
  - `cpp/YogaNode.cpp`
  - `scripts/verify-package-typescript-consumer.mjs`
  - `scripts/verify-yoganode-native-commands-render.mjs`
- Delegated read-only check: `style_contract_explorer` independently found no package-root drift from Worker 131's `fontVariations` closure and ranked the same `<text textStyle>` rich-style over-promise first. It did not edit files or rerun the matrix.

# Commands run

- `git status --short --branch`: passed; clean baseline before report writing.
- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed with no output.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands; total command duration `5m 22s`.

Notable matrix evidence:

- `check:package-typescript-consumer` passed and still rejects unsupported `fontVariations` on `text.textStyle`, flattened `paragraph.paragraphStyle`, and nested `paragraph.paragraphStyle.textStyle`.
- `check:yoganode-native-commands-render` passed and still proves selected `SkTextStyle` fields, selected `SkParagraphStyle` fields, public-shaped `strutStyle`, flattened/nested `fontVariations` rejection, TextCmd/ParagraphCmd CSS color conversion, and bounded raster behavior.
- `check:yoganode-nitro-materialization` passed and still proves generated wrapper materialization and selected generated `setCommand(...)` delivery, including basic text and paragraph command state.
- Matrix cleanup removed generated `tsconfig.tsbuildinfo` and `/tmp/rnskia-feasible-matrix-FSggkc`; remaining new tracked artifacts after cleanup: none.

# Current proof surface

- `src/jsx.ts` now omits `fontVariations` from `YogaTextStyle`, and `YogaParagraphStyle.textStyle` uses `YogaTextStyle` rather than raw RN Skia `SkParagraphStyle["textStyle"]`.
- `cpp/JSIConverter+SkTextStyle.hpp` rejects `fontVariations` and parses/serializes selected public-shaped rich text-style fields: colors, font families, font features, font style, height override, half leading, spacing, locale, shadows, decoration, and baseline.
- `cpp/JSIConverter+SkParagraphStyle.hpp` rejects flattened and nested `fontVariations`, preserves flattened paragraph text-style fields, serializes selected paragraph controls, emits selected `strutStyle` fields, and applies a local `strutStyle.fontFamilies` parse overlay.
- `scripts/verify-package-typescript-consumer.mjs` proves the public package root and JSX runtime types reject Worker 131's unsupported `fontVariations` contract while preserving package export boundaries.
- `scripts/verify-yoganode-native-commands-render.mjs` proves direct and representative `NodeCommand` `toJSI -> fromJSI` coverage for selected text/paragraph fields, plus explicit unsupported `fontVariations` rejection.
- `cpp/YogaNode.cpp` still renders simple `<text>` through `TextCmd::updateProps(...)`, which applies only `textStyle.getFontSize()` to the active `SkFont` and `textStyle.getColor()` as fallback paint color. Other rich `SkTextStyle` fields can be accepted into command state but do not affect simple text rendering.
- `ParagraphCmd::updateProps(...)` uses `ParagraphBuilder`, pushes `paragraphStyle.getTextStyle()`, and remains the route for richer paragraph text styling.
- `src/specs/commands.ts` still uses raw RN Skia `SkTextStyle` / `SkParagraphStyle` for internal generated command custom types, but package export checks keep `src/specs` deep imports outside the supported public package contract.

# Remaining gaps considered

1. Simple `<text textStyle>` over-promises rich styling.

Evidence: public `YogaTextProps.textStyle` accepts `YogaTextStyle`, which exposes rich fields such as `fontFamilies`, `fontFeatures`, `fontStyle`, decoration, foreground/background colors, shadows, spacing, locale, and baseline. Native conversion preserves many of them, but `TextCmd::updateProps(...)` only renders `fontSize` and `color`.

2. Nested `paragraphStyle.textStyle` shape preservation.

Evidence: public paragraph style allows nested `textStyle`, and native parsing accepts it. Current `ParagraphStyle::toJSI(...)` emits text-style fields flattened onto the paragraph object and suppresses text-style `heightMultiplier`, so nested authoring shape and nested text height intent are not round-trip preserved.

3. Richer generated-wrapper materialization breadth.

Evidence: direct command/render verification covers rich text/paragraph conversion more deeply than `check:yoganode-nitro-materialization`, whose generated-wrapper side-effect assertions remain representative rather than exhaustive.

4. `SkSamplingOptions.maxAniso`.

Evidence: current sampling serialization emits RN Skia parser-compatible `{ B, C }` or `{ filter, mipmap }` shapes. RN Skia's public `SamplingOptions` type is cubic/filter based, so anisotropy remains outside the accepted public/parser contract.

5. Internal generated command type looseness.

Evidence: `src/specs/commands.ts` imports raw RN Skia style types for Nitro custom types, so unsupported deep-import users could see looser internal command payload types. Package exports and packed-consumer checks reject representative `src/specs` deep imports, so this is not package-root public drift.

6. Platform/app/runtime/fidelity gaps.

Evidence: the current proof boundary still excludes CocoaPods install, Gradle build, simulator/device launch, native app runtime, React Native bridge delivery, Nitro registry install inside a running app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image asset loading/decoding, exact typography/shaping, and exact render fidelity.

# Selected next target

Close the simple `<text textStyle>` contract drift.

Recommended direction: split the public simple text style from the richer paragraph text style and add native text-command rejection for unsupported rich text fields. Keep rich `YogaTextStyle` available for paragraph text styling and for direct converter tests; narrow only the `<text>` authoring surface and direct text command payload behavior.

The expected public simple text style should be limited to the fields `TextCmd` actually renders today:

- `fontSize`
- `color`

The separate `font` prop should remain the path for a concrete `SkFont`.

# Why this is stronger than alternatives

- It is a current public no-op contract: users can author rich `<text textStyle>` fields that are accepted but not rendered.
- It is locally repo-owned and unblocked: the fix can be proven with packed TypeScript negatives, host-JSC native command rejection, and existing TextCmd positive render assertions.
- It avoids weakening paragraph styling: `ParagraphCmd` already uses paragraph text style through `ParagraphBuilder`, so rich paragraph styling should not be narrowed as part of a simple text fix.
- It is more concrete than nested paragraph shape preservation, which needs an API decision about flattened versus nested serialization and height key collisions.
- It has higher root-cause value than generated-wrapper proof breadth, which would expand evidence for supported paths without closing a false authoring contract.
- It is less speculative than `maxAniso`, platform app runtime, image loading, or exact typography/fidelity work, which either sit outside the accepted public parser contract or remain overclaim-prone without broader environment support.

# Proposed implementation/proof shape for next worker

Expected implementation shape:

- In `src/jsx.ts`, introduce a simple text style type for `<text>` authoring, for example `YogaSimpleTextStyle = Pick<YogaTextStyle, "fontSize" | "color">`.
- Change `YogaTextProps.textStyle` and its animated/deep counterpart to use the simple text style type.
- Keep `YogaTextStyle` as the rich text style used by `YogaParagraphStyle` and nested `paragraphStyle.textStyle`.
- Add packed-consumer negative coverage in `scripts/verify-package-typescript-consumer.mjs` for representative unsupported simple-text fields, such as:
  - `<text textStyle={{ fontFamilies: ["Inter"] }} />`
  - `<text textStyle={{ fontFeatures: [...] }} />`
  - `<text textStyle={{ fontStyle: {...} }} />`
  - `<text textStyle={{ letterSpacing: 1 }} />`
- Preserve positive packed-consumer coverage for `<text textStyle={{ color: "white", fontSize: 14 }} />`.
- Add a text-command-specific native validator before or around the `TEXT` branch in `cpp/JSIConverter+NodeCommand.hpp`, rather than narrowing `JSIConverter<skia::textlayout::TextStyle>` globally. Direct `TextStyle` conversion and paragraph style conversion should continue to own rich-style parsing.
- Reject unsupported `text.textStyle` keys with clear errors for representative runtime `as any` payloads.
- Extend `scripts/verify-yoganode-native-commands-render.mjs` with negative host-JSC assertions for text command payloads carrying rich-only fields, while keeping existing direct `TextStyle`, paragraph, CSS color, `fontFeatures`, `strutStyle`, and `fontVariations` assertions green.
- Do not edit `node_modules`.
- Do not claim richer simple-text rendering unless the worker implements a different rendering path that actually consumes those fields.

Expected verification:

- `git diff --check`
- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:package-typescript-consumer`
- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:yoganode-native-commands-render`
- `npm run check:feasible-matrix`

# Proof boundary/overclaim risks

- This audit proves only the current local source and verifier state under host-JSC/native and package/type checks.
- It does not prove platform-native app build/run, simulator/device launch, real React Native bridge delivery, Nitro registry install inside a running app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading/decoding, exact typography/shaping, or exact render fidelity.
- The selected next worker should not claim that simple text supports rich `SkTextStyle` fields unless it changes `TextCmd` rendering to consume them and adds render/state proof.
- Narrowing `<text textStyle>` is a breaking type-level change, but the removed fields are currently misleading for simple text rendering.
- Native rejection should be scoped to text command payloads only. Direct `TextStyle` and paragraph style converters should keep their current rich-style coverage.
- Nested `paragraphStyle.textStyle` remains a separate parser/serializer shape issue and should not be bundled into the simple text contract closure.
- CSS color string preservation is still not claimed; current proof covers parsing/normalization and selected render behavior, not exact authored string round trips.

# Cleanup

- Expected changed files for this worker: this report only.
- No product source, generated specs, examples, package metadata, or `node_modules` files were edited.
- The feasible matrix removed its matrix-owned temp parent and generated `tsconfig.tsbuildinfo`.
- Ignored dependency directories, including `node_modules/` and `example/node_modules/`, were left untouched.
- Final expected commit scope: `worker-progress/worker-132-post-131-root-cause-audit.md`.

# Quality/maintainability/performance/security review

- Quality: report-only audit; the selected next target is grounded in a specific public contract mismatch with file-level evidence and a bounded proof plan.
- Maintainability: the proposed split keeps simple text and paragraph text semantics separate instead of weakening rich paragraph styling to match simple text limitations.
- Performance: no runtime code changed in this worker. The proposed next fix would add only small property-presence validation on text command conversion paths.
- Security: no new dependency, filesystem, process, network, or native execution behavior was introduced.

Goal finished.
