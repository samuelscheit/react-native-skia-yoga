# Summary

This was a report-only post-worker-137 root-cause audit. I changed only this report:

- `worker-progress/worker-138-post-137-root-cause-audit.md`

The post-worker-137 baseline is green under the required focused checks and the full 28-command feasible matrix. Worker 137's packed TypeScript and Reconciler JS-mode proof for dynamic nested `paragraphStyle.textStyle.color` and `fontSize` `SharedValue` leaves is present and covered by `check:package-typescript-consumer`, `check:reconciler-animated-bindings`, and `check:feasible-matrix`.

Selected next target: define and prove the outbound `ParagraphStyle::toJSI(...)` shape for nested `paragraphStyle.textStyle`, including the current text-style `heightMultiplier` collision/loss boundary. This is the strongest locally unblocked API-contract target now that static and dynamic nested paragraph input paths are proven.

# Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-138-post-137-root-cause-audit`
- Branch: `worker/138-post-137-root-cause-audit`
- Baseline commit reviewed: `8d0f99c Accept worker 137 and queue next audit`
- Prior integration commits reviewed:
  - `64b2c4b Merge worker 137 dynamic paragraph textStyle proof`
  - `7bc905b Add dynamic paragraph textStyle reconciler proof`
- Current git status before report writing: clean except ignored `node_modules/` and `example/node_modules/`.
- Feasible matrix baseline: passed all 28 commands in `4m 56s`.

Worker 137's proof is source-confirmed:

- `scripts/verify-package-typescript-consumer.mjs:347` and `:389` add `SharedValue<string>` / `SharedValue<number>` packed-consumer authoring for nested `paragraphStyle.textStyle.color` and `fontSize`.
- `scripts/verify-reconciler-animated-bindings.mjs:163` adds the nested color listener case and `:199` adds the nested fontSize listener case.
- `scripts/verify-reconciler-animated-bindings.mjs:274` reports the JS listener path now covers nested paragraph textStyle cases.
- `src/Reconciler.ts:116` includes `paragraphStyle` as a paragraph command prop, `src/Reconciler.ts:124` includes it as a nested traversal root, and `src/Reconciler.ts:495` recurses through nested animated values.

# Evidence Inspected

Required context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-135-nested-paragraph-textstyle-color.md`
- `worker-progress/worker-136-post-135-root-cause-audit.md`
- `worker-progress/worker-137-dynamic-paragraph-textstyle-reconciler.md`

Source and verifier files reviewed:

- `src/jsx.ts`
- `src/Reconciler.ts`
- `src/specs/commands.ts`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-feasible-matrix.mjs`
- `README.md`
- `example/types/skiayoga-typecheck.tsx`

Delegated read-only checks:

- `platform_feasibility_explorer` found no newly unblocked iOS or Android runtime path. It confirmed no committed `example/ios` or `example/android`, no CocoaPods, CLT-only Xcode, no working Java runtime, unset Android SDK env vars, and missing Android/Gradle/ADB tooling. This supports keeping platform runtime work separate from repo-owned proof/API targets.
- `text_contract_explorer` did not return findings before the report was ready and was closed as obsolete; it did not affect the ranking.

Local platform probes:

