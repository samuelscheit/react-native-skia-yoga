# Worker 221 - Post-Worker 220 root-cause audit

## Summary

- Accepted Worker 220's boundary: static numeric command `AnimatedDouble` payloads for `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, `path.trimEnd`, and `circle.radius` now reject `NaN`, `Infinity`, and `-Infinity` before same-type native command state mutates.
- The implementation does not overclaim dynamic validation. Dynamic Worklets-backed `AnimatedDouble` object payloads still pass through the existing `JSIConverter<AnimatedDouble>` / `Synchronizable` path, and the focused verifier still proves selected dynamic command fallback, resolution, and mutation behavior.
- The strongest locally unblocked next root-cause target is deterministic finite-number validation for path stroke numeric payloads: `stroke.width`, `stroke.miter_limit` / `stroke.miterLimit`, and `stroke.precision`.
- No product/source/test code was changed by this audit.

## Evidence reviewed

- `MASTER_PLAN.md`: latest accepted implementation and follow-up queue identify Worker 220 as command `AnimatedDouble` finite validation and path stroke numeric finite validation as the next queued candidate.
- `MASTER_PROGRESS.md`: Worker 220 branch commit `4b162b6` was merged as `5fe7ff0`, with worker and main post-merge checks recorded as passing.
- `worker-progress/worker-220-command-animated-double-finite-validation.md`: Worker 220 claimed static numeric `AnimatedDouble` finite validation only, with explicit proof boundaries excluding platform app runtime and UI-runtime Worklets.
- Worker 220 diff/history: `5fe7ff0^1..5fe7ff0` / `4b162b6` touched only `cpp/JSIConverter+NodeCommand.hpp`, the two verifier scripts, and the Worker 220 report.
- Source inspection:
  - `parseStaticFiniteAnimatedDouble(...)` converts through `JSIConverter<AnimatedDouble>::fromJSI(...)`, then rejects only non-dynamic numeric values with `!std::isfinite(...)`.
  - The five scoped command fields use stable labels in the native converter.
  - Existing dynamic command tests still cover `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd`.
  - `parseStrokeOpts(...)` and direct `JSIConverter<RNSkia::StrokeOpts>::fromJSI(...)` still read `width`, `miter_limit` / `miterLimit`, and `precision` as raw optional floats without local finite checks.
- Nested subagents were not used; the uncertainty was resolvable from the source diff and focused verifier output.

## Commands run

- `git diff --check 5fe7ff0^1 5fe7ff0`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 50s.

## Findings

- No blocking correctness issue found in Worker 220.
- Converter behavior is appropriately scoped: static numbers are finite-checked after the existing `AnimatedDouble` conversion, while object payloads that become dynamic `Synchronizable` values are not rejected by the static finite helper.
- Native command/render coverage proves rejection before same-type mutation for the four affected command classes: `CircleCmd`, `RRectCmd`, `BlurMaskFilterCmd`, and `PathCmd`.
- Generated materialized coverage proves the same rejection path through generated JS-facing `YogaNode.setCommand(...)` wrappers.
- Proof boundaries are stated accurately. The evidence is host-JSC/native and generated-wrapper proof, not iOS/Android app runtime, simulator/device, UI-runtime Worklets, Reanimated delivery, exact render fidelity, or exhaustive future command-field proof.

## Recommended next target

Select finite validation for path stroke numeric payloads: `stroke.width`, `stroke.miter_limit` / `stroke.miterLimit`, and `stroke.precision`.

This is stronger than adjacent candidates because the gap is source-confirmed and locally testable. Public JSX exposes `path.stroke`, the command parser already preserves public `miter_limit` plus the `miterLimit` alias, and current verifiers prove only finite positive stroke values plus shape/enum rejections. They do not prove that `NaN` or infinity are rejected before prior `PathCmd` stroke state mutates.

The implementation should cover the command path and direct `StrokeOpts` converter path unless a worker proves one path is intentionally out of scope. Focused proof should extend both native command/render and generated materialized `setCommand(path)` coverage with same-type state preservation after invalid stroke numeric payloads.

## Quality, maintainability, performance, and security review

- Quality: Worker 220 added stable labels, inventory guards, and negative cases in both focused proof surfaces.
- Maintainability: the helper centralizes static `AnimatedDouble` finite validation without duplicating field-specific logic.
- Performance: the finite check is a constant-time parse-time guard on command updates only; no render-loop cost was introduced for static values.
- Security/robustness: rejecting non-finite numeric command payloads reduces undefined native rendering state and preserves previous command state after invalid input.
- Residual risk: dynamic `Synchronizable` values are intentionally preserved rather than finite-normalized, and platform runtime proof remains externally blocked by the established local environment boundaries.

## Proof boundary

Proven: Worker 220 rejects non-finite static numeric `AnimatedDouble` command payloads for the five scoped fields before same-type native command mutation through both direct host-native command conversion and generated materialized `setCommand(...)`.

Not proven: iOS/Android app build/run, simulator/device presentation, React Native bridge delivery, Nitro module registry install in a full app runtime, UI-runtime Worklets execution, Reanimated delivery, exact GPU/render fidelity, dynamic `Synchronizable` non-finite value validation, future command fields outside the current inventory, or path stroke numeric finite validation.

Goal finished.
