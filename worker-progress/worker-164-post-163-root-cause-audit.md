# Worker 164 - Post-worker-163 root-cause audit

## Summary

Report-only audit completed for Worker 163. I accept Worker 163's proof-only
boundary: composed public `style.transform` arrays now have bounded
host-native proof through concrete `YogaNode::_matrix` consumers, not only
through `_style.transform` or `_matrix` equality.

Changed files in this worker: this report only.

The strongest next locally unblocked target is public/Reconciler transform
authoring proof: packed TypeScript and source-level Reconciler coverage for
static `style.transform`, whole `SharedValue<Transform>`, and selected nested
`SharedValue` transform leaves. Worker 161 proved generated materialized native
delivery, and Worker 163 proved native render/hit-test consumers. The remaining
local gap is the public JSX/Reconciler source path into those native proofs.

## Recovery note

The orchestrator launched Worker 164 as managed subagents with the assigned
worktree and `goal: true`, but the initial attempt and a shorter retry both
stayed running without producing a report, commit, or worktree changes. Both
were closed as stuck.

This report was recovered from the clean assigned worktree to avoid blocking
the orchestration loop. No product code was edited.

## Worker 163 acceptance verdict

Accepted.

Worker 163 changed:

- `scripts/verify-yoganode-native-hit-testing.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-163-transform-composition-runtime.md`

Worker 163 commit `863fb17` was merged as `5cfe4bc`.

The implementation is coherent:

- The hit-test verifier now covers composed public transform arrays through
  `YogaNode::hitTestTagAt()` / `hitTestInternal()`:
  - `translateX + translateY + scale`
  - `translateX + rotateZ`
- The command/render verifier now covers bounded raster evidence for
  `translateX + translateY + scale` through `YogaNode::renderToContext()` and
  `ctx.canvas->concat(*_matrix)`.
- The assertions are intentionally runtime-consumer evidence: they check
  transformed hit-test points and raster pixels, not only state equality.
- No product C++ bug was found and no product C++ was changed.

The proof boundary is correctly narrow. It proves host-native render/hit-test
consumers of `_matrix`; it does not prove React Native bridge delivery, Nitro
registry install in a React Native runtime, platform app runtime, UI-runtime
Worklets/Reanimated delivery, RNGH gesture delivery, exhaustive transform
rendering, or exact GPU fidelity.

## Evidence inspected

- `worker-progress/worker-163-transform-composition-runtime.md`.
- `scripts/verify-yoganode-native-hit-testing.mjs`: inspected the new composed
  transform-array hit-test cases and proof-boundary output.
- `scripts/verify-yoganode-native-commands-render.mjs`: inspected the new
  composed transform raster case and proof-boundary output.
- `scripts/verify-yoganode-nitro-materialization.mjs`: confirmed Worker 161's
  generated materialized transform proof remains a separate boundary.
- `cpp/YogaNode.cpp` and `cpp/YogaNode.hpp`: confirmed render consumes
  `_matrix` through canvas concat and hit testing consumes `_matrix` through
  inverse coordinate mapping.
- `src/specs/style.ts` and `src/jsx.ts`: confirmed public `Transform` variants
  and JSX authoring support for static transform arrays, whole
  `SharedValue<Transform>`, and animated transform entry leaves.
- `scripts/verify-package-typescript-consumer.mjs` and
  `scripts/verify-reconciler-animated-bindings.mjs`: confirmed there is broad
  dynamic style proof, but no explicit public transform authoring/Reconciler
  transform listener case.

## Commands run and results

All Node/npm checks used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `git diff --check 5cfe4bc~1 5cfe4bc`: passed.
- `node --check scripts/verify-yoganode-native-hit-testing.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-hit-testing`: passed. Output explicitly names
  composed public transform-array inversion.
- `npm run check:yoganode-native-commands-render`: passed. Output explicitly
  names composed public transform-array rendering and bounds the raster proof.
- `npm run check:yoganode-nitro-materialization`: passed, preserving Worker
  161's generated materialized single-transform, precedence, fallback, and
  reset proof.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 46s. The
  matrix reran the focused hit-test, command/render, and materialization checks,
  removed `tsconfig.tsbuildinfo`, removed its matrix temp parent, and reported
  no remaining new tracked artifacts.

Current local platform blocker probes:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `command -v pod`, `gradle`, `adb`, `cmake`, and `ninja`: failed.
- `java -version`: failed because no Java runtime is available.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

## Proof boundary and overclaim risks

Proven after Worker 163:

- Host-native composed public transform arrays can affect
  `YogaNode::hitTestInternal()` coordinate inversion.
- Host-native composed public transform arrays can affect
  `YogaNode::renderToContext()` raster output through `_matrix` and canvas
  concat.
- Worker 161's generated materialized transform delivery remains green.

Not proven:

- Public packed TypeScript authoring for `style.transform` variants and dynamic
  transform forms.
- Source-level Reconciler listener registration/update/cleanup for nested
  dynamic `style.transform` leaves.
- Actual React Native bridge delivery or Nitro registry install in a React
  Native runtime.
- iOS/Android app build/run, simulator/device launch, or native platform
  presentation.
- UI-runtime Worklets execution, real Reanimated SharedValue delivery, RNGH
  native delivery, or transformed gesture delivery.
- Exhaustive transform rendering or exact GPU/platform fidelity.

Worker 158's matrix nuance still matters: JS matrix arrays exercise the
`std::shared_ptr<SkMatrix>` custom converter path, not generated tuple-16
selection. Worker 161's generated materialized transform proof is separate
from Worker 163's host-native runtime-consumer proof.

## Remaining locally unblocked gaps considered

1. Public/Reconciler transform authoring proof. `src/jsx.ts` intentionally
   exposes `style.transform` as static transform arrays, whole
   `SharedValue<Transform>`, and animated transform entry leaves. Existing
   packed-consumer and Reconciler verifiers prove broad style dynamics, but they
   do not name transform authoring or nested transform listener behavior. This
   is now the strongest adjacent public-path gap after Workers 161 and 163.
2. Transform variant/source drift guard. Useful hygiene, but lower current
   value than proving the supported public authoring path reaches Reconciler
   style delivery.
3. Broader transform render coverage. Worker 163 intentionally added bounded
   stable raster/hit-test cases. More cases risk overclaiming exact transform
   geometry before public-path proof is explicit.
4. Platform/native app runtime proof. Still blocked by local Xcode/CocoaPods,
   Java, Android SDK, Gradle, ADB, CMake, and Ninja gaps.
5. React Native runtime/Nitro registry bridge proof. Valuable, but not the next
   strongest local target without a new runtime harness.

## Recommended Worker 165 target

Assign Worker 165: public/Reconciler transform authoring proof.

Exact scope:

- Extend `check:package-typescript-consumer` with packed-consumer JSX cases for
  static `style.transform` arrays covering representative public variants,
  whole `SharedValue<Transform>`, and selected nested transform entry
  `SharedValue<number>` leaves.
- Extend `check:reconciler-animated-bindings` with source-level Reconciler
  cases proving `style.transform` dynamic leaves register JS style listeners,
  resolve initial snapshots, rebuild the host style on updates, invalidate, and
  clean up listeners.
- Preserve Worker 161's generated materialized/native-state proof and Worker
  163's host-native runtime-consumer proof without duplicating them.
- If the proof exposes unsupported nested dynamic transform behavior, fix the
  root cause or narrow the public type contract intentionally.

Write boundaries:

- Expected files:
  - `scripts/verify-package-typescript-consumer.mjs`
  - `scripts/verify-reconciler-animated-bindings.mjs`
  - `worker-progress/worker-165-transform-public-reconciler-proof.md`
- Do not edit product source unless the new proof exposes a real source/type
  contract bug.
- Do not edit generated files, package metadata, docs, or unrelated verifiers
  unless required by a documented root-cause fix.

Verification expectations:

- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-package-typescript-consumer.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH node --check scripts/verify-reconciler-animated-bindings.mjs`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:package-typescript-consumer`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:reconciler-animated-bindings`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:yoganode-nitro-materialization`
- `PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH npm run check:feasible-matrix`
- `git diff --check`

Expected proof boundary:

- Packed TypeScript public authoring and Node VM source-level Reconciler style
  listener delivery for transform styles only.
- No claim of actual React Native bridge delivery, Nitro registry install,
  platform app runtime, UI-runtime Worklets/Reanimated delivery, RNGH delivery,
  host-native render/hit-test beyond existing Worker 163 coverage, simulator or
  device behavior, or exact transform render fidelity.

## Cleanup status

- Report-only scope was preserved.
- Product source, verifier scripts, generated files, package metadata, and docs
  were not edited.
- The feasible matrix removed its temp parent and reported no remaining new
  tracked artifacts after cleanup.
- Ignored dependency/native/example artifacts were preserved.
- The stuck Worker 164 subagents were closed.

Goal finished.
