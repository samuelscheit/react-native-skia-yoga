# Worker 148 - Post-worker-147 root-cause audit

## Summary

This was a report-only post-worker-147 audit. I accept Worker 147's fixed
`YogaNode::setStyle(...)` paint-ordering behavior within its stated local
host-native proof boundary: `backgroundColor` supplied as `SkPaint` now
establishes the base paint before explicit public paint fields override stroke
width, stroke cap/join/miter, dither, antiAlias, opacity, and blendMode.

The strongest remaining locally unblocked target is bounded `style.layer` /
`_layerPaint` API and render proof. `layer` is public, example-demonstrated, and
render-affecting through `canvas->saveLayer(...)`, but Worker 147 explicitly
kept layer paint outside scope and the current feasible matrix does not prove
generated `NodeStyle.layer` delivery or layer render behavior.

## Changed files

- `worker-progress/worker-148-post-147-root-cause-audit.md`

## Evidence gathered

- Reviewed `WORKER_BRIEF.md`, `MASTER_PLAN.md`, `MASTER_PROGRESS.md`, and recent
  worker reports `worker-145`, `worker-146`, and `worker-147`.
- `cpp/YogaNode.cpp` now handles `style.backgroundColor` before border and
  paint-style fields, then applies `borderWidth`, `strokeCap`, `strokeJoin`,
  `strokeMiter`, `dither`, `antiAlias`, `opacity`, and `blendMode`.
- `scripts/verify-yoganode-native-commands-render.mjs` includes a direct
  host-native `NodeStyle` assertion for SkPaint-backed background plus explicit
  paint-field precedence.
- `scripts/verify-yoganode-nitro-materialization.mjs` still limits generated
  JS-facing `setStyle(...)` side-effect proof to `width`, `height`, and
  `antiAlias`; it does not mention `backgroundColor`, `borderWidth`,
  `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`, `opacity`, or
  `blendMode`.
- A focused source probe found 80 public `NodeStyle` fields, no fields missing
  from generated `NodeStyle.hpp`, and no fields missing textual use in
  `YogaNode.cpp`.
- `style.layer` is public in `src/specs/style.ts`, generated as optional
  `SkPaint`, demonstrated in `example/app/(tabs)/styles/paint-demos.tsx`, reset
  and assigned to `_layerPaint` in `YogaNode::setStyle(...)`, and used by
  `drawInternal()` via `canvas->saveLayer(...)`.
- Nested explorer `post147_gap_scan` independently selected `style.layer` proof
  as the strongest locally unblocked target and found no source-confirmed layer
  bug before proof is added.

## Commands run/results

- Initial `git status --short --branch`: clean on
  `worker/148-post-147-root-cause-audit`.
- `git diff --check`: passed before and after report edits.
- `npm run check:feasible-matrix`: passed all 28 commands in 5m 19s; removed
  `tsconfig.tsbuildinfo`, removed the matrix temp parent, and left no remaining
  new tracked artifacts.
- Focused NodeStyle probe:
  `NodeStyle public fields: 80`; missing generated fields: none; missing
  `YogaNode.cpp` textual references: none; Nitro materialization generated
  `setStyle(...)` proof mentions `backgroundColor`: false; paint fields present
  in that materialization proof: none.
- Platform blocker probe: active developer directory is
  `/Library/Developer/CommandLineTools`; `xcodebuild` requires full Xcode;
  `xcrun --sdk iphonesimulator --show-sdk-path` cannot locate the simulator SDK;
  Java is unavailable; `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` are
  unset; `pod`, `gradle`, `adb`, `cmake`, `ninja`, `sdkmanager`, and `emulator`
  are absent from `PATH`.

## Accepted post-147 proof surface

- Product source: accepted. The paint-ordering fix is present in
  `cpp/YogaNode.cpp` and establishes `backgroundColor` as the base paint before
  explicit public paint fields are applied.
- Host-native proof: accepted. `check:yoganode-native-commands-render` compiles
  and links the real native source and asserts the SkPaint-backed background
  precedence behavior directly.
- Feasible matrix: accepted. The full current 28-command matrix passes in this
  worker checkout.
- Proof boundary: bounded. The explicit paint-field precedence assertion is a
  host-native `YogaNode::setStyle(...)` proof, not full platform presentation,
  exact render fidelity, or broad generated/materialized `setStyle(...)` proof
  for every public style field.

## Remaining gaps considered

- `style.layer` / `_layerPaint`: public, example-demonstrated, render-affecting,
  and explicitly excluded by Worker 147. No current proof asserts generated
  transport or saveLayer raster effect.
- Generated/materialized `setStyle(...)` breadth for Worker 147 paint fields:
  current materialization proof covers `width`, `height`, and `antiAlias`, while
  Worker 147's new direct precedence proof uses a native `NodeStyle` object.
