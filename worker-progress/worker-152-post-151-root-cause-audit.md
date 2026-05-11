# Worker 152 - Post-worker-151 root-cause audit

## Summary

This was a report-only post-worker-151 audit. I accept Worker 151's dynamic
`style.layer` / opaque style `SharedValue` proof within its stated local
boundary: public packed TypeScript authoring now accepts dynamic
`style.layer: SharedValue<SkPaint>`, dynamic `style.opacity:
SharedValue<number>`, and whole `style: SharedValue<YogaNodeStyle>`; the
source-level Reconciler verifier now proves JS style-listener delivery for
top-level `style.layer` and whole-style `SharedValue` updates.

The strongest remaining locally unblocked implementation target is generated
materialized `YogaNode.setStyle(...)` breadth for the recent public paint-style
fields. Direct host-native `YogaNode::setStyle(...)` behavior is already proved
for SkPaint-backed `backgroundColor` ordering and explicit paint-field
overrides, but the materialized generated wrapper proof still exercises only
`width`, `height`, `antiAlias`, `layer`, and string `backgroundColor`.

## Changed files

- `worker-progress/worker-152-post-151-root-cause-audit.md`

## Evidence inspected

- Read `WORKER_BRIEF.md` and current branch state.
- Reviewed Worker 151 report:
  `worker-progress/worker-151-dynamic-layer-style-proof.md`.
- Reviewed Worker 151 commit `cb2ea4a Add dynamic layer style proof` and merge
  `6f5b5ef Merge worker 151 dynamic layer style proof`.
- Reviewed current `src/jsx.ts`, especially the optional-style
  `SharedValue<NonNullable<T>>` fix and `YogaAnimatedStyle` surface.
- Reviewed current `src/Reconciler.ts`, especially `addAnimatedListener(...)`,
  `bindAnimatedValues(...)`, `getResolvedStyle(...)`, and
  `resolveAnimatedStyle(...)`.
- Reviewed current `scripts/verify-package-typescript-consumer.mjs` dynamic
  `style.layer`, `style.opacity`, and whole-style packed-consumer fixtures.
- Reviewed current `scripts/verify-reconciler-animated-bindings.mjs`
  `verifyStyleLayerSharedValueUsesJsStyleDelivery()` and
  `verifyWholeStyleSharedValueUsesJsStyleDelivery()` cases.
- Reviewed remaining-gap evidence in `src/specs/style.ts`,
  `cpp/YogaNode.cpp`, `nitrogen/generated/shared/c++/NodeStyle.hpp`,
  `scripts/verify-yoganode-native-commands-render.mjs`, and
  `scripts/verify-yoganode-nitro-materialization.mjs`.
- Reviewed recent reports `worker-147` through `worker-151` plus current
  `MASTER_PLAN.md` / `MASTER_PROGRESS.md` context.
- Used two read-only nested explorers:
  - `w151_boundary` accepted Worker 151's local proof boundary and found no
    blocking defects.
  - `remaining_gaps` independently ranked materialized `setStyle(...)`
    paint-field breadth as the strongest Worker 153 target.

## Worker 151 acceptance/challenge

Accepted. Worker 151 proves the intended public TypeScript authoring boundary:
`src/jsx.ts` now allows concrete `SharedValue<NonNullable<T>>` for optional
style keys, and the packed consumer compiles `SharedValue<SkPaint>` for
`style.layer`, `SharedValue<number>` for `style.opacity`, and
`SharedValue<YogaNodeStyle>` as the whole `style` prop.

Accepted. Worker 151 proves the intended source-level Reconciler delivery
boundary: top-level style SharedValues register JS listeners rather than native
command mirrors, initial snapshots are resolved into host style payloads,
emits bridge listener keys and values through `runOnJS`, updates rebuild full
style snapshots through `setStyle(getResolvedStyle(...))`, invalidation fires,
and cleanup removes listeners and ignores late emits. Whole-style
`SharedValue<YogaNodeStyle>` follows the same JS style-listener path with the
root listener key.

No source defect was found. The proof should not be widened beyond its own
claims: the Reconciler verifier uses Node VM stubs and opaque JS objects for
paint-like values, not a running React Native app, not real Reanimated delivery,
not UI-runtime Worklets scheduling, and not native C++ conversion/rendering of
a dynamic style update.

## Verification results

- `node --check scripts/verify-package-typescript-consumer.mjs` - passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs` - passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- Focused NodeStyle proof-surface probe:
  - public `NodeStyle` field count: 80.
  - materialized `setStyle(layer)` proof: present.
  - materialized generated-style proof text does not mention
    `borderWidth`, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`,
    `opacity`, or `blendMode`.
- `npm run check:package-typescript-consumer` - passed; output includes dynamic
  `style.layer SharedValue<SkPaint>`, dynamic `style.opacity`, and whole
  `SharedValue<YogaNodeStyle>` authoring.
