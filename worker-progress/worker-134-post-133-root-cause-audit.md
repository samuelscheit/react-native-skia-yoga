# Summary

This was a report-only post-worker-133 audit. I changed only this report:

- `worker-progress/worker-134-post-133-root-cause-audit.md`

The current baseline is green under the required focused checks and the full feasible matrix. Worker 133's simple `<text textStyle>` contract closure is present: public simple text authoring is narrowed to `fontSize` and `color`, native text command conversion rejects rich-only `text.textStyle` keys, and paragraph/direct rich text-style conversion remains available.

Selected next target: close the nested `paragraphStyle.textStyle` Yoga text-style value-shape mismatch, starting with CSS string color values. Public nested paragraph text style uses `YogaTextStyle`, which accepts string colors, but current native paragraph parsing enters RN Skia's nested `textStyle` parser before the local CSS-capable text-style overlay. The existing proof covers flattened paragraph CSS colors, not nested `paragraphStyle.textStyle.color`.

# Baseline reviewed

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-134-post-133-root-cause-audit`
- Branch: `worker/134-post-133-root-cause-audit`
- Baseline commit reviewed: `af63c8d Accept worker 133 and queue next audit`
- Prior reports reviewed:
  - `worker-progress/worker-131-fontvariations-contract.md`
  - `worker-progress/worker-132-post-131-root-cause-audit.md`
  - `worker-progress/worker-133-simple-textstyle-contract.md`
- Source/proof files reviewed:
  - `src/jsx.ts`
  - `src/index.ts`
  - `index.d.ts`
  - `src/Reconciler.ts`
  - `src/specs/commands.ts`
  - `src/specs/SkiaYoga.nitro.ts`
  - `cpp/NodeCommand.hpp`
  - `cpp/JSIConverter+SkTextStyle.hpp`
  - `cpp/JSIConverter+SkParagraphStyle.hpp`
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `cpp/YogaNode.hpp`
  - `cpp/YogaNode.cpp`
  - `scripts/verify-package-typescript-consumer.mjs`
  - `scripts/verify-yoganode-native-commands-render.mjs`
  - `scripts/verify-yoganode-nitro-materialization.mjs`
  - `scripts/verify-feasible-matrix.mjs`
  - generated Nitro shared C++ specs for `HybridYogaNodeSpec`
  - installed RN Skia paragraph/text/color native parser headers under `node_modules/@shopify/react-native-skia/cpp/api`
- Delegated read-only check:
  - `verifier_boundary_explorer` independently ranked nested `paragraphStyle.textStyle.color` CSS proof first and confirmed package/native/Nitro proof currently uses flattened paragraph style, not nested color.
  - `text_style_contract_explorer` was closed as obsolete after not returning before the report write; it made no findings that affected this report.

# Commands run

- `git status --short --branch`: passed; clean on the assigned branch before report writing.
- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed with no output.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands; total command duration `4m 20s`.

Notable feasible-matrix evidence:

- `check:package-typescript-consumer` still proves simple `<text textStyle={{ color, fontSize }}>`, rich simple-text rejections, rich paragraph authoring, package root/JSX runtime imports, and representative `src/specs` deep-import rejection.
- `check:yoganode-native-commands-render` still proves selected value-bearing `SkTextStyle`, selected `SkParagraphStyle`, public-shaped `strutStyle`, simple text command serialization, rich text-command rejection, flattened paragraph CSS color render evidence, and flattened/nested `fontVariations` rejection.
- `check:yoganode-nitro-materialization` still proves host-JSC `YogaNode::toObject(runtime)`, generated wrapper `setCommand(...)` breadth for all command kinds, selected native side effects, and materialized `getChildren()` identity/prototype behavior.
- Matrix cleanup removed generated `tsconfig.tsbuildinfo`; remaining new tracked artifacts after cleanup: none.

# Current proof surface

- Public JSX types:
  - `YogaTextStyle` omits `fontVariations` and uses string-capable text color fields.
  - `YogaSimpleTextStyle` is `Pick<YogaTextStyle, "fontSize" | "color">`.
  - `YogaTextProps.textStyle` now uses the simple style.
  - `YogaParagraphStyle` remains rich and allows both flattened text-style fields and nested `textStyle?: YogaTextStyle`.
- Package boundary:
  - The package root exports the public JSX and canvas types through explicit allowlists.
  - `src/specs` remains physically packed for codegen but is not exported by `package.json`.
  - Packed-consumer proof rejects representative internal root exports and `src/specs` deep imports under package-exports-aware TypeScript resolution.
- Native text style:
  - Local `applyTextStyle(...)` parses public-shaped text-style fields, including CSS string colors, and rejects unsupported `fontVariations`.
  - Direct `TextStyle` conversion and rich paragraph conversion keep selected rich fields including `fontFamilies`, `fontFeatures`, `fontStyle`, decoration, foreground/background colors, height override, half leading, spacing, locale, shadows, and baseline.
- Native simple text command:
  - `JSIConverter<NodeCommand>::fromJSI(...)` rejects rich-only `text.textStyle` keys for `NodeCommandKind::TEXT`.
  - `TextCmd` serialization emits only simple `fontSize` and `color`.
  - The host-native verifier proves simple text command state/render and rich-key rejection.
- Native paragraph style:
  - `ParagraphStyle::fromJSI(...)` rejects flattened and nested `fontVariations`, calls RN Skia paragraph parsing, applies the local text-style overlay to flattened paragraph fields, and applies the local `strutStyle.fontFamilies` overlay.
  - `ParagraphStyle::toJSI(...)` serializes selected paragraph scalars, selected default text style fields flattened onto the paragraph object, and selected `strutStyle` fields.
  - The current host-native proof covers direct and `NodeCommand` flattened paragraph-style conversion/serialization, selected paragraph render evidence, and flattened CSS color parsing.
- Nitro materialization:
  - The materialization verifier proves generated JS-facing wrappers deliver selected `setCommand(...)` payloads for all command kinds.
  - Its paragraph payload uses flattened `paragraphStyle`; it does not prove nested `paragraphStyle.textStyle.color`.
- Feasible matrix:
  - The matrix proves the accepted local package/source/example metadata and host-native verifier surface.
  - It still excludes platform app runtime, RN bridge delivery, Nitro registry install inside an RN runtime, UI-runtime Worklets/Reanimated, RNGH delivery, image loading, exact typography/shaping, and exact render fidelity.

# Remaining gaps considered

1. Nested `paragraphStyle.textStyle` CSS string/color parser mismatch.

Evidence: `YogaParagraphStyle.textStyle` is public and typed as `YogaTextStyle`, whose color fields accept strings. The packed consumer proves nested rich paragraph fields such as `fontFeatures` and `letterSpacing`, but not nested `color`. Native `ParagraphStyle::fromJSI(...)` currently calls RN Skia's `JsiSkParagraphStyle::fromValue(...)` before the local flattened `applyTextStyle(...)` overlay. RN Skia's nested `JsiSkTextStyle` color path calls `JsiSkColor::fromValue(...)`, which expects an object-backed SkColor value, while the local CSS parser that accepts strings is only applied to the paragraph object itself. This is a source-inferred public/native mismatch and should be converted into a focused failing proof before implementation.

2. Nested `paragraphStyle.textStyle` serializer shape preservation.

Evidence: native parsing accepts nested `paragraphStyle.textStyle`, while `ParagraphStyle::toJSI(...)` serializes the paragraph default text style as flattened fields and suppresses text-style `heightMultiplier` to avoid colliding with paragraph `heightMultiplier`. This remains a real parser/serializer asymmetry, but it needs an API shape decision: flatten-only, nested-preserving, or dual-shape output.

3. Nitro materialization nested paragraph-style breadth.

Evidence: `check:yoganode-nitro-materialization` now covers generated `setCommand(paragraph)` delivery, but its representative paragraph style is flattened. It does not reduce nested `paragraphStyle.textStyle` risk unless the next task adds nested payloads to the generated-wrapper path.

4. Internal generated command type looseness.

Evidence: `src/specs/commands.ts` still uses raw RN Skia `SkTextStyle` and `SkParagraphStyle` for Nitro custom types. Public package checks reject root `NodeCommand` exports and representative `src/specs` deep imports, and the Reconciler feeds commands from narrowed public props, so this is lower priority than a package-root nested paragraph authoring mismatch.

5. `SkSamplingOptions.maxAniso`.

Evidence: local serialization covers RN Skia's public `SamplingOptions` shapes, filter/mipmap and cubic `B`/`C`. RN Skia's installed public type does not expose `maxAniso`, so this is not a current package-root public contract gap.

6. Platform/runtime/fidelity gaps.

Evidence: CocoaPods install, Gradle build, simulator/device launch, native app runtime, RN bridge delivery, Nitro registry install inside RN, UI-runtime Worklets/Reanimated, RNGH delivery, image loading, exact typography/shaping, and exact render fidelity remain outside the local repo-owned proof surface.

# Selected next target

Close nested `paragraphStyle.textStyle` CSS string/color parsing for Yoga paragraph styles.

Recommended scope: prove and, if needed, fix nested `paragraphStyle.textStyle.color` first, with a general implementation shape that lets the existing local `applyTextStyle(...)` parser own nested Yoga text-style values. The fix should preserve current flattened paragraph-style behavior and keep flattened text-style fields as the final precedence layer if both flattened and nested values are authored.

# Why this is stronger than alternatives

- It is a current public value-shape mismatch: public nested paragraph `textStyle` uses `YogaTextStyle`, and `YogaTextStyle` intentionally accepts string colors.
- It is locally repo-owned and unblocked: the next worker can prove it with packed TypeScript authoring, direct host-JSC/native paragraph conversion, `NodeCommand` paragraph conversion/rendering, and generated Nitro `setCommand(paragraph)` materialization.
- It is smaller than full nested serializer shape preservation: accepting nested CSS colors does not require deciding whether `toJSI(...)` should emit nested, flattened, or dual shapes.
- It is more user-visible than generated-wrapper breadth alone: the generated wrapper proof can be included for the same nested payload, but the root cause is the paragraph text-style value conversion path.
- It is more concrete than platform runtime, image loading, exact typography, or render fidelity work, which are still broader proof classes with higher overclaim risk.
- It is higher priority than internal `src/specs` type looseness because package exports and packed-consumer checks already keep those internals out of the supported package-root API.

# Proposed implementation/proof shape for next worker

Expected proof-first shape:

- Add packed-consumer positive coverage for nested paragraph color strings, for example `<paragraph paragraphStyle={{ textStyle: { color: "#00ff00", fontSize: 16 } }} />`.
- Add direct native `JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(...)` coverage for nested `textStyle.color` as a CSS string and assert `getTextStyle().getColor()`.
- Add representative `NodeCommand` `paragraph.paragraphStyle.textStyle.color` coverage through `JSIConverter<NodeCommand>::fromJSI(...)`.
- Add bounded `ParagraphCmd` measure/render evidence for a nested CSS color payload, or at minimum state proof plus one bounded raster assertion matching existing flattened paragraph CSS coverage.
- Add generated Nitro materialization coverage for `setCommand(paragraph)` with nested `paragraphStyle.textStyle.color`.
- Add invalid nested CSS color rejection coverage that proves the failure is scoped to paragraph command conversion and names the invalid string.

Expected implementation shape if the first proof fails:

- In `cpp/JSIConverter+SkParagraphStyle.hpp`, keep the existing pre-parse rejection for flattened and nested `fontVariations`.
- Avoid sending a nested `textStyle` object containing Yoga string colors into RN Skia's native paragraph parser unmodified. A conservative approach is to build an RN-Skia-compatible paragraph object without `textStyle`, let RN Skia parse paragraph scalar and `strutStyle` fields, then apply local `applyTextStyle(...)` to the nested `textStyle` object.
- After nested local application, apply the existing flattened `applyTextStyle(runtime, arg, textStyle)` overlay so current flattened Yoga paragraph fields keep precedence over nested defaults.
- Keep the existing `strutStyle.fontFamilies` overlay.
- Do not change `JSIConverter<skia::textlayout::TextStyle>` or text command rejection semantics.
- Do not claim authored CSS string preservation; conversion may continue to normalize colors to numeric Skia colors.

Expected verification:

- `git diff --check`
- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:package-typescript-consumer`
- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`

# Proof boundary/overclaim risks

- This audit is report-only. It does not include a new failing assertion for nested CSS colors; the selected bug is source-inferred from public types and parser order and should be proven first by the next worker.
- The next fix should not claim full nested `paragraphStyle.textStyle` shape preservation unless it also changes and proves `ParagraphStyle::toJSI(...)` output shape.
- The next fix should not claim CSS string round-trip preservation; current converter behavior normalizes string colors into native colors.
- If both nested and flattened text-style values are authored, precedence must be explicit and tested. This audit recommends preserving current flattened precedence.
- The next worker should keep `fontVariations` unsupported and rejected unless it designs real variable-font support.
- Platform app runtime, RN bridge delivery, Nitro registry install inside a running RN app, UI-runtime Worklets/Reanimated, RNGH native delivery, image loading, exact typography/shaping, and exact render fidelity remain out of scope unless separately assigned.

# Cleanup

- No product source, generated specs, examples, package metadata, or `node_modules` files were edited.
- The feasible matrix removed its generated `tsconfig.tsbuildinfo` and matrix-owned temp parent.
- Ignored dependency directories, including `node_modules/` and `example/node_modules/`, were left untouched.
- Expected final changed file for this worker: `worker-progress/worker-134-post-133-root-cause-audit.md`.

# Quality/maintainability/performance/security review

- Quality: the selected next target is grounded in a concrete public nested paragraph value shape and a specific native parser-order risk, with a proof plan that should fail or pass clearly.
- Maintainability: the proposed fix keeps text command, direct rich text-style conversion, nested paragraph text style, and flattened paragraph style responsibilities separate.
- Performance: no runtime code changed in this worker. The proposed next fix would add bounded object parsing on paragraph-style conversion only.
- Security: no dependency, network, filesystem, or process-execution behavior changed. The proposed next verifier inputs should remain fixed local literals.

Goal finished.
