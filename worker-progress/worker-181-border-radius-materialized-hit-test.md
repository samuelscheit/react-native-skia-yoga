# Worker 181 - Border Radius Materialized Hit Test

## Summary

Added scalar global `style.borderRadius` proof in the generated/materialized YogaNode path and in the direct native hit-test path.

The materialization verifier now calls generated `setStyle({ borderRadius: 17 })` through a materialized `YogaNode` JS object and asserts NativeState identity/cached-object behavior, `_style.borderRadius`, `_clipsToBounds`, all four `_clipToBoundsRadii`, absence of per-corner radius fields, and absence of explicit `style.clip` state.

The native hit-test verifier now covers a parent with scalar `borderRadius` and a full-size interactive child. It rejects hits in all four rounded corners and accepts representative in-bounds rounded points that return the child tag.

## Changed files

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-yoganode-native-hit-testing.mjs`
- `worker-progress/worker-181-border-radius-materialized-hit-test.md`

## Commands run

- `git diff --check` - passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `node --check scripts/verify-yoganode-native-hit-testing.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run check:yoganode-native-hit-testing` - passed.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 29s.

## Evidence gathered

- Generated/materialized `setStyle(global borderRadius)` succeeds through the materialized object and preserves the NativeState/cached-object identity pattern.
- `_style.borderRadius` stores the scalar value while `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, and `borderBottomLeftRadius` remain absent.
- Scalar `borderRadius` enables `_clipsToBounds` and seeds upper-left, upper-right, lower-right, and lower-left `_clipToBoundsRadii` slots with the scalar radius.
- Scalar `borderRadius` leaves `_style.clip`, `_clipPath`, `_clipRect`, and `_clipRRect` absent.
- Direct native hit testing rejects `(1,1)`, `(99,1)`, `(99,99)`, and `(1,99)` for a `100x100` parent with `borderRadius = 30`.
- Direct native hit testing accepts `(30,10)`, `(70,10)`, `(70,90)`, and `(30,90)` and returns the full-size child tag.
- `check:feasible-matrix` reran the materialization and hit-test verifiers plus the existing local package/source/example matrix successfully.

## Proof boundary and overclaim risks

Proven: host-JSC generated YogaNode materialization for scalar `borderRadius` delivery into native state, and host-native `YogaNode::hitTestTagAt` / `hitTestInternal` behavior for scalar rounded bounds clipping.

Not proven: React Native bridge delivery, Nitro registry installation inside a React Native runtime, Reanimated/UI-runtime delivery, RNGH native delivery, iOS/Android app build/run, simulator/device launch, native platform presentation, exact render fidelity, exact platform GPU clipping, or platform app runtime behavior.

## Cleanup status

No ambiguous local or ignored artifacts were removed. The feasible matrix reported cleanup of its matrix-owned temp parent and removed only its probe-created `tsconfig.tsbuildinfo`.

Worktree before commit contained only the intended verifier/report changes.

## Recommended next tasks

- Add platform-runtime proof only if a future worker can run an actual React Native app surface; keep it separate from host-native verifier claims.
- Consider a future materialized React Native bridge/Nitro registry proof if a stable local harness becomes available.

Goal finished.
