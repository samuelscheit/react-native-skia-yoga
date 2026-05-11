# Worker 154 - Post-worker-153 root-cause audit

## Summary

This was a report-only post-worker-153 audit. I accept Worker 153's materialized
`YogaNode.setStyle(...)` paint-field breadth proof within a precise host-JSC
Nitro materialization boundary.

Worker 153 closed the selected Worker 152 target: the generated JS-facing
`setStyle(...)` wrapper on a `YogaNode::toObject(runtime)` object now has
materialized proof for SkPaint-backed `backgroundColor`, `borderWidth`,
`strokeCap`, `strokeJoin`, `strokeMiter`, `dither`, `opacity`, `blendMode`,
native `_style` optionals, ordinary `_paint` base/override behavior, and Yoga
border state.

The strongest remaining locally unblocked target is materialized generated
`setStyle(...)` coverage for `clip`, `matrix`, `transform`, and `invertClip`,
because those fields use custom/generated conversion and nontrivial native
state in `YogaNode::setStyle(...)`, but the current materialized wrapper proof
does not exercise them.

## Worker 153 acceptance decision

Accepted. Worker 153 accurately reports a generated materialized wrapper path,
not a direct C++ setter shortcut: `assertGeneratedPaintBackedStyle(...)` creates
a materialized YogaNode object, retrieves generated `setStyle`, calls it with
`callWithThis(...)`, and asserts side effects on the original native node.

No blocking overclaim was found. The report does not claim command rendering,
React Native bridge delivery, Nitro registry install in a React Native runtime,
platform presentation, UI-runtime Worklets/Reanimated delivery, saveLayer/GPU
fidelity, or exact render fidelity.

Non-blocking caveats:

- The paint-backed materialized fixture does not assert every SkPaint field,
  such as `SkPaint::Style`.
- It does not assert `antiAlias` override precedence in that same paint-backed
  fixture; materialized canonical `antiAlias` and direct native paint precedence
  are covered by adjacent verifier cases.
- It covers `borderWidth`, not every border edge/alias field.
- It uses a fresh paint-backed node, so it does not test interaction with an
  existing `style.layer`; separate materialized layer coverage remains intact.

## Evidence reviewed

- `MASTER_PLAN.md` and `MASTER_PROGRESS.md`, including the Worker 151-153
  integration timeline and current "fresh post-worker-153 audit" next step.
- `worker-progress/worker-151-dynamic-layer-style-proof.md`.
- `worker-progress/worker-152-post-151-root-cause-audit.md`.
- `worker-progress/worker-153-materialized-style-paint-breadth.md`.
- `scripts/verify-yoganode-nitro-materialization.mjs`, especially
  `makePaintBackedStyle(...)`, `assertGeneratedPaintBackedStyle(...)`, and the
  verifier proof-boundary output.
- `scripts/verify-yoganode-native-commands-render.mjs`, especially the direct
  host-native SkPaint precedence, `style.layer`, render, and boundary output.
- `scripts/verify-reconciler-animated-bindings.mjs` and
  `scripts/verify-package-typescript-consumer.mjs`, for the public dynamic style
  and Reconciler JS-listener boundary.
- `src/jsx.ts`, `src/Reconciler.ts`, `src/specs/style.ts`, `cpp/YogaNode.cpp`,
  and `nitrogen/generated/shared/c++/NodeStyle.hpp`.

## Verification run/results

- `git status --short --branch` - passed before report edits; output was only
  `## worker/154-post-153-root-cause-audit`.
- `npm run check:yoganode-nitro-materialization` - passed. The verifier
  confirmed generated materialized `setStyle(layer)` and generated materialized
  `setStyle(SkPaint-backed backgroundColor plus public paint fields)` delivery
  into native `NodeStyle`, `_paint`, `_layerPaint`, and Yoga border state. npm
  printed the existing `minimum-release-age` warning.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 35s. Cleanup
  removed no new tracked artifacts, preserved pre-existing `tsconfig.tsbuildinfo`,
  and removed the matrix temp parent.
- Local platform blocker probes from this worktree:
  - `command -v pod` exited 1.
  - `xcode-select -p` returned `/Library/Developer/CommandLineTools`.
  - `java -version` exited 1 with "Unable to locate a Java Runtime."
  - `ANDROID_HOME` and `ANDROID_SDK_ROOT` were unset.
  - `command -v adb`, `command -v cmake`, `command -v ninja`, and
    `command -v gradle` exited 1.
- `git diff --check` - passed after writing this report.

## Remaining gaps ranked

