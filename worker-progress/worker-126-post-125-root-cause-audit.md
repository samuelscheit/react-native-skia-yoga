# Summary

This was a report-only post-worker-125 audit. I changed only this report:

- `worker-progress/worker-126-post-125-root-cause-audit.md`

No product source, verifier script, generated Nitro output, package metadata, dependency tree, `MASTER_PLAN.md`, or `MASTER_PROGRESS.md` was edited.

The post-worker-125 baseline is green. Worker 125's accepted `TextStyle.fontFeatures` proof is reflected in current source and verifier output: `fontFeatures` now serializes as public-shaped `{ name, value }` entries, is omitted when empty, and is covered through direct `TextStyle`, representative `text.textStyle`, and flattened `paragraph.paragraphStyle` round trips.

Selected next target for worker 127: add bounded `ParagraphStyle` scalar `toJSI(...)` serialization for `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`, with direct converter and representative `paragraph.paragraphStyle` `NodeCommand` round-trip proof.

# Baseline Verification

Worktree:

- `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-126-post-125-root-cause-audit`
- Branch: `worker/126-post-125-root-cause-audit`
- HEAD at audit: `872aa46 Accept worker 125 and queue next audit`

Commands run:

- `git diff --check`: passed before report writing.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in `4m 42s`.
- `git diff --check`: passed again after the matrix.

Feasible matrix evidence:

- `check:yoganode-native-commands-render` passed and reported selected value-bearing `SkSamplingOptions`, `SkTextStyle` including `fontFeatures`, and selected `SkParagraphStyle` serialization fields.
- `check:yoganode-nitro-materialization` passed and preserved host-JSC `YogaNode::toObject(...)`, generated wrapper, and `getChildren()` materialization proof.
- Package codegen/autolinking, packed TypeScript consumer, package surface/lifecycle, RN codegen schema, lazy-init, Reconciler animated bindings, gesture/lifecycle runtimes, RN Skia import guard, Android archive guard, host-native lifetime/runtime/hit-testing, raw methods, RNSkYogaView runtime, root typecheck, lint, example typecheck, specs generation, example bundle export, and isolated example native generation all passed.
- Matrix cleanup removed its temporary parent `/tmp/rnskia-feasible-matrix-pknHNy` and the generated `tsconfig.tsbuildinfo`; remaining new tracked artifacts after cleanup: none.

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
- No `example/ios`, `example/android`, or `example/.expo` directories were left in the assigned worktree.

# Current Proof Surface

Recent accepted scope:

- Worker 119 added selected value-bearing `SkSamplingOptions`, `TextStyle`, and `ParagraphStyle` serialization.
- Worker 121 fixed canonical public `style.antiAlias`, preserved legacy `style.antiaAlias`, and proved generated/native `SkPaint` anti-alias state.
- Worker 123 expanded `TextStyle` serialization for paint-backed foreground/background colors, decoration fields, `fontStyle`, `shadows`, and `textBaseline`.
- Worker 125 added bounded `TextStyle.fontFeatures` serialization and direct plus command round-trip proof.

Current source/verifier surface:

- `cpp/JSIConverter+SkSamplingOptions.hpp` emits parser-compatible `{ B, C }` or `{ filter, mipmap }`; `maxAniso` remains outside the accepted public/parser contract.
- `cpp/JSIConverter+SkTextStyle.hpp` now serializes the parsed public-shaped fields handled by local `applyTextStyle(...)`, including `fontFeatures`.
- `cpp/JSIConverter+SkParagraphStyle.hpp` still emits only `textAlign`, bounded `maxLines`, paragraph `heightMultiplier`, `ellipsis`, and flattened default text-style fields.
- RN Skia `JsiSkParagraphStyle::fromValue(...)` parses additional paragraph fields: `disableHinting`, `replaceTabCharacters`, `textDirection`, `textHeightBehavior`, `strutStyle`, and nested `textStyle`.
- `scripts/verify-yoganode-native-commands-render.mjs` proves selected direct converter and representative `NodeCommand` round trips, but its proof boundary still excludes every `SkParagraphStyle` field.
- `scripts/verify-yoganode-nitro-materialization.mjs` proves generated `setCommand(text)` and `setCommand(paragraph)` wrapper delivery with basic font size/color state, not the expanded rich text/paragraph style field set.

Delegated read-only checks:

- `style_converter_gap_audit` independently ranked `ParagraphStyle` scalar serialization first and called out `strutStyle` as a follow-up with a `fontFamilies` parser caveat.
- `command_nitro_gap_audit` independently ranked `ParagraphStyle` serialization breadth first, then public `fontVariations` typing/native support drift, then richer generated-wrapper materialization coverage.

# Candidate Next Targets

1. Bounded `ParagraphStyle` scalar `toJSI(...)` serialization.

Classification: strongest locally unblocked product-source converter target.

Evidence: public `YogaParagraphStyle` includes RN Skia paragraph controls; RN Skia native parsing accepts `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`; Skia exposes getters for the resulting state; local `ParagraphStyle::toJSI(...)` currently omits them.

Why it ranks first: it is the narrowest remaining parsed-but-unserialized paragraph gap after workers 119/123/125. It is adjacent to the current proof surface, low blast radius, and directly provable in the existing host-JSC/native command/render verifier.

2. Bounded `ParagraphStyle.strutStyle` serialization.

Classification: locally actionable but broader.

Evidence: public `SkParagraphStyle` exposes `strutStyle`, RN Skia parsing accepts it, and Skia exposes strut getters. Local `toJSI(...)` emits no `strutStyle` today.

