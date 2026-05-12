# Worker 191 - Inverted rrect/path raster proof

## Summary

Added paired inverted rrect/path raster proof across the direct host-native
command/render verifier and the generated materialized Nitro verifier.

The direct verifier now covers `invertClip` for rect, rrect, and path clips
through `YogaNode::renderToContext()` using a `GroupCmd` parent and full-size
`RectCmd` child. The materialization verifier mirrors rrect/path inverted clips
through `YogaNode::toObject(runtime)`, generated `setCommand(...)`,
`setStyle(...)`, `insertChild(...)`, and `computeLayout(...)` wrappers before
rendering the native parent and asserting bounded pixels.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
  - Added direct host-native inverted rrect and inverted path raster cases.
  - Updated verifier output and proof-boundary text from inverted rect-only to
    inverted rect/rrect/path coverage.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added generated materialized inverted rrect/path style builders and raster
    assertions.
  - Updated materialized verifier output and proof-boundary text to include
    inverted rect/rrect/path raster coverage.
- `worker-progress/worker-191-inverted-rrect-path-raster-proof.md`

## Commands run

- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 3m 54s.

## Evidence gathered

- The direct native command/render verifier compiled and linked a host
  executable against real `YogaNode.cpp`, `AnimatedDouble.cpp`, generated Nitro
  specs, React Native JSC, upstream Yoga, RN Skia macOS archives, RN Skia CSS
  color parsing, Worklets shared-item sources, and project helper sources.
- Direct inverted rrect proof stores `invertClip=true`, keeps an explicit
  `SkRRect` clip in `_style.clip`, populates `_clipRRect`, avoids implicit
  bounds/style-radius clipping, clears an inside-rounded-rrect pixel, keeps
  outside-shape child pixels painted, and keeps outside-parent pixels clear.
- Direct inverted path proof stores `invertClip=true`, keeps an explicit
  `SkPath` clip in `_style.clip`, populates `_clipPath`, avoids rect/rrect clip
  state, clears an inside-path pixel, keeps outside-path child pixels painted,
  and keeps outside-parent pixels clear.
- The materialization verifier compiled and linked a host executable against
  real `YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, Nitro
  materialization/prototype/cache sources, platform ThreadUtils, React Native
  JSC, upstream Yoga, RN Skia macOS archives, RN Skia CSS color parsing,
  Worklets helper sources, `AnimatedDouble`, and project helper sources.
- Materialized inverted rrect/path cases use generated JS-facing wrappers after
  `YogaNode::toObject(runtime)`: `setCommand(group/rect)`,
  `setStyle(clip rrect/path, invertClip)`, `insertChild(...)`, and
  `computeLayout(...)`, followed by native `YogaNode::renderToContext()` pixel
  assertions.
- The full feasible matrix reran the updated direct command/render verifier as
  item 17/28 and the updated materialization verifier as item 20/28. Matrix
  cleanup removed only its owned `tsconfig.tsbuildinfo` artifact and matrix temp
  parent.

## Proof boundary and overclaim risks

Proven:

- Host-native direct `style.clip` inverted rrect/path raster behavior through
  `YogaNode::renderToContext()`.
- Host-JSC generated materialized `setStyle(clip rrect/path, invertClip)`
  delivery followed by bounded native raster assertions.
- Selected inside-shape, outside-shape, and outside-parent pixels only.

Not proven:

- Exact clip geometry, antialias transition fidelity, GPU/saveLayer fidelity,
  exact typography, or every rendering path.
- React Native bridge delivery, Nitro registry installation inside a React
  Native runtime, real Reanimated/UI-runtime delivery, RNGH native delivery,
  image loading, iOS/Android app build/run, simulator/device launch, or native
  platform presentation.

## Cleanup status

- Product/native source files were not edited.
- `MASTER_PLAN.md` and `MASTER_PROGRESS.md` were not edited in this worktree.
- Preserved ambiguous ignored/local artifacts including `node_modules/`,
  `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`,
  `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` except for matrix-owned
  cleanup.
- The original Worker 191 agent and a continuation agent became unresponsive
  before report/commit. Their isolated worktree patch was preserved, reviewed,
  verified, and completed here.

## Recommended next tasks

- Run a post-Worker 191 root-cause audit to independently accept the new
  direct/materialized inverted rrect/path proof boundary and rerank the next
  locally unblocked target.
- Keep platform-native app build/run and real React Native runtime delivery as
  separate tasks until the known local toolchain blockers are cleared.

Goal finished.
