# Summary

This was a report-only post-worker-139 root-cause audit. I changed only this report:

- `worker-progress/worker-140-post-139-root-cause-audit.md`

Post-worker-139 baseline is green under the required focused checks and the full 28-command feasible matrix. Worker 139's selected nested `ParagraphStyle::toJSI(...)` target is closed in current source: paragraph serialization now emits both flattened compatibility fields and a nested `textStyle` object, and the host-native command/render verifier proves distinct paragraph/text-style `heightMultiplier` round trips.

Selected next target: add user-facing README/API documentation for the simple `<text textStyle>` versus rich `<paragraph paragraphStyle>` split. This is now the strongest locally unblocked target because the executable package/native proof already enforces the split, but the README only demonstrates simple `<text>` and gives no corresponding rich paragraph styling guidance.

# Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-140-post-139-root-cause-audit`
- Branch: `worker/140-post-139-root-cause-audit`
- Baseline commit reviewed: `a484814 Accept worker 139 and queue next audit`
- Relevant integration commits reviewed:
  - `06f1f38 Merge worker 139 paragraph toJSI nested textStyle`
  - `0007900 Preserve nested paragraph textStyle toJSI shape`
- Initial git status before report writing: clean except ignored `node_modules/` and `example/node_modules/`.
- Feasible matrix baseline: passed all 28 commands in `4m 49s`.

Worker 139 closure is source-confirmed:

- `cpp/JSIConverter+SkParagraphStyle.hpp:289` creates the nested text-style object, `:291` writes it to `textStyle`, and `:293` still writes flattened compatibility text-style fields.
- `cpp/JSIConverter+SkParagraphStyle.hpp:138` through `:152` detects nested `textStyle.heightMultiplier`, and `:247` through `:251` prevents the flattened root `heightMultiplier` key from overwriting that nested text-style height.
- `scripts/verify-yoganode-native-commands-render.mjs:170` now reports nested paragraph text-style output and distinct paragraph/text-style height preservation in representative `NodeCommand` toJSI/fromJSI proof.
- `scripts/verify-yoganode-native-commands-render.mjs:1331` through `:1355` asserts root paragraph `heightMultiplier === 1.75` and nested `textStyle.heightMultiplier === 1.25`.
- `scripts/verify-yoganode-native-commands-render.mjs:178` no longer lists nested `paragraphStyle.textStyle toJSI` shape preservation as a missing boundary.

# Evidence Inspected

Required context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-138-post-137-root-cause-audit.md`
- `worker-progress/worker-139-paragraph-tojsi-nested-textstyle.md`

Relevant source, docs, and verifier files reviewed:

- `README.md`
- `src/jsx.ts`
- `src/Reconciler.ts`
- `src/specs/commands.ts`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-feasible-matrix.mjs`
- `example/types/skiayoga-typecheck.tsx`
- `example/app/(tabs)/animate.tsx`

Delegated read-only checks:

- `post139_api_contract_explorer` ranked README/API docs for the simple text versus rich paragraph split first. It cited `src/jsx.ts:52` / `:54`, native rich simple-text rejection in `cpp/JSIConverter+NodeCommand.hpp:340`, and README's simple-only usage snippet at `README.md:54`. It ranked example nested paragraph proof refresh second and style proof-boundary inventory third.
- `platform_runtime_blocker_explorer` found no newly unblocked platform-native path. It confirmed no tracked `example/ios` or `example/android`, no runnable native app markers, Command Line Tools-only Xcode, absent Android SDK/Gradle/ADB/CMake/Ninja tooling, unset `JAVA_HOME`, and no runnable Java runtime.

Local platform probes matched the platform explorer:

- `git ls-files example/ios example/android`: no tracked native example folders.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `java -version`: failed with `Unable to locate a Java Runtime`.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME`: unset.
- `command -v pod`, `gradle`, `adb`, `cmake`, and `ninja`: no local tool found in `PATH`.

# Verification Commands

- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in `4m 49s`.

Notable focused verifier evidence:

- `check:yoganode-native-commands-render` passed and printed dual flattened/nested paragraph `textStyle` output, distinct paragraph/text-style `heightMultiplier` preservation, nested paragraph CSS color conversion, flattened/nested unsupported `fontVariations` rejection, and rich simple `TextCmd` text-style rejection.
- `check:package-typescript-consumer` passed and printed that packed consumer TypeScript accepts simple `text.textStyle` `color`/`fontSize`, rejects rich simple-text fields, preserves rich paragraph styling, and accepts static plus dynamic nested `paragraphStyle.textStyle` CSS color/fontSize authoring.
- `check:feasible-matrix` passed all 28 commands, removed generated `tsconfig.tsbuildinfo`, removed its matrix temp parent, and left no remaining new tracked artifacts.

# Candidate Ranking

1. Document the simple `<text textStyle>` versus rich `<paragraph paragraphStyle>` split.

Evidence: `src/jsx.ts:52` defines `YogaSimpleTextStyle` as only `fontSize` and `color`; `src/jsx.ts:170` uses that simple shape for `<text>`. `src/jsx.ts:54` through `:57` keeps rich paragraph styling by combining `YogaTextStyle`, `SkParagraphStyle`, and nested `textStyle?: YogaTextStyle`; `src/jsx.ts:175` through `:177` exposes that rich paragraph shape. Native command conversion enforces the same split: `cpp/JSIConverter+NodeCommand.hpp:340` through `:351` rejects rich `text.textStyle` fields, and `:364` through `:383` lists the rejected rich keys. The README usage section only shows `<text textStyle={{ color, fontSize }}>` at `README.md:54` through `:60`; `rg -n "<paragraph|paragraphStyle" README.md` finds no paragraph styling guidance.

Impact is moderate and immediate: users following the package docs can discover simple text but not the supported rich paragraph path. Evidence strength is high because package TypeScript and native verifiers already prove the behavior. Local feasibility is high as a docs-only/API-contract clarification. Overclaim risk is low if the docs explicitly avoid promising rich `<text textStyle>` rendering.

2. Refresh example-owned nested paragraph type/demo coverage.

Evidence: packed consumer coverage already accepts dynamic nested `paragraphStyle.textStyle.color` and `fontSize` at `scripts/verify-package-typescript-consumer.mjs:347` through `:398`, and Reconciler JS-mode coverage exercises `paragraphStyle.textStyle.color` / `fontSize` at `scripts/verify-reconciler-animated-bindings.mjs:163` through `:235`. The example type fixture still uses flattened dynamic `paragraphStyle.fontSize` at `example/types/skiayoga-typecheck.tsx:148` through `:155`, and the animation demo still uses flattened `paragraphStyle.fontSize` at `example/app/(tabs)/animate.tsx:71` through `:79`.

This is locally feasible and would align the example feedback loop with the newer nested API, but it is lower impact than docs because package/Reconciler proof is already green and the example change would not prove real Reanimated UI-runtime delivery or platform rendering.

3. Style serializer field inventory / proof-boundary cleanup.

Evidence: `src/jsx.ts:38` exposes broad rich `YogaTextStyle` fields, `cpp/JSIConverter+SkTextStyle.hpp:193` through `:230` serializes many selected text-style fields, and `cpp/JSIConverter+SkParagraphStyle.hpp:259` through `:297` serializes selected paragraph and strut fields. The native verifier still intentionally frames coverage as selected and excludes every-field proof, CSS color string preservation, exact typography, font fallback correctness, and paragraph shaping fidelity at `scripts/verify-yoganode-native-commands-render.mjs:178`.

This is useful as an audit or proof-boundary clarification, but it is broader and has higher overclaim risk than the docs target. It should not become an implementation pass unless a concrete public field mismatch is selected.

4. Unsupported `SkSamplingOptions` anisotropy / broader sampling fidelity.

Evidence: `cpp/JSIConverter+SkSamplingOptions.hpp:26` through `:45` serializes only cubic `{ B, C }` or `{ filter, mipmap }`, and `scripts/verify-yoganode-native-commands-render.mjs:178` excludes unsupported `SkSamplingOptions maxAniso` preservation. Current RN Skia TypeScript `SamplingOptions` is only `CubicResampler | FilterOptions`, and package types keep nested sampling leaves opaque, so this is lower current public-contract risk.

5. Rich simple `TextCmd` text-style rendering.

Evidence: native rejection at `cpp/JSIConverter+NodeCommand.hpp:340` through `:388` and package negative coverage at `scripts/verify-package-typescript-consumer.mjs:405` through `:428` intentionally close this as unsupported. Implementing richer simple text rendering would be a feature expansion, not a current contract fix.

6. Platform-native iOS/Android build/run.

Evidence: the feasible matrix verifies generated native project creation and autolinking, but local native app build/run remains blocked by missing full Xcode/CocoaPods and Android Java/SDK/Gradle/ADB tooling. Keep this separate until the local toolchain changes.

# Selected Next Target

Add README/API documentation for the simple `<text textStyle>` versus rich `<paragraph paragraphStyle>` split.

Recommended scope for the next worker:

- Update README usage/API docs to state that `<text textStyle>` is intentionally simple and supports the fields the simple `TextCmd` renders today: `fontSize` and `color`.
- Add a rich paragraph example using `<paragraph text="..." paragraphStyle={...}>` with either flattened rich paragraph fields and/or nested `paragraphStyle.textStyle`.
- Mention that rich paragraph styling is the supported path for fields such as `fontFamilies`, `fontFeatures`, `fontStyle`, `letterSpacing`, decorations, shadows, locale, and height behavior.
- Preserve the unsupported `fontVariations` boundary and do not imply variable-font support.
- Keep runtime/platform claims out of the docs unless a platform-native run is separately proven.
- Run at least `git diff --check`, `npm run check:package-typescript-consumer`, and `npm run check:feasible-matrix` if docs examples include compile-checked snippets or package-facing contract wording. A docs-only patch can use focused syntax/status checks if no executable examples are changed, but the package TypeScript verifier is the strongest local guard for this API wording.

Why this target is strongest now:

- It directly follows workers 131 through 139: the package/native behavior is no longer ambiguous, but the public README has not caught up.
- It has high evidence strength and very low local feasibility risk.
- It reduces user-facing API misuse without reopening intentionally closed unsupported simple-text fields.
- It has lower overclaim risk than broad text/paragraph fidelity or platform runtime work.

# Proof Boundary / Overclaim Risks

- Proven now: simple `<text textStyle>` public authoring is limited to `fontSize` and `color`; rich simple text-style fields are rejected in packed TypeScript and native text command conversion; rich paragraph styling remains available through flattened `paragraphStyle` fields and nested `paragraphStyle.textStyle`; nested paragraph CSS color/fontSize authoring works statically and dynamically in package/Reconciler proof; nested `ParagraphStyle::toJSI(...)` dual output preserves distinct paragraph/text-style heights; current local feasible matrix passes.
- Not proven now: platform-native app build/run, CocoaPods install, Gradle build, simulator/device launch, native platform presentation, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual native bridge delivery, RNGH native delivery, CSS color string preservation after native normalization, exact typography/shaping, font fallback correctness, exact render fidelity, image asset loading/decoding, texture-backed images, unsupported `SkSamplingOptions` anisotropy, every rich text/paragraph style field, variable-font support, or rich simple `TextCmd` text-style rendering.
- Documentation must not suggest that `<text textStyle>` accepts or renders rich fields unless a future worker expands `TextCmd` rendering and proof.
- Example/demo refresh should not claim UI-runtime animation proof; current dynamic nested paragraph proof is package TypeScript plus Node VM Reconciler listener behavior.
- Platform-native build/run should remain on the external-prerequisite track until full Xcode/CocoaPods and Android Java/SDK tooling are available locally.

# Cleanup Status

- No product source, package metadata, generated specs, examples, README docs, master planning docs, or dependency directories were edited.
- Ignored dependency directories were left untouched: `node_modules/` and `example/node_modules/`.
- The feasible matrix removed its generated `tsconfig.tsbuildinfo` and matrix temp parent.
- Final intended tracked change: this report only.
- Final pre-commit worktree state: clean except ignored `node_modules/` and `example/node_modules/`.

# Recommended Next Tasks

- Assign a docs/API worker for the simple text versus rich paragraph README target above.
- Optionally follow with a small example-owned nested paragraph text-style refresh after the docs target, if the orchestrator wants the example fixtures to mirror the current recommended API shape.
- Keep style/sampling every-field fidelity as audit-only until a concrete public mismatch is selected.
- Keep platform-native build/run verification queued until local iOS and Android toolchain prerequisites are actually available.

Goal finished.
