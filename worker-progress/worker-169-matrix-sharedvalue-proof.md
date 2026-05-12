# Worker 169 Matrix SharedValue Proof

## Summary

- Extended the packed-package TypeScript consumer verifier to prove public authoring of whole `style.matrix` `SharedValue` values for representative 9-value and 16-value matrix array payloads.
- Added a packed-consumer negative fixture proving nested `SharedValue<number>` entries inside `style.matrix` arrays remain rejected by the public type surface.
- Extended the Reconciler animated-binding verifier to prove source-level whole `style.matrix` `SharedValue` delivery through the JS style listener path: initial snapshot, top-level `matrix` listener key, `runOnJS` update delivery, full style rebuild, invalidation, cleanup, ignored late emits, and no native command mirror.
- Added Reconciler negative assertions that nested matrix `SharedValue` entries fail with the existing explicit error, including both direct matrix arrays and invalid whole-matrix snapshots.
- No product/native source edits were needed.

## Changed files

- `scripts/verify-package-typescript-consumer.mjs`
  - Adds `PublicMatrix`, matrix-array extraction aliases, static 9-/16-value matrix style fixtures, `SharedValue<PublicMatrix>` whole-matrix fixtures, and an unsupported nested matrix-entry negative fixture.
  - Updates verifier success output to name the matrix proof and boundary.
- `scripts/verify-reconciler-animated-bindings.mjs`
  - Adds whole `style.matrix` `SharedValue` JS-style-listener coverage.
  - Adds nested matrix `SharedValue` explicit-error coverage.
- `worker-progress/worker-169-matrix-sharedvalue-proof.md`
  - Records this handoff and evidence.

## Commands run

- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-package-typescript-consumer.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-reconciler-animated-bindings.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:package-typescript-consumer`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:reconciler-animated-bindings`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-native-hit-testing`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix`
- `git diff --check`

## Evidence gathered

- `node --check` passed for both edited verifier scripts.
- `check:package-typescript-consumer` passed and reported:
  - Packed consumer JSX compiled whole `style.matrix` `SharedValue` 9-/16-value arrays.
  - Packed consumer TypeScript rejected unsupported nested `style.matrix` `SharedValue<number>` array entries while accepting `SharedValue` for the whole matrix.
- `check:reconciler-animated-bindings` passed and reported:
  - Whole `style.matrix` `SharedValue` listeners resolve 9-value snapshots, deliver 16-value updates through the top-level `matrix` key, rebuild full styles, invalidate, clean up, reject nested `SharedValue` matrix entries with the explicit boundary error, and avoid native command mirrors.
- `check:yoganode-nitro-materialization` passed, including adjacent generated materialized 9- and 16-value matrix array delivery evidence.
- `check:yoganode-native-hit-testing` passed, including adjacent matrix inversion and transform-array hit-test evidence.
- `check:feasible-matrix` passed all 28 child checks in 4m 41s, including the updated package TypeScript consumer and Reconciler animated-binding verifiers.
- `git diff --check` passed.

## Proof boundary and overclaim risks

- Proven: public packed TypeScript consumer authoring for whole `style.matrix` `SharedValue<PublicMatrix>` fixtures and Node VM source-level Reconciler delivery for whole `style.matrix` `SharedValue` values.
- Proven: nested `SharedValue<number>` entries inside matrix arrays are rejected by the packed public type fixture and by the Reconciler runtime boundary with the existing explicit error.
- Not claimed: native bridge delivery, Nitro registry install, platform runtime behavior, UI-runtime Worklets execution, real Reanimated/RNGH delivery, simulator/device behavior, or exact matrix render/hit-test fidelity beyond the adjacent checks that already own those surfaces.
- The Reconciler matrix proof uses VM stubs for `executeOnUIRuntimeSync`, `runOnJS`, and host nodes; it proves source-level listener wiring and delivery semantics, not a React Native runtime.

## Cleanup status

- No unmanaged temp output remains from the required checks.
- `check:feasible-matrix` reported removal of its matrix-owned temp parent and removal of newly created `tsconfig.tsbuildinfo`.
- `git status --short --branch` before report creation showed only the two owned verifier scripts modified.

## Recommended next tasks

- No source fix is required from this proof.
- If broader confidence is needed later, add a platform runtime test that exercises an actual Reanimated `SharedValue<MatrixArray>` through React Native, but keep that separate from this Node VM source-level proof boundary.

Goal finished.
