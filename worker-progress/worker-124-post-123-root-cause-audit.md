# Summary

This was a report-only post-worker-123 audit. I changed only this report:

- `worker-progress/worker-124-post-123-root-cause-audit.md`

No product source, verifier script, package metadata, generated Nitro output, README, master planning/progress file, dependency tree, or prior worker report was edited.

Worker 123 closed its intended local boundary without overclaiming. The current source and verifier support bounded additional `TextStyle` `toJSI(...)` serialization for paint-backed `backgroundColor`/`foregroundColor`, decoration fields, `fontStyle`, non-empty `shadows`, and `textBaseline`, plus representative direct converter and `NodeCommand` round-trip proof. The report correctly excludes CSS string preservation, full `fontFeatures`, paint-ID serialization, exact typography/render fidelity, app runtime, bridge delivery, and platform build/run.

Selected next target: add bounded `TextStyle.fontFeatures` `toJSI(...)` serialization, with direct `TextStyle`, representative `text.textStyle`, and flattened `paragraph.paragraphStyle` round-trip proof. This is the strongest remaining local target because `fontFeatures` is a public-shaped `TextStyle` field already parsed by `fromJSI(...)` and still dropped by `toJSI(...)`.

# Context Reviewed

Repository context:

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-124-post-123-root-cause-audit`
- Branch: `worker/124-post-123-root-cause-audit`
- Recent commits reviewed: `c4bd620 Add bounded TextStyle toJSI serialization`, `e3228fe Merge worker 123 TextStyle toJSI serialization`, `9e17086 Accept worker 123 and queue next audit`.

Required planning/progress context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-119-value-bearing-style-tojsi.md`
- `worker-progress/worker-120-post-119-root-cause-audit.md`
- `worker-progress/worker-121-canonical-antialias-style.md`
- `worker-progress/worker-122-post-121-root-cause-audit.md`
- `worker-progress/worker-123-textstyle-tojsi-serialization.md`

Worker-123 and adjacent surfaces reviewed:

- `cpp/JSIConverter+SkTextStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/NodeCommand.hpp`
- `src/jsx.ts`
- `src/Reconciler.ts`
- `src/specs/commands.ts`
- `src/specs/style.ts`
- `package.json`
- `index.d.ts`
- `src/index.ts`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-package-surface.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`

# Worker 123 Acceptance Boundary

Accepted source boundary:

- `cpp/JSIConverter+SkTextStyle.hpp` now serializes `backgroundColor` and `foregroundColor` only when `TextStyle` stores an `SkPaint`, avoiding a false public color value for paint IDs.
- The shared `writeTextStylePublicFieldsToJSI(...)` path emits the worker-119 fields plus `backgroundColor`, `foregroundColor`, `decoration`, `decorationColor`, `decorationThickness`, `decorationStyle`, `fontStyle`, non-empty `shadows`, and `textBaseline`.
- `applyTextStyle(...)` already parsed these fields, so worker 123 closes a real parse/serialize asymmetry for selected public text-style values.
- `cpp/JSIConverter+SkParagraphStyle.hpp` reuses the same text-style serializer for flattened paragraph default text style with `includeHeightMultiplier = false`, so paragraph serialization inherits the expanded text-style fields without claiming independent flattened text height preservation.
- `cpp/JSIConverter+NodeCommand.hpp` delegates `text.textStyle` and `paragraph.paragraphStyle` serialization through the same converters.

Accepted verifier boundary:

- `scripts/verify-yoganode-native-commands-render.mjs` asserts direct `TextStyle` `fromJSI(...) -> toJSI(...) -> fromJSI(...)` behavior for the expanded selected fields.
- The same verifier asserts representative `NodeCommand` `text.textStyle` and flattened `paragraph.paragraphStyle` serialized payload shape and round-trip behavior.
- The verifier logs the bounded proof boundary and still excludes unsupported `SkSamplingOptions.maxAniso`, every `SkTextStyle`/`SkParagraphStyle` field, CSS color string preservation, exact typography, shaping, render fidelity, Nitro materialization, bridge delivery, and platform app execution.

Decision:

- Worker 123 should be accepted within its stated host-JSC/native proof boundary.
- I found no overclaim in the worker report. The report explicitly limits colors to normalized numeric SkColors, excludes paint IDs, and leaves `fontFeatures` for future bounded work.

# Verification

Commands run before writing this report:

- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-feasible-matrix.mjs`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
- `git diff --check`: passed again after the matrix.