- `npm run check:reconciler-animated-bindings` - passed; output includes
  top-level `style.layer` SharedValue source-level delivery and whole-style
  SharedValue delivery.
- `npm run check:yoganode-nitro-materialization` - passed; output confirms the
  current generated materialized `setStyle(...)` scope is
  `width/height/antiAlias/layer`.
- `npm run check:feasible-matrix` - passed all 28 commands in 5m 48s and
  removed generated tracked artifacts plus its matrix temp parent.
- `git diff --check` - passed after writing this report.

## Target ranking

1. Generated materialized `YogaNode.setStyle(...)` breadth for recent paint
   fields. This is the strongest local target because direct native behavior is
   already proved for SkPaint-backed `backgroundColor` plus explicit public
   paint fields, generated `NodeStyle.hpp` exposes the fields, and the remaining
   gap is the JS-facing materialized wrapper path from a `YogaNode::toObject`
   object into native `_style`, `_paint`, and Yoga border state.
2. Broad `NodeStyle` inventory/drift proof. Useful as future-proofing because
   `NodeStyle` has 80 public fields, but it is broader and lower immediate
   risk than closing a known materialized wrapper gap for concrete paint fields.
3. App/runtime proof for dynamic style updates. Higher eventual value, but
   still locally blocked without a real platform React Native/Reanimated/Nitro
   registry runtime harness.
4. Platform-native iOS/Android build/run. Still environment-blocked unless the
   local toolchain changes.
5. Exact render/fidelity, real bridge delivery, UI-runtime Worklets, and broad
   native app behavior. Important later, but currently overclaim-prone compared
   with the available host-JSC/native verifier surface.

## Selected Worker 153 target

Assign Worker 153 exactly one target: expand generated materialized
`YogaNode.setStyle(...)` paint-field breadth in
`scripts/verify-yoganode-nitro-materialization.mjs`.

Proof plan:

- Add a materialized generated `setStyle(...)` fixture that calls the generated
  JS-facing wrapper on a `YogaNode::toObject(runtime)` object.
- Build the style payload with a real `JsiSkPaint` host object for
  SkPaint-backed `backgroundColor` plus explicit `borderWidth`, `strokeCap`,
  `strokeJoin`, `strokeMiter`, `dither`, `opacity`, and `blendMode` values.
- Assert `_style` optionals are populated through generated conversion.
- Assert `_paint` starts from the SkPaint-backed `backgroundColor` base and is
  then overridden by the explicit public paint fields.
- Assert `borderWidth` still writes Yoga layout border state through the
  materialized wrapper path.
- Preserve the existing materialized `layer` proof; do not replace it with this
  broader paint-field fixture.

Expected files:

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-153-materialized-style-paint-breadth.md`
- `cpp/YogaNode.cpp` only if the new proof exposes a real product failure.

Acceptance commands:

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:yoganode-native-commands-render`
- `npm run check:feasible-matrix`
- `git diff --check`

## Proof boundary/overclaim risks

- Worker 151 covers public compile-time authoring and Node VM/source-level
  Reconciler style-listener behavior only.
- Worker 151 does not prove React Native bridge delivery, Nitro registry install
  in a running app, UI-runtime Worklets execution, real Reanimated delivery,
  platform app build/run, simulator/device launch, native C++ conversion or
  rendering of a dynamic style update, saveLayer behavior beyond Worker 149's
  static proof, exact GPU blend fidelity, or broad `NodeStyle` completeness.
- Worker 153's recommended target would prove host-JSC materialized generated
  wrapper delivery into native state. It should not claim command rendering,
  app runtime, platform presentation, React Native bridge delivery, Nitro
  registry install in an RN runtime, UI-runtime Worklets, Reanimated delivery,
  or exact render fidelity.
- The current host-native paint-field proof remains owned by
  `check:yoganode-native-commands-render`; the missing piece is generated
  materialized wrapper delivery for the same field set.

## Cleanup status

- The feasible matrix removed generated tracked artifacts
  (`example/.expo`, `example/android`, `example/ios`, and
  `tsconfig.tsbuildinfo`) and removed its matrix temp parent.
- Nested explorers were read-only and closed after returning findings.
- No product/source/docs/example/package files were edited by this audit.
- Final intended tracked change is this report only.

## Recommended next tasks

- Worker 153: implement the selected materialized generated
  `setStyle(...)` paint-field breadth proof.
- After Worker 153, rerank broad `NodeStyle` inventory/drift proof against any
  newly exposed materialized wrapper or converter gaps.
- Keep platform-native app build/run and real dynamic Reanimated/UI-runtime
  delivery proofs queued until the local toolchain/runtime prerequisites are
  actually available.

Goal finished.
