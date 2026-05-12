# Worker 178 - Post-worker-177 Root-cause Audit

## Summary

Accepted Worker 177's packed TypeScript plus Node VM Reconciler source-level
corner-radius proof as scoped.

Worker 177 closed the JS/Reconciler completion target selected by Worker 176:
the packed public TypeScript verifier now explicitly names all four
SkPoint-capable per-corner style radius keys for scalar `SharedValue<number>`,
whole `SharedValue<SkPoint>`, and nested `{ x, y }` SharedValue leaves, while
the Reconciler verifier now table-drives whole scalar `SharedValue<number>`
delivery for all four keys. The focused checks and the full feasible matrix
remain green.

I made one tiny report correction in Worker 177's report: the new inventory
guard proves the `NodeStyle` per-corner fields accept both `number` and
`SkPoint`; it does not assert that those are the only union members.

Full platform-native app proof remains locally blocked by missing simulator,
CocoaPods, Android, and Java prerequisites. The next strongest locally
unblocked target is a compact named global `style.borderRadius` scalar
host-raster smoke, because the per-corner style-radius path is now covered
across public TypeScript, Reconciler source behavior, generated materialization,
native hit testing, and bounded raster clipping, while the global scalar
`borderRadius` path is still only source-adjacent.

## Changed files

- `worker-progress/worker-177-corner-radius-js-reconciler-completion.md`
- `worker-progress/worker-178-post-177-root-cause-audit.md`

## Worker 177 acceptance decision

Accepted as scoped.

Worker 177's proof is coherent:

- `scripts/style-corner-radius-inventory.mjs` extracts the four
  SkPoint-capable per-corner keys from `src/specs/style.ts`,
  `src/jsx.ts`, and `src/Reconciler.ts`, then fails the verifier if case
  tables drift from those source inventories.
- `scripts/verify-package-typescript-consumer.mjs` compiles packed public
  authoring for all four keys as scalar `SharedValue<number>`, whole
  `SharedValue<SkPoint>`, and nested `{ x, y }` SharedValue leaves.
- `scripts/verify-reconciler-animated-bindings.mjs` table-drives all four
  whole scalar `SharedValue<number>` style radius keys and asserts paired x/y
  listener registration, initial snapshots, `runOnJS` payloads, full style
  rebuilds, invalidation, cleanup, ignored late emits, and no native command
  mirrors.
- Existing representative nested-leaf, whole `SharedValue<SkPoint>`, and
  invalid-shape Reconciler cases remain in place for `borderTopLeftRadius`.

The acceptance is bounded to the stated packed TypeScript and Node VM
Reconciler source-level proof. It does not prove real Reanimated delivery,
UI-runtime Worklets execution, React Native bridge delivery, generated/native
delivery, raster output, simulator/device behavior, or platform-native app
presentation.

## Evidence reviewed

- `worker-progress/worker-177-corner-radius-js-reconciler-completion.md`.
- Worker 177 implementation commit `a221402`:
  `scripts/style-corner-radius-inventory.mjs`,
  `scripts/verify-package-typescript-consumer.mjs`, and
  `scripts/verify-reconciler-animated-bindings.mjs`.
- Current accepted branch head `867cdfb`, which records orchestrator
  acceptance of Worker 177 in master planning/progress files.
- `src/specs/style.ts`: `NodeStyle` has `borderRadius?: number` plus all four
  per-corner `number | SkPoint` fields.
- `src/jsx.ts`: `YogaStyleCornerRadiusKey` lists all four per-corner keys and
  `YogaAnimatedCornerRadius` admits scalar, `SkPoint`, whole
  `SharedValue<SkPoint>`, and animated point leaves.
- `src/Reconciler.ts`: `styleNestedRoots` and `scalarCornerRadiusKeys` list the
  same four per-corner keys; scalar per-corner values normalize to x/y points
  before animated binding traversal.
- `worker-progress/worker-176-post-175-root-cause-audit.md`,
  `worker-progress/worker-175-style-corner-radius-raster-proof.md`, and
  `worker-progress/worker-173-native-corner-radius-proof.md`.
- `scripts/verify-yoganode-nitro-materialization.mjs`: generated materialized
  all-four per-corner style-radius delivery into `_style`,
  `_clipsToBounds`, and `_clipToBoundsRadii`.
- `scripts/verify-yoganode-native-hit-testing.mjs`: style corner radii clip
  hit testing for a full-size child.
- `scripts/verify-yoganode-native-commands-render.mjs`: style corner radii on a
  `GroupCmd` parent clip a full-size `RectCmd` child through
  `YogaNode::renderToContext()`.
- `cpp/YogaNode.cpp` / `cpp/YogaNode.hpp`: `YogaNode::setStyle(...)` maps both
  global `borderRadius` and per-corner style radius fields into rounded
  `_clipToBoundsRadii`, and render clipping consumes those radii.

## Commands run

All Node/npm verification commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `git diff --check`: passed before report creation and after the report edits.
- `node --check scripts/style-corner-radius-inventory.mjs`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed. Output included all
  four per-corner style radius keys accepted as `SharedValue<number>`,
  `SharedValue<SkPoint>`, and `{ x, y }` SharedValue leaves, with source
  inventory alignment across `src/specs/style.ts`, `src/jsx.ts`, and
  `src/Reconciler.ts`.