Feasible matrix evidence:

- Total command duration: `4m 45s`.
- `/usr/bin/time` real duration: `284.81s`.
- `check:yoganode-native-commands-render` passed and reported selected value-bearing serialization for `SkTextStyle fontSize/color/fontFamilies/backgroundColor/foregroundColor/decoration fields/fontStyle/heightMultiplier/halfLeading/letterSpacing/wordSpacing/locale/shadows/textBaseline` and `SkParagraphStyle` selected fields plus flattened default text style fields.
- `check:yoganode-nitro-materialization` passed and preserved the existing materialized generated-wrapper boundary for selected command/style cases.
- `check:package-typescript-consumer` passed and preserved packed public entrypoint, dynamic command prop, canonical `style.antiAlias`, legacy `style.antiaAlias`, opaque `image.sampling`, and package export-boundary evidence.
- `bun run specs`, root `typecheck`, `lint-ci`, example typecheck, example bundle export, and isolated example native generation all passed inside the matrix.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining new tracked artifacts, and removed `/tmp/rnskia-feasible-matrix-ohIRSN`.

Warnings observed:

- npm repeatedly printed the existing `Unknown user config "minimum-release-age"` and `Unknown env config "minimum-release-age"` warnings.
- Expo export printed the existing bytecode advisory.
- Expo native generation printed the existing Android `EDGE_TO_EDGE_PLUGIN` warning about `edgeToEdgeEnabled`.

# Remaining Gaps Ranked

1. Bounded `TextStyle.fontFeatures` `toJSI(...)` serialization.

Classification: strongest locally unblocked product-source converter target.

Evidence: `src/jsx.ts` exposes `YogaTextStyle` from RN Skia `SkTextStyle` with color-related overrides only, so `fontFeatures` remains part of the public text-style authoring surface. `cpp/JSIConverter+SkTextStyle.hpp` parses `fontFeatures` by resetting and adding named feature values, but the current serializer still does not emit `fontFeatures`. Worker 123 explicitly deferred it.

Why it ranks first: it is the narrowest remaining TextStyle parse/serialize asymmetry after worker 123. It can be proven in the existing host-JSC/native command/render verifier with direct `TextStyle`, `text.textStyle`, and flattened `paragraph.paragraphStyle` round trips, without changing TypeScript or generated specs.

2. Additional `ParagraphStyle` scalar controls and bounded `strutStyle` serialization.

Classification: locally unblocked but broader and more collision-prone.

Evidence: `cpp/JSIConverter+SkParagraphStyle.hpp` delegates parsing to RN Skia paragraph-style conversion, then serializes only `textAlign`, bounded `maxLines`, paragraph `heightMultiplier`, `ellipsis`, and flattened default text-style fields. Worker 120/122 already identified omitted paragraph controls such as text direction, text height behavior, disable hinting, replace-tab behavior, and `strutStyle`.

Why below candidate 1: this should be split carefully after `fontFeatures`, because paragraph output mixes paragraph fields with flattened text-style fields and already has a known flat `heightMultiplier` ambiguity.

3. Sampling API gaps, especially `SkSamplingOptions::maxAniso`.

Classification: not selected until the public/parser contract changes.

Evidence: `cpp/JSIConverter+SkSamplingOptions.hpp` emits parser-compatible `{ B, C }` or `{ filter, mipmap }`. Worker 119 and the current verifier intentionally exclude `maxAniso`, and public `image.sampling` is treated as an opaque RN Skia `SamplingOptions` value in `src/jsx.ts`.

Why below candidate 1: supporting anisotropy is an API/parser decision, not just a missing serializer field.

4. Public TypeScript/API drift around dynamic values and package exports.

Classification: currently guarded; no stronger local drift surfaced.

Evidence: `src/jsx.ts` keeps `SamplingOptions` opaque while explicitly accepting whole `SharedValue<SamplingOptions>` on `image.sampling`; `scripts/verify-package-typescript-consumer.mjs` accepts that public shape and rejects nested sampling leaves. Package exports remain limited to root, JSX runtime subpaths, and package metadata while `src/specs` stays physically packed for codegen.

Why below candidate 1: the public authoring checks are green, and changing nested sampling support would expand the API rather than close a current supported-path mismatch.

5. Generated/materialized Nitro coverage for expanded text-style fields.

Classification: useful verifier breadth, lower root-cause value.

