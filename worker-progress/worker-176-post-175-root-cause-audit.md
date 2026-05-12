# Worker 176 - Post-worker-175 root-cause audit

## Summary

Report-only audit completed for Worker 175. I accept Worker 175's bounded
host-native style corner-radius raster proof as scoped.

Worker 175 closed the target selected by Worker 174: the command/render verifier
now proves that style corner radii stored on a `GroupCmd` parent clip a
full-size `RectCmd` child through real `YogaNode::renderToContext()` on a raster
`SkSurface`. The proof uses one SkPoint style radius and one scalar style
radius, asserts transparent rounded-corner pixels and colored in-bounds/square
corner pixels, and keeps the evidence distinct from explicit `style.clip` and
`RRectCmd::cornerRadius`.

The next strongest locally unblocked target is a compact JS/Reconciler
completion pass for the four SkPoint-capable corner keys plus the whole scalar
`SharedValue<number>` corner-radius path. The lower generated/native/render
stack now has stronger focused coverage than the JS/Reconciler surface.

## Changed files

- `worker-progress/worker-176-post-175-root-cause-audit.md`

## Worker 175 acceptance decision

Accepted as scoped.

Worker 175 changed:

- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-175-style-corner-radius-raster-proof.md`

The proof is coherent:

- `assertStyleCornerRadiusClipRender(...)` creates a `GroupCmd` parent with
  `borderTopLeftRadius = SkPoint(30, 20)` and
  `borderBottomRightRadius = 24`.
- It inserts a full-size green `RectCmd` child and renders through
  `YogaNode::renderToContext()` onto a raster surface.
- It asserts `_clipsToBounds`, `_clipToBoundsRadii`, expected SkRRect corner
  slots, SkPoint/scalar variant preservation, and zero radii for the unset
  upper-right/lower-left corners.
- It asserts no explicit clip state is populated:
  `_style.clip`, `_clipPath`, `_clipRect`, and `_clipRRect` are empty.
- It separates the case from `RRectCmd::cornerRadius` by using a `GroupCmd`
  parent and `RectCmd` child, asserting neither command is `RRectCmd`, and
  asserting the child has no `_clipToBoundsRadii`.
- Pixel assertions prove transparent clipped pixels at `(1, 1)` and `(99, 99)`,
  green in-bounds pixels at `(30, 20)` and `(76, 76)`, green unset square
  corners at `(99, 1)` and `(1, 99)`, and transparency outside layout at
  `(104, 104)`.

## Evidence reviewed

- `worker-progress/worker-175-style-corner-radius-raster-proof.md`.
- Worker 175 commit `48f8661`, especially the delta in
  `scripts/verify-yoganode-native-commands-render.mjs`.
- `worker-progress/worker-174-post-173-root-cause-audit.md`.
- `worker-progress/worker-173-native-corner-radius-proof.md`.
- `worker-progress/worker-172-post-171-root-cause-audit.md`.
- `worker-progress/worker-171-corner-radius-dynamic-proof.md`.
- `scripts/verify-yoganode-native-commands-render.mjs`:
  `assertStyleCornerRadiusClipRender(...)`, `renderNode(...)`, helper styles,
  and updated verifier output/proof boundary.
- `scripts/verify-yoganode-nitro-materialization.mjs`:
  generated all-four style corner-radius source guards,
  `makeCornerRadiusStyle(...)`, `assertGeneratedCornerRadiusStyle(...)`, and
  `_clipToBoundsRadii` assertions.
- `scripts/verify-yoganode-native-hit-testing.mjs`:
  `styleCornerRadiiClipToBounds()` and adjacent explicit clip cases.
- `cpp/YogaNode.cpp` and `cpp/YogaNode.hpp`:
  `YogaNode::setStyle(...)` maps style corner radii into
  `_clipToBoundsRadii`; `drawInternal(...)` clips with
  `detail::makeRoundedRect(...)`; `pointPassesClipping(...)` consumes the same
  radii for hit testing; `RectCmd::draw(...)` has a separate rounded draw
  branch tied to the command node's own `_clipToBoundsRadii`.
- `nitrogen/generated/shared/c++/NodeStyle.hpp`: all four per-corner fields are
  `std::optional<std::variant<double, SkPoint>>` and generated converters read,
  write, and validate the same keys.
- `src/jsx.ts`, `src/Reconciler.ts`,
  `scripts/verify-package-typescript-consumer.mjs`, and
  `scripts/verify-reconciler-animated-bindings.mjs` for the remaining
  public/Reconciler corner-radius gap.

## Commands run

All Node/npm verification commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `git diff --check`: passed before report creation.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed. Output included
  bounded style corner-radius raster clipping through `YogaNode::renderToContext()`.
- `npm run check:yoganode-nitro-materialization`: passed. Output included
  generated materialized all-four style corner-radius delivery into `_style`
  SkPoint/scalar variants, `_clipsToBounds`, and `_clipToBoundsRadii`.
- `npm run check:yoganode-native-hit-testing`: passed. Output included style
  corner-radius clipping in `YogaNode::hitTestTagAt` / `hitTestInternal`.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 15s. The matrix
  removed its generated `tsconfig.tsbuildinfo` artifact and removed its
  matrix-owned temp parent.

## Platform blocker reprobe

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `command -v pod gradle adb cmake ninja`: produced no paths and exited
  nonzero.
- Follow-up per-tool probe confirmed:
  `pod=not found`, `gradle=not found`, `adb=not found`,
  `cmake=not found`, `ninja=not found`.
- `java -version`: failed because no Java runtime is available.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

These remain local environment/toolchain blockers, not repo verification
failures. CocoaPods install, Gradle build, simulator/device launch,
platform-native app runtime, and native presentation proof remain blocked
locally.

## Next target recommendation

Assign the next implementation worker to a compact JS/Reconciler
corner-radius completion pass.

Recommended scope:

- Add a small corner-key inventory guard that keeps `src/specs/style.ts`,
  `src/jsx.ts`, `src/Reconciler.ts`, and verifier cases aligned for
  `borderBottomLeftRadius`, `borderBottomRightRadius`,
  `borderTopLeftRadius`, and `borderTopRightRadius`.
- Extend `scripts/verify-reconciler-animated-bindings.mjs` with table-driven
  whole scalar `SharedValue<number>` cases for all four keys. Assert stable
  listener keys, initial scalar snapshots, `runOnJS` updates, full style
  rebuilds, invalidation, cleanup, ignored late emits, and no native command
  mirrors.
- Preserve the existing nested `{ x, y }` SharedValue and whole
  `SharedValue<SkPoint>` representative cases, or table-drive them if the
  change stays compact.
- Extend `scripts/verify-package-typescript-consumer.mjs` so the packed public
  TypeScript output no longer only names representative `borderTopLeftRadius`
  dynamic authoring if all four keys are explicitly covered.
- Keep the proof boundary at packed TypeScript plus Node VM Reconciler
  source-level behavior; do not claim real Reanimated/UI-runtime delivery or
  platform-native presentation.

Why this is strongest now:

- Worker 173 proves generated/materialized all-four corner delivery and native
  hit-test clipping.
- Worker 175 proves bounded host-raster render clipping through
  `YogaNode::renderToContext()`.
- Worker 171 still leaves direct JS/Reconciler proof representative for
  `borderTopLeftRadius` and does not separately exercise whole scalar
  `SharedValue<number>` Reconciler updates.
- Platform-native app proof remains blocked by the local toolchain.

## Proof boundary and overclaim risks

Accepted after Worker 175:

- Bounded host-native macOS raster proof that style per-corner radii on a
  parent YogaNode clip a full-size child through `YogaNode::renderToContext()`.
- Representative mixed style radius variants in that raster case:
  upper-left SkPoint and lower-right scalar.
- Separation from explicit `style.clip` path/rect/rrect state.
- Separation from `RRectCmd::cornerRadius` and from the child `RectCmd` rounded
  draw branch.
- Adjacent generated/native evidence for all four per-corner style keys and
  native hit-test clipping remains green.

Not proven:

- Exact style corner-radius render fidelity beyond the asserted host-raster
  pixels.
- Per-key, per-variant raster exhaustiveness for all four corners.
- Global `borderRadius` scalar raster behavior as a separately named case.
- React Native bridge delivery.
- Nitro registry install in a React Native runtime.
- UI-runtime Worklets execution or real Reanimated delivery.
- RNGH native delivery.
- iOS/Android app build or launch.
- Simulator/device behavior or native platform presentation.
- Image asset loading/decoding, exact typography, GPU/backend fidelity, or
  exact saveLayer/image render fidelity.

Overclaim risks to avoid:

- Do not describe the host-raster proof as platform-native presentation.
- Do not describe fixed pixel samples as exact renderer fidelity.
- Do not claim all four per-corner JS/Reconciler runtime behavior from the
  existing representative `borderTopLeftRadius` Reconciler proof.
- Do not imply real Reanimated/UI-runtime delivery from Node VM Reconciler
  stubs or host-JSC/native verifiers.

## Cleanup status

- Report-only scope was preserved.
- No product source, verifier script, generated spec, package metadata, docs,
  or example native folders were edited by this worker.
- Ambiguous local artifacts such as `node_modules`, `example/node_modules`,
  `example/ios`, `example/android`, `example/.expo`, `lib`, `.DS_Store`, and
  `tsconfig.tsbuildinfo` were preserved unless matrix-owned cleanup handled a
  generated tracked artifact.
- `check:feasible-matrix` removed only its generated `tsconfig.tsbuildinfo`
  cleanup target and matrix-owned temp parent.
- No nested subagents or explorers were used.
- Before this report was written, the worktree was clean.

## Recommended next tasks

- Implement the JS/Reconciler corner-radius completion pass described above.
- Optionally add a tiny named global `borderRadius` scalar host-raster smoke if
  the next worker touches corner-radius cases and can keep the change compact.
- Keep full platform-native app build/run and real RN/Nitro/Reanimated/RNGH
  runtime proof blocked until local toolchain prerequisites change.

Goal finished.
