# Worker 229 post-Worker 228 root-cause audit

## Summary

Accepted Worker 228.

Worker 228 closed the intended command numeric enum validation gap without a correctness blocker. Numeric command enum payloads now reject non-finite, fractional, and out-of-range values before same-type command mutation, while existing string enum and omitted/null optional behavior remains intact.

The managed Worker 229 subagent stalled before producing durable output. This report-only audit was recovered in the assigned Worker 229 worktree after the stalled subagent was closed, with no product-code edits.

## Evidence Reviewed

- Worker commit: `c79f168 Validate command numeric enum payloads`
- Merge commit: `bbcd7e0 Merge worker 228 command numeric enum validation`
- Acceptance commit: `da752c1 Accept worker 228 command numeric enum validation`
- Worker 228 report: `worker-progress/worker-228-command-numeric-enum-validation.md`
- Converter changes:
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `cpp/JSIConverter+StrokeOpts.hpp`
- Verifier changes:
  - `scripts/verify-yoganode-native-commands-render.mjs`
  - `scripts/verify-yoganode-nitro-materialization.mjs`
- Current coordination docs:
  - `MASTER_PLAN.md`
  - `MASTER_PROGRESS.md`

## Findings

- `cpp/JSIConverter+NodeCommand.hpp` now validates numeric enum payloads with `std::isfinite(...)`, integer checks via `std::trunc(number) == number`, explicit valid-value arrays, and stable property-specific messages.
- The command converter covers the intended public command enum paths:
  - `blurMaskFilter.blurStyle`: `[0, 1, 2, 3]`
  - `points.pointMode`: `[0, 1, 2]`
  - `path.fillType`: `[0, 1, 2, 3]`
  - `path.stroke.join`: `[0, 1, 2]`
  - `path.stroke.cap`: `[0, 1, 2]`
- String enum payloads continue through the pre-existing string switch paths, preserving valid string behavior and existing invalid-string errors.
- Optional omitted/null behavior is preserved. `parseBlurStyle(...)`, `parsePointMode(...)`, `parsePathFillType(...)`, `parseStrokeJoin(...)`, and `parseStrokeCap(...)` only enter the new numeric helper when the JS value is numeric; otherwise they keep the existing optional string conversion path.
- `cpp/JSIConverter+StrokeOpts.hpp` now applies the same finite/integer/range guard to direct numeric `stroke.join` and `stroke.cap`, while non-object direct `StrokeOpts` payload behavior and string join/cap parsing remain unchanged.
- The native command/render verifier contains state-preservation coverage for invalid `NaN`, fractional, and out-of-range numeric enum updates across `blurMaskFilter.blurStyle`, `points.pointMode`, `path.fillType`, `path.stroke.join`, and `path.stroke.cap`.
- The native command/render verifier also covers direct `StrokeOpts` numeric enum rejection for `stroke.join` and `stroke.cap`.
- The generated Nitro materialization verifier repeats the command numeric enum rejection pattern through generated JS-facing `setCommand(...)` wrappers and checks prior same-type command pointer/state preservation.
- Worker 228 did not overclaim React Native bridge delivery, Nitro registry install in a full React Native runtime, iOS/Android app build/run, simulator/device runtime, UI-runtime Worklets execution, or future command enum inventories.

## Commands Run

- `git diff --check bbcd7e0^1 bbcd7e0`: passed
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed
- `npm run check:yoganode-native-commands-render`: passed
- `npm run check:yoganode-nitro-materialization`: passed

Accepted existing main post-merge evidence from `MASTER_PROGRESS.md`:

- `git diff --check HEAD~1 HEAD`: passed after Worker 228 acceptance docs
- both updated verifier `node --check` commands: passed on main
- `npm run check:yoganode-native-commands-render`: passed on main
- `npm run check:yoganode-nitro-materialization`: passed on main
- `npm run typecheck`: passed on main
- `npm run check:feasible-matrix`: passed 28/28 in `5m 25s` on main

## Residual Risk

- The proof remains host-JSC/native and generated materialized wrapper coverage. It does not prove actual React Native bridge delivery, Nitro registry install inside a React Native runtime, platform app build/run, simulator/device presentation, UI-runtime Worklets execution, real Reanimated delivery, or RNGH native delivery.
- Future command enum fields added outside the current converter inventory will still need explicit validation and verifier coverage.
- The verifier proves representative invalid-number categories for each guarded enum property rather than every possible out-of-range numeric value. The shared helper and explicit valid-value arrays support the broader range claim.

## Recommended Next Target

Select deterministic finite/native-float validation for YogaNode method numeric arguments: generated `computeLayout(width, height)` and raw `hitTest(x, y)`.

Why it ranks first now:

- It is source-confirmed and still unclosed. `YogaNode::computeLayout(std::optional<double> width, std::optional<double> height)` casts optional doubles directly to `float`, and `YogaNode::hitTest(...)` casts numeric `x` and `y` directly to `float`.
- It is locally verifiable. `check:yoganode-nitro-materialization` already exercises generated `computeLayout(...)` through materialized YogaNode objects, and `check:yoganode-jsi-raw-methods` already exercises raw `hitTest(...)`.
- It affects observable behavior. Non-finite layout constraints can corrupt computed layout state, and non-finite hit-test coordinates can affect gesture/interaction routing.
- Broader public style and command numeric validation targets have now been addressed through Workers 210, 212, 214, 216, 218, 220, 222, 224, 226, and 228, leaving method-argument validation as the strongest remaining local finite-number boundary.

Suggested implementation shape:

- Add a small finite/native-float guard for `computeLayout.width`, `computeLayout.height`, `hitTest.x`, and `hitTest.y`.
- Reject invalid numeric arguments before `YGNodeCalculateLayout(...)`, before `_layout` / `_hasLayoutBeenComputed` mutation, and before hit-test traversal.
- Extend `scripts/verify-yoganode-nitro-materialization.mjs` with generated materialized `computeLayout(...)` invalid-number state-preservation cases.
- Extend `scripts/verify-yoganode-jsi-raw-methods.mjs` with raw `hitTest(...)` non-finite rejection and state-preservation cases.
- Preserve missing/undefined `computeLayout` arguments as Yoga undefined layout constraints, and preserve existing nonnumeric/missing argument errors for `hitTest(...)`.

Lower-ranked targets:

- Dynamic `AnimatedDouble` mutation-time validation remains policy-sensitive because UI-runtime Worklets and real Reanimated delivery are outside local proof.
- Platform-native build/run remains externally blocked unless local prerequisites become available.
- Exact render fidelity, typography fidelity, and asset loading/decoding remain important but are less direct than the source-confirmed method-argument numeric boundary.

## Cleanup Status

- No product files were edited.
- The only intended tracked change in this worktree is this report.
- Ignored dependency symlinks `node_modules/` and `example/node_modules/` were left in place for worker verification.
- No generated native/example folders were created in this worker worktree.

Goal finished.
