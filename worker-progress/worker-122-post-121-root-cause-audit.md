# Worker 122 - Post-121 Root-Cause Audit

## Summary

This was a report-only audit of the post-worker-121 state. I changed only this report:

- `worker-progress/worker-122-post-121-root-cause-audit.md`

No product source, verifier script, package metadata, generated Nitro output, README, master planning/progress file, dependency tree, or prior worker report was edited.

Worker 121 closed its intended local proof boundary without overclaiming. The current source and verifiers support canonical public `style.antiAlias`, deprecated `style.antiaAlias` fallback, canonical precedence, generated `NodeStyle` transport, host-native `SkPaint::setAntiAlias(...)` state, and materialized generated `YogaNode.setStyle(...)` delivery. The report correctly excludes full iOS/Android build/run, simulator/device presentation, real RN bridge delivery, Nitro registry install inside an app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading, exact typography, and exact render fidelity.

The strongest locally unblocked next target is bounded additional `TextStyle` `toJSI(...)` serialization for currently parsed but still unserialized public text-style fields, with direct converter and `NodeCommand` round-trip coverage in the host-native command/render verifier.

## Context Reviewed

Repository context:

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-122-post-121-root-cause-audit`
- Branch: `worker/122-post-121-root-cause-audit`
- HEAD: `ff153f1 Accept worker 121 and queue next audit`
- Recent integration commits reviewed: `9a82fde Add canonical antiAlias style support`, `34708e9 Merge worker 121 canonical antiAlias style support`, `ff153f1 Accept worker 121 and queue next audit`.

Required planning/progress context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-118-post-117-root-cause-audit.md`
- `worker-progress/worker-119-value-bearing-style-tojsi.md`
- `worker-progress/worker-120-post-119-root-cause-audit.md`
- `worker-progress/worker-121-canonical-antialias-style.md`

Required worker-121 surfaces reviewed:

- `src/specs/style.ts`
- `nitrogen/generated/shared/c++/NodeStyle.hpp`
- `cpp/YogaNode.cpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `example/app/(tabs)/styles/paint-demos.tsx`

Additional local backlog surfaces sampled for ranking:

- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `src/jsx.ts`
- `src/Reconciler.ts`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `scripts/verify-feasible-matrix.mjs`
- `package.json`

## Worker 121 Acceptance Boundary

Accepted source boundary:

- `src/specs/style.ts` now exposes canonical `antiAlias?: boolean` and keeps `antiaAlias?: boolean` with a deprecation note.
- `nitrogen/generated/shared/c++/NodeStyle.hpp` carries both `std::optional<bool> antiAlias` and `std::optional<bool> antiaAlias`, and the generated converter reads/writes both JS keys.
- `cpp/YogaNode.cpp` resolves `style.antiAlias` first and falls back to `style.antiaAlias`, then applies the resolved value after `backgroundColor` materialization. This is the important native ordering fix because a `SkPaint` background assignment replaces `_paint`.
- `example/app/(tabs)/styles/paint-demos.tsx` uses the canonical `antiAlias` spelling in the public demo fixture.

Accepted verifier boundary:

- `scripts/verify-package-typescript-consumer.mjs` proves packed TypeScript consumers can author inline `style={{ antiAlias: false }}` and that legacy `YogaNodeStyle` still accepts `antiaAlias`.
- `scripts/verify-yoganode-native-commands-render.mjs` proves generated `NodeStyle` conversion for canonical, legacy, and both-key payloads; canonical serialization under `antiAlias`; legacy serialization under `antiaAlias`; canonical native precedence; and canonical application after `SkPaint` background assignment.
- `scripts/verify-yoganode-nitro-materialization.mjs` proves materialized generated `setStyle(width/height/antiAlias)` populates native `NodeStyle.antiAlias`, does not populate the legacy field for canonical input, and updates `_paint.isAntiAlias()`.

Decision:

- Worker 121 should be accepted within its stated local boundary.
- I found no evidence that the worker overclaimed platform presentation, real app runtime, RN bridge delivery, UI-runtime Worklets/Reanimated delivery, image loading, exact anti-aliased pixel equivalence, or broader paint-style parity.
- The remaining risk is compatibility debt, not an acceptance blocker: the deprecated `antiaAlias` alias intentionally remains in public/generated type surfaces, and generated C++ does not carry the TypeScript deprecation metadata.

## Verification

Commands run before writing this report:

- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 31s.
- `git diff --check`: passed again after the matrix.

Notable matrix evidence:

- `check:package-typescript-consumer` passed and reported canonical `style.antiAlias` authoring, legacy `style.antiaAlias` type compatibility, opaque `image.sampling` nested-leaf rejection, public root/JSX runtime imports, and representative `src/specs` deep-import rejection.
- `check:yoganode-native-commands-render` passed and reported generated `NodeStyle` transport plus host-native `SkPaint` state for canonical `antiAlias`, legacy `antiaAlias`, and canonical precedence. It also preserved the current proof boundary for selected value-bearing sampling/text/paragraph serialization only.
- `check:yoganode-nitro-materialization` passed and reported materialized generated `setStyle(width/height/antiAlias)` delivery to native `NodeStyle` and `SkPaint`.
- `bun run specs`, root `typecheck`, `lint-ci`, example typecheck, package surface/lifecycle/codegen/autolinking checks, example bundle export, and temp-workspace example native generation all passed inside the matrix.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`, left no remaining new tracked artifacts, and removed `/tmp/rnskia-feasible-matrix-FR9LPg`.