Why below candidate 1: RN Skia's native `JsiSkStrutStyle` reads `fontFamilies` but does not call `setFontFamilies(...)`, so full `strutStyle.fontFamilies` round-trip needs a local parser overlay or an upstream/parser decision. The scalar paragraph fields avoid that ambiguity.

3. Public `fontVariations` typing versus native support.

Classification: public TypeScript/native behavior gap, but not a parsed-but-unserialized field.

Evidence: `YogaTextStyle` inherits RN Skia `SkTextStyle`, which includes `fontVariations`, while local `applyTextStyle(...)` and RN Skia native `JsiSkTextStyle` do not parse it. Worker 125 closed `fontFeatures`, not `fontVariations`.

Why below candidate 1: fixing this requires a policy choice: narrow the public Yoga text style type with packed-consumer negatives, or implement bounded native `SkFontArguments` support. That is higher blast radius than paragraph scalar serialization.

4. Rich text/paragraph style coverage in Nitro materialization.

Classification: verifier breadth target.

Evidence: command/render verifies expanded style converters, but `check:yoganode-nitro-materialization` still uses only basic `fontSize` and CSS color payloads for generated `setCommand(text/paragraph)`.

Why below candidate 1: useful proof hardening, but it does not close a product-source data-loss gap on its own.

5. Nested `ParagraphStyle.textStyle` shape preservation.

Classification: real shape asymmetry, but collision-prone.

Evidence: RN Skia parses nested `textStyle`; local `ParagraphStyle::toJSI(...)` emits flattened text-style fields and suppresses flattened text-style `heightMultiplier` to avoid colliding with paragraph `heightMultiplier`.

Why below candidate 1: the package intentionally supports flattened paragraph styles, and nested style preservation needs an explicit shape decision.

6. Platform-native app runtime, bridge delivery, Nitro registry install inside an app, UI-runtime Worklets/Reanimated, image loading, exact typography, and render fidelity.

Classification: high value but locally blocked or overclaim-prone.

Evidence: current local prerequisites still block honest iOS/Android app build/run proof, and the feasible matrix explicitly excludes these runtime/fidelity claims.

# Selected Next Target

Select exactly one next implementation target:

> Add bounded `ParagraphStyle` scalar `toJSI(...)` serialization for `disableHinting`, `replaceTabCharacters`, `textDirection`, and `textHeightBehavior`.

Expected implementation shape:

- Extend `cpp/JSIConverter+SkParagraphStyle.hpp` to emit public-shaped scalar paragraph controls from Skia getter state.
- Keep existing `textAlign`, `maxLines`, paragraph `heightMultiplier`, `ellipsis`, and flattened default text-style output intact.
- Do not include `strutStyle` in the same first slice unless the worker also handles the `fontFamilies` parser caveat explicitly.
- Do not change TypeScript contracts, generated Nitro specs, examples, or package metadata unless a real public-shape mismatch is discovered.

# Expected Files And Verification For Worker 127

Likely files:

- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-127-paragraphstyle-scalar-tojsi.md`

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
- Worker 125's `fontFeatures` serialization is covered by the current command/render verifier and full matrix.
- The next selected target is locally unblocked and grounded in a concrete parsed-but-unserialized `ParagraphStyle` scalar field set.

The selected worker-127 target should prove only:

- Host-JSC/native `ParagraphStyle::toJSI(...) -> fromJSI(...)` preservation for the selected scalar fields.
- Representative `NodeCommand` `paragraph.paragraphStyle` `toJSI(...) -> fromJSI(...)` preservation for those fields.
- Existing selected text-style flattening behavior remains intact.

Do not claim:

- Full `TextStyle` or `ParagraphStyle` parity.
- `strutStyle` parity unless implemented and proven separately.
- Nested `paragraphStyle.textStyle` shape preservation unless explicitly designed and tested.
- CSS color string preservation.
- `SkSamplingOptions.maxAniso` preservation.
- Exact typography, glyph shaping, font fallback, paragraph shaping, or render fidelity.
- iOS/Android build/run, simulator/device launch, native platform presentation, real React Native bridge delivery, Nitro registry install inside a running app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading/decoding, asset resolution, texture-backed images, or exact image fidelity.

# Risks And Follow-Up

- `disableHinting` is a negative public field backed by positive native getter state (`hintingIsOn()`), so serialization should be explicit about default and non-default behavior.
- Some paragraph scalar fields may not expose "was explicitly set" bits; emitting current native values should be documented as state serialization, not authored-intent preservation.
- `strutStyle` remains a good follow-up after scalar fields, but `fontFamilies` needs special care because RN Skia's current native parser appears not to store parsed strut families.
- Public `fontVariations` remains a separate public TypeScript/native support question; do not mix it into the paragraph scalar target.
- Richer Nitro materialization assertions can follow once product converter state is complete enough to be worth proving through generated wrappers.

# Cleanup And Status

Cleanup notes:

- This audit changed only `worker-progress/worker-126-post-125-root-cause-audit.md`.
- The feasible matrix removed its matrix-owned temporary parent and generated `tsconfig.tsbuildinfo`.
- Ignored dependency artifacts were left untouched: `node_modules/` and `example/node_modules/`.
- No generated native/example directories were left in the assigned worktree.
- Nested read-only explorers were closed after completion.

Final `git status --short --ignored`:

```text
?? worker-progress/worker-126-post-125-root-cause-audit.md
!! example/node_modules
!! node_modules
```

Goal finished.