- `npm run check:reconciler-animated-bindings`: passed. Output included all
  four whole scalar `SharedValue<number>` corner-radius cases, representative
  nested and whole-point coverage, cleanup/late-emit behavior, explicit
  invalid-shape errors, and no native command mirrors.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 8s. The matrix
  reran the packed TypeScript/Reconciler checks plus native hit-testing,
  native command/render, and Nitro materialization evidence, then removed its
  generated `tsconfig.tsbuildinfo` cleanup target and matrix temp parent.

## Platform blocker reprobe

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `command -v pod gradle adb cmake ninja`: produced no paths and exited
  nonzero.
- Per-tool follow-up confirmed:
  `pod=not found`, `gradle=not found`, `adb=not found`,
  `cmake=not found`, `ninja=not found`.
- `java -version`: failed because no Java runtime is available.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

These remain local environment/toolchain blockers, not repo verifier failures.
CocoaPods install, Gradle build, simulator/device launch, platform-native app
runtime, real UI-runtime Worklets/Reanimated delivery, and native presentation
proof remain blocked locally.

## Next target recommendation

Assign the next implementation worker to a compact named global
`style.borderRadius` scalar host-raster smoke.

Recommended scope:

- Add a focused case to `scripts/verify-yoganode-native-commands-render.mjs`
  that sets `NodeStyle.borderRadius` on a `GroupCmd` parent, inserts a
  full-size `RectCmd` child, and renders through real
  `YogaNode::renderToContext()` onto a raster `SkSurface`.
- Assert `_style.borderRadius`, `_clipsToBounds`, and `_clipToBoundsRadii`, with
  all four corner slots set to the global scalar radius.
- Assert the case is distinct from explicit `style.clip` state and from
  `RRectCmd::cornerRadius`, matching the separation discipline used by Worker
  175.
- Add bounded pixel assertions for transparent clipped pixels at all four
  rounded corners and colored pixels inside the rounded bounds.
- Keep the proof boundary host-native raster only; do not claim generated
  materialization, React Native bridge delivery, UI-runtime Worklets,
  Reanimated, simulator/device behavior, platform-native presentation, or exact
  renderer fidelity.

Why this is strongest now:

- Worker 177 closed the direct JS/Reconciler completion gap for the four
  SkPoint-capable per-corner keys.
- Worker 173 and Worker 175 already cover generated/native per-corner
  materialization, hit-test clipping, and bounded host-raster clipping.
- `YogaNode::setStyle(...)` has a separate global `borderRadius` branch that
  seeds all four `_clipToBoundsRadii` entries, but the current focused reports
  only name it as an unproven raster gap.
- Full platform-native and real Reanimated/UI-runtime proof remain blocked by
  local prerequisites, and I did not find a stronger unblocked style/command
  runtime gap in the currently green local matrix.

## Proof boundary and overclaim risks

Accepted after Worker 177:

- Packed public TypeScript authoring for all four SkPoint-capable per-corner
  style radius keys as scalar `SharedValue<number>`, whole
  `SharedValue<SkPoint>`, and nested `{ x, y }` SharedValue leaves.
- Node VM source-level Reconciler behavior for all four whole scalar
  `SharedValue<number>` per-corner style radius keys.
- Source inventory alignment between verifier case tables and the current
  source key lists in `src/specs/style.ts`, `src/jsx.ts`, and
  `src/Reconciler.ts`.
- Existing lower-stack per-corner evidence remains green: generated
  materialization, native hit testing, and bounded raster clipping.

Remaining gaps and risks:

- The source inventory guard proves `NodeStyle` per-corner fields accept both
  `number` and `SkPoint`; it does not enforce that no additional union members
  can be added later.
- Whole `SharedValue<SkPoint>` and nested `{ x, y }` Reconciler behavior remain
  representative for `borderTopLeftRadius`; only whole scalar
  `SharedValue<number>` behavior is all-four table-driven.
- Global `style.borderRadius` scalar host-raster behavior is still not a
  separately named focused proof.
- None of the local proofs establish real UI-runtime Worklets execution, real
  Reanimated SharedValue delivery, React Native bridge delivery, Nitro registry
  install inside a React Native runtime, iOS/Android app build or launch,
  simulator/device behavior, platform-native presentation, exact raster
  fidelity, GPU/backend fidelity, image asset loading, or exact typography.

## Cleanup status

- Report-only/product-source scope was preserved.
- The only files intentionally edited by this worker are progress reports.
- No product source, verifier script, generated spec, package metadata, docs,
  or example native folders were edited.
- Ambiguous local artifacts such as `node_modules`, `example/node_modules`,
  `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
  `tsconfig.tsbuildinfo` were preserved unless the feasible matrix removed its
  own generated `tsconfig.tsbuildinfo` cleanup target.
- `check:feasible-matrix` removed its matrix-owned temp parent and reported no
  remaining new tracked artifacts after cleanup.
- No nested subagents or explorers were used.
- The worktree was clean before the report edits.

## Recommended next tasks

- Implement the compact global `style.borderRadius` scalar host-raster smoke
  described above.
- Keep real Reanimated/UI-runtime and full platform-native app proof blocked
  until local simulator, CocoaPods, Java, Android SDK/build-tool, and launch
  prerequisites are available.
- If the project wants stricter drift detection later, tighten
  `scripts/style-corner-radius-inventory.mjs` to assert exact `number |
  SkPoint` unions instead of only SkPoint-capable unions.

Goal finished.
