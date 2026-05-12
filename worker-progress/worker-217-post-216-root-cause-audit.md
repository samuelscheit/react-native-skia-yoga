# Worker 217: Post-216 Root-Cause Audit

## Summary

Audited Worker 216's radius finite validation from the isolated
`worker/217-post-216-root-cause-audit` worktree.

Worker 216 is accepted. The implementation is correctly scoped to
deterministic finite-number validation for `style.borderRadius` and all
per-corner scalar / `SkPoint.x` / `SkPoint.y` radius payload branches, runs
before native `YogaNode::setStyle(...)` mutation, and is covered by generated
materialized Nitro negative cases plus the full feasible local matrix.

The original Worker 217 subagent stalled before writing a report or tracked
changes. Orchestration recovered the report-only audit in the assigned Worker
217 worktree.

## Worker 216 Acceptance Decision

Accepted.

Evidence inspected:

- Implementation commit `a943684 Validate finite radius style payloads`.
- Merge commit `71d1d8b Merge worker 216 radius finite validation`.
- Acceptance docs commit `fbef46f Accept worker 216 radius validation`.
- Worker report `worker-progress/worker-216-radius-finite-validation.md`.
- Key paths: `cpp/YogaNode.cpp`,
  `scripts/verify-yoganode-nitro-materialization.mjs`, `src/specs/style.ts`,
  `nitrogen/generated/shared/c++/NodeStyle.hpp`,
  `cpp/JSIConverter+NodeCommand.hpp`, `src/interactivity.ts`, and
  `src/specs/commands.ts`.

The acceptance docs commit only changed `MASTER_PLAN.md` and
`MASTER_PROGRESS.md`. The product/verifier implementation is in `a943684`.

## Changed Files

- `worker-progress/worker-217-post-216-root-cause-audit.md`

## Commands Run

- `git diff --check 71d1d8b^1 71d1d8b` - passed with no output.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed
  with no output.
- `npm run check:yoganode-nitro-materialization` - passed. The verifier output
  includes generated materialized `setStyle(...)` rejection for non-finite
  `borderRadius`, all per-corner scalar branches, and all per-corner
  `SkPoint.x` / `SkPoint.y` payload branches while preserving prior radius,
  clip, paint, Yoga, layer, matrix, and computed-layout state.
- `npm run check:feasible-matrix` - passed all 28 commands in `7m 02s`.
  Cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining
  new tracked artifacts, and removed the matrix temp parent
  `/tmp/rnskia-feasible-matrix-p5m1Gc`.

## Proof Boundary

Accepted:

- Native finite-number validation covers scalar `style.borderRadius`.
- Native finite-number validation covers all four scalar per-corner radius
  branches: `borderTopLeftRadius`, `borderTopRightRadius`,
  `borderBottomRightRadius`, and `borderBottomLeftRadius`.
- Native finite-number validation covers all four per-corner `SkPoint` payload
  branches by checking both generated `x` and `y` coordinates.
- The validation call remains pre-mutation in `YogaNode::setStyle(...)`: after
  layout-string/background-color/numeric style validation and before
  matrix/transform validation, `invalidateLayout()`, `_style = style`, Yoga
  reset, paint reset, layer reset, clip/radius reset, matrix reset, or computed
  layout changes.
- Source guards tie public radius fields, generated `NodeStyle` transport,
  native radius validators, and radius application into `_clipToBoundsRadii`.
- Generated materialized `YogaNode.setStyle(...)` negative coverage proves
  JS-facing rejection and preservation of previous selected `_style` radius
  fields, `_clipToBoundsRadii`, explicit clip state, `_paint`, Yoga, layer,
  matrix, and computed-layout state.

Rejected as overclaim if implied:

- Exhaustive numeric validation for all command or interaction inputs.
- Range semantics such as non-negative radius enforcement, radius clamping,
  path trim bounds, blur bounds, or hit-slop bounds.
- Real React Native bridge delivery, Nitro registry install inside a React
  Native runtime, iOS/Android app build/run, simulator/device launch, native
  platform presentation, UI-runtime Worklets execution, Reanimated delivery, or
  RNGH delivery.

