# Worker 240 - Text/Paragraph Pre-Narrow Native Float Validation

## Summary

Moved text/paragraph style `float` conversion to explicit pre-narrow native-float validation.

- `cpp/JSIConverter+SkTextStyle.hpp` now checks `std::isfinite(number)` and `abs(number) <= numeric_limits<float>::max()` through `isFiniteNativeStyleFloat(...)` before `static_cast<float>(number)`.
- Plain-object text style point leaves still route through `getRequiredFiniteStyleFloat(...)`, so `shadows[].offset.x/y` use the pre-narrow guard. Host-object `JsiSkPoint` checks remain scoped to already-native `float` values.
- Native command/render and Nitro materialization source guards now reject regressions back to post-narrow `std::isfinite(narrowed)` checking.
- Runtime coverage now includes direct `TextStyle.letterSpacing` native-float overflow plus generated/direct command preservation for text font size, paragraph font size, and `StrutStyle.leading` native-range overflow.

The managed Worker 240 subagent stalled without edits; this branch/report were completed in the assigned isolated worktree as a fallback to keep the lane moving.

## Changed Files

- `cpp/JSIConverter+SkTextStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-240-text-paragraph-prenarrow-native-float-validation.md`

## Commands Run

- `git status --short --branch`
- `git diff --check`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run typecheck`
- `npm run check:feasible-matrix` - passed 28/28 in 4m13s

An initial verifier attempt failed because `text.textStyle.letterSpacing` is intentionally rejected by `TextCmd` as an unsupported rich text key before numeric validation. The extra float-leaf proof was moved to direct `TextStyle` conversion, and the focused checks then passed.

## Evidence

- Source guard: `getRequiredFiniteStyleFloat(...)` validates native-float range before narrowing and no longer relies on `std::isfinite(narrowed)`.
- Direct converter proof: `check:yoganode-native-commands-render` asserts `TextStyle.letterSpacing` native-float overflow rejects with the existing numeric text/paragraph style error.
- Command mutation proof: native and generated materialized verifiers assert non-finite/native-range-overflow rejection preserves same-type `TextCmd` and `ParagraphCmd` state for covered command payloads.
- Full matrix proof: all feasible local package/source/example checks passed after the shared converter change.

## Proof Boundary And Risks

Proven locally: host-JSC/native converter behavior, direct text-style conversion, generated materialized command wrapper behavior, same-type command state preservation for covered text/paragraph numeric payloads, source guard coverage, and full feasible matrix compatibility.

Not proven: iOS/Android app build/run, simulator/device launch, native platform presentation, React Native bridge delivery, Nitro registry install in a real React Native runtime, UI-runtime Worklets execution, RNGH delivery, exact typography, font fallback, or paragraph shaping fidelity.

## Review Notes

- Quality/maintainability: centralizes native-float policy for text-style floats in one helper.
- Performance: adds constant-time range checks only during conversion.
- Security/robustness: avoids narrowing finite out-of-range doubles before validation.
- Compatibility: valid conversion behavior and existing error wording are preserved.

## Cleanup Status

- Matrix temp parent was removed by the verifier.
- No generated tracked artifacts remained after cleanup.
- Ignored dependency symlinks were preserved.
- Final pending changes are the intended tracked files listed above.

## Recommended Next Target

Audit remaining non-command style/layout numeric narrowing sites in `cpp/YogaNode.cpp` that still validate only finite numbers before `static_cast<float>` into Yoga/Skia state, especially `NodeStyle` layout scalar/percent and transform/radius paths, and decide whether native-float range validation belongs at converter boundaries or immediately before Yoga/Skia application.

Goal finished.
