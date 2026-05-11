# Worker 156 - Post-worker-155 root-cause audit

## Summary

This was a report-only post-worker-155 audit. I accept Worker 155's generated
materialized `YogaNode.setStyle(...)` proof for `clip`, `matrix`, `transform`,
and `invertClip` within its stated host-JSC Nitro materialization boundary.

The new proof exercises materialized `YogaNode::toObject(runtime)` objects,
retrieves the generated `setStyle` wrapper from the JS object, invokes it with
the materialized object as `this`, and asserts native side effects on the
original C++ node. No blocking overclaim was found.

The next strongest locally unblocked target is a focused materialized
16-value `style.matrix` array conversion proof. That path is public, generated,
and native, but Worker 155 only proved the 9-value matrix-array conversion.

## Worker 155 acceptance decision

Accepted.

Worker 155 closes the selected Worker 155 target for the precise fields it
claimed:

- `clip` path/rect/rrect: the verifier builds all three payload shapes and
  asserts `_style.clip` variants plus `_clipPath`, `_clipRect`, `_clipRRect`,
  and sibling reset behavior in `scripts/verify-yoganode-nitro-materialization.mjs:1188`
  and `scripts/verify-yoganode-nitro-materialization.mjs:1929`.
- `invertClip`: the verifier asserts `_style.invertClip` and native clipping
  predicate inversion through `pointPassesClipping(...)` after generated wrapper
  delivery in `scripts/verify-yoganode-nitro-materialization.mjs:1999`.
- `matrix`: the verifier asserts a 9-value array is converted by the generated
  `NodeStyle` converter into a `std::shared_ptr<SkMatrix>` and then installed
  into `_matrix` in `scripts/verify-yoganode-nitro-materialization.mjs:2021`.
- `transform` precedence: the verifier supplies both `transform` and a matrix
  fallback, then asserts `_style.transform`, `_style.matrix`, native `_matrix`,
  and transform-over-matrix precedence in
  `scripts/verify-yoganode-nitro-materialization.mjs:2051`.

This complements, rather than duplicates, the adjacent direct-native coverage:
`check:yoganode-native-hit-testing` exercises real native hit testing for
matrix inversion, clipping, and `invertClip`, while Worker 155 proves generated
materialized wrapper delivery into the same native state.

No product C++/TypeScript fix was required.

## Evidence reviewed

- `MASTER_PLAN.md` and `MASTER_PROGRESS.md`, including the current integrated
  history through Worker 155 and the accepted feasible-matrix baseline.
- `worker-progress/worker-154-post-153-root-cause-audit.md`.
- `worker-progress/worker-155-materialized-clip-matrix-transform.md`.
- `scripts/verify-yoganode-nitro-materialization.mjs`, especially the new
  payload builders, generated wrapper calls, native state assertions, and proof
  boundary output.
- `scripts/verify-yoganode-native-hit-testing.mjs`, especially direct native
  matrix inversion, explicit clip path/rect/rrect, and `invertClip` hit-test
  coverage.
- `scripts/verify-yoganode-native-commands-render.mjs`, especially adjacent
  direct `NodeStyle` transport and style/render proof boundaries.
- `scripts/verify-reconciler-animated-bindings.mjs` and
  `scripts/verify-package-typescript-consumer.mjs`, for public dynamic-style,
  package, and Reconciler source-level boundaries.
- `src/jsx.ts`, `src/Reconciler.ts`, `src/specs/style.ts`, `cpp/YogaNode.cpp`,
  `cpp/YogaNode.hpp`, and `nitrogen/generated/shared/c++/NodeStyle.hpp`.

## Verification run/results

- `git status --short --branch` - passed before report edits and again after
  the feasible matrix; output was only
  `## worker/156-post-155-root-cause-audit`.
- `npm run check:yoganode-nitro-materialization` - passed. npm printed the
  existing `minimum-release-age` warning. The verifier compiled/linked the
  host-JSC probe and asserted generated materialized `setStyle(...)` delivery
  for the Worker 155 `clip`/`matrix`/`transform`/`invertClip` cases.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 32s. The
  aggregate reran `check:yoganode-nitro-materialization` as command 20/28,
  removed newly created `tsconfig.tsbuildinfo`, and removed matrix temp parent
  `/tmp/rnskia-feasible-matrix-u8R25O`.
