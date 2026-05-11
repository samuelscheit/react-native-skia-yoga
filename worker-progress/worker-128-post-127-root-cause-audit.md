# Summary

This was a report-only post-worker-127 audit. I changed only this report:

- `worker-progress/worker-128-post-127-root-cause-audit.md`

The post-worker-127 baseline is green. Worker 127's accepted boundary is reflected in current source and verifier output: bounded `ParagraphStyle` scalar serialization now covers `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`, while prior accepted sampling, `TextStyle`, `fontFeatures`, paragraph control, and representative `NodeCommand` round-trip coverage remains intact.

Selected next target for worker 129: add bounded `ParagraphStyle.strutStyle` parser/serializer coverage, including a local `strutStyle.fontFamilies` parser overlay, with direct converter and representative `paragraph.paragraphStyle` `NodeCommand` round-trip proof.

# Baseline Verification

Worktree:

- `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-128-post-127-root-cause-audit`
- Branch: `worker/128-post-127-root-cause-audit`
- HEAD at audit: `740b45e Accept worker 127 and queue next audit`

Commands run:

- `git diff --check`: passed before report writing.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - Matrix total command duration: `4m 26s`.
  - `/usr/bin/time`: `real 266.74`, `user 195.25`, `sys 74.26`.
  - Matrix-owned temp parent: `/tmp/rnskia-feasible-matrix-EdgXMQ`.
  - Cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Remaining new tracked artifacts after matrix cleanup: none.
- `git diff --check`: passed again after the matrix.

Notable matrix evidence:

- `check:yoganode-native-commands-render` passed and reported selected value-bearing `SkSamplingOptions`, `SkTextStyle` including `fontFeatures`, and `SkParagraphStyle` serialization including worker 127's paragraph scalar fields.
- `check:yoganode-nitro-materialization` passed and preserved host-JSC `YogaNode::toObject(...)`, generated wrapper, `getChildren()`, generated `setCommand(...)`, and generated `setStyle(width/height/antiAlias)` materialization proof.
- Package codegen/autolinking, package TypeScript consumer, package surface/lifecycle, RN codegen schema, lazy-init, Reconciler animated bindings, gesture/lifecycle runtimes, RN Skia import guard, Android archive guard, host-native YogaNode/runtime/hit-testing, raw methods, RNSkYogaView runtime, root typecheck, lint, example typecheck, specs generation, example bundle export, and isolated example native generation all passed.

Warnings observed:

- Existing npm `minimum-release-age` config warnings appeared during npm commands.
- Expo export printed the existing bytecode advisory.
- Expo native generation printed the existing Android `EDGE_TO_EDGE_PLUGIN` warning.

Platform-native app build/run remains separate and locally blocked:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because full Xcode is not selected.
- `pod`: unavailable on `PATH`.
- `java`: `/usr/bin/java`, but `java -version` failed because no Java runtime is installed.
- `adb`, `cmake`, `ninja`, and `gradle`: unavailable on `PATH`.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

# Current Proof Surface

Recent accepted scope:

- Worker 119 added selected value-bearing `SkSamplingOptions`, `TextStyle`, and `ParagraphStyle` serialization.
- Worker 121 fixed canonical public `style.antiAlias`, preserved legacy `style.antiaAlias`, and proved generated/native `SkPaint` anti-alias state.
- Worker 123 expanded `TextStyle` serialization for paint-backed foreground/background colors, decoration fields, `fontStyle`, `shadows`, and `textBaseline`.
- Worker 125 added bounded `TextStyle.fontFeatures` serialization and direct plus command round-trip proof.
- Worker 127 added bounded `ParagraphStyle` scalar serialization for `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`.

Current source/verifier surface:

- `cpp/JSIConverter+SkSamplingOptions.hpp` emits parser-compatible `{ B, C }` or `{ filter, mipmap }`; `maxAniso` remains outside the accepted public/parser contract.
- `cpp/JSIConverter+SkTextStyle.hpp` serializes the locally parsed public-shaped text-style fields, including `fontFeatures`. `fontVariations` remains a public TypeScript field inherited from RN Skia but is not parsed by local native text-style conversion or RN Skia's installed native parser.
- `cpp/JSIConverter+SkParagraphStyle.hpp` now emits selected paragraph controls plus flattened default text-style fields, but still emits no `strutStyle`.
- RN Skia's installed `JsiSkParagraphStyle::fromValue(...)` accepts `strutStyle`. Installed `JsiSkStrutStyle::fromValue(...)` parses most strut fields, but currently reads `fontFamilies` into a local vector without calling `setFontFamilies(...)`.
- `scripts/verify-yoganode-native-commands-render.mjs` proves selected direct converter and representative `NodeCommand` round trips. It still excludes every remaining `SkParagraphStyle` field, including `strutStyle`.
- `scripts/verify-yoganode-nitro-materialization.mjs` proves generated `setCommand(text)` and `setCommand(paragraph)` wrapper delivery with basic font size/color state, not the expanded rich text/paragraph style field set.

