# Summary

This was a report-only post-worker-135 root-cause audit. I changed only this report:

- `worker-progress/worker-136-post-135-root-cause-audit.md`

The current post-worker-135 baseline is green under the required focused checks and the full 28-command feasible matrix. Worker 135's nested `paragraphStyle.textStyle.color` CSS parsing fix is present across package TypeScript authoring, host-native paragraph command/render coverage, and generated Nitro materialized `setCommand(paragraph)` proof.

Selected next target: add source-level Reconciler and packed TypeScript proof for dynamic nested `paragraphStyle.textStyle` authoring, especially `paragraphStyle.textStyle.color` / `fontSize` `SharedValue` leaves. Worker 135 proved static nested values through native and Nitro paths, but the current Reconciler animated-binding verifier still has no paragraph/text-style nested case even though the public paragraph style type allows deep animated values.

# Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-136-post-135-root-cause-audit`
- Branch: `worker/136-post-135-root-cause-audit`
- Baseline commit reviewed: `3046f88 Accept worker 135 and queue next audit`
- Prior integration commits reviewed:
  - `ccc1f1a Merge worker 135 nested paragraph textStyle color`
  - `212bd81 Fix nested paragraph textStyle color parsing`
- Current git status before report writing: clean.
- Feasible matrix baseline: passed all 28 commands in `5m 12s`.

Worker 135's fix is source-confirmed:

- `cpp/JSIConverter+SkParagraphStyle.hpp:82` builds a sanitized base paragraph object without nested `textStyle` before delegating to RN Skia.
- `cpp/JSIConverter+SkParagraphStyle.hpp:123` applies nested `paragraphStyle.textStyle` through the local CSS-capable `applyTextStyle(...)`.
- `cpp/JSIConverter+SkParagraphStyle.hpp:221` applies flattened paragraph text-style fields after the nested overlay, preserving flattened-over-nested precedence.
- `scripts/verify-package-typescript-consumer.mjs:376` accepts public nested paragraph CSS color/fontSize authoring.
- `scripts/verify-yoganode-native-commands-render.mjs:3833` proves nested CSS color paragraph command conversion, measure, and bounded green raster evidence.
- `scripts/verify-yoganode-nitro-materialization.mjs:927` and `:1448` prove generated materialized `setCommand(paragraph)` delivery for a nested `paragraphStyle.textStyle.color` payload.

# Evidence Inspected

Required context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-132-post-131-root-cause-audit.md`
- `worker-progress/worker-133-simple-textstyle-contract.md`
- `worker-progress/worker-134-post-133-root-cause-audit.md`
- `worker-progress/worker-135-nested-paragraph-textstyle-color.md`

Source and verifier files reviewed:

- `src/jsx.ts`
- `src/Reconciler.ts`
- `src/specs/commands.ts`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-feasible-matrix.mjs`

Delegated read-only checks:

- `paragraph_shape_explorer` confirmed that nested paragraph text-style input is now parsed but `ParagraphStyle::toJSI(...)` still serializes text-style fields flattened onto the paragraph object. It also noted that text-style `heightMultiplier` is suppressed during paragraph serialization to avoid a paragraph/text height key collision. The explorer recommended not ranking this first unless the next worker is explicitly scoped to define the public `toJSI` shape contract.
- `remaining_gap_explorer` did not return before the report was ready and was closed as obsolete; it made no findings that affected this conclusion.

Local platform toolchain probes:

- `git ls-files example/ios example/android`: no tracked native example folders.
- `command -v pod`: not found.
- `command -v gradle`: not found.
- `command -v adb`: not found.
- `command -v cmake`: not found.
- `command -v ninja`: not found.
- `command -v java`: `/usr/bin/java`.
- `printenv ANDROID_HOME` and `printenv ANDROID_SDK_ROOT`: unset.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: blocked because active developer directory is Command Line Tools, not full Xcode.

# Verification Commands

- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in `5m 12s`.

Notable matrix evidence:

- `check:package-typescript-consumer` still accepts simple `<text textStyle={{ color, fontSize }}>`, rejects rich simple-text fields, preserves rich paragraph styling, and accepts nested `paragraphStyle.textStyle` CSS color/fontSize authoring.
- `check:reconciler-animated-bindings` passes, but its JS command listener coverage is still limited to `circle.radius`, `group.rasterize`, `image.sampling`, `line.from.x`, `path.stroke.miter_limit`, and `points.points.0.x`; no paragraph or nested text-style path is covered.
- `check:yoganode-native-commands-render` still proves nested paragraph CSS color conversion/rendering and explicitly lists nested `paragraphStyle.textStyle toJSI` preservation, JS listener scheduling, Reanimated delivery, and UI-runtime Worklets execution outside its proof boundary.
- `check:yoganode-nitro-materialization` still proves generated materialized `setCommand(paragraph)` for nested `paragraphStyle.textStyle.color`.
- Matrix cleanup removed the generated `tsconfig.tsbuildinfo` and the matrix-owned temp parent; remaining new tracked artifacts after cleanup: none.

# Candidate Ranking

1. Reconciler/package proof for dynamic nested `paragraphStyle.textStyle` values.

Evidence: public `YogaAnimatedParagraphStyleProps` maps every `YogaParagraphStyle` key through `YogaDeepAnimated` in `src/jsx.ts:139`, and `YogaParagraphStyle.textStyle` is rich/nested in `src/jsx.ts:54`. `src/Reconciler.ts:124` includes `paragraphStyle` and `textStyle` as nested command roots, and `bindAnimatedValues(...)` recursively traverses nested values under those roots. Current proof does not exercise the newly fixed nested paragraph text-style surface through the Reconciler JS listener path: `scripts/verify-reconciler-animated-bindings.mjs:56` lists JS command listener cases, but none use `paragraph.paragraphStyle.textStyle.color` or `fontSize`. This is locally unblocked, likely verifier-only if the source behavior already works, and directly follows worker 135's fixed surface.

