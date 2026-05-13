# Worker 222: Path Stroke Numeric Finite Validation

## Summary

Implemented deterministic finite-number validation for path stroke numeric payloads:

- `stroke.width`
- public `stroke.miter_limit`
- alias fallback `stroke.miterLimit`
- `stroke.precision`

Invalid `NaN`, `Infinity`, and `-Infinity` now reject during direct `JSIConverter<RNSkia::StrokeOpts>::fromJSI(...)` conversion and during public `NodeCommand` path command parsing before a same-type `PathCmd` update can mutate prior valid stroke state.

## Files

- `cpp/JSIConverter+StrokeOpts.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-222-path-stroke-numeric-finite-validation.md`

## Implementation

- Added finite checks to direct `StrokeOpts` optional float parsing, including both pre-narrowing `double` and post-narrowing `float` finiteness.
- Preserved direct `StrokeOpts` object-only behavior: top-level `null`, `undefined`, and non-objects still reject through the existing direct converter contract.
- Preserved public-key precedence for `miter_limit`: if the public key exists, it wins over `miterLimit`, including rejection when the public value is non-finite.
- Added path-command parser finite checks with path-scoped labels: `path.stroke.width`, `path.stroke.miter_limit`, `path.stroke.miterLimit`, and `path.stroke.precision`.
- Preserved omitted and `null` stroke semantics in command parsing: both remain "no stroke".
- Preserved join/cap parsing and rejection behavior.

## Verification

Required checks run and passed:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `git diff --check`
- `npm run check:feasible-matrix`

Additional focused check run after a verifier guard hygiene fix:

- `npm run check:rn-skia-imports`

## Evidence

- Native command/render verifier now asserts direct `StrokeOpts` finite rejection for `width`, `miter_limit`, `miterLimit`, and `precision`.
- Native command/render verifier now asserts public path command rejection for all three non-finite values across `width`, public `miter_limit`, alias fallback `miterLimit`, and `precision`, preserving the previously installed `PathCmd` pointer and valid stroke state.
- Nitro materialization verifier now asserts the same rejection matrix through generated JS-facing `setCommand(path)` wrapper calls, preserving same-type native `PathCmd` stroke state.
- Full feasible matrix passed after rerun: 28/28 commands passed, including the native command/render and Nitro materialization checks.

## Review

Quality and maintainability:

- The validation is localized to converter parsing, before native state mutation.
- Error labels are deterministic and property-specific.
- Existing alias and null/omitted semantics remain explicit in verifier coverage.

Performance:

- Validation adds constant-time `std::isfinite` checks only when optional numeric stroke fields are present.
- No render-path work was added.

Security and robustness:

- Rejecting non-finite stroke numbers prevents invalid numeric values from reaching Skia stroke state.
- Prior valid command state is preserved on invalid updates through conversion-time rejection.

## Proof Boundary

Proven locally: host-JSC/direct native conversion, real `YogaNode::setCommand()`, same-type `PathCmd` mutation prevention, direct `StrokeOpts` conversion, generated Nitro materialized wrapper conversion, and source guards for the public path stroke numeric field inventory.

Not proven: React Native bridge delivery, device/simulator runtime, platform presentation, UI-runtime Worklets execution, Reanimated SharedValue delivery, exact path/stroke geometry fidelity beyond existing bounded raster proof, or exhaustive command rendering behavior outside the checked matrix.

## Cleanup

- No ignored local artifacts were intentionally modified.
- Feasible matrix cleanup removed its temporary parent and its generated `tsconfig.tsbuildinfo` artifact.
- Final `git diff --check` passed.

## Next Tasks

- Continue finite validation audits for any remaining command payload numeric leaves not yet source-confirmed as covered.
- Keep future verifier source guards compatible with the RN Skia private-import hygiene scanner by using segmented path construction for installed-source inventory reads.

Goal finished.
