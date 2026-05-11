# Worker 155 - Materialized Clip Matrix Transform

## Summary

Expanded `scripts/verify-yoganode-nitro-materialization.mjs` with generated
materialized `YogaNode.setStyle(...)` proof for `clip`, `matrix`, `transform`,
and `invertClip`.

The new coverage creates fresh native `YogaNode` instances, materializes them
through `YogaNode::toObject(runtime)`, retrieves the generated `setStyle`
function from the materialized JS object, calls it with `callWithThis(...)`, and
asserts native side effects on the original C++ node.

No product C++ or TypeScript changes were needed.

## Changed files

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-155-materialized-clip-matrix-transform.md`

## Proof added

- Added JS payload builders for plain rect clips, rrect clips, JsiSkPath host
  clips, `invertClip`, 9-value matrix arrays, and a representative transform
  array with a matrix fallback.
- Added native matrix/rrect assertion helpers.
- Added generated materialized `setStyle(clip rect)` assertions for
  `_style.clip` as `SkRect`, `_clipRect`, and reset `_clipPath`/`_clipRRect`.
- Added generated materialized `setStyle(clip rrect)` assertions for
  `_style.clip` as `SkRRect`, `_clipRRect`, bounds/radii, and reset sibling
  clip optionals.
- Added generated materialized `setStyle(clip path)` assertions for
  `_style.clip` as `SkPath`, `_clipPath`, and path containment from a real
  `JsiSkPath` host object.
- Added generated materialized `setStyle(invertClip)` assertions for
  `_style.invertClip`, `_clipRect`, and the native clipping predicate inversion.
- Added generated materialized `setStyle(matrix)` assertions for generated
  matrix-array conversion into `_style.matrix` and `_matrix`.
- Added generated materialized `setStyle(transform + matrix)` assertions for
  `_style.transform`, `_style.matrix`, native `_matrix`, and explicit
  transform-over-matrix precedence.
- Updated verifier success output and proof-boundary text to include the new
  style fields without expanding the platform/runtime claim.

## Verification run/results

- `git status --short --branch` - passed before report creation; output showed
  branch `worker/155-materialized-clip-matrix-transform` with only
  `scripts/verify-yoganode-nitro-materialization.mjs` modified.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed.
- `npm run check:yoganode-nitro-materialization` - passed. The host-JSC probe
  compiled/linked and asserted generated materialized wrapper delivery for the
  new clip/matrix/transform/invertClip cases. npm printed the existing
  `minimum-release-age` warning.
- `npm run check:yoganode-native-hit-testing` - passed. npm printed the existing
  `minimum-release-age` warning.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 22s. The
  matrix re-ran the updated materialization verifier as command 20/28. Cleanup
  removed newly created `tsconfig.tsbuildinfo` and removed the matrix temp
  parent `/tmp/rnskia-feasible-matrix-a13Lwh`.
- `git diff --check` - passed.

## Proof boundary/overclaim risks

This proof is limited to host-JSC Nitro `YogaNode::toObject(...)`
materialization, generated YogaNode prototype wrapper delivery, and native C++
state mutation from generated materialized `setStyle(...)` calls.

It does not prove React Native bridge delivery, Nitro registry installation in
a real React Native runtime, iOS/Android app build/run, simulator/device launch,
native platform presentation, UI-runtime Worklets execution, Reanimated
SharedValue delivery, RNGH/gesture delivery, pixel rendering, exact hit-test
behavior, command rendering, or render fidelity.

The invertClip assertion uses `YogaNode::pointPassesClipping(...)` only as a
direct native predicate check after generated wrapper delivery; it is not a full
hit-test or gesture-delivery claim.

## Nested subagent/explorer results

- `style_state_explorer` confirmed the JS payload shapes from `style.ts`, the
  generated `NodeStyle` representation, the public native assertion points, and
  the important precedence rule: when `style.transform` is present,
  `YogaNode::setStyle(...)` uses it and does not fall back to `style.matrix`.
- `materialization_pattern_explorer` confirmed the existing proof pattern:
  create a fresh materialized node with `materializeYogaNode(runtime)`, retrieve
  generated `setStyle` from `materialized.object`, invoke it with
  `callFunctionWithOneObject(...)`, assert the original native node, and dispose
  the materialized object.

## Cleanup status

- Product C++/TypeScript files were left unchanged.
- Ignored dependency/native/example artifacts were not modified intentionally:
  `node_modules`, `example/node_modules`, `example/ios`, `example/android`,
  `example/.expo`, `lib`, `.DS_Store`, and `tsconfig.tsbuildinfo` were
  preserved or cleaned only by existing verifier-owned cleanup rules.
- The feasible matrix reported no remaining new tracked artifacts after its
  cleanup.

## Recommended next tasks

- Add a small generated materialized drift guard for the broader `NodeStyle`
  inventory if future workers need field-count coverage rather than targeted
  behavior coverage.
- Consider optional follow-up coverage for `transform: []` matrix suppression
  and 16-value matrix array conversion if those become the next highest-risk
  conversion edges.

Goal finished.
