# Worker 158 - Post-157 Root-Cause Audit

## Summary

Accepted Worker 157's materialized `MatrixArray16` proof boundary. The added
proof is source-grounded, scoped to host-JSC Nitro materialization, and avoids
claiming that JS array payloads select the generated tuple-16 variant.

The focused materialization verifier passed. The aggregate feasible matrix
could not be reconfirmed end-to-end in this worktree because its structured
runner twice failed to spawn `npm` after earlier `npm` commands had already
started and passed. Standalone replacement checks for the relevant focused
materialization path, package lifecycle, Android archive discovery, native
hit-testing, native command/render coverage, and TypeScript all passed.

The next strongest locally unblocked root-cause target is materialized
`transform: []` matrix suppression: `YogaNode::setStyle(...)` enters the
`style.transform` branch whenever the optional is present, resets `_matrix` when
the transform array is empty, and skips the `style.matrix` fallback.

## Worker 157 acceptance decision

Accepted.

Worker 157 changed only:

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-157-materialized-matrix16.md`

The accepted proof is grounded in the public `MatrixArray16` authoring shape,
the generated `NodeStyle` matrix variant, the `SkMatrix` custom converter, and
native state assertions on `_style.matrix` plus `_matrix`.

Important nuance: the runtime materialized JS-array path chooses the
`std::shared_ptr<SkMatrix>` variant branch because Nitro variant conversion is
first-match and the `SkMatrix` converter accepts both 9- and 16-value arrays.
The tuple-16 native branch remains source-guarded, but this verifier correctly
does not claim that JS arrays exercise that tuple-16 branch.

## Commands run and results

- `git status --short --branch`: passed; clean on
  `worker/158-post-157-root-cause-audit` before writing this report.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: passed; compiled/linked and
  ran the host-JSC materialization probe with 9- and 16-value matrix-array
  delivery.
- `npm run check:feasible-matrix`: blocked. First run passed commands 1-12,
  then failed before command 13 with `Failed to start npm run
  check:android-skia-archives: spawn npm ENOENT`. Cleanup reported no remaining
  tracked artifacts and removed its temp parent.
- `npm run check:feasible-matrix`: blocked on retry. The retry passed commands
  1-3, then failed before command 4 with `Failed to start npm run
  check:package-lifecycle: spawn npm ENOENT`. Cleanup again reported no
  remaining tracked artifacts and removed its temp parent.
- `command -v npm`, `command -v node`, `command -v bun`, and `PATH` inspection:
  `npm`, `node`, and `bun` are available from the shell; this supports treating
  the aggregate failure as a local structured-spawn/PATH runner issue rather
  than a product verifier failure.
- `npm run check:android-skia-archives`: passed standalone after the aggregate
  failed to spawn it.
- `npm run check:package-lifecycle`: passed standalone after the aggregate
  failed to spawn it on retry.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run typecheck`: passed.
- Local platform-toolchain probe: `xcode-select -p` reports
  `/Library/Developer/CommandLineTools`; `pod`, `gradle`, `adb`, `cmake`, and
  `ninja` are missing; `/usr/bin/java` exists but `java -version` reports no
  Java runtime; `ANDROID_HOME` and `ANDROID_SDK_ROOT` are unset.

## Evidence inspected

- Required planning/context files: `WORKER_BRIEF.md`, `MASTER_PLAN.md`, and
  `MASTER_PROGRESS.md`.
- Worker 157 report:
  `worker-progress/worker-157-materialized-matrix16.md`.
- Worker 157 commit content: `31ecc75 Add materialized MatrixArray16 proof`.
- Public matrix contract: `src/specs/style.ts` defines `SkMatrixNative`,
  `MatrixArray9`, `MatrixArray16`, `MatrixArray`, and
  `matrix?: SkMatrixNative | MatrixArray`.
- Generated transport: `nitrogen/generated/shared/c++/NodeStyle.hpp` contains
  `matrix` as a variant of `std::shared_ptr<SkMatrix>`, tuple-9, and tuple-16.
