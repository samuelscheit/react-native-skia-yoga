# Worker 215: Post-214 Root-Cause Audit

## Summary

Audited Worker 214's matrix/transform finite validation from the isolated
`worker/215-post-214-root-cause-audit` worktree.

Worker 214 is accepted. The implementation is correctly scoped to
deterministic finite-number rejection for `style.matrix` array / `SkMatrix`
payloads and `style.transform` operation leaves, runs before native
`YogaNode::setStyle(...)` mutation, and is covered through the generated
materialized Nitro verifier plus the full feasible local matrix.

The original Worker 215 subagent stalled before writing a report or tracked
changes. Orchestration recovered the audit in the assigned Worker 215 worktree
and preserved the report-only scope.

## Worker 214 Acceptance Decision

Accepted.

Evidence inspected:

- Implementation commit `981dc32 Validate finite matrix and transform styles`.
- Merge commit `5141aee Merge worker 214 matrix transform finite validation`.
- Acceptance docs commit `1141123 Accept worker 214 matrix transform validation`.
- Worker report
  `worker-progress/worker-214-matrix-transform-finite-validation.md`.
- Key paths: `cpp/JSIConverter+SkMatrix.hpp`, `cpp/YogaNode.cpp`,
  `scripts/verify-yoganode-nitro-materialization.mjs`, `src/specs/style.ts`,
  and `nitrogen/generated/shared/c++/NodeStyle.hpp`.

The acceptance docs commit only changed `MASTER_PLAN.md` and
`MASTER_PROGRESS.md`. The product/verifier implementation is in `981dc32`.

## Changed Files

- `worker-progress/worker-215-post-214-root-cause-audit.md`

## Commands Run

- `git diff --check 5141aee^1 5141aee` - passed with no output.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed
  with no output.
- `npm run check:yoganode-nitro-materialization` - passed. The verifier output
  includes generated materialized `setStyle(...)` rejection for non-finite
  9-value matrix arrays, 16-value matrix arrays, `SkMatrix` host objects, and
  all current transform leaves while preserving prior `_style`, `_matrix`,
  `_paint`, Yoga, clip/radius, layer, and computed-layout state.
- `npm run check:feasible-matrix` - passed all 28 commands in `4m 53s`.
  Cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining
  new tracked artifacts, and removed the matrix temp parent
  `/tmp/rnskia-feasible-matrix-cb78eL`.

## Proof Boundary

Accepted:

- Matrix-array finite validation covers both public 9-value and 16-value
  matrix arrays, including a 16-value slot outside RN Skia's 3x3 projection.
- `SkMatrix` finite validation covers host-object matrix payloads before the
  native style mutation path stores or applies them.
- Transform finite validation covers every current public/generated transform
  operation leaf: `rotateX`, `rotateY`, `rotateZ`, `scale`, `scaleX`, `scaleY`,
  `translateX`, `translateY`, `skewX`, and `skewY`.
- The validation call remains pre-mutation in `YogaNode::setStyle(...)`: after
  layout-string/background-color validation and numeric style validation, but
  before `invalidateLayout()`, `_style = style`, Yoga reset, paint reset,
  layer reset, clip/radius reset, matrix reset, or computed-layout changes.
- Source guards tie the public `Transform` inventory, generated `NodeStyle`
  transform variants, native validator branches, and transform application
  branches together.
- Generated materialized `YogaNode.setStyle(...)` negative coverage proves
  JS-facing rejection and preservation of previous selected native state.

Rejected as overclaim if implied:

- Exhaustive numeric validation for all style, command, or interaction inputs.
- Radius scalar / `SkPoint` finite validation.
- Command numeric payload finite validation.
- Interaction hit-slop finite validation.
- Range semantics such as non-negative dimensions, opacity clamping, radius
  bounds, or transform angle limits.
- React Native bridge delivery, Nitro registry install inside a real React
  Native runtime, iOS/Android app build/run, simulator/device launch, native
  platform presentation, UI-runtime Worklets execution, Reanimated delivery, or
  RNGH delivery.

## Remaining Gaps

