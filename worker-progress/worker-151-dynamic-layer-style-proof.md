# Worker 151 Dynamic Layer Style Proof

## Summary

- Added packed-consumer TypeScript proof for public dynamic `style.layer` authoring with `SharedValue<SkPaint>`, a scalar `style.opacity` companion, and whole `SharedValue<YogaNodeStyle>` style authoring.
- Found and fixed a real public type gap in `src/jsx.ts`: optional style keys now accept `SharedValue<NonNullable<T>>`, allowing concrete SharedValues such as `SharedValue<SkPaint>` and `SharedValue<number>` for optional style fields.
- Extended the Reconciler animated-bindings verifier with source-level VM cases for top-level `style.layer` SharedValue delivery and whole-style SharedValue delivery.

## Changed Files

- `src/jsx.ts`
  - Added internal `YogaAnimatedStyleProp<T>` so optional style keys accept either the optional static value, `SharedValue<T>`, or `SharedValue<NonNullable<T>>`.
- `scripts/verify-package-typescript-consumer.mjs`
  - Added packed consumer fixtures for `SharedValue<SkPaint>` on `style.layer`, `SharedValue<number>` on `style.opacity`, and `SharedValue<YogaNodeStyle>` as a whole `style` prop.
- `scripts/verify-reconciler-animated-bindings.mjs`
  - Added VM/source-level assertions for `style.layer` initial snapshot resolution, listener keying, update delivery through `setStyle(getResolvedStyle(...))`, invalidation, cleanup, and no native command mirror creation.
  - Added whole `SharedValue<YogaNodeStyle>` style delivery coverage.
- `worker-progress/worker-151-dynamic-layer-style-proof.md`
  - Final worker evidence and boundaries.

## Commands Run/Results

- `node --check scripts/verify-package-typescript-consumer.mjs` - passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs` - passed.
- `npm run check:reconciler-animated-bindings` - passed.
- `npm run check:package-typescript-consumer` - initially failed before the `src/jsx.ts` fix because `SharedValue<SkPaint>` and `SharedValue<number>` were not assignable to optional style keys containing `undefined`; reran after the fix and passed.
- `git diff --check` - passed.
- `npm run check:feasible-matrix` - passed all 28 matrix commands.

## Evidence Gathered

- Public packed TypeScript consumer now proves JSX authoring for:
  - Static `style.layer: Skia.Paint()`.
  - Dynamic `style.layer: SharedValue<SkPaint>`.
  - Dynamic scalar companion `style.opacity: SharedValue<number>`.
  - Whole `style: SharedValue<YogaNodeStyle>`.
- Reconciler VM proof now asserts:
  - `style.layer` registers a top-level JS SharedValue listener keyed as `"layer"`.
  - Initial style snapshots carry the opaque layer paint object, scalar opacity, and static style fields.
  - `style.layer` emits bridge through `runOnJS("layer", nextPaint)`.
  - Updates call `setStyle` with the rebuilt full resolved style, preserving sibling animated snapshots and static fields.
  - Style updates invalidate the container.
  - Cleanup removes `style.layer` and `style.opacity` listeners and prevents later emits from rebuilding styles, invalidating, or bridging through `runOnJS`.
  - Style SharedValues do not create `Synchronizable` native command mirrors or use `setBlocking`.
  - Whole `SharedValue<YogaNodeStyle>` resolves the initial full style, updates the full payload on emits, invalidates, and cleans up.
- The feasible matrix reran the package, source, native host, typecheck, lint, codegen, and example metadata checks and passed.

## Proof Boundary/Overclaim Risks

- This proof covers public TypeScript authoring plus Node VM/source-level Reconciler behavior with stubs.
- It does not prove React Native bridge delivery, Nitro registry install in a running app, UI-runtime Worklets/Reanimated delivery, platform app build/run, simulator/device launch, native C++ conversion/rendering of a dynamic style update, saveLayer raster behavior beyond the existing static layer evidence, exact GPU blend fidelity, or broad NodeStyle completeness.
- The native/static `style.layer` transport and bounded saveLayer raster proof remain owned by the existing Worker 149 evidence.

## Cleanup Status

- `npm run check:feasible-matrix` cleaned its matrix temp parent and removed its generated `tsconfig.tsbuildinfo`.
- Final pre-report git status showed only intended source/proof edits before this progress report was added.
- No product docs, examples, package metadata, generated native folders, or dependency artifacts were changed.

## Recommended Next Tasks

- Add an app-runtime proof for dynamic `style.layer` only when a real React Native/Reanimated UI-runtime harness is available.
- Keep native dynamic layer rendering claims blocked until a platform or host-native path proves dynamic `setStyle(layer)` update conversion/render behavior beyond the current source-level Reconciler proof.