2. Define and prove nested `ParagraphStyle::toJSI` output shape.

Evidence: `ParagraphStyle::fromJSI(...)` accepts nested `paragraphStyle.textStyle`, but `ParagraphStyle::toJSI(...)` calls `writeTextStylePublicFieldsToJSI(...)` on the paragraph object itself in `cpp/JSIConverter+SkParagraphStyle.hpp:268`. Paragraph command serialization delegates to that converter at `cpp/JSIConverter+NodeCommand.hpp:546`, and the verifier asserts flattened output at `scripts/verify-yoganode-native-commands-render.mjs:1281`. This is real but needs an API decision: keep flattened output, emit nested output, or dual-emit while preserving existing flattened compatibility.

3. Document the simple text versus rich paragraph style split.

Evidence: worker 133 narrowed simple `<text textStyle>` to `fontSize` and `color`, while rich text-style fields remain supported through paragraph styles. The package and native behavior is proven, but README/API docs may still benefit from explicitly naming this split. This is useful but lower root-cause value than executable proof for the new nested paragraph path.

4. Internal generated command type looseness.

Evidence: `src/specs/commands.ts` still uses raw RN Skia `SkTextStyle` / `SkParagraphStyle` custom types for Nitro transport, but `package.json` exports and packed-consumer checks reject representative `src/specs` deep imports. This remains a lower public-risk internal/codegen boundary.

5. Unsupported or unproven full style fidelity, including `SkSamplingOptions.maxAniso`, every text/paragraph field, exact typography, and CSS string round-trip preservation.

Evidence: existing native verifiers intentionally cover selected stable fields and normalize colors to native values. These are broader fidelity or non-public-parser questions, not the strongest next local target.

6. Platform-native build/run.

Evidence: Expo native generation still passes, but full iOS/Android build/run remains locally blocked by missing CocoaPods, missing full Xcode selection, missing Gradle/ADB/CMake/Ninja, and unset Android SDK environment variables. Keep this separate until the local toolchain changes.

# Selected Next Target

Add proof for dynamic nested `paragraphStyle.textStyle` authoring and Reconciler JS-mode command updates.

Recommended scope for the next worker:

- Add packed-consumer TypeScript positive coverage for nested paragraph text-style dynamic leaves, for example `paragraphStyle={{ textStyle: { color: sharedColor, fontSize: sharedFontSize } }}` where the shared values are `SharedValue<string>` and `SharedValue<number>`.
- Add a `scripts/verify-reconciler-animated-bindings.mjs` JS command listener case for `paragraph.paragraphStyle.textStyle.color` and/or `fontSize`.
- Assert listener key registration, `runOnJS` delivery, rebuilt paragraph command payload shape, invalidation, cleanup behavior, and ignored late emits using the existing Node VM Reconciler harness.
- Keep the proof boundary explicit: this should prove source-level Reconciler listener behavior, not real UI-runtime Worklets execution, real Reanimated delivery, native bridge delivery, C++ conversion, or rendering.
- Run at least `node --check scripts/verify-package-typescript-consumer.mjs`, `node --check scripts/verify-reconciler-animated-bindings.mjs`, `npm run check:package-typescript-consumer`, `npm run check:reconciler-animated-bindings`, and `npm run check:feasible-matrix`.

If the new verifier fails, fix the Reconciler traversal/update root cause. If it passes without source changes, the proof itself is still valuable because it closes the local evidence gap left after worker 135.

# Proof Boundary / Overclaim Risks

- Proven now: static nested paragraph CSS color authoring from packed TypeScript, native paragraph style conversion, paragraph command conversion/rendering, generated Nitro materialized `setCommand(paragraph)`, and flattened-over-nested paragraph text-style precedence.
- Not proven now: Reconciler JS listener updates for nested `paragraphStyle.textStyle` leaves, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, React Native bridge delivery, Nitro module registry install inside a running RN app, platform-native app launch, simulator/device presentation, RNGH native delivery, image loading/decoding, exact typography/shaping, exact render fidelity, CSS color string preservation, or nested paragraph text-style `toJSI` shape preservation.
- The selected target should not claim C++ conversion or render behavior; worker 135 and the current native verifier already own that boundary for static nested CSS color values.
- The nested `toJSI` shape asymmetry is real, but changing it without a public API decision could break or complicate the current flattened serialization contract.
- Platform-native build/run should not be promoted until CocoaPods/full Xcode and Android build tooling are available locally.

# Cleanup Status

- No product source, tests, package metadata, generated artifacts, master planning docs, or dependency directories were edited.
- Ignored dependency directories were left untouched.
- The feasible matrix removed its generated `tsconfig.tsbuildinfo` and matrix-owned temp directory.
- Final intended tracked change: this report only.

# Recommended Next Tasks

- Assign a proof worker for dynamic nested `paragraphStyle.textStyle` package/Reconciler coverage as described above.
- Treat nested `ParagraphStyle::toJSI` shape preservation as a separate API-contract decision, with direct converter and paragraph `NodeCommand::toJSI` proof if selected later.
- Keep platform-native build/run verification queued until the local Xcode/CocoaPods and Android toolchain blockers are resolved.

Goal finished.
