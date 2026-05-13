# Worker 233: Post-232 Root-Cause Audit

## Verdict

Accepted. I found no blocking correctness issue in Worker 232's dynamic
`AnimatedDouble::resolveNativeFloat()` implementation, selected command render
fail-closed behavior, static validation preservation, fallback behavior, or
verifier coverage.

Worker 232's root-cause claim is appropriately bounded: it proves host-native
Worklets `Synchronizable` extraction/resolution and selected `YogaNode`
render-time behavior for the complete current `AnimatedDouble` command-field
inventory, not real Reanimated/UI-runtime delivery or platform app execution.

## Changed Files

- `worker-progress/worker-233-post-232-root-cause-audit.md`

## Evidence Gathered

- `cpp/JSIConverter+AnimatedDouble.hpp:31` defines explicit `Unset`, `Valid`,
  and `Invalid` native-float resolution states, and `:71` exposes
  `AnimatedDouble::resolveNativeFloat()`.
- `cpp/AnimatedDouble.cpp:59` classifies unresolved values as `Unset`,
  rejects non-finite values and `abs(value) > std::numeric_limits<float>::max()`
  as `Invalid`, and narrows only valid values to `float`.
- `cpp/AnimatedDouble.cpp:117` wraps `resolve()` in a fail-closed catch path,
  so unconvertible dynamic `Synchronizable` values do not escape render-time
  mutation paths as exceptions or invalid floats.
- `cpp/YogaNode.hpp:492`, `:566`, `:669`, and `:805` route
  `blurMaskFilter.blur`, `rrect.cornerRadius`, `circle.radius`,
  `path.trimStart`, and `path.trimEnd` through `resolveNativeFloat()` before
  mutating render props.
- Invalid dynamic render values preserve the last safe state: blur keeps
  `_nativeBlur`, rrect leaves `props.r/props.rect` unchanged, circle leaves
  `props.r/_hasExplicitRadius` unchanged, and path leaves `props.start/end`
  unchanged. `Unset` still uses the prior documented fallbacks: blur `0`,
  rrect `0`, circle layout radius, path trim start `0`, and trim end `1`.
- `cpp/NodeCommand.hpp:44` through `:92`, `src/specs/commands.ts:124`
  through `:165`, and `src/Reconciler.ts:445` through `:458` confirm the
  current `AnimatedDouble` command-field inventory is exactly
  `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`,
  `path.trimEnd`, and `circle.radius`.
- Static validation is preserved: `cpp/JSIConverter+NodeCommand.hpp:384`
  still rejects non-finite static `AnimatedDouble` command values, and `:573`
  through `:615` applies that path to all five fields.
- Verifier coverage is meaningful, not just source-grep: the raw
  `AnimatedDouble` verifier mutates a real Worklets `Synchronizable` through
  finite, NaN, Infinity, native-float-overflow, and recovery cases; the
  command/render verifier asserts object state and bounded raster behavior for
  invalid dynamic mutations on circle, rrect, blur, and path trim.

## Commands Run

- `git diff --check d418b32^1 d418b32` - passed with no output.
- `node --check scripts/verify-animated-double-synchronizable.mjs` - passed
  with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs` - passed
  with no output.
- `npm run check:animated-double-synchronizable` - passed; compiled and ran the
  host `AnimatedDouble`/Worklets `Synchronizable` probe and reported dynamic
  NaN, Infinity, native-float-overflow rejection plus recovery.
- `npm run check:yoganode-native-commands-render` - passed; compiled and ran
  the host native command/render probe and reported dynamic fail-closed coverage
  for all five selected `AnimatedDouble` command props.
- `npm run check:yoganode-nitro-materialization` - passed as broader static
  preservation evidence; it reported generated materialized `setCommand(...)`
  non-finite static `AnimatedDouble` rejection for all five fields.

## Proof Boundary and Overclaim Risks

- Proven: host-JSC/native Worklets `Synchronizable` extraction, blocking
  dynamic reads through RN Skia's main runtime pointer, no-main-runtime fallback
  behavior, native-float classification, selected render-time command mutation
  behavior, bounded raster evidence, direct converter static rejection, and
  generated materialized static rejection for non-finite static values.
- Not proven: real UI-runtime Worklets execution, real Reanimated SharedValue
  delivery, JS listener scheduling, React Native bridge delivery, Nitro module
  registry install in a React Native runtime, iOS/Android build or launch,
  simulator/device presentation, exact Skia render fidelity beyond asserted
  pixels, or future `AnimatedDouble` fields added outside the current
  inventory.
- Residual risk: static `AnimatedDouble` command conversion still rejects only
  non-finite values. A finite value outside native `float` range is now prevented
  from becoming an invalid render prop by `resolveNativeFloat()`, but it is not
  rejected deterministically at direct/generated `setCommand(...)` conversion
  time.

## Quality, Performance, and Security

- Quality: the central resolution type avoids duplicating finite/range checks
  in each command and makes the unset-vs-invalid policy explicit.
- Performance: the render paths add only one resolution/classification per
  dynamic field per draw; no new persistent allocations or broad scans are
  introduced.
- Security/robustness: non-finite and native-float-overflow dynamic values no
  longer narrow into Skia-facing float props or mask-filter parameters. The
  catch-all render-time failure policy is intentional fail-closed behavior, but
  it should not be overclaimed as validation of every upstream producer.

## Cleanup Status

The verifier scripts removed their temporary roots. I did not edit generated
artifacts or unrelated files. The worktree was clean before writing this report.

## Recommended Next Root-Cause Target

Define and verify static `AnimatedDouble` native-float-overflow conversion
policy for direct and generated `setCommand(...)` paths. The likely files are
`cpp/JSIConverter+NodeCommand.hpp`,
`scripts/verify-yoganode-native-commands-render.mjs`, and
`scripts/verify-yoganode-nitro-materialization.mjs`. This should decide whether
finite values outside `float` range should throw before same-type command
mutation, matching the deterministic validation style already used for
non-finite static values and text/paragraph native-range numeric fields.

## Final Git Status

```text
## worker/233-post-232-root-cause-audit
?? worker-progress/worker-233-post-232-root-cause-audit.md
```

Goal finished.