Evidence: `check:yoganode-nitro-materialization` already exercises generated `setCommand(text)` and `setCommand(paragraph)` wrappers with selected text/paragraph style state, but it does not specifically assert the worker-123 expanded style fields through materialized generated wrappers.

Why below candidate 1: generated wrapper delivery for text/paragraph is already covered at a representative level; the remaining `fontFeatures` converter data loss is a more concrete product-source gap.

6. Native/package verifier boundary hardening beyond the matrix.

Classification: lower priority unless a specific blind spot appears.

Evidence: the 28-command matrix covers package surface/lifecycle/codegen/autolinking, packed TypeScript consumer behavior, source-level runtime stubs, host-native YogaNode/runtime/view probes, command/render probes, Nitro materialization, specs regeneration, typecheck, lint, example bundle export, and isolated example native generation.

Why below candidate 1: broadening verification without a concrete defect is weaker than closing a known accepted-field serialization loss.

7. Platform-native build/run, real RN bridge delivery, Nitro registry install inside an app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image asset loading, and exact render/typography fidelity.

Classification: high-value but still blocked or overclaim-prone locally.

Evidence: current planning/progress and verifier outputs still exclude CocoaPods install, Gradle build, simulator/device launch, native app runtime, real RN bridge delivery, Nitro registry install inside a running RN app, UI-runtime Worklets execution, Reanimated delivery, RNGH native delivery, image loading/decoding, texture-backed images, exact typography, and exact render fidelity.

Why below candidate 1: this environment still cannot close those proofs honestly.

# Selected Next Target

Select exactly one next implementation target:

> Add bounded `TextStyle.fontFeatures` `toJSI(...)` serialization and prove direct plus representative command round trips.

Likely implementation files:

- `cpp/JSIConverter+SkTextStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- Next worker report

Suggested implementation shape:

- Serialize `fontFeatures` as public-shaped `{ name, value }` objects, matching the existing `applyTextStyle(...)` parser.
- Keep the field omitted when no font features are present.
- Reuse the shared text-style serializer so flattened `ParagraphStyle::toJSI(...)` inherits the same bounded field.
- Do not broaden TypeScript contracts or generated specs unless the implementation discovers a real public-shape mismatch.

Recommended verification commands:

- `git diff --check`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization` only if generated materialized assertions are expanded
- `npm run check:feasible-matrix`

# Proof Boundary And Overclaim Risks

Accepted worker-123 proof boundary:

- Host-JSC/native converter behavior for selected `TextStyle` fields.
- Representative `NodeCommand` serialization symmetry for `text.textStyle`.
- Flattened `paragraph.paragraphStyle` reuse through `ParagraphStyle::toJSI(...)`.
- Feasible local package/source/example matrix remains green.

Do not claim from this audit:

- Full `TextStyle` or `ParagraphStyle` parity.
- CSS color string preservation.
- `TextStyle` paint-ID serialization.
- `fontFeatures` serialization.
- `strutStyle` serialization.
- `SkSamplingOptions.maxAniso` preservation.
- Full iOS or Android build/run.
- Simulator/device execution.
- Native platform presentation.
- Real React Native bridge delivery.
- Nitro registry install inside a running app.
- UI-runtime Worklets execution or real Reanimated SharedValue delivery.
- RNGH native delivery.
- Image asset loading/decoding, local/remote asset resolution, or texture-backed image behavior.
- Exact render fidelity, exact typography, font fallback correctness, glyph geometry, or paragraph shaping fidelity.

Overclaim risks for the selected next target:

- `fontFeatures` should only be claimed for the public `{ name, value }` shape that `applyTextStyle(...)` already accepts.
- Getter compatibility across the supported Skia header set should be confirmed by the host-native verifier compile, not assumed from type names.
- Flattened paragraph proof should remain a reuse proof, not a full paragraph-style parity claim.

# Cleanup And Status

Cleanup/status evidence before writing this report:

- `git diff --check`: passed.
- `git diff --stat`: no output.
- `git status --short --ignored` before this report showed only ignored dependency trees:
  - `!! example/node_modules`
  - `!! node_modules`
- The feasible matrix removed its temporary parent and newly created `tsconfig.tsbuildinfo`.
- Ignored dependency artifacts were left untouched: `node_modules/` and `example/node_modules/`.
- No generated native/example directories were left in the assigned worktree by this audit; native generation ran in isolated temporary workspaces.

Final `git status --short --ignored` after writing this report:

```text
?? worker-progress/worker-124-post-123-root-cause-audit.md
!! example/node_modules
!! node_modules
```

Goal finished.
