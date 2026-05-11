# Worker 150 - Post-worker-149 root-cause audit

## Summary

This was a report-only post-worker-149 audit. I accept Worker 149's
`style.layer` / `_layerPaint` proof within its stated local boundary: generated
`NodeStyle.layer` accepts a real `JsiSkPaint`, `NodeStyle::toJSI(...)` emits a
paint host object, `YogaNode::setStyle(...)` stores and resets `_layerPaint`
separately from ordinary `_paint`, materialized generated `setStyle(layer)`
delivers the paint, packed TypeScript consumers can author static
`style.layer`, and bounded raster evidence proves layer alpha modulates a child
subtree through `saveLayer(...)`.

The strongest remaining locally unblocked target is focused proof for dynamic
public style delivery, centered on `style.layer` / opaque paint-style
`SharedValue` authoring. The public JSX style type accepts `SharedValue` for
every style key, including `layer`, but the packed consumer currently proves
static `Skia.Paint()` layer authoring only, and the Reconciler animated-style
verifier exercises a transform leaf rather than top-level opaque style values or
`style.layer`.

## Changed files

- `worker-progress/worker-150-post-149-root-cause-audit.md`

## Evidence gathered

- Reviewed `WORKER_BRIEF.md`, `MASTER_PLAN.md`, `MASTER_PROGRESS.md`, and recent
  worker reports `worker-145` through `worker-149`.
- Reviewed current source and verifier boundaries in `src/jsx.ts`,
  `src/Reconciler.ts`, `src/specs/style.ts`, `cpp/YogaNode.cpp`,
  `cpp/YogaNode.hpp`, `nitrogen/generated/shared/c++/NodeStyle.hpp`,
  `scripts/verify-yoganode-native-commands-render.mjs`,
  `scripts/verify-yoganode-nitro-materialization.mjs`,
  `scripts/verify-package-typescript-consumer.mjs`, and
  `scripts/verify-reconciler-animated-bindings.mjs`.
- Confirmed `src/specs/style.ts` exposes 80 public `NodeStyle` fields and
  `layer?: SkColorNative`; `SkColorNative` is a Nitro custom type over RN Skia
  `SkPaint`.
- Confirmed `src/jsx.ts` defines `YogaAnimatedStyleObject` so each
  `YogaNodeStyle` key accepts `YogaAnimatedProp<...>`, which includes
  `SharedValue<T>`.
- Confirmed `scripts/verify-package-typescript-consumer.mjs` proves static
  `style: { layer: Skia.Paint(), opacity: 0.9 }`, but does not prove
  `SharedValue<SkPaint>` or whole `SharedValue<YogaNodeStyle>` authoring.
- Confirmed `scripts/verify-reconciler-animated-bindings.mjs` proves the current
  source-level animated-style listener path with `transform.0.translateX` plus
  continuous-redraw toggling for object `matrix`, but does not exercise
  `style.layer`, opaque style values, or whole-style `SharedValue` updates.
