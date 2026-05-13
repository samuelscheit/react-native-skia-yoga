# Worker 237: Post-Worker 236 Root-Cause Audit

## Summary / Verdict

Accepted Worker 236.

Worker 236 correctly closes the command `SkPoint` native-float validation gap for
`line.from`, `line.to`, and indexed `points.points[]` coordinates. The
implementation rejects non-finite and native-float-overflowing point
coordinates in `JSIConverter<NodeCommand>::fromJSI(...)` before any same-type
`LineCmd` or `PointsCmd` mutation can replace prior native command state.

No product-code changes were made by this audit. The only tracked change is
this report.

## Changed Files

- `worker-progress/worker-237-post-236-root-cause-audit.md`

## Inspected Files / Commits

- `40a145b Validate command SkPoint native floats`
- `7f6c612 Merge worker 236 command SkPoint native-float validation`
- `97f2ce8 Accept worker 236 command SkPoint validation`
- `d9c6065 Record worker 237 audit retry`
- `WORKER_BRIEF.md`
- `worker-progress/worker-236-command-skpoint-native-float-validation.md`
- `worker-progress/worker-235-post-234-root-cause-audit.md`
- `worker-progress/worker-234-static-animateddouble-native-float-validation.md`
- `worker-progress/worker-232-dynamic-animateddouble-numeric-validation.md`
- `worker-progress/worker-230-yoganode-method-numeric-validation.md`
- `worker-progress/worker-228-command-numeric-enum-validation.md`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+StrokeOpts.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`

## Commands / Outcomes

- `sed -n '1,240p' WORKER_BRIEF.md`: passed; read first as required.
- `git status --short --branch`: passed before report; clean
  `worker/237-post-236-root-cause-audit` branch.
- `git log --oneline --decorate -12`: inspected retry, acceptance, merge, and
  Worker 236 implementation ancestry.
- `git show --stat --oneline --decorate 40a145b`: inspected Worker 236 change
  scope.
- `git show --stat --oneline --decorate 97f2ce8`: inspected acceptance change
  scope.
- `git show --patch 40a145b -- cpp/JSIConverter+NodeCommand.hpp`: inspected
  converter implementation.
- `git show --patch 40a145b -- scripts/verify-yoganode-native-commands-render.mjs`:
  inspected direct verifier changes.
- `git show --patch 40a145b -- scripts/verify-yoganode-nitro-materialization.mjs`:
  inspected generated verifier changes.
- Initial `sed` reads for prompt-shorthand prior report names exited 1 because
  those exact filenames do not exist in this checkout.
- `rg --files worker-progress | rg 'worker-(228|230|232|234|235)'`: resolved
  exact prior report filenames after prompt shorthand names did not exist.
- One exploratory `rg` included an absent `tests` path and exited 2 after
  reporting relevant hits from existing paths; follow-up reads used real files.
- Additional `rg`, `nl`, and `sed` reads inspected current converter,
  verifier, prior-report, and planning-doc evidence.
- `git diff --check 40a145b^ 40a145b`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed. The host-native
  verifier reported non-finite and native-float-overflow command point
  rejection for `line.from.x/y`, `line.to.x/y`, and indexed
  `points.points[]` coordinates, preserving prior `LineCmd`/`PointsCmd` state.
- `npm run check:yoganode-nitro-materialization`: passed. The generated
  materialized verifier reported the same command point rejection through
  generated JS-facing `setCommand(...)` wrappers.
- `git diff --check --no-index /dev/null worker-progress/worker-237-post-236-root-cause-audit.md`:
  no whitespace diagnostics; exited 1 because `--no-index` reports a file
  difference for the new untracked report.
- `tail -n 5 worker-progress/worker-237-post-236-root-cause-audit.md`: passed;
  confirmed the required final report line.
- `git status --short --branch`: passed after report; only
  `?? worker-progress/worker-237-post-236-root-cause-audit.md` remains.

The full feasible matrix was not rerun in this report-only audit because
Worker 236 and main post-merge evidence already report 28/28 passing, and the
two focused native/generated verifiers were rerun successfully here.

## Audit Evidence

- `cpp/JSIConverter+NodeCommand.hpp` now defines
  `isValidCommandPointNativeFloat(double)` and checks both `std::isfinite(...)`
  and `abs(value) <= numeric_limits<float>::max()` before narrowing a command
  point coordinate to `float`.
- `parsePoint(...)` still rejects malformed non-object point payloads with
  `Expected point object.` before coordinate parsing.
- `parsePoints(...)` still rejects malformed non-array/non-object points
  payloads with `Expected points array.` before indexed point conversion.
- `line.from` and `line.to` both route through `parsePoint(...)`, so all four
  line coordinates share the native-float guard before `LineCommandData`
  construction.
- `points.points[]` routes through `parsePoints(...)`, which passes stable
  indexed labels such as `points.points[0]` into `parsePoint(...)`; invalid
  coordinates therefore report property paths like `points.points[0].x`.
- Valid payload behavior remains covered: the direct verifier still constructs
  and renders real `LineCmd` and `PointsCmd` commands, and the materialization
  verifier still asserts generated `setCommand(line)` and `setCommand(points)`
  preserve valid coordinates and point mode.
- Direct invalid coverage now includes NaN, Infinity, -Infinity, and native
  float overflow across `line.from.x`, `line.from.y`, `line.to.x`,
  `line.to.y`, `points.points[0].x`, `points.points[0].y`,
  `points.points[1].x`, and `points.points[1].y`.
- Generated invalid coverage repeats the same coordinate inventory through
  materialized `YogaNode.setCommand(...)`.
- Both invalid verifier paths snapshot the previously installed native command
  pointer and command state, then assert rejected updates preserve the prior
  same-type `LineCmd` / `PointsCmd` state.
- Source guards in both verifier scripts now require the native-float helper,
  the stable error text, and representative direct/generated overflow labels,
  reducing the chance of drifting back to finite-only point validation.

## Risks / Proof Boundary

Proven locally: host-JSC/native command conversion, real
`YogaNode::setCommand(...)` direct delivery, generated host-JSC materialized
wrapper delivery, state preservation after rejected same-type command updates,
and valid line/points command behavior in the focused verifiers.

Not proven: React Native bridge delivery, Nitro registry installation inside a
full app runtime, iOS/Android build or launch, simulator/device presentation,
UI-runtime Worklets execution, real Reanimated delivery, RNGH delivery, image
asset loading, exact render fidelity beyond bounded host-raster checks, or
future command fields added outside the current guarded inventory.

Remaining caveat: verifier invalid cases are representative by indexed points
and coordinate branch rather than exhaustive for arbitrary points-array lengths.
The shared parser and source guards support the broader current-schema claim.

## Quality / Maintainability / Performance / Security

Quality: validation is placed at the command converter boundary before
`NodeCommand` construction and before `YogaNode::setCommand(...)` can mutate
native command state.

Maintainability: the helper centralizes the point coordinate policy, and the
direct/generated verifier guards make the command point inventory explicit.

Performance: the added check is constant-time per coordinate during command
conversion only.

Security/robustness: invalid JS numeric payloads can no longer install
non-finite or overflowing `SkPoint` coordinates into native Skia command state,
and rejected updates preserve prior valid command state.

## Cleanup / Final Status

- Work was limited to the assigned worktree.
- No product code, scripts, generated files, metadata, or coordination docs
  were edited by this audit.
- No commits, merges, rebases, or worktree removal were performed.
- The worktree was clean after focused verification and before writing this
  report.
- Final status after writing this report is only the new untracked report file.

## Next Strongest Unblocked Root-Cause Target

Select deterministic pre-narrow native-float validation for path stroke numeric
`float` leaves: direct `stroke.width`, `stroke.miter_limit`,
`stroke.miterLimit`, `stroke.precision`, and public command
`path.stroke.width`, `path.stroke.miter_limit`, `path.stroke.miterLimit`, and
`path.stroke.precision`.

Why it ranks next: after Workers 232, 234, and 236, command
`AnimatedDouble` and `SkPoint` native-float gaps are closed. The path stroke
surface still carries finite-only proof text, and the current helpers narrow
stroke numbers to `float` before or during validation rather than applying the
same explicit pre-narrow `abs(double) <= numeric_limits<float>::max()` policy
now used for command points, `AnimatedDouble`, YogaNode methods, hitSlop, and
text/paragraph numeric leaves. The target is public-facing, locally testable,
and smaller than broad platform/runtime proof.

Likely files:

- `cpp/JSIConverter+StrokeOpts.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/<next-worker>.md`

Suggested verification:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run typecheck`
- `npm run check:feasible-matrix`
- `git diff --check`

Goal finished.
