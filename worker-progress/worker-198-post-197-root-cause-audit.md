# Worker 198 - Post-Worker 197 root-cause audit

## Summary

Worker 197's proof boundary should be accepted.

The merged Worker 197 commit `fd6c93d Add materialized layout edge breadth
proof`, merged as `ee50ae8 Merge worker 197 layout edge breadth`, made a
scoped verifier-only expansion to
`scripts/verify-yoganode-nitro-materialization.mjs` plus its worker report.
The current branch history then accepted that work in `3885a58 Accept worker
197 layout breadth` and prepared this audit in `a4a777e Prepare worker 198
audit`.

The new evidence is meaningful and bounded: it proves selected host-JSC
generated-wrapper/materialized `YogaNode` delivery for residual layout
edge/constraint cases through generated `setStyle(...)`,
`insertChild(...)`, `computeLayout(...)`, native Yoga state, selected computed
native layout values, and generated `layout` getter values. I found no reason
to reject the proof, and the current verifier/report wording avoids the main
end-to-end overclaims.

## Changed files

- `worker-progress/worker-198-post-197-root-cause-audit.md`

No product files, verifier files, or master docs were edited by this audit.

## Commands run

- `git status --short --branch`: clean at start on
  `worker/198-post-197-root-cause-audit`.
- `git log --oneline --decorate --max-count=12`: confirmed Worker 197 merge,
  acceptance, and Worker 198 prep commits are in branch history.
- `git show --stat --oneline fd6c93d ee50ae8 3885a58 a4a777e`: confirmed
  Worker 197 touched only the materialization verifier and its report, while
  acceptance/prep commits touched master docs.
- `git show --find-renames --find-copies --stat --patch --minimal fd6c93d --
  scripts/verify-yoganode-nitro-materialization.mjs
  worker-progress/worker-197-materialized-layout-edge-breadth.md`: reviewed
  Worker 197's verifier/report diff.
- Read `WORKER_BRIEF.md`, `MASTER_PLAN.md`, `MASTER_PROGRESS.md`,
  `worker-progress/worker-197-materialized-layout-edge-breadth.md`,
  `worker-progress/worker-196-post-195-root-cause-audit.md`,
  `src/specs/style.ts`, `cpp/YogaNode.cpp`,
  `nitrogen/generated/shared/c++/NodeStyle.hpp`,
  `nitrogen/generated/shared/c++/HybridYogaNodeSpec.hpp`, and
  `nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp`.
- `git diff --check`: passed before report writing.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in `4m 33s`.
  Cleanup removed a generated `tsconfig.tsbuildinfo`, reported no remaining
  new tracked artifacts, and removed the matrix temp parent.

Platform reprobes:

- `xcodebuild -version`: failed because active developer directory is
  `/Library/Developer/CommandLineTools`, not full Xcode.
- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because SDK
  `iphonesimulator` cannot be located.
- `pod --version`: `command not found: pod`.
- `gradle -v`: `command not found: gradle`.
- `adb version`: `command not found: adb`.
- `cmake --version`: `command not found: cmake`.
- `ninja --version`: `command not found: ninja`.
- `java -version`: failed with `Unable to locate a Java Runtime`.
- `printenv ANDROID_HOME`: unset.
- `printenv ANDROID_SDK_ROOT`: unset.

## Evidence gathered

- `src/specs/style.ts` publicly exposes the residual layout fields Worker 197
  targeted: `alignContent`, `alignSelf`, `flexWrap`, `direction`, `display`,
  `boxSizing`, min/max constraints, `aspectRatio`, start/end/top/bottom edges,
  percentage-capable values, and auto-capable values.
- `nitrogen/generated/shared/c++/NodeStyle.hpp` contains generated optional
  fields and `obj.getProperty(...)` reads for those style keys.
- `cpp/YogaNode.cpp` maps those generated `NodeStyle` fields to native Yoga
  setters/gettable Yoga state, including align, wrap, direction, display, box
  sizing, min/max constraints, aspect ratio, and edge position values.
- Worker 197 added materialized host-JSC C++ cases that build real
  `YogaNode::toObject(runtime)` objects and call generated `setStyle(...)`,
  `insertChild(...)`, and `computeLayout(...)` wrappers.
- The residual layout case asserts generated delivery into native `_style`
  optionals, selected Yoga getters, selected computed native layout values,
  and generated `layout` getter values for constrained, aspect-ratio, and
  absolute-position children.
- The display-none case separately asserts generated `display: "none"`
  delivery, Yoga display state, zero child layout, and generated `layout`
  getter output.
- The materialization verifier's own output explicitly says this is host-JSC
  Nitro materialization/generated-wrapper evidence and excludes exact Yoga
  conformance, RN bridge/runtime delivery, platform app build/run,
  UI-runtime Worklets/Reanimated delivery, exhaustive layout coverage, and
  exact render fidelity.
- The full feasible matrix still passes after Worker 197, including the
  focused materialization check as item 20.

## Proof boundary and overclaim risks

Accepted boundary:

- Host-JSC Nitro `YogaNode::toObject(runtime)` materialization.
- Generated materialized wrapper execution for selected residual layout style
  fields.
- Generated `setStyle(...)`, `insertChild(...)`, `computeLayout(...)`, and
  generated `layout` getter behavior for the added cases.
- Selected native `_style` optionals, selected Yoga style getters, and selected
  computed native/generated layout values.

Explicit non-claims:

- No React Native bridge delivery proof.
- No Nitro registry proof inside a React Native runtime.
- No UI-runtime Worklets or Reanimated delivery proof.
- No iOS/Android build/run, simulator/device, native presentation, or platform
  proof.
- No exact Yoga conformance beyond asserted values.
- No exhaustive layout field or layout-combination coverage.
- No exact render fidelity proof.

Residual risks:

- The generated residual layout cases are selected stable examples, not a Yoga
  layout conformance suite.
- The proof exercises generated wrappers in a host-JSC harness; it does not
  prove the same payloads travel through React Native app surfaces.
- Some public layout style fields are now better represented in materialized
  native proof than in public/Reconciler dynamic-style proof.
- `MASTER_PROGRESS.md` has a stale phrase saying the next step is a fresh
  post-Worker 195 audit, despite the current prepared worker being the
  post-Worker 197 audit; this is documentation drift only and was not edited
  due to this audit's report-only scope.

## Cleanup status

- Matrix cleanup removed the generated `tsconfig.tsbuildinfo`.
- No product files, verifier files, generated Nitro files, package files, or
  master docs were changed by this audit.
- Ignored dependency symlinks in root/example `node_modules` remain expected
  worker setup.
- Final `git diff --check`: passed.
- Final `git status --short --branch`: branch
  `worker/198-post-197-root-cause-audit` with only
  `?? worker-progress/worker-198-post-197-root-cause-audit.md`.

## Recommended next tasks

1. Public/Reconciler dynamic layout-style proof.
   - This is the strongest locally unblocked next target. Worker 197 improved
     host-JSC generated-wrapper/native layout proof, while prior dynamic-style
     public/Reconciler coverage is stronger for transform, matrix, layer,
     clip, and radius paths than for layout-specific fields.
2. Further materialized layout edge coverage only if a follow-up identifies a
   concrete high-risk missing layout combination.
   - Worker 197 already closed the target selected by Worker 196, so generic
     breadth expansion is lower value unless tied to a specific residual risk.
3. Platform-native app build/run only after local toolchain blockers change.
   - Full Xcode/iPhone simulator SDK, CocoaPods, Gradle, ADB, CMake, Ninja,
     Java, and Android SDK env vars remain unavailable in this environment.

Goal finished.