1. Materialized `clip` / `matrix` / `transform` / `invertClip` style coverage.
   This is the best Worker 155 target. `src/specs/style.ts` exposes these fields,
   generated `NodeStyle.hpp` converts them, and `YogaNode::setStyle(...)` mutates
   `_clipPath`, `_clipRect`, `_clipRRect`, `_matrix`, and clip inversion state.
   Direct native hit-testing already exercises transform/clipping behavior, but
   the generated materialized wrapper path does not.
2. Broader materialized `NodeStyle` inventory/drift accounting. `NodeStyle` has
   80 public fields, and `check:yoganode-nitro-materialization` covers only
   selected high-risk style subsets. A drift guard is useful, but it is broader
   and less behavior-specific than the current clip/matrix/transform gap.
3. Public dynamic-style/package/Reconciler boundary. Worker 151 and the current
   verifiers cover packed public authoring for dynamic `style.layer`,
   `style.opacity`, whole `SharedValue<YogaNodeStyle>`, and Node VM Reconciler
   JS-listener delivery. Remaining app-runtime delivery is not locally provable
   without a real RN/Reanimated/Nitro runtime harness.
4. Platform-native app build/run. Node-run Expo CNG/native-generation metadata
   is green, but full iOS/Android build and app runtime remain locally blocked
   by the toolchain gaps listed above.

## Selected Worker 155 target

Assign Worker 155: expand `scripts/verify-yoganode-nitro-materialization.mjs`
with generated materialized `YogaNode.setStyle(...)` coverage for
`clip`, `matrix`, `transform`, and `invertClip`.

Expected proof shape:

- Use fresh materialized YogaNode objects created through `YogaNode::toObject(runtime)`.
- Invoke generated `setStyle(...)` through the materialized JS object, not direct
  native `YogaNode::setStyle(...)`.
- Use real/generated payload shapes for `clip` variants, a matrix payload, a
  representative transform array, and `invertClip`.
- Assert generated conversion populates `_style` optionals and native side
  effects on `_clipPath` / `_clipRect` / `_clipRRect`, `_matrix`, and clip
  inversion state.
- Keep transform-vs-matrix precedence bounded and explicit because
  `YogaNode::setStyle(...)` applies `transform` before falling back to `matrix`.

Likely files/checks:

- Files: `scripts/verify-yoganode-nitro-materialization.mjs` and
  `worker-progress/worker-155-materialized-clip-matrix-transform.md`.
- Product files should change only if the new proof exposes a real bug.
- Checks: `node --check scripts/verify-yoganode-nitro-materialization.mjs`,
  `npm run check:yoganode-nitro-materialization`,
  `npm run check:yoganode-native-hit-testing`,
  `npm run check:feasible-matrix`, and `git diff --check`.

## Proof boundaries/overclaim risks

Worker 153 proves host-JSC Nitro `toObject(...)` materialization and generated
`setStyle(...)` delivery for a static paint-style payload. It does not prove
React Native bridge delivery, Nitro registry installation in a real RN runtime,
UI-runtime Worklets/Reanimated delivery, platform-native presentation, command
rendering, saveLayer/GPU fidelity, or exact render fidelity.

Worker 155 should keep the same boundary discipline. Materialized
clip/matrix/transform assertions should prove generated wrapper conversion and
native state mutation only. They should not claim platform app behavior,
gesture delivery, pixel rendering, exact hit-test behavior, or real bridge
delivery unless a separate verifier actually exercises those paths.

## Nested subagent/explorer results

- Recovered prior nested explorer result from the failed Worker 154 attempt:
  no blocking overclaim found. It confirmed the generated wrapper path via
  `YogaNode::toObject(...)` plus `setStyle.callWithThis(...)`, real
  `JsiSkPaint` `backgroundColor`, `_style` optionals for
  `borderWidth`/`strokeCap`/`strokeJoin`/`strokeMiter`/`dither`/`opacity`/
  `blendMode`, `_paint` base/override assertions, Yoga border state, and
  separate preserved `style.layer` materialization. Its caveats were that the
  materialized `_paint` base does not assert every SkPaint field and the
  paint-backed case uses a fresh node rather than a layer-interaction case.
- New read-only explorer `worker153_boundary_explorer` accepted Worker 153's
  report boundary, found no material overclaim, and independently ranked
  materialized `clip`/`matrix`/`transform`/`invertClip` coverage as the highest
  directly related local gap.

## Cleanup status

- Report-only scope was preserved. The only intended tracked change is this
  progress report.
- Required checks ran in the assigned worktree.
- The feasible matrix removed its matrix temp parent and left no new tracked
  artifacts.
- Ignored dependency symlinks and any local ignored native/example artifacts
  were preserved.

Goal finished.