- Broader public `NodeStyle` inventory/proof: public fields are generated and
  source-referenced, but there is no RN-Skia-style explicit bucketed inventory
  for local style proof depth.
- Platform-native app build/run: still locally blocked by missing Xcode,
  CocoaPods, Java, Android SDK, and Android build tools; not a repo-owned source
  task until prerequisites change.
- UI-runtime Worklets/Reanimated delivery, actual React Native bridge delivery,
  image asset loading/decoding, texture-backed images, exact typography,
  paragraph shaping, and exact render fidelity remain outside current local
  proof.
- Rich simple `<text textStyle>` styling remains intentionally unsupported and
  documented; expanding it would be a feature change, not cleanup.

## Ranked next candidates

1. Bounded `style.layer` / `_layerPaint` generated transport and render proof.
   This is the strongest target because the public API and example already
   present it as supported, the source path is narrow, and a host-native raster
   proof can reduce real integration risk without needing platform builds.
2. Generated/materialized `setStyle(...)` proof for Worker 147 paint fields.
   Useful follow-up hardening, especially for JS-facing delivery of
   SkPaint-backed `backgroundColor` plus explicit paint fields, but lower risk
   because the direct native behavior is now proved.
3. Broad `NodeStyle` field inventory/proof buckets. Valuable drift prevention,
   but broader and less directly tied to one user-visible behavior than
   `style.layer`.
4. Platform-native iOS/Android build/run. High value, but still environment
   blocked locally.
5. Broader runtime/fidelity proof. Important long term, but currently too broad
   and overclaim-prone compared with the bounded layer target.
6. Rich simple `TextCmd` styling. Deliberate feature expansion, not a current
   root-cause cleanup item.

## Selected next target for Worker 149

Assign Worker 149 to add bounded `style.layer` / `_layerPaint` API and render
proof.

Recommended scope:

- Add generated `NodeStyle.layer` transport proof using a real `SkPaint` /
  `JsiSkPaint` payload.
- Add host-native proof that `YogaNode::setStyle(...)` stores `_layerPaint`,
  resets it when omitted, and preserves ordinary `_paint` behavior separately.
- Add bounded raster proof in `scripts/verify-yoganode-native-commands-render.mjs`
  that a layer paint alpha or blend mode affects a node subtree through
  `canvas->saveLayer(...)`.
- Add materialized generated `setStyle(...)` proof in
  `scripts/verify-yoganode-nitro-materialization.mjs` if the generated wrapper
  can accept the `JsiSkPaint` payload in the existing host-JSC harness.
- Optionally add a packed TypeScript consumer fixture in
  `scripts/verify-package-typescript-consumer.mjs` proving public
  `YogaNodeStyle.layer` authoring with an RN Skia `SkPaint`-typed value.
- Edit product source only if the proof exposes a real behavior or contract
  failure; suspected source files would be `cpp/YogaNode.cpp`,
  `cpp/YogaNode.hpp`, and `src/specs/style.ts`.

Recommended commands:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-native-commands-render`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` if edited
- `npm run check:yoganode-nitro-materialization` if edited
- `npm run check:package-typescript-consumer` if package typing proof changes
- `npm run check:feasible-matrix`
- `git diff --check`

Out of scope for Worker 149:

- iOS/Android app build/run, simulator/device presentation, exact blend-mode
  fidelity across GPUs, exact render fidelity, UI-runtime Worklets delivery,
  Reanimated delivery, RNGH native delivery, image loading, and broader
  `NodeStyle` completeness claims.

## Proof boundary/overclaim risks

- Worker 147 should not be described as proving layer paint. Its report
  correctly excludes layer behavior.
- Current direct native paint-ordering proof should not be widened to claim full
  generated/materialized `setStyle(...)` delivery for every paint field.
- A future layer proof should state whether it proves only `_layerPaint` state,
  raster saveLayer effect, generated `NodeStyle` conversion, materialized
  wrapper delivery, or package TypeScript authoring.
- Platform-native build/run remains blocked by local tools and should stay
  separate from host-native proof language.

## Cleanup status

No product, source, verifier, generated, dependency, or example files were
edited by this audit. The full feasible matrix cleaned up its generated
TypeScript build-info artifact and matrix-owned temp parent. The only tracked
change from Worker 148 is this report.

## Recommended next tasks

- Worker 149: implement the selected `style.layer` / `_layerPaint` proof target.
- After layer proof, rerank generated/materialized `setStyle(...)` breadth for
  Worker 147 paint fields versus a broader `NodeStyle` proof inventory.
- Keep platform-native build/run queued until full Xcode/CocoaPods and
  Java/Android SDK tooling are available locally.

Goal finished.