- Confirmed `scripts/verify-yoganode-nitro-materialization.mjs` now proves
  materialized generated `setStyle(width/height/antiAlias/layer)` and
  `backgroundColor` string separation from `_layerPaint`, but still does not
  prove materialized generated delivery for Worker 147's remaining paint fields
  such as `borderWidth`, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`,
  `opacity`, and `blendMode`.
- Confirmed the example style showcase has a type-level all-style-property
  coverage sentinel and includes a `layer: Skia.Paint()` paint demo.
- Nested explorer `post149_gap_scan` accepted Worker 149's proof boundary and
  independently ranked dynamic `style.layer` / opaque paint-style `SharedValue`
  proof as the strongest next target.
- Nested explorer `style_materialization_breadth_scan` challenged that ranking
  and selected materialized generated `setStyle(...)` paint-field breadth. I
  rank that second because direct native paint-field behavior is already proved,
  while the public dynamic style API path remains unproved.

## Commands run/results

- `git status --short --branch`: clean on
  `worker/150-post-149-root-cause-audit` before report edits.
- `git diff --check`: passed before report edits.
- `npm run check:feasible-matrix`: passed all 28 commands; total command
  duration `5m 17s`; removed `tsconfig.tsbuildinfo`; removed matrix temp parent
  `/tmp/rnskia-feasible-matrix-Mtt0L4`; remaining new tracked artifacts: none.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed; current output proves
  static `style.layer` `Skia.Paint()` authoring and representative dynamic
  command props, not dynamic style-layer authoring.
- `npm run check:reconciler-animated-bindings`: passed; current output proves
  source-level animated command paths and a representative animated style leaf,
  not `style.layer` or opaque style values.
- Focused NodeStyle proof-surface probe: public `NodeStyle` field count is 80;
  current materialized style proof text does not mention most fields, including
  the recent paint-field set listed above.
- Platform blocker probe: `xcode-select -p` returned
  `/Library/Developer/CommandLineTools`; `xcodebuild -version` requires full
  Xcode; `xcrun --sdk iphonesimulator --show-sdk-path` cannot locate the
  simulator SDK; Java is unavailable; `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and
  `JAVA_HOME` are unset; `pod`, `gradle`, `adb`, `cmake`, `ninja`, `sdkmanager`,
  and `emulator` are absent from `PATH`.
- Cleanup probes found no repo-local `.tgz`, `tsconfig.tsbuildinfo`, or
  `rnskia-*` artifacts, and no matching verifier temp roots under `/tmp` or
  `node:os.tmpdir()`.

## Accepted post-149 proof surface

- Generated direct `NodeStyle.layer` transport from a real RN Skia
  `JsiSkPaint` host object is accepted.
- `NodeStyle::toJSI(...)` layer paint round-trip with alpha/blend state is
  accepted.
- `YogaNode::setStyle(...)` storage/reset of `_layerPaint` and separation from
  ordinary `_paint` are accepted.
- Bounded `saveLayer(...)` alpha raster evidence over a simple child subtree is
  accepted.
- Materialized generated `YogaNode.setStyle(layer)` delivery is accepted.
- Packed TypeScript static authoring of `style.layer: Skia.Paint()` is accepted.

This does not widen Worker 149 into proof of dynamic style authoring,
Reconciler delivery, React Native bridge delivery, Nitro registry install inside
a running app, UI-runtime Worklets/Reanimated behavior, platform-native app
runtime, exact GPU blend fidelity, or broad `NodeStyle` completeness.

## Remaining gaps considered

- Dynamic public style delivery: public JSX types accept `SharedValue` style
  values, including `style.layer`; current packed consumer and Reconciler proof
  do not focus on `style.layer`, opaque `SkPaint` values, or whole-style
  `SharedValue<YogaNodeStyle>`.
- Materialized generated `setStyle(...)` breadth for paint fields:
  `check:yoganode-native-commands-render` proves direct native paint-field
  behavior, but `check:yoganode-nitro-materialization` does not yet send the
  full recent paint-field set through the generated JS-facing materialized
  wrapper.
- Broad `NodeStyle` inventory/drift proof: useful for future changes, but a
  broader proof pass is weaker than a focused supported public path.
- Example/API contract: the example has all-style-property type coverage and a
  layer demo. README remains intentionally high-level; no stronger doc drift was
  found than the dynamic style proof gap.
- Platform-native app build/run: still locally blocked by toolchain
  prerequisites, not a repo-owned source task in this worker checkout.
- Exact rendering, typography, image loading/decoding, texture-backed image
  behavior, true RN bridge delivery, Nitro registry install inside a running RN
  app, UI-runtime Worklets, Reanimated delivery, and RNGH native delivery remain
  outside the current feasible local proof surface.

## Ranked next candidates

1. Dynamic `style.layer` / opaque style `SharedValue` public source-path proof.
   This is the strongest target because Worker 149 closed static/native layer
   behavior, while the public animated style contract still lacks focused
   packed-consumer and Reconciler evidence for the same layer value class.