Delegated read-only checks:

- `strutstyle_gap_audit` ranked bounded `ParagraphStyle.strutStyle` serialization first and identified `strutStyle.fontFamilies` as the parser caveat requiring a local overlay.
- `public_boundary_gap_audit` ranked public `fontVariations` type/native support drift first, then `strutStyle`, then richer generated-wrapper materialization coverage. I ranked `strutStyle` first because it is lower blast radius, fully locally provable through current getters, and closes an already parsed paragraph style state gap. `fontVariations` remains the strongest public-boundary follow-up.

# Candidate Next Targets

1. Bounded `ParagraphStyle.strutStyle` parser/serializer coverage.

Classification: strongest locally unblocked product-source converter target.

Evidence: public `YogaParagraphStyle` inherits RN Skia `SkParagraphStyle`, which includes `strutStyle`; RN Skia native parsing accepts `paragraphStyle.strutStyle`; Skia exposes getters/setters for `StrutStyle`; local `ParagraphStyle::toJSI(...)` currently emits no `strutStyle`. The installed RN Skia strut parser also drops `fontFamilies`, so a local overlay is needed for honest round-trip proof.

Why it ranks first: it is the clearest remaining parsed public paragraph state gap after worker 127. It is directly testable in the existing host-JSC/native command/render verifier and can avoid TypeScript/generated/package churn.

2. Public `fontVariations` typing versus native parser support.

Classification: real public TypeScript/native behavior drift, but higher policy and implementation risk.

Evidence: `YogaTextStyle` omits only color fields from RN Skia `SkTextStyle`, so `fontVariations` remains public for `<text textStyle>` and flattened `<paragraph paragraphStyle>`. RN Skia's public TypeScript type declares `fontVariations`, but local `applyTextStyle(...)` and the installed RN Skia native `JsiSkTextStyle` parser do not handle it. Full symmetric support is not a simple `toJSI(...)` slice because `TextStyle::getFontArguments()` returns a wrapped `FontArguments` whose variation coordinates are private in the installed headers.

Why below candidate 1: this needs a policy choice. The next worker could narrow the public Yoga type with packed-consumer negative coverage, or attempt bounded native `SkFontArguments` support with limited readback. Either path has more blast radius than `strutStyle`.

3. Richer generated-wrapper materialization coverage for text/paragraph styles.

Classification: useful verifier breadth, lower root-cause value.

Evidence: direct command/render coverage now proves richer style converters than `check:yoganode-nitro-materialization`, whose generated text/paragraph commands still use basic `fontSize` and color payloads.

Why below candidate 1: generated wrapper delivery is already covered at a representative level. Expanding it would harden proof, but it would not close a product-source data-loss gap on its own.

4. Nested `paragraphStyle.textStyle` shape preservation.

Classification: real shape asymmetry, but API-decision dependent.

Evidence: RN Skia accepts nested `paragraphStyle.textStyle`; local `ParagraphStyle::toJSI(...)` emits flattened text-style fields and suppresses flattened text-style `heightMultiplier` to avoid colliding with paragraph `heightMultiplier`.

Why below candidate 1: flattened paragraph style is an intentional Yoga-facing affordance. Preserving nested shape needs an explicit public-shape decision.

5. `SkSamplingOptions::maxAniso`.

Classification: not selected until public/parser support exists.

Evidence: current sampling serialization intentionally emits only parser-compatible cubic or filter/mipmap shapes. Public RN Skia `SamplingOptions` remains opaque for Yoga image props.

6. Platform-native app runtime, real RN bridge delivery, Nitro registry install inside an app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading, exact typography, and render fidelity.

Classification: high value but locally blocked or overclaim-prone.

Evidence: current local prerequisites still block honest iOS/Android app build/run proof, and the feasible matrix explicitly excludes these runtime/fidelity claims.

# Selected Next Target

Select exactly one next implementation target:

> Add bounded `ParagraphStyle.strutStyle` parser/serializer coverage, including `strutStyle.fontFamilies`, with direct converter and representative `paragraph.paragraphStyle` `NodeCommand` round-trip proof.

Expected implementation shape:

- Extend `cpp/JSIConverter+SkParagraphStyle.hpp` with strut-style `toJSI(...)` helpers.
- Emit public-shaped `strutStyle` fields: `strutEnabled`, `fontFamilies`, `fontStyle`, `fontSize`, `heightMultiplier`, `halfLeading`, `leading`, and `forceStrutHeight`.
- Use `StrutStyle::getHeightOverride()` to decide whether to emit `heightMultiplier`.
- Add a local parser overlay for `strutStyle.fontFamilies` after RN Skia paragraph parsing, because installed `JsiSkStrutStyle` reads but does not store the family array.
- Do not edit `node_modules`.
- Keep existing paragraph scalar output, ellipsis output, and flattened default text-style output intact.
- Do not change TypeScript contracts, generated Nitro specs, examples, or package metadata unless a real public-shape mismatch is discovered during implementation.

# Expected Files And Verification For Worker 129

Likely files:

- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-129-paragraphstyle-strutstyle-tojsi.md`

Optional file if generated-wrapper proof is deliberately expanded:

- `scripts/verify-yoganode-nitro-materialization.mjs`

Recommended verification commands:

- `git diff --check`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization` if materialized generated-wrapper assertions change
- `npm run check:feasible-matrix`

Optional checks if TypeScript/public surfaces change unexpectedly:

- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:package-typescript-consumer`
- `bun run specs`

# Proof Boundary

This audit proves:

- The assigned worktree is green under `git diff --check`, syntax checking for the command/render verifier, and the full feasible local matrix.
- Worker 127's paragraph scalar serialization is covered by the current command/render verifier and full matrix.
- The selected worker-129 target is locally unblocked and grounded in a concrete public/parser-compatible `ParagraphStyle.strutStyle` gap.

The selected worker-129 target should prove only:

- Host-JSC/native `ParagraphStyle::fromJSI(...) -> toJSI(...) -> fromJSI(...)` preservation for the selected strut-style fields.
- Representative `NodeCommand` `paragraph.paragraphStyle` `toJSI(...) -> fromJSI(...)` preservation for those fields.
- Existing paragraph scalar and flattened text-style behavior remains intact.

Do not claim:

- Full `TextStyle` or `ParagraphStyle` parity.
- `fontVariations` support or preservation.
- Nested `paragraphStyle.textStyle` shape preservation unless explicitly designed and tested.
- CSS color string preservation.
- `SkSamplingOptions.maxAniso` preservation.
- Exact typography, glyph shaping, font fallback, paragraph shaping, or render fidelity.
- iOS/Android build/run, simulator/device launch, native platform presentation, real React Native bridge delivery, Nitro registry install inside a running app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading/decoding, asset resolution, texture-backed images, or exact image fidelity.

# Risks And Follow-Up

- `strutStyle.fontFamilies` needs explicit local handling because the installed RN Skia strut parser currently reads the array but does not store it. The next worker should prove non-empty family arrays, not just scalar strut fields.
- `ParagraphStyle::operator==` does not compare strut state. Verifier assertions should use explicit `getStrutStyle()` getter checks.
- Some strut fields may not expose authored-intent bits. Serialization should be documented as current native state, not exact authored-object preservation.
- `fontVariations` remains a public-boundary issue. The strongest follow-up is either to narrow `YogaTextStyle`/`YogaParagraphStyle` and add packed-consumer negative coverage, or design bounded native `SkFontArguments` support with a clear proof boundary.
- Richer generated-wrapper materialization coverage for expanded text/paragraph fields remains useful after product-source converter gaps are closed.

# Cleanup And Status

Cleanup notes:

- This audit changed only `worker-progress/worker-128-post-127-root-cause-audit.md`.
- The feasible matrix removed its matrix-owned temporary parent and generated `tsconfig.tsbuildinfo`.
- Ignored dependency artifacts were left untouched: `node_modules/` and `example/node_modules/`.
- No generated native/example directories were left in the assigned worktree.
- Nested read-only explorers completed without edits.

Expected final `git status --short --ignored` after writing this report:

```text
?? worker-progress/worker-128-post-127-root-cause-audit.md
!! example/node_modules
!! node_modules
```

Goal finished.
