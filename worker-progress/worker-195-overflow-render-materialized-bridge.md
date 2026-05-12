# Worker 195 - Overflow render/materialized bridge proof

## Summary

Added bounded overflow clipping proof across the direct host-native
command/render verifier and the generated Nitro materialization verifier.

The new coverage proves selected `overflow: "hidden"` and
`overflow: "scroll"` delivery into native `NodeStyle`, Yoga overflow state, and
rectangular `_clipsToBounds` behavior, then renders oversized child rectangles
through `YogaNode::renderToContext()` and checks bounded in-bounds and
out-of-bounds raster pixels.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added direct host-native `overflow` cases for public strings
    `"hidden"` and `"scroll"`.
  - Asserted generated `NodeStyle` JSI transport, native enum state, Yoga
    overflow getters, `_clipsToBounds`, and separation from style corner radii,
    global `borderRadius`, and explicit `style.clip`.
  - Rendered a `GroupCmd` parent with an oversized `RectCmd` child and asserted
    pixels inside the 50x50 parent remain colored while pixels past the parent
    bounds remain transparent.
  - Updated verifier summary and proof-boundary text.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added generated materialized `setStyle({ overflow })` cases for
    `"hidden"` and `"scroll"`.
  - Used materialized `setCommand(group/rect)`, `setStyle(...)`,
    `insertChild(...)`, `computeLayout(...)`, and native
    `renderToContext()` to prove generated-wrapper delivery reaches bounded
    raster clipping.
  - Asserted native `_style.overflow`, Yoga overflow, `_clipsToBounds`, and
    separation from radius and explicit clip state.
  - Updated verifier summary and proof-boundary text.
- `worker-progress/worker-195-overflow-render-materialized-bridge.md`

## Commands run

- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 39s.

The focused matrix entries for the edited verifiers passed:

- Item 17, `npm run check:yoganode-native-commands-render`: passed in 34.2s.
- Item 20, `npm run check:yoganode-nitro-materialization`: passed in 33.3s.

## Evidence gathered

- The direct native verifier now exercises `NodeStyle` conversion for public
  overflow strings and validates `toJSI(...)` serializes the same public string
  values.
- The direct native verifier checks the expected native overflow enum,
  `YGNodeStyleGetOverflow(...)`, rectangular `_clipsToBounds`, and no accidental
  radius/explicit-clip state.
- The direct native raster proof uses a 50x50 parent and oversized child so the
  asserted transparent pixels at x/y 50 and outside the parent prove bounded
  clipping at the parent layout boundary.
- The materialized verifier drives the generated JS-facing methods from
  `YogaNode::toObject(runtime)` rather than setting native fields directly.
- The materialized verifier proves generated `setStyle({ overflow })` reaches
  native `_style.overflow`, Yoga overflow state, rectangular `_clipsToBounds`,
  computed layout, and bounded raster clipping.
- Both paths keep overflow clipping distinct from global `borderRadius`, per
  corner style radius clipping, and explicit `style.clip` state.
- The feasible matrix completed with no newly created tracked artifacts after
  cleanup.

## Proof boundary and overclaim risks

Proven:

- Host-native macOS C++ `NodeStyle` conversion and `toJSI(...)` serialization
  for selected overflow values.
- Native Yoga overflow state and rectangular `_clipsToBounds` state for
  selected overflow values.
- Bounded host-raster clipping through `YogaNode::renderToContext()` for
  oversized children under `overflow: "hidden"` and `overflow: "scroll"`.
- Host-JSC generated Nitro materialization and generated-wrapper delivery for
  selected materialized overflow styles.

Not proven:

- Exact overflow behavior beyond the asserted host-raster pixels.
- Exhaustive Yoga overflow conformance or all possible overflow modes.
- GPU/platform clipping fidelity.
- React Native bridge delivery, Nitro registry installation inside a React
  Native runtime, iOS/Android app build/run, simulator/device launch, native
  platform presentation, UI-runtime Worklets execution, real Reanimated
  delivery, RNGH native delivery, gesture delivery, image asset loading, exact
  typography, or every command rendering path.

Overclaim risks:

- This closes a bounded direct/materialized host proof for plain overflow
  clipping. It should not be described as end-to-end React Native app proof.
- The raster assertions intentionally prove only selected edge pixels around a
  rectangular parent boundary.
- Platform-native app build/run remains a separate target blocked by local
  toolchain state.

## Cleanup status

- The original Worker 195 spawn-agent stalled after producing scoped verifier
  edits and before reporting or committing. The patch was preserved in this
  isolated worktree, independently verified, reported, and prepared for commit
  manually.
- Product/runtime source files were not edited.
- `MASTER_PLAN.md` and `MASTER_PROGRESS.md` were not edited in this worktree.
- Preserved ambiguous ignored/local artifacts including `node_modules/`,
  `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`,
  `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` except for verifier-owned
  cleanup.
- Matrix-owned temporary output was cleaned by the matrix verifier.

## Recommended next tasks

- Run a post-Worker 195 root-cause audit to independently accept the overflow
  render/materialized proof and rerank remaining locally unblocked targets.
- If accepted, likely next candidates are residual generated layout
  edge/constraint breadth, public/Reconciler dynamic layout-style proof, or
  platform-native app build/run once local toolchains are available.

Goal finished.
