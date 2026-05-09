# YogaNode Parent Lifetime Audit Report

## 1. Goal Lifecycle

- Goal created: finalize the YogaNode parent lifetime audit report from prior tmux worker evidence without changing product code.
- Status: completed as a report-only deliverable.
- No product code was modified in this worker.

## 2. Scope and Commands

- Scope was limited to validating prior worker evidence and writing this report in `worker-progress/worker-010-yoganode-parent-lifetime-audit.md`.
- I reviewed the prior worker log at `../worker-logs/worker-010-yoganode-parent-lifetime-audit.jsonl`.
- I reviewed the prior native architecture report at `../react-native-skia-yoga/worker-progress/worker-002-native-architecture-audit.md`.
- I validated the local source references in:
  - `cpp/YogaNode.hpp`
  - `cpp/YogaNode.cpp`
  - `cpp/RNSkYogaView.cpp`
  - `cpp/SkiaYoga.cpp`
  - `src/Reconciler.ts`
  - `src/index.ts`
  - `src/util.ts`
- No nested subagents were spawned by this worker. I relied on the completed nested explorer result already captured in the prior log.

## 3. Root Cause Assessment

### Primary finding

The core risk is a parent lifetime invariant violation in `YogaNode`: children are owned by `std::shared_ptr`, but `_parent` is a raw back-link. That is acceptable only if every child is detached before any ancestor in its chain can be destroyed. The current code does not enforce that invariant strongly enough.

### Why this is a real crash shape

- `YogaNode` stores `_parent` as a raw pointer and `_children` as owning `shared_ptr`s in `cpp/YogaNode.hpp:410-412`.
- `insertChild()` sets `yogaNode->_parent = this` and appends the child to `_children` in `cpp/YogaNode.cpp:858-861`.
- Upward invalidation paths recursively dereference `_parent` without a lifetime check in:
  - `invalidateLayout()` at `cpp/YogaNode.cpp:1227-1234`
  - `invalidateRasterCache()` at `cpp/YogaNode.cpp:1237-1244`
  - `adjustInteractiveDescendantCount()` at `cpp/YogaNode.cpp:1247-1257`
- Mutations can reach those paths from public APIs:
  - `setStyle()` can invalidate layout.
  - `setCommand()` can invalidate raster state.
  - `setInteractionConfig()` can update interaction state.
- The destructor only frees the Yoga C node at `cpp/YogaNode.cpp:219-224`. It does not clear descendant back-links or otherwise make stale children safe if a subtree is still externally retained.

### Important refinement

`detachViewRoot()` is not the stale-parent bug by itself. It only clears the renderer root reference:

- `cpp/SkiaYoga.cpp:76-84`

That path is not the same as a descendant keeping a stale `_parent` after its ancestor is destroyed. The real crash shape is:

1. A descendant remains externally retained, for example through `getChildren()` exposure.
2. A native or GC-driven teardown destroys an ancestor higher in the tree.
3. The retained descendant later mutates and walks `_parent`.
4. The raw parent pointer can now reference freed memory.

### Ownership invariant gap

There is a second, broader tree-consistency problem: `insertChild()` does not first detach a child from an existing parent before reparenting or reordering it.

- The method inserts directly into `_children` and sets the new back-link in `cpp/YogaNode.cpp:858-861`.
- `removeChild()` and `removeAllChildren()` do clear immediate `_parent` links in `cpp/YogaNode.cpp:867-887`, but `insertChild()` does not enforce single-parent ownership before the new attachment.
- That means C++ `_children` ownership can diverge from the single parent back-link if callers reuse a node across parents or rely on reorder semantics.

## 4. Nested Subagent Results

The most important nested explorer result from the prior log supports the refined root cause:

- `YogaNode` stores parent as a raw pointer and children as owning `shared_ptr`s.
- `insertChild()` assigns `_parent = this` and stores the child.
- `invalidateLayout()`, `invalidateRasterCache()`, and `adjustInteractiveDescendantCount()` recursively dereference `_parent`.
- `removeChild()` and `removeAllChildren()` clear immediate child parents, but `~YogaNode()` does not clear descendants.
- `getChildren()` exports retained child `shared_ptr`s back to JS, so a descendant can survive independently of its ancestor.
- The nested explorer explicitly concluded that the unsafe shape is not `detachViewRoot()` alone; it is ancestor destruction while a descendant is externally retained.

The nested explorer also recommended a safer design:

- Use `std::enable_shared_from_this<YogaNode>`.
- Store `_parent` as `std::weak_ptr<YogaNode>`.
- Guard upward traversals with `lock()`.
- Detach or reject a child that already has a live parent before insertion.
- Perform destructor-level cleanup of immediate children before native node free.

## 5. Proposed Fix Design

I am not implementing the fix in this worker, but the later implementation should be concrete and mechanical:

1. Replace the raw `_parent` pointer with `std::weak_ptr<YogaNode>`.
2. Make `YogaNode` `std::enable_shared_from_this<YogaNode>` so safe parent references can be established where needed.
3. Change upward invalidation helpers to resolve the parent via `lock()` before recursing.
4. Enforce the single-parent invariant in `insertChild()`:
   - either detach the child from its current parent first,
   - or reject insertion if the child already has a live parent.
5. Make subtree teardown explicit:
   - before the destructor frees the underlying Yoga node, clear immediate child back-links and detach children from the Yoga tree state.
6. Keep the React reconciler behavior aligned, but do not rely on it as the only defense. The native layer must be correct even when nodes are retained through `getChildren()` or used outside the reconciler lifecycle.

## 6. Verification Strategy

For a later implementation worker, the verification should prove the invariant rather than only checking one symptom:

1. Add a regression test that retains a grandchild through `getChildren()`, destroys its ancestor subtree, and then mutates the retained node.
2. Add a reparenting test that inserts the same child into a second parent and verifies the original parent-child ownership state is not left inconsistent.
3. Add a teardown test that covers destructor-driven subtree destruction, not only explicit React `removeChild()` flows.
4. Run the existing JS and native validation suite after the native lifetime change.
5. If possible, add an AddressSanitizer or equivalent native lifetime stress pass for retained-node teardown.

## 7. Quality, Maintainability, Performance, Security Review

- Quality: the current code depends on implicit tree discipline that is not enforced by the native API.
- Maintainability: the raw `_parent` model is fragile because every future mutation path must remember to preserve detachment semantics.
- Performance: a `weak_ptr`/`lock()` parent model adds a small amount of overhead on upward traversal, but the cost is localized and preferable to undefined behavior.
- Security: stale raw-pointer traversal is memory-safety relevant. Even if the current crash surface is not externally exploitable, it is the wrong lifetime model for an externally retained tree.

## 8. Files to Change Later

- `cpp/YogaNode.hpp`
- `cpp/YogaNode.cpp`
- Potentially focused native tests alongside the Yoga node implementation

## 9. Remaining Risks

- If insertion/reparenting semantics are not explicitly defined, callers may still create tree-state divergence even after the parent pointer is made weak.
- If destructor cleanup only handles immediate children but not the full Yoga tree state, stale native relations may survive in edge cases.
- `getChildren()` remains an intentional external retention surface, so the fix must assume descendants can outlive ancestors.
- I did not implement or run the later fix here, so runtime validation is still required before closing the bug.