## Remaining Gaps

- Command `SkPoint` payloads remain unguarded. `src/specs/commands.ts` exposes
  `line.from`, `line.to`, and `points.points[]` as `SkPoint`; native
  `parsePoint(...)` in `cpp/JSIConverter+NodeCommand.hpp` reads `x` and `y`
  through `asNumber()` and casts directly to `float` without finite checks.
  These values feed native line/points render state and hit-test bounds.
- Selected command numeric payloads remain broader than point payloads:
  `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`,
  `path.trimStart`, `path.trimEnd`, and `path.stroke` numeric fields are public
  command surfaces with existing conversion/render verifiers but no exhaustive
  finite rejection proof.
- Interaction `hitSlop` remains a JS-to-native numeric surface.
  `src/interactivity.ts` normalizes numeric and edge-object hit-slop values
  without finite checks before `setInteractionConfig(...)`, and native
  hit-testing uses the normalized values to expand hit bounds.
- Full platform-native app build/run remains blocked by local toolchain
  availability, not by new repository evidence.

## Next Recommended Target

Rank 1: finite-number validation for command `SkPoint` payloads.

Recommended scope:

- Add deterministic finite-number rejection for `line.from.x`, `line.from.y`,
  `line.to.x`, `line.to.y`, and every `points.points[index].x/y` coordinate in
  `JSIConverter<NodeCommand>::fromJSI(...)`.
- Keep validation at command conversion time before `YogaNode::setCommand(...)`
  installs or mutates native command state.
- Preserve valid line/points behavior, existing point-mode parsing, public JSX
  dynamic listener behavior, native command/render raster evidence, and
  generated materialized `setCommand(...)` breadth.
- Add source guards tying public command specs, Reconciler command builders,
  native point parsing, native command/render verifier coverage, and generated
  materialized `setCommand(...)` coverage.
- Add direct native command/render negative cases and generated materialized
  negative cases proving deterministic rejection and preservation of previous
  command state.
- Verify with `git diff --check`, `node --check` for touched verifier scripts,
  `npm run check:yoganode-native-commands-render`, `npm run
  check:yoganode-nitro-materialization`, and `npm run check:feasible-matrix`.

Rationale:

- This is the same finite-input root-cause class as the recent style validators,
  but on the command transport path rather than `setStyle(...)`.
- It is more concrete and locally verifiable than attempting all command
  numeric fields at once.
- It closes a point-like geometry surface analogous to Worker 216's `SkPoint`
  radius validation and affects both render state and hit-test geometry.

Rank 2: finite validation for selected scalar command numeric payloads,
including `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`,
`path.trimStart`, `path.trimEnd`, and `path.stroke` numeric fields.

Rank 3: finite validation for interaction `hitSlop` normalization and native
delivery.

Highest-value blocked target: real React Native runtime/platform proof once
full Xcode/simulator/CocoaPods or Android Java/SDK/Gradle/ADB/CMake/Ninja
prerequisites are available.

## Quality, Maintainability, Performance, Security

- Quality: Worker 216 keeps validation centralized and exercises the
  JS-facing generated materialized wrapper path.
- Maintainability: the new source guards reduce silent drift between public
  specs, generated transport, native validation, and radius application.
- Performance: the validation is constant-time over the fixed public radius
  fields and runs before heavier native reset/application work.
- Security: rejecting NaN/Infinity radii reduces undefined-state propagation
  into clipping and hit-test geometry. Command point payloads and hit-slop keep
  related numeric-input risk.

## Cleanup Status

- Report-only scope was preserved.
- No product source, verifier scripts, package metadata, generated files,
  examples, or master docs were edited by Worker 217.
- The feasible matrix removed its owned temp parent and generated
  `tsconfig.tsbuildinfo`.
- Final pre-report status showed only expected ignored dependency symlinks:
  `node_modules` and `example/node_modules`.
- This branch should commit only
  `worker-progress/worker-217-post-216-root-cause-audit.md`.

Goal finished.