- `style.borderRadius` remains a public numeric scalar, generated as
  `std::optional<double>`, and is used to seed all four clip radii plus clipping
  and hit-test behavior. It is not yet covered by the finite-number validator.
- `style.borderTopLeftRadius`, `style.borderTopRightRadius`,
  `style.borderBottomRightRadius`, and `style.borderBottomLeftRadius` remain
  public `number | SkPoint` fields, generated as `std::variant<double,
  SkPoint>`, and are applied into `_clipToBoundsRadii` without finite checks for
  either scalar or `{ x, y }` payload branches.
- Radius fields are not inert state: existing verifiers prove generated
  delivery, clipping, raster, hit-test, and dynamic public/Reconciler behavior,
  so non-finite radius values can propagate into geometry used by render and
  hit-test code unless rejected deterministically.
- Command numeric payloads and interaction hit-slop numeric payloads remain
  separate non-style validation surfaces. They should be scoped separately from
  style-radius validation.
- Full platform-native app build/run remains blocked by local toolchain
  availability, not by new repository evidence.

## Next Recommended Target

Rank 1: finite-number validation for radius scalar and `SkPoint` style
payloads.

Recommended scope:

- Extend the existing pre-mutation `YogaNode::setStyle(...)` validation path to
  reject non-finite `borderRadius` values.
- Reject non-finite scalar and `SkPoint.x` / `SkPoint.y` values for all four
  per-corner radius fields.
- Preserve the existing valid radius behavior: global radius seeding, per-corner
  scalar radii, per-corner `SkPoint` radii, explicit clip separation, overflow
  separation, raster clipping, hit-test clipping, dynamic Reconciler behavior,
  and reset semantics.
- Add generated materialized negative cases proving deterministic rejection and
  preservation of prior `_style`, `_clipToBoundsRadii`, explicit clip, `_paint`,
  Yoga, layer, matrix, and computed-layout state.
- Add source guards so public/generated/native radius inventories cannot drift
  silently.
- Verify with `git diff --check`, `node --check
  scripts/verify-yoganode-nitro-materialization.mjs`, `npm run
  check:yoganode-nitro-materialization`, and `npm run check:feasible-matrix`.

Rationale:

- This is the same root-cause class as Workers 206, 208, 210, 212, and 214:
  public runtime inputs that TypeScript/Nitro cannot make safe must be rejected
  deterministically before native mutation.
- The radius surface is now the strongest remaining local `setStyle(...)`
  validation gap because it is public, generated, already proven through render
  and hit-test geometry, and locally verifiable in the existing materialized
  host-JSC harness.

Rank 2: finite validation for selected command numeric payloads, split by
command family and backed by the existing native command/render and materialized
`setCommand(...)` harnesses.

Rank 3: finite validation for interaction hit-slop numeric payloads, backed by
the existing gesture/interaction and native hit-test verifiers.

Highest-value blocked target: real React Native runtime/platform proof once
full Xcode/simulator/CocoaPods or Android Java/SDK/Gradle/ADB/CMake/Ninja
prerequisites are available.

## Quality, Maintainability, Performance, Security

- Quality: Worker 214 keeps validation deterministic and exercised through the
  JS-facing generated wrapper path, not just raw native entry points.
- Maintainability: source guards reduce silent drift between public specs,
  generated transport, native validation, and transform application branches.
- Performance: the new checks are bounded by current matrix/transform payload
  sizes and run before heavier native state reset/application work.
- Security: rejecting NaN/Infinity matrix and transform values reduces
  undefined-state propagation into render transforms and hit-test inversion.
  Radius, command, and hit-slop numeric surfaces keep the same class of risk.

## Cleanup Status

- Report-only scope was preserved.
- No product source, verifier scripts, package metadata, generated files,
  examples, or master docs were edited by Worker 215.
- The feasible matrix removed its owned temp parent and generated
  `tsconfig.tsbuildinfo`.
- Final pre-report status showed only expected ignored dependency symlinks:
  `node_modules` and `example/node_modules`.
- This branch should commit only
  `worker-progress/worker-215-post-214-root-cause-audit.md`.

Goal finished.
