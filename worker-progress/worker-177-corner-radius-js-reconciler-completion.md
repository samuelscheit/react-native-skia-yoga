# Worker 177 - Corner Radius JS/Reconciler Completion

## Summary

Implemented the requested JS/Reconciler completion pass for SkPoint-capable
style corner radii.

- Added verifier-owned all-four corner-radius case tables for
  `borderBottomLeftRadius`, `borderBottomRightRadius`,
  `borderTopLeftRadius`, and `borderTopRightRadius`.
- Added a shared source-inventory drift guard that checks those verifier cases
  against `src/specs/style.ts`, `src/jsx.ts`, and `src/Reconciler.ts`.
- Expanded packed public TypeScript consumer coverage so scalar
  `SharedValue<number>`, whole `SharedValue<SkPoint>`, and nested `{ x, y }`
  `SharedValue<number>` authoring explicitly name all four per-corner style
  radius keys.
- Expanded the Reconciler Node VM proof with table-driven whole scalar
  `SharedValue<number>` cases for all four keys while preserving the existing
  representative nested point-leaf and whole `SharedValue<SkPoint>` coverage.

## Changed files

- `scripts/style-corner-radius-inventory.mjs`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `worker-progress/worker-177-corner-radius-js-reconciler-completion.md`

## Implementation details

- `scripts/style-corner-radius-inventory.mjs` centralizes the drift guard. It
  parses:
  - `src/specs/style.ts` `NodeStyle` per-corner radius fields and asserts each
    is `number | SkPoint`.
  - `src/jsx.ts` `YogaStyleCornerRadiusKey`.
  - `src/Reconciler.ts` `styleNestedRoots` corner entries and
    `scalarCornerRadiusKeys`.
- `scripts/verify-package-typescript-consumer.mjs` now uses the shared guard
  and generates public consumer style props that explicitly include all four
  corner keys for scalar SharedValue, whole SkPoint SharedValue, and nested
  animated point leaves.
- `scripts/verify-reconciler-animated-bindings.mjs` now uses the same guard and
  adds `cornerRadiusScalarBindingCases` for all four keys. Each case asserts
  scalar SharedValue expansion into stable `.x` and `.y` listener keys, initial
  snapshots, runOnJS update payloads, full style rebuilds, invalidations,
  cleanup, ignored late emits, and absence of native Synchronizable mirrors.
- Existing representative Reconciler coverage for nested `{ x, y }`
  `SharedValue<number>` leaves, whole `SharedValue<SkPoint>`, and invalid
  shapes remains in place.

## Evidence/commands run

All commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `node --check scripts/style-corner-radius-inventory.mjs`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed. Output reports packed
  consumer acceptance for all four per-corner radius keys and source inventory
  alignment across `src/specs/style.ts`, `src/jsx.ts`, and `src/Reconciler.ts`.
- `npm run check:reconciler-animated-bindings`: passed. Output reports all-four
  whole scalar `SharedValue<number>` corner-radius coverage plus preserved
  representative point coverage and no native command mirrors.
- `git diff --check`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 22s.

## Proof boundary

Proven:

- Packed public TypeScript authoring accepts the requested dynamic forms for
  all four per-corner style radius keys.
- Node VM source-level Reconciler behavior for all-four whole scalar
  `SharedValue<number>` style corner radii, including scalar expansion to x/y
  style listeners and JS style rebuild behavior.
- Source inventory alignment between the verifier case tables and the current
  style/JSC/Reconciler key declarations.

Not proven:

- Real UI-runtime Worklets execution.
- Real Reanimated SharedValue delivery.
- Actual React Native bridge delivery.
- Generated/native materialization, hit-test behavior, render/raster behavior,
  Nitro registry install in React Native, platform-native presentation,
  iOS/Android app build or launch, or exact renderer fidelity.

## Cleanup status

- No product source, generated specs, package metadata, docs, or example files
  were intentionally changed.
- Ambiguous local artifacts such as `node_modules`, `example/node_modules`,
  `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
  `tsconfig.tsbuildinfo` were preserved unless matrix-owned cleanup removed its
  generated `tsconfig.tsbuildinfo`.
- The feasible matrix removed its matrix-owned temp parent and reported no
  remaining new tracked artifacts after cleanup.
- No nested subagents or explorers were used.

## Recommended next tasks

- Keep runtime-level Reanimated/UI-runtime proof separate until a test
  environment can exercise real worklet delivery without overclaiming.
- No additional JS/Reconciler corner-radius completion work is currently
  recommended from this scoped pass.

Goal finished.
