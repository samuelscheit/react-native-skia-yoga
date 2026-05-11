# Worker 143 - Example Nested Paragraph Demo

## Summary

Refreshed the example-owned nested paragraph type/demo surfaces to match the documented rich paragraph styling path.

The example type fixture now compile-checks dynamic nested `paragraphStyle.textStyle.color` and `paragraphStyle.textStyle.fontSize` leaves. The animate tab demonstrates the public `paragraphStyle.textStyle.fontSize` path. The paragraph command demo now shows root paragraph fields plus nested `paragraphStyle.textStyle`.

## Changed files

- `example/types/skiayoga-typecheck.tsx`
  - Added a `SharedValue<string>` color fixture for nested paragraph text style.
  - Moved the dynamic paragraph `color` and `fontSize` compile fixture under `paragraphStyle.textStyle`.
- `example/app/(tabs)/animate.tsx`
  - Moved the animated paragraph font size under `paragraphStyle.textStyle.fontSize`.
  - Corrected demo copy to name `paragraphStyle.textStyle.fontSize`.
- `example/app/(tabs)/components/paragraph.tsx`
  - Replaced the flat paragraph color/font-size-only demo with root paragraph fields `ellipsis`, `heightMultiplier`, and `maxLines` plus nested `textStyle` color/font size/letter spacing.
- `worker-progress/worker-143-example-nested-paragraph-demo.md`
  - Added this report.

## Commands run

- `/usr/bin/time -p git diff --check`: passed, `real 0.01`.
- `/usr/bin/time -p bun run typecheck` from `example/`: passed, `real 1.19`.
- `/usr/bin/time -p npm run typecheck`: passed, `real 1.42`.
- `/usr/bin/time -p npm run check:example-bundle`: passed, `real 7.44`.
- `/usr/bin/time -p npm run check:package-typescript-consumer`: passed, `real 10.74`.
- `/usr/bin/time -p npm run check:reconciler-animated-bindings`: passed, `real 0.82`.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands, matrix command duration `4m 58s`, `/usr/bin/time` `real 298.71`.
- `git diff --check` after removing generated build info: passed.

## Evidence gathered

- Worker 142 selected this exact example-owned refresh because README docs and package/Reconciler/generated-wrapper/native proof already covered nested `paragraphStyle.textStyle`, while example surfaces still used flattened paragraph styling.
- `src/jsx.ts` keeps simple `<text textStyle>` limited to `fontSize` and `color`, while `YogaParagraphStyle` preserves rich root fields plus nested `textStyle?: YogaTextStyle`, and `YogaAnimatedParagraphStyleProps` maps those nested leaves through `YogaDeepAnimated`.
- `scripts/verify-package-typescript-consumer.mjs` already accepts static and dynamic nested `paragraphStyle.textStyle.color` and `paragraphStyle.textStyle.fontSize` from an installed packed package.
- `scripts/verify-reconciler-animated-bindings.mjs` covers JS command listener rebuild cases for `paragraph.paragraphStyle.textStyle.color` and `paragraph.paragraphStyle.textStyle.fontSize`.
- `scripts/verify-yoganode-native-commands-render.mjs` covers nested paragraph text-style CSS color conversion, selected nested paragraph text-style output, flattened-over-nested precedence, unsupported `fontVariations` rejection, and rich simple-text rejection.
- `scripts/verify-yoganode-nitro-materialization.mjs` materializes a generated `setCommand(paragraph)` payload using nested `paragraphStyle.textStyle` and asserts a real `ParagraphCmd` is built.
- Standalone example typecheck and example bundle export passed after the example changes.
- The full feasible matrix passed all 28 commands and included package consumer, Reconciler, native command/render, Nitro materialization, example typecheck, example bundle export, and native-generation checks.

## Proof boundary and overclaim risks

This change proves example compile-time/demo-source alignment with the documented nested paragraph text-style path, plus the existing local package/source/example/native verifier boundaries exercised by the required checks.

It does not prove UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual React Native bridge delivery, native platform app runtime, simulator/device launch, CocoaPods install, Gradle build, exact typography, paragraph shaping fidelity, font fallback correctness, exact render fidelity, or CSS color string preservation after native normalization.

The unsupported `fontVariations` boundary was preserved. Simple `<text textStyle>` examples remain limited to `fontSize` and `color`.

## Cleanup status

- Removed ignored generated `tsconfig.tsbuildinfo` after the required TypeScript/matrix checks.
- `git status --short --ignored=matching` then showed only the scoped example/report changes plus ignored dependency directories `node_modules/` and `example/node_modules/`.
- The feasible matrix removed its matrix-owned temp parent `/tmp/rnskia-feasible-matrix-H5QpOO` and reported no remaining new tracked artifacts after cleanup.
- No product source, README, package metadata, generated verifier scripts, or native files were edited.

## Recommended next tasks

- Run a fresh post-143 audit before selecting the next root-cause target.
- Keep any future example work similarly bounded to compile/demo alignment unless platform-native toolchain prerequisites become available.
- If runtime visual proof becomes a goal, treat it as a separate platform-native or simulator task with explicit toolchain requirements and proof boundaries.

Goal finished.
