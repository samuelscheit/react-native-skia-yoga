# Worker 161: Materialized Transform Breadth

## Summary

Recovered from partial uncommitted work in `scripts/verify-yoganode-nitro-materialization.mjs` and finished the assigned generated-wrapper proof expansion.

The materialization verifier now exercises generated `setStyle(...)` with one fresh materialized `YogaNode` per public single transform operation:

- `rotateX`
- `rotateY`
- `rotateZ`
- `scale`
- `scaleX`
- `scaleY`
- `translateX`
- `translateY`
- `skewX`
- `skewY`

For each operation, the probe asserts the generated conversion populated `_style.transform` with the expected variant and value, left `_style.matrix` absent, created `_matrix`, and made `_matrix` match the expected native transform matrix.

The verifier also adds an explicit generated-wrapper proof for `setStyle({ transform: [] })` without a matrix fallback. It first installs a matrix as a precondition, then proves the empty transform style leaves `_style.transform` present and empty, leaves `_style.matrix` absent, and resets `_matrix` to `nullptr`.

Existing non-empty transform-over-matrix precedence and empty-transform matrix fallback assertions were preserved.

## Changed files

- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added table/helper-driven generated single-transform breadth checks.
  - Added expected native matrix construction for all public single transform operations.
  - Added empty-transform/no-matrix reset proof.
  - Updated verifier output and proof-boundary text to include the new coverage without expanding beyond the host-JSC materialization boundary.
- `worker-progress/worker-161-materialized-transform-breadth.md`
  - Added this recovery report.

No product C++ source was changed.

## Commands run

All required verification used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:yoganode-native-hit-testing`
- `npm run check:feasible-matrix`
- `git diff --check`
- `git status --short --branch`
- `git diff --name-only`
- `git diff --stat`

The feasible matrix also ran `bun run specs` as command 25/28.

## Evidence gathered

- `node --check scripts/verify-yoganode-nitro-materialization.mjs` passed.
- `npm run check:yoganode-nitro-materialization` passed.
  - The generated host-JSC materialized `YogaNode` wrapper invoked `setStyle(...)` for all single transform variants.
  - The probe asserted `_style.transform`, `_style.matrix`, and `_matrix` state for each variant.
  - The probe asserted `transform: []` without matrix resets `_matrix` to `nullptr`.
- `npm run check:yoganode-native-hit-testing` passed.
- `npm run check:feasible-matrix` passed all 28 commands.
  - The matrix reran `npm run check:yoganode-nitro-materialization`.
  - The matrix ran `bun run specs`.
  - Cleanup accounting removed `tsconfig.tsbuildinfo`.
  - Remaining new tracked artifacts after cleanup: none.
- After the matrix, `git status --short --branch` showed only `scripts/verify-yoganode-nitro-materialization.mjs` modified before adding this report.
- After the matrix, `git diff --name-only` showed no generated-file diff. `bun run specs` left generated files unchanged.

## Proof boundary and overclaim risks

This work proves host-JSC Nitro `YogaNode::toObject(runtime)` materialization and generated wrapper delivery through the materialized object for the covered style payloads.

The new transform proof is limited to generated materialized `setStyle(...)` conversion into native `NodeStyle` and `YogaNode::_matrix` state for single-operation transform arrays, plus existing transform-over-matrix and empty-transform fallback/reset behavior.

The matrix-array nuance remains preserved: JS matrix arrays exercise the `std::shared_ptr<SkMatrix>` custom converter path, including 9- and 16-value arrays, not generated tuple-16 selection.

This does not prove actual React Native bridge delivery, Nitro module registry install in a React Native runtime, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets/Reanimated execution, RNGH native delivery, command rendering, pixels, exact hit-test behavior, or exact transform render fidelity.

## Cleanup status

- No product C++ source changes.
- No generated files changed.
- No package metadata, docs, or unrelated verifier files changed.
- The feasible matrix cleaned its temp parent and removed its generated `tsconfig.tsbuildinfo`.
- Final intended tracked changes are the verifier script and this report.

## Recommended next tasks

- If more transform confidence is needed, add a separate render/hit-test-oriented proof that composes multiple transform operations through the public runtime path and explicitly defines its render-fidelity boundary.
- Consider a future source-level assertion or focused verifier for generated variant ordering if the Nitro union converter changes.

Goal finished.