- Local platform blocker probes:
  - `command -v pod` exited 1.
  - `xcode-select -p` returned `/Library/Developer/CommandLineTools`.
  - `java -version` exited 1 with "Unable to locate a Java Runtime."
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` were unset.
  - `command -v adb`, `command -v cmake`, `command -v ninja`, and
    `command -v gradle` exited 1.
- `git diff --check` - passed after writing this report.

## Remaining gaps ranked

1. Materialized 16-value `style.matrix` array conversion. `src/specs/style.ts`
   exposes `MatrixArray16`, generated `NodeStyle.hpp` accepts a tuple-16 matrix
   variant, and `YogaNode.cpp` uses a distinct `SkM44::RowMajor(...).asM33()`
   native conversion branch. Worker 155's materialized proof covers the 9-value
   array branch only.
2. `transform: []` matrix suppression. Native `YogaNode::setStyle(...)` enters
   the `transform` branch whenever `style.transform` is present; an empty
   transform vector resets `_matrix` and does not fall back to `style.matrix`.
   This should be locked down, but it is a narrower semantic edge than the
   public 16-value matrix conversion path.
3. Broader materialized `NodeStyle` inventory/drift. Generated `NodeStyle`
   currently has 80 optional public fields, while the materialized verifier
   intentionally covers selected high-risk style subsets. A generated/public
   field inventory guard would be useful, but it is broader hygiene rather than
   a concrete unproved conversion branch.
4. Public dynamic-style/package/Reconciler boundaries. Existing packed-consumer
   and Reconciler checks already cover representative dynamic command props,
   dynamic `style.layer`, dynamic `style.opacity`, and whole
   `SharedValue<YogaNodeStyle>` JS-style delivery. Remaining app-runtime proof
   depends on an actual RN/Reanimated/Nitro runtime.
5. Full platform-native app build/run. Node-run Expo CNG/native-generation and
   package metadata checks are green, but local iOS/Android build/run remains
   blocked by the toolchain gaps listed above.

## Selected Worker 157 target

Assign Worker 157: expand
`scripts/verify-yoganode-nitro-materialization.mjs` with generated materialized
`YogaNode.setStyle(...)` proof for 16-value `style.matrix` arrays.

Expected proof shape:

- Add a 16-value matrix payload builder that uses the public `MatrixArray16`
  shape from `src/specs/style.ts`.
- Use a fresh materialized `YogaNode` object from `YogaNode::toObject(runtime)`.
- Invoke generated `setStyle(...)` through the materialized JS object, not
  direct native `YogaNode::setStyle(...)`.
- Assert `_style.matrix` materializes as `std::shared_ptr<SkMatrix>` and that
  `_matrix` equals the expected `SkM44::RowMajor(values).asM33()` result.
- Keep the proof boundary to host-JSC generated wrapper conversion and native
  state mutation. Do not claim platform rendering, hit testing, command
  rendering, bridge delivery, or RN runtime integration.

Likely files and checks:

- Files: `scripts/verify-yoganode-nitro-materialization.mjs` and
  `worker-progress/worker-157-materialized-matrix16.md`.
- Product files should change only if the proof exposes a real conversion bug.
- Checks: `node --check scripts/verify-yoganode-nitro-materialization.mjs`,
  `npm run check:yoganode-nitro-materialization`,
  `npm run check:yoganode-native-hit-testing`,
  `npm run check:feasible-matrix`, and `git diff --check`.

## Proof boundaries/overclaim risks

Worker 155 proves host-JSC Nitro `YogaNode::toObject(...)` materialization,
generated YogaNode prototype wrapper delivery, and native C++ state mutation
from generated materialized `setStyle(...)` calls.

It does not prove React Native bridge delivery, Nitro registry installation in
a real React Native runtime, iOS/Android app build/run, simulator/device launch,
native platform presentation, UI-runtime Worklets execution, Reanimated
SharedValue delivery, RNGH/gesture delivery, pixel rendering, exact hit-test
behavior, command rendering, or render fidelity.

Non-blocking caveats:

- The matrix case is a 9-value array only; 16-value arrays remain the selected
  next target.
- The transform case proves representative translate/scale operations plus
  transform-over-matrix precedence, not every transform operation variant.
- `transform: []` matrix suppression is not asserted.
- The `invertClip` proof uses `pointPassesClipping(...)` as a native predicate
  check after generated wrapper delivery; it is not a full hit-test claim.

## Nested subagent/explorer results

- Completed read-only explorer `w156_remaining_gap_explorer` accepted Worker
  155's boundary and ranked the remaining local gaps. It recommended 16-value
  materialized matrix-array conversion as the Worker 157 target because the
  public contract, generated C++ type, and native conversion branch all exist,
  while Worker 155 only covered the 9-value branch. It ranked
  `transform: []` matrix suppression, broader `NodeStyle` inventory/drift,
  public dynamic-style/Reconciler/package boundaries, and platform build/run
  blockers below that target.
- Read-only explorer `w156_worker155_boundary_explorer` was launched to
  challenge the Worker 155 proof boundary but did not return a completed result
  before the root status checkpoint. It was closed as nonessential because
  direct source review and the completed gap explorer provided enough evidence
  to proceed.

## Cleanup status

- Report-only scope was preserved. The only intended tracked change is this
  progress report.
- Product source, verifier scripts, generated files, package metadata, and
  master docs were not edited.
- Ignored dependency/native/example artifacts were preserved:
  `node_modules`, `example/node_modules`, `example/ios`, `example/android`,
  `example/.expo`, `lib`, `.DS_Store`, and `tsconfig.tsbuildinfo`.
- The feasible matrix removed its own temp parent and left no new tracked
  artifacts after cleanup.

Goal finished.
