# Worker 196 - Post-Worker 195 root-cause audit

## Summary

Accepted Worker 195's overflow render/materialized bridge proof within its
stated bounded host-native and host-JSC generated-wrapper proof boundary.

Worker 195 proves selected `overflow: "hidden"` and `overflow: "scroll"`
delivery into direct native `NodeStyle`, Yoga overflow state, rectangular
`_clipsToBounds`, and bounded `YogaNode::renderToContext()` raster clipping.
It also proves generated materialized `setStyle({ overflow })` delivery through
`YogaNode::toObject(runtime)`, generated wrappers, native state, computed
layout, and bounded raster pixels.

## Context inspected

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-194-post-193-root-cause-audit.md`
- `worker-progress/worker-195-overflow-render-materialized-bridge.md`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `git show --stat --oneline 740cb3c`
- `git show --stat --oneline 1f35f96`

## Worker 195 acceptance decision

Accepted.

Evidence:

- The direct native verifier table-drives public overflow values `"hidden"` and
  `"scroll"`, then asserts `NodeStyle` converter output, public `toJSI(...)`
  serialization, native overflow enum state, Yoga overflow state, and
  rectangular `_clipsToBounds`.
- The direct native raster proof uses a `GroupCmd` parent and oversized
  `RectCmd` child, then asserts colored pixels inside the parent and
  transparent pixels at/past the parent bounds.
- The direct proof explicitly checks that plain overflow clipping does not
  populate style corner-radius clipping, global `borderRadius`, explicit
  `style.clip`, `_clipPath`, `_clipRect`, or `_clipRRect`.
- The materialized proof constructs parent/child YogaNodes through
  `YogaNode::toObject(runtime)`, calls generated `setCommand(group/rect)`,
  generated `setStyle({ overflow })`, generated `insertChild(...)`, generated
  `computeLayout(...)`, then renders the native parent and asserts bounded
  raster pixels.
- The materialized proof asserts native `_style.overflow`, Yoga overflow,
  rectangular `_clipsToBounds`, layout values, and separation from radius and
  explicit clip state.
- The updated verifier proof-boundary text describes host-native/host-JSC
  evidence and preserves exclusions for exact overflow fidelity, platform app
  runtime, React Native bridge delivery, Nitro registry install inside React
  Native, UI-runtime Worklets/Reanimated/RNGH delivery, assets, typography, and
  broader render paths.

## Verification commands and results

- `git status --short --branch`: clean before report, with only ignored
  `node_modules` symlinks after dependency-layout setup.
- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- Initial focused native verifier probes failed in this fresh worker worktree
  because its ignored `node_modules` install drifted from main: RN Skia headers
  lacked the local include shims already present in main's ignored dependency
  tree. This was an audit-environment issue, not tracked code drift.
- After aligning the worker worktree to main's known-good ignored
  `node_modules` / `example/node_modules` dependency layout, focused checks
  passed:
  - `npm run check:yoganode-native-commands-render`: passed.
  - `npm run check:yoganode-nitro-materialization`: passed.
- An initial full matrix rerun then failed at `lint-ci` only because the
  preserved stale worker-local `node_modules.worker196-stale-20260512`
  directory remained inside the worktree and ESLint scanned it. The stale
  directory was moved outside the worktree and removed after confirmation.
- Final `npm run check:feasible-matrix`: passed all 28 commands in `4m 39s`.
  - Item 17, `npm run check:yoganode-native-commands-render`: passed in
    `35.3s`.
  - Item 20, `npm run check:yoganode-nitro-materialization`: passed in
    `34.7s`.
  - Matrix cleanup removed generated `tsconfig.tsbuildinfo`.
  - Remaining new tracked artifacts after cleanup: none.

The prior Worker 196 spawn-agent attempt produced a nested read-only
proof-boundary review that also accepted Worker 195 within a bounded host
proof, but the parent agent stalled before writing a durable report. The
orchestrator closed the stuck agents and recovered this report manually in the
isolated Worker 196 worktree.

## Platform blocker snapshot

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `pod`: missing.
- `gradle`: missing.
- `adb`: missing.
- `cmake`: missing.
- `ninja`: missing.
- `command -v java`: `/usr/bin/java`, but `java -version` fails because no
  Java Runtime is installed.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

Interpretation: full CocoaPods install, Gradle build, simulator/device launch,
and platform-native app runtime proof remain blocked by local toolchain state.

## Next-target ranking

1. Residual generated materialized layout edge/constraint breadth.
   - Worker 193 proved a compact layout tree and one stable width special
     value, but intentionally did not exhaust public layout fields.
   - Remaining locally testable layout risk includes alignContent, alignSelf,
     flexWrap, direction/display/boxSizing, min/max constraints, aspectRatio,
     edge-specific aliases, percentage/auto values where stable, and additional
     computed layout edge cases.
2. Public/Reconciler dynamic layout-style proof.
   - Public style typing admits dynamic style values, but current dynamic
     source-level proof is stronger for transform, matrix, layer, clip, and
     radius paths than for layout-specific fields.
3. Platform-native app build/run.
   - Still lower priority locally because the required iOS/Android toolchains
     remain unavailable.

## Selected next worker target

Worker 197: residual generated materialized layout edge/constraint breadth.

Suggested scope:

- Extend `scripts/verify-yoganode-nitro-materialization.mjs` with a bounded
  generated materialized layout proof for additional public layout fields not
  covered by Worker 193.
- Prefer table-driven cases that call generated `setStyle(...)`,
  `insertChild(...)`, `computeLayout(...)`, and generated `layout` getter from
  materialized YogaNode objects.
- Assert selected native `_style` optionals, stable Yoga style getters, and
  selected computed layout values.
- Keep the proof bounded to host-JSC generated-wrapper/layout evidence. Do not
  claim exact Yoga conformance, React Native bridge delivery, platform app
  runtime, UI-runtime Worklets, or exhaustive layout coverage.

Expected checks:

- `git diff --check`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`