- Conversion behavior: `JSIConverter+Variant.hpp` converts variants by first
  matching branch; `cpp/JSIConverter+SkMatrix.hpp` accepts array lengths 9 and
  16 for `std::shared_ptr<SkMatrix>`; RN Skia's `JsiSkMatrix.h` parses
  16-value arrays into a 3x3 matrix.
- Native state path: `cpp/YogaNode.cpp` applies matrix state through
  `makeMatrixPointer(...)` and updates `_matrix` in `setStyle(...)`.
- Worker 157 verifier additions:
  `makeMatrixArray16(...)`, `makeSkMatrix16(...)`,
  `assertGeneratedMatrix16Style(...)`, and the call before transform precedence
  coverage in `scripts/verify-yoganode-nitro-materialization.mjs`.
- Nested read-only explorer results:
  `proof_boundary_explorer` found no blocking proof issue and highlighted the
  same SkMatrix-branch nuance; `next_target_explorer` ranked empty transform
  matrix suppression first.

## Proof boundary and overclaim risks

Current accepted proof boundary:

- Host-JSC `YogaNode::toObject(runtime)` materialization.
- Generated YogaNode prototype wrapper delivery for `setStyle(...)`.
- Public 16-value JS matrix arrays delivered through generated `NodeStyle`
  conversion into native `_style.matrix`.
- Actual runtime branch asserted as `std::shared_ptr<SkMatrix>`, with
  `_style.matrix` and `_matrix` matching the expected 16-value matrix.
- Existing proof-boundary text continues to exclude React Native bridge
  delivery, Nitro module registry install inside a React Native runtime,
  iOS/Android build/run, simulator/device launch, native presentation,
  UI-runtime Worklets/Reanimated delivery, command rendering, pixel rendering,
  hit testing for this specific matrix case, and exact render fidelity.

Overclaim risk:

- Do not phrase the runtime assertion as tuple-16 generated variant delivery.
  JS arrays choose the `SkMatrix` custom converter branch first. The tuple-16
  branch is still source-guarded as a native fallback shape, not proven as the
  selected branch for JS arrays in this verifier.
- Worker 157's report already states this limitation explicitly, so no
  rejection or corrective product change is needed.

## Ranked next-target recommendation with rationale

1. Materialized `transform: []` matrix-suppression fix/proof.
   Public style allows both `transform` and `matrix`. In `YogaNode.cpp`, the
   presence of `style.transform` enters the transform branch, an empty array
   leaves `hasTransform == false`, `_matrix` is reset, and the `else if
   style.matrix` fallback is skipped. The current materialization verifier
   proves non-empty transform precedence over matrix fallback, but does not
   cover this empty-transform edge. Worker 159 should characterize and fix the
   root cause if empty transform is intended to behave as no transform, then add
   generated materialized `setStyle(...)` proof without claiming platform
   rendering or RN bridge delivery.
2. Materialized transform-operation breadth.
   Public `Transform` supports rotateX/Y/Z, scale, scaleX/Y, translateX/Y, and
   skewX/Y. Current materialized transform proof covers translateX,
   translateY, and scale. Broader table-driven materialized coverage would be
   locally feasible, but it is lower priority than the source-confirmed
   empty-array semantic edge.
3. Broader generated `NodeStyle` inventory/drift guard.
   A generated/public field inventory guard could reduce future drift across
   materialized style delivery, but it is broader hygiene rather than a concrete
   user-visible semantic risk.

Platform-native build/run remains separate. Local toolchain evidence still
shows the same blockers: Command Line Tools Xcode selection, missing CocoaPods,
missing Java runtime despite `/usr/bin/java`, missing Gradle/ADB/CMake/Ninja,
and unset Android SDK variables.

## Cleanup status

- No product source files were changed.
- The aggregate feasible-matrix attempts cleaned their temp parents and reported
  no remaining new tracked artifacts.
- Standalone verifier runs left no tracked artifacts before this report was
  written.
- Ignored dependency/native/example artifacts were preserved.

## Recommended next tasks

- Start Worker 159 on materialized `transform: []` matrix suppression.
- Keep platform-native build/run verification blocked until local toolchain
  prerequisites change.
- Treat the aggregate `spawn npm ENOENT` behavior as a verifier-runner hygiene
  note if it repeats outside this worktree; standalone scripts currently pass.

Goal finished.
