# Worker 159 - Transform Empty Matrix Fallback

## Summary

Fixed `YogaNode::setStyle(...)` so a present but empty public
`transform: []` array behaves like no transform for matrix fallback purposes.
Non-empty transforms still take precedence over `style.matrix`; empty transforms
now apply `style.matrix` when present and reset `_matrix` when no matrix is
present.

Added focused generated materialized `setStyle(...)` proof for a fresh
materialized YogaNode receiving `transform: []` plus a matrix fallback. The
probe asserts `_style.transform` is present and empty, `_style.matrix` is
present, and native `_matrix` matches the fallback matrix.

## Changed Files

- `cpp/YogaNode.cpp`
  - Added a local `applyMatrixStyle` helper inside `YogaNode::setStyle(...)`.
  - Kept non-empty transform precedence.
  - Routes empty-transform state through the same matrix fallback/reset path as
    omitted transform.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added empty-transform fallback matrix payload and assertion helper.
  - Invokes the new helper from the existing clip/matrix/transform
    materialization proof sequence.
  - Updated verifier summary/proof-boundary output to name the empty-transform
    fallback proof.

## Commands Run and Results

- `git status --short --branch`: passed; branch
  `worker/159-transform-empty-matrix`; changed files were the expected product
  and verifier files.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: initially
  failed before project execution because this shell's `PATH` pointed at an
  absent `/Users/user/.nvm/versions/node/v26.0.0/bin/node`.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-yoganode-nitro-materialization.mjs`:
  passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization`:
  passed; compiled/linked and ran the host-JSC materialization probe.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-native-hit-testing`:
  passed.
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix`:
  passed all 28 commands in 4m 41s; the aggregate runner did not reproduce
  Worker 158's `spawn npm ENOENT` issue with the corrected PATH.
- `git diff --check`: passed.
- `git diff -- nitrogen/generated/shared/c++/NodeStyle.hpp nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp nitrogen/generated/shared/c++/HybridYogaNodeSpec.hpp | wc -c`:
  `0`; `bun run specs` inside the aggregate verifier left generated Nitro
  files unchanged.

## Evidence Gathered

- Public `Transform` is an array type, so `[]` is a valid public value:
  `src/specs/style.ts`.
- Public `NodeStyle` exposes adjacent independent `transform?: Transform` and
  `matrix?: SkMatrixNative | MatrixArray` fields.
- Reconciler style normalization rejects unsupported `origin` and unsupported
  matrix-array SharedValue leaves, but does not give empty transform any
  special semantics before `instance.setStyle(resolvedStyle)`.
- Native `YogaNode::setStyle(...)` already records the complete public payload
  into `_style` before deriving native `_matrix` state.
- Existing verifier coverage already preserved non-empty transform precedence
  over matrix fallback; the new case proves the empty-array branch falls back to
  matrix instead of suppressing it.
- A read-only nested explorer was started for source-semantics confirmation but
  did not return after follow-up; it was closed as obsolete and no explorer
  conclusion was used.

## Proof Boundary and Overclaim Risks

- Proven: host-JSC Nitro `YogaNode::toObject(runtime)` materialization,
  generated JS-facing `setStyle(...)` invocation from the materialized object,
  generated `NodeStyle` conversion of public `transform: []` plus matrix array,
  `_style.transform` and `_style.matrix` preservation, and native `_matrix`
  fallback state.
- Preserved: existing generated materialized non-empty transform-over-matrix
  precedence proof.
- Source-grounded but not separately materialized here: `transform: []` with no
  matrix leaves `_matrix` reset through the same helper branch.
- Not claimed: React Native bridge delivery, Nitro module registry install
  inside a React Native runtime, iOS/Android build/run, simulator/device launch,
  native platform presentation, UI-runtime Worklets/Reanimated delivery,
  gesture delivery, command rendering, pixel rendering, exact transform render
  fidelity, or broader transform-operation breadth.
- Matrix-array runtime nuance from Worker 158 remains: JS matrix arrays
  materialize through the `std::shared_ptr<SkMatrix>` custom-converter variant
  branch, not as proof that JS arrays select the generated tuple-16 variant.

## Cleanup Status

- No unrelated product files were edited.
- The aggregate feasible-matrix verifier cleaned its temp parent and removed
  its generated `tsconfig.tsbuildinfo` artifact.
- `bun run specs` inside the aggregate verifier left generated Nitro files
  unchanged.
- Ignored dependency/native/example artifacts were preserved.

## Recommended Next Tasks

- Merge this branch after orchestrator review.
- Consider broader table-driven materialized transform-operation coverage as a
  separate task if desired; it is lower priority than this fixed edge case.
- Keep full platform-native build/run verification blocked until local
  CocoaPods/Java/Android/Xcode prerequisites are available.

Goal finished.