Warnings observed:

- npm repeatedly printed the existing `Unknown user config "minimum-release-age"` and `Unknown env config "minimum-release-age"` warnings.
- Expo export printed the existing bytecode advisory.
- Expo native generation printed the existing Android `EDGE_TO_EDGE_PLUGIN` warning about `edgeToEdgeEnabled`.

## Remaining Gaps Ranked

1. Bounded additional `TextStyle` `toJSI(...)` serialization.

Classification: strongest locally unblocked product-source converter target.

Evidence: `cpp/JSIConverter+SkTextStyle.hpp` parses additional public-shaped fields that worker 119 did not serialize: `backgroundColor`, `decoration`, `decorationColor`, `decorationThickness`, `decorationStyle`, `fontFeatures`, `fontStyle`, `foregroundColor`, `shadows`, and `textBaseline`. Current `toJSI(...)` emits only the selected worker-119 subset through `writeTextStylePublicFieldsToJSI(...)`: `fontSize`, numeric `color`, `fontFamilies`, conditional `heightMultiplier`, `halfLeading`, `letterSpacing`, `wordSpacing`, and `locale`.

Why it ranks first: worker 121 closed the stronger public `antiAlias` mismatch. This text-style target is now the clearest remaining local root-cause gap where the native converter accepts meaningful values but loses them during serialization. It is directly testable in the existing host-JSC/native command/render verifier without platform tooling.

Expected proof shape: add field-by-field serialization for a stable bounded subset, then prove direct `JSIConverter<TextStyle>::toJSI(...) -> fromJSI(...)` and representative `NodeCommand` `text.textStyle` / flattened `paragraph.paragraphStyle` round trips. Keep CSS string preservation out of scope because parsed strings normalize to numeric colors.

2. Additional `ParagraphStyle` controls and bounded `strutStyle` serialization.

Classification: locally unblocked but broader and more collision-prone than candidate 1.

Evidence: `cpp/JSIConverter+SkParagraphStyle.hpp` serializes selected paragraph controls and flattened default text-style fields, while RN Skia parsing can accept more paragraph controls such as text direction, text height behavior, disable hinting, replace-tab behavior, and strut-style-shaped values. Paragraph style also has the existing flat `heightMultiplier` key collision risk between paragraph height and flattened text-style height.

Why below candidate 1: it should be split carefully after the simpler text-style slice, because paragraph serialization has more public-shape and flattened-field ambiguity.

3. `SkSamplingOptions::maxAniso` or sampling API expansion.

Classification: not selected until the public/parser contract changes.

Evidence: current `SkSamplingOptions::toJSI(...)` serializes parser-compatible `{ B, C }` or `{ filter, mipmap }` shapes. Worker 119 and the current command/render verifier intentionally exclude `maxAniso` because the accepted public parser shape does not support it.

Why below candidate 1: adding anisotropy would require an explicit JS API and RN Skia parser decision before serialization. The existing supported sampling shapes are already covered.

4. Nested `image.sampling.filter` / `sampling.mipmap` SharedValue leaves or generic `YogaDeepAnimated<T>` union cleanup.

Classification: public TypeScript/API drift candidate, but currently not a bug against the documented contract.

Evidence: `src/jsx.ts` keeps `SamplingOptions` opaque and specifically widens `YogaImageProps.sampling` to allow a whole `SharedValue<SamplingOptions>`. `scripts/verify-package-typescript-consumer.mjs` intentionally rejects nested sampling SharedValue leaves, while `scripts/verify-reconciler-animated-bindings.mjs` covers the top-level opaque listener path.

Why below candidate 1: changing this would expand the public API rather than close a mismatch in a supported typed path. Prior helper-level changes risked regressions in other nested dynamic command props.

5. Native/package verifier boundary hardening beyond current matrix.

Classification: useful but lower priority unless a concrete blind spot is found.

Evidence: the matrix now covers package surface, lifecycle, installed-package TypeScript, RN codegen/autolinking, example bundle/native generation, source-level JS runtimes, host-native runtime paths, host-native command/render paths, and Nitro materialization. I did not find a stronger current package/public-boundary failure than the remaining converter serialization gaps.

Why below candidate 1: existing verifiers are green and targeted; adding broader verifier breadth without a known defect would be weaker than closing a concrete unserialized converter field set.