- `git ls-files example/ios example/android`: no tracked native example folders.
- `command -v pod`, `gradle`, `adb`, `cmake`, `ninja`: not found.
- `command -v java`: `/usr/bin/java`, but `java -version` failed with `Unable to locate a Java Runtime`.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`: unset.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.

# Verification Commands

- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in `4m 56s`.

Notable matrix evidence:

- `check:package-typescript-consumer` accepts static and dynamic nested `paragraphStyle.textStyle` CSS color/fontSize authoring from an installed tarball.
- `check:reconciler-animated-bindings` covers listener keys `paragraphStyle.textStyle.color` and `paragraphStyle.textStyle.fontSize`, rebuilds paragraph command payloads, invalidates, cleans up listeners, and ignores late emits.
- `check:yoganode-native-commands-render` proves nested paragraph input conversion/rendering but explicitly keeps nested `paragraphStyle.textStyle toJSI` shape preservation outside its proof boundary.
- `check:yoganode-nitro-materialization` proves generated materialized `setCommand(paragraph)` delivery with nested `paragraphStyle.textStyle` CSS color input, but does not claim command rendering or outbound serialization shape.
- Matrix cleanup removed generated `tsconfig.tsbuildinfo` and the matrix-owned temp parent; remaining new tracked artifacts after cleanup: none.

# Candidate Ranking

1. Define and prove nested `ParagraphStyle::toJSI(...)` outbound shape.

Evidence: the public paragraph type supports both flattened rich text-style fields and a nested `textStyle?: YogaTextStyle` object in `src/jsx.ts:54`. Native input now handles nested text style through `applyNestedParagraphStyleTextStyleOverlay(...)` in `cpp/JSIConverter+SkParagraphStyle.hpp:123`, then applies flattened fields later for precedence in `cpp/JSIConverter+SkParagraphStyle.hpp:221`. Outbound serialization still writes text-style fields directly onto the paragraph object in `cpp/JSIConverter+SkParagraphStyle.hpp:268`, and it passes `includeHeightMultiplier = false`, so text-style height is suppressed to avoid colliding with paragraph `heightMultiplier` from `cpp/JSIConverter+SkParagraphStyle.hpp:249`. Paragraph command serialization delegates to that converter in `cpp/JSIConverter+NodeCommand.hpp:546`. The verifier currently asserts flattened output in `scripts/verify-yoganode-native-commands-render.mjs:1281` and only proves nested input conversion at `scripts/verify-yoganode-native-commands-render.mjs:2233`. The same verifier names nested `paragraphStyle.textStyle toJSI` preservation as outside the proof boundary.

Impact is moderate but concrete: this is an API-contract asymmetry in the native converter and representative `NodeCommand::toJSI(...)` path, and it can lose nested text-style height intent on serialization. Evidence strength is high and the target is locally feasible through host-JSC/native verifier coverage. Overclaim risk is manageable if the next worker first defines the outbound contract and does not claim platform runtime behavior.

2. Document the simple `<text textStyle>` versus rich `<paragraph paragraphStyle>` split.

Evidence: worker 133 narrowed simple `<text textStyle>` authoring to `fontSize` and `color`, while rich text styling remains supported through paragraph styles. The packed consumer and native verifier prove this behavior, but `README.md:54` only shows the simple text path and does not explain the rich paragraph route. This is useful user-facing API hygiene, but it is lower root-cause value than the executable converter asymmetry above.

3. Add example-owned type/demo coverage for dynamic nested paragraph text style.

Evidence: packed-package TypeScript coverage proves dynamic nested paragraph authoring, but `example/types/skiayoga-typecheck.tsx:148` still exercises flattened dynamic `paragraphStyle.fontSize`, not nested dynamic `paragraphStyle.textStyle` leaves. This would improve example feedback, but it duplicates package/Reconciler proof that is already green.

4. Internal generated command type looseness and deep source publishing.

Evidence: `src/specs/commands.ts` remains transport/codegen-shaped and physically packed for codegen, but package `exports` and packed-consumer checks already reject representative `src/specs` deep imports. Public risk is currently low.

5. Broad fidelity gaps: unsupported `SkSamplingOptions.maxAniso`, every text/paragraph field, CSS string preservation, exact typography/shaping/render fidelity, image decoding/assets, and every dynamic command prop.

Evidence: current verifiers intentionally cover selected stable fields and normalize color strings to native values. These are real boundaries, but they are broader, higher-overclaim areas and less locally actionable than the specific paragraph serialization shape.

6. Platform-native build/run.

Evidence: Expo native generation and autolinking checks pass, but local iOS/Android app build/run remains blocked by missing full Xcode/CocoaPods and Android/Java tooling. Keep this on the external-prerequisite track until the local toolchain changes.

# Selected Next Target

Define and prove nested `ParagraphStyle::toJSI(...)` output shape preservation.

Recommended scope for the next worker:

- Decide the supported outbound contract before changing code: keep flattened-only, emit nested `textStyle`, or dual-emit nested `textStyle` while preserving flattened compatibility.
- If changing the contract, update `JSIConverter<skia::textlayout::ParagraphStyle>::toJSI(...)` and representative paragraph `NodeCommand::toJSI(...)` coverage together.
- Add direct converter proof for a paragraph style created from nested `paragraphStyle.textStyle` input, including `color`, `fontSize`, and a text-style `heightMultiplier` case that currently collides with paragraph `heightMultiplier`.
- Add paragraph `NodeCommand::toJSI(...)` / `fromJSI(...)` round-trip proof for the chosen shape.
- Preserve flattened-over-nested input precedence unless the API decision explicitly changes it.
- Keep simple `<text textStyle>` rich-key support out of scope; worker 133 intentionally closed that contract.

# Proof Boundary / Overclaim Risks

- Proven now: static nested paragraph CSS color input through packed TypeScript, direct native paragraph style conversion, paragraph command conversion/rendering, generated Nitro materialized `setCommand(paragraph)`, flattened-over-nested input precedence, and dynamic nested paragraph text-style Reconciler JS-mode listener behavior.
- Not proven now: nested `ParagraphStyle::toJSI(...)` shape preservation, CSS color string preservation after native normalization, UI-runtime Worklets execution, real Reanimated delivery, React Native bridge delivery, Nitro registry install inside a running RN app, platform-native app launch, simulator/device presentation, RNGH native delivery, image loading/decoding, exact typography/shaping, exact render fidelity, or platform-native build/run.
- Changing paragraph serialization can create compatibility risk if consumers or verifiers rely on flattened outbound fields. The next worker should define compatibility explicitly rather than silently switching shapes.
- A nested output shape can preserve text-style `heightMultiplier`, but it should not claim exact paragraph layout fidelity without render/platform proof.
- Platform-native work should not be promoted until CocoaPods/full Xcode and Android Java/SDK tooling are available locally.

# Cleanup Status

- No product source, package metadata, generated specs, examples, master planning docs, or dependency directories were edited.
- Ignored dependency directories were left untouched: `node_modules/` and `example/node_modules/`.
- The feasible matrix removed generated `tsconfig.tsbuildinfo` and its matrix-owned temp directory.
- Final intended tracked change: this report only.

# Recommended Next Tasks

- Assign an implementation/proof worker for the nested `ParagraphStyle::toJSI(...)` outbound shape target above.
- Keep documentation for the simple-text/rich-paragraph split as the next lower-risk API hygiene task if the serialization target is deferred.
- Keep platform-native build/run verification queued until local Xcode/CocoaPods and Android Java/SDK prerequisites are actually available.

Goal finished.
