# Worker 160 - Post-worker-159 root-cause audit

## Summary

Report-only audit completed for Worker 159. I accept the Worker 159 fix and
proof boundary: `transform: []` now behaves like an omitted transform for
matrix fallback, non-empty transforms still take precedence over
`style.matrix`, and the materialized verifier proves the generated wrapper path
for `transform: []` plus a matrix fallback.

Changed files in this worker: this report only.

The strongest next locally unblocked target is table-driven generated
materialized transform-operation coverage, with an added generated-wrapper
assertion for `transform: []` without `matrix` so the reset behavior is no
longer source-only.

## Worker 159 acceptance verdict

Accepted.

Worker 159 changed `cpp/YogaNode.cpp`,
`scripts/verify-yoganode-nitro-materialization.mjs`, and
`worker-progress/worker-159-transform-empty-matrix.md` in commit
`4a24f2822cfab185ed2b76dcccbe4c4d38e63ff1`, merged as
`1201301ace662793f7e74d4cbf9467dbc816678b`.

The source fix is coherent. `YogaNode::setStyle(...)` now has one
`applyMatrixStyle` helper. If `style.transform` is present and has at least one
recognized operation, `_matrix` is derived from the transform. If the transform
array is empty, the helper applies `style.matrix` when present or resets
`_matrix` when absent. If `style.transform` is omitted, the same helper handles
ordinary matrix fallback.

The proof boundary is also coherent. The verifier creates a materialized
YogaNode object through `YogaNode::toObject(runtime)`, invokes generated
`setStyle(...)`, and checks native `_style` plus `_matrix` state for
`transform: []` with a 9-value matrix fallback. That proves the generated
wrapper/converter/native-state path for the fixed fallback case. It does not
turn the case into platform rendering or React Native bridge proof.

One nuance to preserve: `transform: []` with no `matrix` is source-grounded by
the shared helper path and the initial `_matrix.reset()`, but Worker 159 did
not add a separate generated materialized fixture for that no-matrix reset.
That is not a rejection; it is an audit boundary.

## Evidence inspected

- `WORKER_BRIEF.md`: confirmed report-only scope, assigned worktree, required
  sections, and final `Goal finished.` requirement.
- `cpp/YogaNode.cpp`: inspected `YogaNode::setStyle(...)` around the matrix and
  transform branch. Lines 774-780 define `applyMatrixStyle`; lines 782-847 keep
  non-empty transform precedence and route empty transform to the helper; lines
  849-850 route omitted transform to the same helper.
- `scripts/verify-yoganode-nitro-materialization.mjs`: inspected the generated
  materialized transform proof. Lines 2170-2211 prove the existing non-empty
  transform-over-matrix precedence for translateX, translateY, and scale. Lines
  2214-2237 prove `transform: []` plus matrix fallback through generated
  `setStyle(...)`.
- `worker-progress/worker-159-transform-empty-matrix.md`: inspected the
  reported changes, commands, and stated proof boundary. The report correctly
  marks no-matrix empty transform as source-grounded rather than separately
  materialized.
- `git show 4a24f28 -- ...`: inspected the Worker 159 branch commit patch.
- `git show -m 1201301 -- ...`: inspected the merge commit patch relative to
  main's first parent.
- `src/specs/style.ts`: confirmed the public `Transform` array supports
  rotateX, rotateY, rotateZ, scale, scaleX, scaleY, translateX, translateY,
  skewX, and skewY, while current generated materialized transform assertions
  only cover translateX, translateY, scale, empty fallback, and precedence.
- Recent audits, especially Workers 154, 156, and 158: confirmed the prior
  ranking path from materialized paint fields to clip/matrix/transform,
  MatrixArray16, then the empty-transform edge.
- No nested agents were used for this audit.

## Commands run and results

- `env PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH git diff --check HEAD~1 HEAD`:
  passed.
- `env PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-yoganode-nitro-materialization.mjs`:
  passed.
- `env PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization`:
  passed. The host-JSC materialization verifier compiled, linked, and ran; its
  output explicitly named non-empty transform precedence and empty-transform
  matrix fallback.
- `env PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix`:
  passed all 28 commands in 4m 45s. It reran materialization as command 20,
  removed `tsconfig.tsbuildinfo`, removed its matrix temp parent, and reported
  no remaining new tracked artifacts.

Additional local blocker probes for ranking:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `command -v pod`, `command -v gradle`, `command -v adb`,
  `command -v cmake`, and `command -v ninja`: exited 1.
- `java -version`: exited 1 with "Unable to locate a Java Runtime."
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

## Proof boundary and overclaim risks

Proven after Worker 159:

- Host-JSC Nitro `YogaNode::toObject(runtime)` materialization.
- Generated materialized `setStyle(...)` invocation from a JS object.
- Public `transform: []` plus matrix-array payload conversion into native
  `_style.transform`, `_style.matrix`, and `_matrix` fallback state.
- Non-empty transform precedence over matrix fallback for the existing
  translateX, translateY, and scale fixture.
- Source-level reset behavior for `transform: []` without matrix, through
  `applyMatrixStyle()` and `_matrix.reset()`.

Not proven:

- A separate generated materialized `transform: []` with no `matrix` fixture.
- Generated materialized coverage for every public transform operation variant.
- React Native bridge delivery, Nitro module registry install in a real React
  Native runtime, iOS/Android app build/run, simulator/device launch, native
  platform presentation, UI-runtime Worklets execution, real Reanimated
  SharedValue delivery, RNGH native delivery, command rendering for this case,
  pixel rendering, exact transform render fidelity, or exact hit-test behavior
  for this new fallback case.

Worker 158's matrix nuance still matters: runtime JS matrix arrays in these
probes exercise the `std::shared_ptr<SkMatrix>` custom-converter branch, not a
claim that JS arrays select the generated tuple-16 variant.

## Remaining locally unblocked gaps considered

1. Generated materialized transform-operation breadth plus empty no-matrix
   reset proof. Public `Transform` has ten operation variants, while the
   materialized transform assertion currently proves translateX, translateY,
   scale, precedence over matrix fallback, and empty-transform matrix fallback.
   This is concrete, local, and adjacent to the just-fixed root cause.
2. Broader generated materialized `NodeStyle` inventory/drift guard. This would
   reduce future drift risk across generated style delivery, but it is broader
   hygiene and less behavior-specific than completing transform semantics.
3. Native/platform app build-run proof. The feasible matrix proves package,
   source, generated native project, host-native, and example bundle checks,
   but full iOS/Android build/run remains locally blocked by the probed
   Xcode/CocoaPods/Java/Android toolchain gaps.
4. Real RN runtime bridge/Nitro registry/Reanimated/RNGH delivery. Existing
   local verifiers cover host-JSC/native and Node VM boundaries only. This
   remains outside the current local harness unless platform prerequisites or a
   new runtime harness are introduced.
5. Exact transform pixel/render fidelity. Host-native render checks are broad,
   but transform visual fidelity for every operation is a separate rendering
   target and higher risk to overclaim than generated wrapper/native-state
   breadth.

## Recommended Worker 161 target

Assign Worker 161: expand generated materialized transform proof in
`scripts/verify-yoganode-nitro-materialization.mjs`.

Exact scope:

- Add table-driven or helper-driven generated `setStyle(...)` cases for the
  remaining public transform variants: rotateX, rotateY, rotateZ, scaleX,
  scaleY, skewX, and skewY. Existing translateX, translateY, and scale coverage
  can remain or be folded into the table if that simplifies maintenance.
- For each operation, use a fresh materialized YogaNode, invoke generated
  `setStyle(...)` through the materialized JS object, assert the expected
  `_style.transform` variant/value, assert `_matrix` is non-null, and compare
  `_matrix` with the expected `SkM44`/`SkMatrix` result.
- Add one generated materialized case for `transform: []` with no `matrix` that
  asserts `_style.transform` is present and empty, `_style.matrix` is absent,
  and `_matrix == nullptr`.
- Preserve the existing non-empty transform precedence and empty-transform
  matrix fallback assertions.

Write boundaries:

- Expected files: `scripts/verify-yoganode-nitro-materialization.mjs` and
  `worker-progress/worker-161-materialized-transform-breadth.md`.
- Do not edit product C++ unless the new proof exposes a real source bug.
- Do not edit generated files, package metadata, docs, or unrelated verifiers
  unless a necessary root-cause fix requires it and is documented.

Verification expectations:

- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-native-hit-testing`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix`
- `git diff --check`

Expected proof boundary:

- Host-JSC Nitro materialization, generated wrapper conversion, and native
  `_style.transform` / `_matrix` state for public transform operations and
  empty-transform reset semantics only.
- No claim of React Native bridge delivery, platform build/run, UI-runtime
  Worklets/Reanimated delivery, RNGH delivery, command rendering, pixel
  rendering, exact hit-test behavior, or exact transform render fidelity.

## Cleanup status

- Report-only scope was preserved.
- Product source, verifier scripts, generated files, package metadata, and docs
  were not edited by Worker 160.
- The feasible matrix removed its temp parent and reported no remaining new
  tracked artifacts after cleanup.
- A direct `/tmp` check found no remaining `rnskia-feasible-matrix-*` temp
  parent.
- Ignored dependency/native/example artifacts were preserved.

Goal finished.