6. Generated/materialized Nitro command/style coverage breadth.

Classification: mostly covered for current high-value command/style cases; incremental expansion remains possible.

Evidence: `check:yoganode-nitro-materialization` now exercises materialized `setCommand(...)` breadth, `getChildren()` identity/prototype behavior, generated/raw method execution, generated `setStyle(width/height/antiAlias)`, and native `SkPaint` antiAlias side effects. Remaining gaps are real-app delivery and exact rendering, not local materialized wrapper coverage.

Why below candidate 1: no stronger locally unblocked materialized style/command mismatch surfaced during this audit.

7. Platform-native build/run, RN bridge delivery, Nitro registry install inside an app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image asset loading, and exact render/typography fidelity.

Classification: high value but blocked or overclaim-prone locally.

Evidence: the current matrix and reports still exclude CocoaPods install, Gradle build, simulator/device launch, native app runtime, real RN bridge delivery, Nitro registry install inside a running RN app, UI-runtime Worklets execution, Reanimated delivery, RNGH native delivery, image asset loading/decoding, texture-backed images, exact typography, and exact render fidelity. Prior platform audits documented missing full Xcode selection/CocoaPods/Java/Android SDK or build tools for honest local proof.

Why below candidate 1: these are important product confidence gaps, but this environment still cannot close them honestly.

## Selected Next Target

Select exactly one next implementation target:

> Add bounded additional `TextStyle` `toJSI(...)` serialization for currently parsed but unserialized public text-style fields.

Likely implementation files:

- `cpp/JSIConverter+SkTextStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- Possibly `cpp/JSIConverter+SkParagraphStyle.hpp` only to reuse the expanded text-style serializer through flattened paragraph default text-style serialization.
- Next worker report.

Suggested first field slice:

- Numeric or normalized-color `backgroundColor`, `foregroundColor`, and `decorationColor`.
- Numeric `decoration`, `decorationStyle`, `decorationThickness`, and `textBaseline`.
- Numeric `fontStyle` weight/width/slant.
- A bounded `shadows` array if stable getters are available.
- Defer `fontFeatures` unless the installed Skia API exposes a stable getter with public-shaped output.

Recommended verification commands:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`
- `git diff --check`

Optional checks if the implementation touches TypeScript, generated specs, examples, or package boundaries:

- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:package-typescript-consumer`
- `bun run specs`

## Proof Boundary And Overclaim Risks

Accepted proof boundary for worker 121:

- Public packed TypeScript authoring for canonical `style.antiAlias`.
- Deprecated legacy `style.antiaAlias` type compatibility.
- Generated C++ `NodeStyle` transport for both fields.
- Host-native `YogaNode::setStyle(...)` `SkPaint::setAntiAlias(...)` state for canonical, legacy fallback, canonical precedence, and background `SkPaint` ordering.
- Host-JSC Nitro materialized generated `setStyle(...)` delivery to native `NodeStyle.antiAlias` and `SkPaint` state.

Do not claim from this audit:

- Full iOS or Android build/run.
- Simulator/device execution.
- Native platform presentation.
- Real React Native bridge delivery.
- Nitro registry install inside a running app.
- UI-runtime Worklets execution or real Reanimated SharedValue delivery.
- RNGH native delivery.
- Image asset loading/decoding, local/remote asset resolution, or texture-backed image behavior.
- Exact anti-aliased pixel equivalence, exact render fidelity, exact typography, font fallback correctness, glyph geometry, or paragraph shaping fidelity.
- Broad paint-style parity beyond the anti-alias flag.

Overclaim risks for the selected next target:

- Serializing CSS color strings as strings would overclaim round-trip preservation; current parsing normalizes them to numeric color values.
- Flattened paragraph text-style serialization should not imply independent paragraph and text-style `heightMultiplier` preservation unless explicitly proven.
- Only fields with stable public JS shapes and stable Skia getters should be serialized.
- The host-native verifier can prove converter and representative command round trips, but it still will not prove real RN bridge delivery, platform rendering, exact typography, or exact visual fidelity.

## Cleanup And Status

Pre-report cleanup/status evidence:

- `git status --short --ignored` before writing this report showed only ignored dependency trees:
  - `!! example/node_modules`
  - `!! node_modules`
- `git diff --stat` before writing this report showed no product or verifier diffs.
- `git diff --check` passed before and after the feasible matrix.
- The feasible matrix removed its own temporary parent and newly created `tsconfig.tsbuildinfo`.
- Ignored dependency artifacts were left untouched: `node_modules/` and `example/node_modules/`.
- No generated native/example directories were created or left in the assigned worktree by this audit. The matrix used isolated temporary workspaces for native generation and removed them.

Final `git status --short --ignored` after writing this report:

```text
?? worker-progress/worker-122-post-121-root-cause-audit.md
!! example/node_modules
!! node_modules
```

Goal finished.