2. Materialized generated `setStyle(...)` paint-field breadth. Strong and
   locally actionable; lower than candidate 1 because direct native behavior for
   the paint fields is already proved, while dynamic public style delivery is
   still unproved.
3. Broad `NodeStyle` field inventory and generated-wrapper breadth. Useful drift
   prevention, but too broad for the next slot without a more specific
   user-facing path.
4. Platform-native iOS/Android build/run. High value, but blocked locally by
   missing Xcode/CocoaPods/Java/Android SDK/build-tool prerequisites.
5. Exact render/fidelity and real app runtime proof. Important long term, but
   overclaim-prone and not locally available at the same confidence level.
6. Rich simple `<text textStyle>` styling or other feature expansion. Still an
   intentional unsupported boundary, not cleanup.

## Selected next target for Worker 151

Assign Worker 151 to add bounded proof for dynamic public style delivery,
centered on `style.layer` / opaque paint-style `SharedValue` authoring.

Recommended scope:

- Extend `scripts/verify-package-typescript-consumer.mjs` with packed-consumer
  TypeScript fixtures for `SharedValue<SkPaint>` `style.layer` authoring and,
  if practical, whole `SharedValue<YogaNodeStyle>` authoring.
- Extend `scripts/verify-reconciler-animated-bindings.mjs` with source-level
  Reconciler cases proving top-level style `layer` `SharedValue` snapshots,
  listener updates, `setStyle(getResolvedStyle(...))`, invalidation, cleanup,
  and no native command mirror creation.
- Include a scalar paint-style companion such as `opacity` only if it clarifies
  the opaque-value behavior without broadening the target.
- Touch `src/Reconciler.ts` or `src/jsx.ts` only if the new proof exposes a real
  public contract or runtime-source failure.

Recommended commands:

- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-reconciler-animated-bindings.mjs`
- `npm run check:package-typescript-consumer`
- `npm run check:reconciler-animated-bindings`
- `npm run check:feasible-matrix`
- `git diff --check`

Out of scope:

- Native C++ conversion/render proof for the dynamic update itself.
- `saveLayer(...)` raster proof beyond the existing static layer evidence.
- Actual RN bridge delivery, Nitro registry install in a running RN app,
  UI-runtime Worklets/Reanimated delivery, platform app build/run, simulator or
  device launch, exact GPU blend fidelity, and broad `NodeStyle` completeness.

## Proof boundary/overclaim risks

- Worker 149 should be described as proving static host-JSC/native layer
  transport, materialized wrapper delivery, and bounded raster behavior, not
  dynamic style delivery.
- `check:reconciler-animated-bindings` is a Node VM source-level verifier with
  stubs. Even after Worker 151, it should not be used to claim real UI-runtime
  Worklets, Reanimated, bridge, Nitro registry, or platform app behavior.
- Packed TypeScript dynamic style authoring would prove the public type
  boundary only; it would not execute a real `Skia.Paint()` SharedValue in an
  app.
- Materialized `setStyle(...)` paint-field breadth remains useful follow-up work
  and should not be implied by dynamic style proof.
- Platform-native blockers should not be converted into product-source claims
  until the required local tools are actually available.

## Cleanup status

No product, source, verifier, generated, dependency, or example files were
edited. The only tracked change is this report. The feasible matrix cleaned up
its generated build-info artifact and matrix-owned temp parent. Final status
before writing this report showed only ignored `node_modules` and
`example/node_modules`; cleanup probes found no verifier-owned leftover
artifacts.

## Recommended next tasks

- Worker 151: implement the selected dynamic `style.layer` / opaque style
  `SharedValue` proof target.
- After that, rerank materialized generated `setStyle(...)` breadth for the
  remaining public paint fields against broader `NodeStyle` inventory work.
- Keep platform-native build/run queued until full Xcode/CocoaPods and
  Java/Android SDK tooling are available locally.

Goal finished.
