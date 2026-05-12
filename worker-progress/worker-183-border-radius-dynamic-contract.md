# Worker 183 Border Radius Dynamic Contract

## Summary

Added source-level proof that scalar global `style.borderRadius` accepts `SharedValue<number>` through the public packed TypeScript JSX authoring path and the Reconciler JS style-listener path.

Added a narrow Reconciler guard so invalid global `style.borderRadius` runtime shapes, including `SharedValue<SkPoint>` snapshots and point-object forms, fail before listener/native conversion. Existing SkPoint-capable per-corner radius behavior remains covered by the prior inventory-backed cases.

## Changed files

- `src/Reconciler.ts`
  - Added `assertSupportedBorderRadiusValue(...)`.
  - Wired the guard into `assertSupportedStyleShape(...)`.
- `scripts/verify-package-typescript-consumer.mjs`
  - Added packed-consumer positive JSX coverage for `style.borderRadius: SharedValue<number>`.
  - Added packed-consumer negative coverage for `SharedValue<SkPoint>` and `{ x, y }` global `borderRadius` forms.
- `scripts/verify-reconciler-animated-bindings.mjs`
  - Added a top-level scalar `style.borderRadius` SharedValue case proving listener registration/key, initial snapshot, update, invalidation, full style rebuild, cleanup, ignored late emits, and no native command mirror.
  - Added focused invalid-shape assertions for non-number dynamic/global payloads.
- `worker-progress/worker-183-border-radius-dynamic-contract.md`
  - Recorded this report.

## Commands run

- `git diff --check`
- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-reconciler-animated-bindings.mjs`
- `npm run check:package-typescript-consumer`
- `npm run check:reconciler-animated-bindings`
- `npm run check:feasible-matrix`

## Evidence gathered

- Packed package TypeScript consumer passed from a real npm tarball install outside the repository.
- Packed consumer accepted `style.borderRadius: SharedValue<number>` through `YogaIntrinsicElements["rect"]` / JSX usage.
- Packed consumer rejected global `style.borderRadius` `SharedValue<SkPoint>` and point-object forms while preserving valid per-corner radius `SharedValue<number>`, `SharedValue<SkPoint>`, and `{ x, y }` animated leaves.
- Reconciler verifier passed with a new `style.borderRadius` case showing one JS listener keyed by `borderRadius`, initial scalar snapshot resolution, full-style rebuild on update, invalidation, cleanup, ignored late emits, and no `createSynchronizable` / `setBlocking` native mirror.
- Reconciler verifier passed focused invalid-shape checks showing non-number global `borderRadius` payloads throw `style.borderRadius only supports number or SharedValue<number>.` before listener registration or native mirror creation.
- `npm run check:feasible-matrix` passed all 28 commands in 4m 6s, including the updated packed TypeScript consumer and Reconciler animated-binding verifiers.

## Proof boundary and overclaim risks

This proves public TypeScript and Node VM source-level Reconciler behavior for scalar global `style.borderRadius`. It does not claim platform app runtime, React Native bridge delivery, Nitro registry install, real Reanimated/UI-runtime delivery, RNGH native delivery, native rendering, or simulator/device behavior for this new dynamic source-level case.

The guard is intentionally scoped to global `style.borderRadius`; per-corner SkPoint-capable radius keys remain governed by the existing corner-radius contract and inventory-backed verifier.

## Cleanup status

- `npm run check:feasible-matrix` removed its matrix temp parent and reported no remaining new tracked artifacts after cleanup.
- Ignored/local artifacts such as `node_modules/`, `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`, `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` were not cleaned manually.
- Before this report, git status showed only the intended three modified files.

## Recommended next tasks

- Merge this branch after orchestrator review.
- If stronger runtime claims are needed later, add a separate platform/native runtime task; this worker intentionally stayed at public TypeScript plus Reconciler source-level proof.

Goal finished.
