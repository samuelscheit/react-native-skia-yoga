# Worker 208: BackgroundColor String Validation

## Summary

Implemented deterministic native validation for string
`style.backgroundColor` in `YogaNode::setStyle(...)`.

Invalid CSS color strings are now rejected before `_style`, `_paint`, Yoga,
clip, layer, or matrix state is mutated. Valid CSS strings still parse into the
ordinary node paint, and `SkPaint` host-object `backgroundColor` behavior is
preserved.

The managed Worker 208 subagent made useful partial edits but stalled before
writing a report or committing. Orchestration closed the subagent and completed
the branch in the isolated worker worktree.

## Changed Files

- `cpp/YogaNode.cpp`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-208-backgroundcolor-string-validation.md`

## Commands Run

- `git status --short --branch --ignored=matching`
- `git diff --check`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`

## Evidence Gathered

- `YogaNode::setStyle(...)` now calls `validateBackgroundColorString(style)`
  immediately after layout-unit validation and before `invalidateLayout()`,
  `_style = style`, `resetYogaStyle(_node)`, `_paint = SkPaint()`, layer,
  clip, and matrix resets.
- `validateBackgroundColorString(...)` only inspects string
  `backgroundColor` variants. `SkPaint` variants return unchanged, and valid
  CSS strings continue through the existing style application path.
- Invalid strings throw a deterministic `std::invalid_argument` with the
  `backgroundColor` property in the message.
- `check:yoganode-nitro-materialization` now includes generated materialized
  `setStyle(...)` proof for:
  - valid CSS-string `backgroundColor` delivery into `_style.backgroundColor`
    and `_paint`;
  - invalid CSS-string rejection through the generated JS-facing wrapper;
  - preservation of the previous `_style.backgroundColor` string and `_paint`
    RGB, stroke width, stroke cap, stroke join, stroke miter, dither,
    antiAlias, and alpha after rejection.
- `npm run check:yoganode-nitro-materialization` passed.
- `npm run check:feasible-matrix` passed all 28 commands in 4m 14s. Cleanup
  removed only newly created `tsconfig.tsbuildinfo` and the matrix-owned temp
  parent; remaining new tracked artifacts were none.

## Proof Boundary And Overclaim Risks

Proven:

- Generated materialized Nitro `YogaNode.setStyle(...)` rejects invalid string
  `backgroundColor` values before mutating native style/paint state.
- Valid CSS-string `backgroundColor` and existing `SkPaint`-backed
  `backgroundColor` behavior remain covered by the materialization verifier.
- The full feasible local package/source/example matrix remains green.

Not proven:

- Actual React Native bridge delivery.
- Nitro registry installation in a React Native runtime.
- iOS/Android app build/run, simulator/device launch, or native platform
  presentation.
- UI-runtime Worklets/Reanimated delivery.
- Exhaustive CSS color syntax conformance beyond the shared project parser and
  selected verifier cases.

## Cleanup Status

- No platform tooling was installed.
- No native projects were generated in this worktree.
- Matrix-owned temporary files were cleaned by the feasible matrix.
- Ignored dependency symlinks remain untouched and expected:
  `node_modules` and `example/node_modules`.

## Recommended Next Tasks

- Orchestrator acceptance audit and merge of
  `worker/208-backgroundcolor-string-validation`.
- After merge, rerun focused materialization validation from `main` and update
  master progress/history.
- Select the next implementation target through a fresh post-208 root-cause
  audit unless the merge audit finds a repair target.

Goal finished.
