# Summary

- Implemented dual-shape `ParagraphStyle::toJSI(...)` output: paragraph text-style fields continue to be emitted flat for compatibility, and a nested `textStyle` object is now emitted for paragraph-owned default text-style values.
- Preserved paragraph-level `heightMultiplier` on the paragraph object while serializing text-style `heightMultiplier` inside `textStyle.heightMultiplier`.
- Tightened the input collision boundary so serialized dual output can round-trip distinct paragraph/text-style heights: flat-only `heightMultiplier` remains accepted, but when `textStyle.heightMultiplier` is present, that nested value owns the text-style height while the root key remains paragraph height.
- Added direct converter and paragraph `NodeCommand` toJSI/fromJSI proof for nested `textStyle` output with color, fontSize, and distinct paragraph/text-style `heightMultiplier` values.

# Changed Files

- `cpp/JSIConverter+SkParagraphStyle.hpp`
  - Added nested `textStyle` emission in paragraph serialization.
  - Added nested text-style height collision detection before applying flattened text-style overlay.
- `cpp/JSIConverter+SkTextStyle.hpp`
  - Added an optional `skipHeightMultiplier` parameter to the shared text-style overlay helper.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Extended serialized paragraph assertions to cover dual flattened/nested output.
  - Added distinct-height direct `ParagraphStyle` converter proof.
  - Added distinct-height paragraph `NodeCommand` toJSI/fromJSI proof.
  - Updated verifier proof-boundary output to remove the old nested `textStyle` toJSI gap.
- `worker-progress/worker-139-paragraph-tojsi-nested-textstyle.md`
  - This report.

# Evidence

- Current root cause confirmed from source:
  - `ParagraphStyle::toJSI(...)` previously called `writeTextStylePublicFieldsToJSI(..., false)`, preserving flat fields but suppressing text-style height.
  - Root `heightMultiplier` was already paragraph-owned on output.
  - `NodeCommand::toJSI(...)` delegates paragraph payload serialization through `JSIConverter<std::optional<ParagraphStyle>>::toJSI(...)`, so fixing the paragraph converter fixes representative command output.
- Read-only nested explorer result:
  - Confirmed the converter shape and exact collision: root `heightMultiplier` was parsed as both paragraph height and flattened text-style height, while toJSI omitted text-style height to avoid overwriting paragraph height.
  - Recommended direct converter proof near `assertValueBearingStyleConverters(...)` and paragraph `NodeCommand` proof near `assertNodeCommandToJSISerializationSymmetry(...)`.
- Focused verifier evidence:
  - Direct `ParagraphStyle` conversion now creates a paragraph with root height `1.75` and nested rich `textStyle` fontSize `24`, green color, and text-style height `1.25`.
  - Direct `ParagraphStyle::toJSI(...)` asserts root `heightMultiplier === 1.75`, nested `textStyle.heightMultiplier === 1.25`, and flat compatibility fields still include the text-style values.
  - Direct `ParagraphStyle` toJSI/fromJSI round-trip preserves both heights.
  - Paragraph `NodeCommand` toJSI/fromJSI round-trip preserves the same dual-output shape and both heights.

# Verification Commands

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `git diff --check`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 54s.

# Proof Boundary / Overclaim Risks

- Proven: host-JSC/native direct converter behavior, paragraph `NodeCommand` toJSI/fromJSI representative round-trip behavior, dual flat/nested paragraph text-style output, distinct paragraph/text-style `heightMultiplier` preservation, and existing flattened fontSize/color precedence over nested values.
- Preserved compatibility: flat paragraph text-style fields remain emitted; flat-only paragraph `heightMultiplier` input remains accepted by the existing overlay path.
- Collision boundary: when nested `textStyle.heightMultiplier` is present, that nested key now owns text-style height so serialized dual output can round-trip distinctly from paragraph height. This intentionally avoids using the paragraph root key as the text-style height override for that collision case.
- Not proven: CSS color string preservation after native normalization, exact typography/shaping/render fidelity, UI-runtime Worklets execution, Reanimated SharedValue delivery, native bridge delivery, Nitro registry install inside a running React Native app, iOS/Android app build/run, simulator/device launch, or broad every-field paragraph/text-style fidelity.
- Simple `<text textStyle>` rich-key support remains intentionally unchanged and out of scope.

# Cleanup Status

- Feasible matrix removed its generated `tsconfig.tsbuildinfo` and matrix temp parent.
- No generated Nitro files changed after the matrix `bun run specs` step.
- Worktree was clean apart from the intended tracked edits before this report was added.
- Ignored dependency directories and pre-existing ignored artifacts were left untouched.

# Recommended Next Tasks

- Add user-facing documentation for the simple `<text textStyle>` versus rich `<paragraph paragraphStyle>` split if desired.
- Keep platform-native build/run verification queued until local full Xcode/CocoaPods and Android Java/SDK prerequisites are available.
- Consider a future broader paragraph/text-style fidelity pass only if a concrete field-specific contract gap is selected.

Goal finished.
