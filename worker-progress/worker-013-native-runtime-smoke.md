# Worker 013: Native Runtime Smoke

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Determine and, if feasible, add runtime smoke coverage for YogaNode retained-descendant teardown and reparenting.`
- Original worker proved feasibility, received a nested read-only challenger result, then hit a Codex usage limit before writing files.
- Finalizer worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize runtime smoke coverage for YogaNode retained-descendant teardown and reparenting from worker 013 evidence.`
- Finalizer worker authored the runtime smoke script and package hook, then hit a Codex usage limit before writing this report or marking its goal complete.
- This report was completed by orchestration from the tmux JSON logs and worker-authored diff.

## Feasibility evidence

- The existing `check:yoganode-native-lifetime` verifier is a syntax/source invariant guard only.
- The original worker proved that a simple `YogaNode.cpp` plus Yoga-only executable is not enough: `YogaNode.cpp` pulls in JSI, Nitro, React Native Skia, and Skia symbols from the same translation unit.
- A maintained host executable is feasible when it links:
  - real `cpp/YogaNode.cpp`
  - generated `HybridYogaNodeSpec.cpp` in the same probe translation unit
  - upstream React Native Yoga `.cpp` sources
  - RN Skia macOS static archives
  - the minimal JSI/Nitro/RN Skia helper sources required for object emission
- The worker-authored command `bun run check:yoganode-native-runtime` passed and executed the compiled binary.

## Strategy considered

- Rejected: source-shape-only checks as sufficient runtime coverage.
- Rejected: Yoga-only host link, because it fails on real Skia/JSI/Nitro symbols.
- Rejected: broad production-style iOS/CocoaPods or Android/CMake build-system work for this focused regression.
- Accepted: a repo-local host smoke harness with explicit dependency discovery and a generated temporary C++ probe.

## Changes

- Added `scripts/verify-yoganode-native-runtime-smoke.mjs`.
- Added package script `check:yoganode-native-runtime`.
- Kept `scripts/verify-yoganode-native-lifetime.mjs` intact.

## Nested subagent results

- The original worker's nested read-only challenger concluded the harness is feasible only if it links real `YogaNode.cpp`, real Yoga sources, real Skia archives, and keeps unresolved/stubbed host-incompatible paths outside the exercised ownership path.
- The finalizer worker attempted an additional narrow challenger for `dynamic_lookup` rationale, but that result did not return before the Codex usage limit.

## Verification

- `bun run check:yoganode-native-runtime`: passed.
- `git diff --check`: passed.
- `bun run check:install-isolation`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `npm pack --dry-run`: passed; no tarball remained after cleanup.
- `npm run typecheck`: failed in the worker worktree with the known mixed root/example React Native type-resolution issue. This same command is expected to be rerun in the main worktree by orchestration, where worker 012's patch previously passed.

## Coverage limits

- The runtime smoke executes native host code, not an iOS or Android app.
- `-Wl,-undefined,dynamic_lookup` remains in the host link because `YogaNode.cpp` also contains host-incompatible generated/JSI/native entry points outside the tested path.
- The tested ownership behavior is not stubbed: the probe executes `YogaNode::insertChild`, `removeChild`, `removeAllChildren`, `invalidateLayout`, `invalidateRasterCache`, weak parent traversal, and Yoga native parent/child APIs.

## Quality/maintainability/performance/security review

- Quality: the smoke uses direct assertions against `_children`, `_parent`, `YGNodeGetParent`, and `YGNodeGetChildCount`.
- Maintainability: dependency paths are explicit and fail loudly if required node_modules layouts change.
- Performance: the check compiles a native host binary and should remain a targeted CI/manual regression check, not a hot-path runtime cost.
- Security: the script only reads repo dependencies, writes into a temporary directory, executes the generated local binary, and removes the temp directory.

## Files changed

- `package.json`
- `scripts/verify-yoganode-native-runtime-smoke.mjs`
- `worker-progress/worker-013-native-runtime-smoke.md`

## Remaining risks

- The host link depends on the currently installed RN Skia macOS archive layout.
- `dynamic_lookup` can hide unentered host-incompatible symbols; the smoke mitigates this by executing the actual ownership paths and failing at runtime if those paths touch unresolved symbols.
- Main-worktree verification is still required before integration.

## Final git status

At report recovery time:

```text
## worker/013-native-runtime-smoke
 M package.json
?? scripts/verify-yoganode-native-runtime-smoke.mjs
?? worker-progress/worker-013-native-runtime-smoke.md
```
