# Worker 011 YogaNode Parent Lifetime Fix

## Goal Lifecycle

- Original worker goal: `Implement a root-cause fix for YogaNode parent lifetime and single-parent invariants.`
- Original worker passed the visible goal gate in `worker-logs/worker-011-yoganode-parent-lifetime.jsonl`, applied the first C++ patch, then hit a usage limit before verification/report completion.
- First fixup worker goal: `Finalize and verify the YogaNode parent lifetime and single-parent invariant fix.`
- First fixup worker passed the visible goal gate in `worker-logs/worker-011-yoganode-parent-lifetime-fixup.jsonl`, spawned a nested read-only reviewer, and then hit a usage limit before applying the reviewer fix.
- Second fixup worker goal: `Finalize the YogaNode parent lifetime fix from the reviewed partial patch.`
- Second fixup worker passed the visible goal gate in `worker-logs/worker-011-yoganode-parent-lifetime-fixup-v2.jsonl`, applied the final source fix, wrote a draft report, and hit a usage limit before `update_goal(status: "complete")`.
- Orchestrator accepted only the worker-owned source patch for `cpp/YogaNode.cpp` and `cpp/YogaNode.hpp`, excluding the worker worktree's `bun.lock` drift, then completed main-worktree verification.

## Root Cause

`YogaNode` previously owned children with `std::shared_ptr<YogaNode>` but stored `_parent` as a raw pointer. Retained children can escape through public APIs such as `getChildren()`, so a descendant can outlive an ancestor and later mutate through `invalidateLayout()`, `invalidateRasterCache()`, or `adjustInteractiveDescendantCount()`, dereferencing a stale parent pointer.

The same insertion path also lacked a native single-parent invariant. Reparenting or reordering a child could leave the old parent's `_children`, the new parent's `_children`, the child's `_parent`, Yoga native ownership, and interactive descendant counts out of sync.

## Design Decision

- Store `_parent` as `std::weak_ptr<YogaNode>`.
- Use Nitro `HybridObject::shared_cast<YogaNode>()` to establish the new parent weak link instead of adding another `enable_shared_from_this<YogaNode>` base.
- Detach a child from any live old parent before native insertion.
- Keep `insertChild(child, beforeChild)` semantics as insert-before-current-node after detach/recompute.
- Treat numeric `insertChild(child, index)` as final-index-after-detach semantics. The reconciler uses the before-node path for ordered inserts, and no source evidence showed a pre-move numeric-index contract.
- Clear immediate child back-links before freeing a parent Yoga node.

## Changes

- Added Yoga tree helper functions for shared parent resolution, child index lookup, cycle detection, child-reference erasure, child detach, and detach-all cleanup.
- Replaced raw `_parent` traversal with `weak_ptr::lock()` in upward invalidation and interactive-count propagation.
- Updated `insertChild()` to reject disposed nodes and cycles, detach old parents, compute the final insert index after detach, insert into `_children` first, then call `YGNodeInsertChild()`, then assign `_parent`, then adjust interactive descendant count.
- Added rollback around `YGNodeInsertChild()` so a native insertion failure erases the just-inserted vector reference and removes the Yoga owner if it was attached.
- Updated `detachChildFromParent()` to subtract interactive descendants only for actual `_children` references removed. Stale Yoga/back-link-only cleanup invalidates layout but does not guess a count delta.
- Updated `removeChild()`, `removeAllChildren()`, and `~YogaNode()` to share the same detach semantics.

## Nested Subagent Results

- The first fixup worker's nested reviewer found the key remaining issue: `detachChildFromParent()` used `removedCount == 0 ? 1 : removedCount`, which could over-subtract `_interactiveDescendantCount` after a partial insert failure.
- The reviewer also confirmed `HybridObject::shared_cast<YogaNode>()` is the correct ownership source because Nitro already owns the shared control block and `YogaNode` instances are created with `std::make_shared<YogaNode>()`.
- The second fixup worker attempted another nested review from inside the tmux worker, but the nested tool call failed with a model/fork configuration error. The final patch therefore relies on the prior successful nested reviewer result plus orchestrator verification.

## Verification

Main worktree verification after applying the accepted worker patch:

- `git diff --check`: passed.
- `git diff --cached --check`: passed.
- `bun run specs`: passed.
- `npm run typecheck`: passed.
- `bun run check:install-isolation`: passed.
- `npm pack --dry-run`: passed.
- Focused native syntax probe: passed with a temporary `/tmp/rnskia-nitro-shim` that maps generated `<NitroModules/...>` includes to installed Nitro headers, plus explicit React Native, Yoga, React Native Skia, and Worklets include roots:
  - `clang++ -std=c++20 -fsyntax-only -include cpp/polyfill.h ... cpp/YogaNode.cpp`

Worker worktree verification notes:

- The worker's first `bun run specs` and `npm run typecheck` attempts failed before dependency installation because `nitrogen` and `tsc` were unavailable in that isolated worktree.
- The worker later installed dependencies in its isolated worktree, which modified `bun.lock`; that lockfile change was not accepted.

## Quality, Maintainability, Performance, Security Review

- Quality: the tree model now enforces the native single-parent invariant at the mutation boundary instead of assuming reconciler discipline.
- Maintainability: parent traversal now has an explicit weak-link lifetime model, and detach/count updates are centralized in helper functions.
- Performance: the added vector scans run on child mutation paths, not draw/layout traversal hot paths.
- Security: removing stale raw-parent traversal reduces a native memory-safety risk when retained descendants outlive ancestors.

## Files Changed

- `cpp/YogaNode.cpp`
- `cpp/YogaNode.hpp`

## Remaining Risks

- `insertChild()` does not restore the old parent if a later new-parent insert fails after old-parent detach; it leaves the child safely detached instead of attempting a larger transaction.
- The focused native syntax probe is not a full platform build. iOS/Android builds should still be run in their native environments.
- There is no dedicated native lifetime regression harness in this repo yet, so runtime retained-descendant teardown should be covered when native test infrastructure exists.

## Final Git Status At Integration

```text
 M MASTER_PROGRESS.md
M  cpp/YogaNode.cpp
M  cpp/YogaNode.hpp
?? worker-progress/worker-011-yoganode-parent-lifetime.md
```