## Proof boundary and overclaim risks

Accepted Worker 195 boundary:

- Proven: selected direct host-native overflow transport/state/raster clipping
  and selected generated materialized overflow delivery/state/raster clipping
  for `"hidden"` and `"scroll"`.
- Not proven: exact overflow behavior beyond asserted host-raster pixels,
  exhaustive Yoga overflow conformance, GPU/platform clipping fidelity, React
  Native bridge delivery, Nitro registry install inside React Native, iOS or
  Android app build/run, simulator/device launch, native platform
  presentation, UI-runtime Worklets execution, real Reanimated delivery, RNGH
  native delivery, asset loading, exact typography, or every command/render
  path.

Overclaim risks:

- The raster assertions are selected point evidence at a rectangular boundary,
  not complete geometry equivalence.
- Host verifiers intentionally use local host shims and dynamic lookup for
  unentered platform-incompatible paths; they do not prove full platform link
  closure.
- The materialized proof is host-JSC generated-wrapper evidence, not a React
  Native application bridge proof.

## Cleanup status

- The original and restarted Worker 196 spawn-agents stalled without writing a
  durable report; both were closed by the orchestrator before manual recovery.
- Product/runtime source files were not edited.
- `MASTER_PLAN.md` and `MASTER_PROGRESS.md` were not edited in this worktree.
- The only tracked change is this report.
- Worker-local ignored dependency drift was handled inside this isolated
  worktree by using main's known-good ignored `node_modules` and
  `example/node_modules` symlinks. The stale worker-local dependency directory
  was moved outside the worktree and removed after it caused lint scanning
  noise.
- Matrix-owned temporary output was cleaned by the matrix verifier.
- Preserved ignored/local artifacts in the main checkout.

## Final status

Worker 195 is accepted. Worker 197 should target residual generated
materialized layout edge/constraint breadth.

Goal finished.
