# Worker 228 command numeric enum validation

## Summary

Added deterministic converter-boundary validation for public numeric enum command payloads before same-type `YogaNode::setCommand(...)` mutation can replace existing native command state.

The implementation now rejects non-finite, fractional, and out-of-range numeric enum payloads for:

- `blurMaskFilter.blurStyle`
- `points.pointMode`
- `path.fillType`
- `path.stroke.join`
- `path.stroke.cap`
- direct `StrokeOpts` `stroke.join`
- direct `StrokeOpts` `stroke.cap`

String enum payloads and omitted/null optional enum fields continue through the existing paths.

## Files Changed

- `cpp/JSIConverter+NodeCommand.hpp`
  - Added explicit finite/integer/range numeric enum validation for command enum payloads.
  - Kept valid numeric enum values scoped to the Skia enum domains:
    - `SkBlurStyle`: `[0, 1, 2, 3]`
    - `SkCanvas::PointMode`: `[0, 1, 2]`
    - `SkPathFillType`: `[0, 1, 2, 3]`
    - `SkPaint::Join`: `[0, 1, 2]`
    - `SkPaint::Cap`: `[0, 1, 2]`
- `cpp/JSIConverter+StrokeOpts.hpp`
  - Added the same finite/integer/range guard for direct numeric `StrokeOpts` join/cap parsing.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added host-native JSC coverage proving invalid numeric enum payloads reject before command mutation.
  - Added direct `StrokeOpts` numeric enum rejection coverage.
  - Updated verifier inventory and proof-boundary text.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added generated JS-facing materialized `setCommand(...)` coverage proving invalid numeric enum payloads reject before command mutation.
  - Updated verifier inventory and proof-boundary text.

## Validation Behavior

Numeric enum values must be finite integers and must match the explicitly accepted Skia enum values for their property. Invalid numeric values throw stable, property-specific messages like:

`Invalid numeric enum value for path.stroke.join: expected a finite integer in [0, 1, 2].`

State preservation coverage proves rejected updates do not replace the existing same-type command pointer or mutate the previously installed native command state.

## Checks

- `git diff --check`: pass
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: pass
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: pass
- `npm run check:yoganode-native-commands-render`: pass
- `npm run check:yoganode-nitro-materialization`: pass
- `npm run check:feasible-matrix`: pass, 28/28 commands in 4m 37s
  - includes `npm run typecheck`, `npm run lint-ci`, `cd example && bun run typecheck`, native command/render, Nitro materialization, and generated example checks

## Residual Risk

This proves deterministic converter rejection and state preservation in the host-native and generated materialized verifier boundaries. It does not prove React Native bridge delivery, Nitro registry install in a full React Native runtime, iOS/Android app build/run, simulator/device launch, UI-runtime Worklets execution, or exhaustive future command enum fields added after this inventory.

Goal finished.
