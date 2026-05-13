# Worker 238 - Path Stroke Native Float Validation

## Summary

Implemented deterministic pre-narrow native-float validation for stroke numeric `float` leaves before any `double` is narrowed to `float`.

- Direct `JSIConverter<RNSkia::StrokeOpts>` now parses `width`, `miter_limit`, `miterLimit`, and `precision` as `double`, validates finite/native-float range with `abs(value) <= numeric_limits<float>::max()`, then narrows.
- Public `path.stroke` command conversion now reuses the same native-float helper, preserving `miter_limit` over `miterLimit` alias fallback and rejecting before same-type `PathCmd` mutation.
- Native command/render and generated Nitro materialization verifiers now cover native-float overflow for `path.stroke.width`, `path.stroke.miter_limit`, `path.stroke.miterLimit`, and `path.stroke.precision`, plus direct `StrokeOpts` overflow cases.

## Changed Files

- `cpp/JSIConverter+StrokeOpts.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-238-path-stroke-native-float-validation.md`

## Commands Run

- `git diff --check`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run typecheck`
- `npm run check:feasible-matrix`

## Evidence Gathered

- `git diff --check` passed before and after the heavy verification run.
- Both verifier scripts passed `node --check`.
- `npm run check:yoganode-native-commands-render` passed, compiling/linking the host executable and asserting non-finite plus native-float-overflow stroke rejection for command and direct `StrokeOpts` paths.
- `npm run check:yoganode-nitro-materialization` passed, asserting generated materialized `setCommand(path)` rejects non-finite plus native-float-overflow stroke values before preserving existing same-type `PathCmd` state.
- `npm run typecheck` passed.
- `npm run check:feasible-matrix` passed all 28 child checks in 4m 12s, including reruns of the focused native command/render and Nitro materialization verifiers.

## Proof Boundary And Overclaim Risks

- Proven: direct `StrokeOpts` and public command `path.stroke` numeric fields reject NaN, infinities, and values outside native `float` range before narrowing.
- Proven: same-type `PathCmd` state and command pointer are preserved for covered invalid public command stroke cases.
- Proven: public-key precedence remains intact because `miter_limit` is still checked before the `miterLimit` alias.
- Not proven: iOS/Android app build/run, simulator/device launch, React Native bridge delivery, UI-runtime Worklets delivery, or exhaustive render geometry fidelity beyond the existing bounded verifier claims.

## Review Notes

- Quality/maintainability: centralized stroke native-float validation removes duplicated post-narrow checks and keeps direct plus command behavior aligned.
- Performance: added validation is constant-time per optional numeric leaf and only runs during conversion.
- Security/robustness: rejecting overflow before narrowing avoids implementation-defined or platform-sensitive invalid `float` state.
- Compatibility: error text now says `expected a finite native float` for stroke numeric values, matching the stricter contract.

## Cleanup Status

- No generated/tracked artifacts remain from verification.
- `npm run check:feasible-matrix` removed its temporary parent and reported no remaining new tracked artifacts.
- Existing unrelated regenerable directories such as `node_modules/` were left untouched.

## Recommended Next Tasks

- Audit remaining direct RN Skia numeric float converters that still validate only after narrowing.
- Consider consolidating shared native-float wording across style, command point, AnimatedDouble, and stroke validation where public contracts allow it.

Goal finished.
