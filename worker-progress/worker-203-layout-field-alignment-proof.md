# Worker 203: Layout Field Alignment Proof

## Summary

Closed the exact public/Reconciler dynamic layout field-alignment gap identified by Worker 202.

The materialized Nitro verifier now has a narrow same-node sequential generated `setStyle(...)` case for the previously uncovered Worker 199 exact fields: `start`, `end`, `marginLeft`, `marginRight`, and `inset`.

## Field alignment inventory

Worker 199 public/Reconciler dynamic layout fields:

`width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `flexBasis`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink`, `alignContent`, `alignSelf`, `flexWrap`, `direction`, `display`, `boxSizing`, `position`, `top`, `right`, `bottom`, `left`, `start`, `end`, `marginLeft`, `marginRight`, `inset`, `insetHorizontal`, `insetVertical`.

Already covered by Worker 201 same-node sequential materialized proof:

`width`, `height`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `flexBasis`, `gap`, `rowGap`, `columnGap`, `flexGrow`, `flexShrink`, `alignContent`, `alignSelf`, `flexWrap`, `direction`, `display`, `boxSizing`, `position`, `top`, `right`, `bottom`, `left`, `insetHorizontal`, `insetVertical`.

Remaining exact field gap before this worker:

`start`, `end`, `marginLeft`, `marginRight`, `inset`.

Worker 203 added same-node sequential generated materialized coverage for those five fields. The older residual one-shot case already covered `start`/`end`, but not in the same-node sequential update/cleanup path. `marginLeft`, `marginRight`, and `inset` were the concrete exact-field misses.

## Implementation details

- Added a source drift guard in `scripts/verify-yoganode-nitro-materialization.mjs` that checks Worker 199's dynamic layout table still exists in `scripts/verify-reconciler-animated-bindings.mjs`, public `src/specs/style.ts`, and generated `NodeStyle.hpp`.
- Added native-path guards for the exact alias setters: `style.start`, `style.end`, `style.marginLeft`, `style.marginRight`, and `style.inset`.
- Added `makeSequentialFieldAlignment*Style(...)` builders for a small parent/flow-child/absolute-child tree.
- Added `assertGeneratedMaterializedSequentialLayoutFieldAlignment(...)`, which reuses the same materialized nodes across initial, update, inset, and cleanup `setStyle(...)` calls.
- The new case asserts native `_style` replacement and cleanup, selected Yoga edge getters for margin and position aliases, layout invalidation after update phases, `computeLayout(...)`, and generated `layout` getter values for the parent and inset-positioned absolute child.
- Wired the case into the host-JSC materialization probe and updated the verifier summary/proof-boundary output.

## Commands run

- `git status --short --branch` - clean branch header at start.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - first run failed because my initial drift guard looked for Worker 199 `key: "..."`
  entries in `src/Reconciler.ts`; fixed to read `scripts/verify-reconciler-animated-bindings.mjs`.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed after the guard fix.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 43s.
- `git diff --check` - passed after writing this report.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed after writing this report.

## Evidence gathered

- The focused materialization verifier compiled and linked the host executable against real `YogaNode.cpp`, generated Nitro specs, Nitro runtime/prototype/cache sources, JSC, Yoga, Worklets helpers, RN Skia macOS archives, and local helper sources.
- The executable now reports exact sequential edge-alias alignment for `start`/`end`, `marginLeft`/`marginRight`, and `inset`.
- The new runtime assertions cover generated wrapper delivery, native `_style` storage/replacement/cleanup, selected Yoga getters for left/right margins, start/end positions, and all-edge inset, invalidation after sequential updates, computed layout, and generated `layout` getter values.
- The full feasible matrix reran the updated verifier as step 20 and passed.
- Nested read-only challenger `inventory_challenger` independently confirmed the same exact missing fields and the low proof-boundary risk of a narrow generated materialized sequential case.

## Proof boundary and non-claims

This proves host-JSC Nitro `YogaNode::toObject(runtime)` materialization and generated JS-facing wrapper delivery for the bounded same-node sequential layout field-alignment case.

It does not prove actual React Native bridge delivery, Nitro registry installation in a React Native runtime, UI-runtime Worklets/Reanimated delivery, iOS/Android build/run, simulator/device/native presentation, exact Yoga conformance beyond asserted values, exhaustive layout combinations, render fidelity, or platform-native app runtime behavior.

## Quality/maintainability/performance/security review

- Quality: the added case targets only the exact public/Reconciler fields selected by Worker 202 and keeps assertions tied to native state, Yoga getter state, invalidation, and generated layout output.
- Maintainability: field inventory guards make future drift visible before the host compile path runs.
- Performance: verifier runtime increased only by a small extra generated-wrapper case inside an existing host executable; no product runtime path changed.
- Security: no new external input, network access, shell interpolation, or product runtime behavior was added.

## Cleanup status

- No product runtime/source files were modified.
- No package metadata, generated artifacts, or existing worker reports were modified.
- Feasible matrix cleanup removed `tsconfig.tsbuildinfo`, reported no remaining new tracked artifacts, and removed its matrix-owned temp parent.

## Final git status summary

- Branch: `worker/203-layout-field-alignment-proof`.
- Modified: `scripts/verify-yoganode-nitro-materialization.mjs`.
- New report: `worker-progress/worker-203-layout-field-alignment-proof.md`.

Goal finished.
