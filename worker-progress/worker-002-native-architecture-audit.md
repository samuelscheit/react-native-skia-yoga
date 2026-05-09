# Native Architecture Audit Report

## 1. Goal Lifecycle

- Goal created: write the native architecture audit report for `react-native-skia-yoga` from prior tmux worker evidence without changing product code.
- Status: completed as a report-only deliverable.
- No product code was modified.

## 2. Scope and Commands Run

- Scope was limited to producing this report in `worker-progress/worker-002-native-architecture-audit.md`.
- No broad source audit was rerun.
- No subagents were spawned in this worker; this report summarizes the nested subagent evidence already captured by v3/v4 workers.

## 3. Current Native Architecture Summary

- Public Nitro spec lives in `src/specs/SkiaYoga.nitro.ts` and declares `SkiaYoga` and `YogaNode`.
- Generated C++ bindings live under `nitrogen/generated/shared/c++/HybridSkiaYogaSpec.*` and `HybridYogaNodeSpec.*`.
- Concrete native implementations live in `cpp/SkiaYoga.*` and `cpp/YogaNode.*`.
- View-root handling is in `cpp/RNSkYogaView.*`.
- Platform glue is split across `ios/` and `android/`.

## 4. Tested Hypotheses and Nested Subagent Evidence

- v3 visible goal gate passed at `worker-logs/worker-002-native-architecture-audit-v3.jsonl:3`.
- v4 visible goal gate passed at `worker-logs/worker-002-native-architecture-report-v4.jsonl:3`, but v4 hit a usage limit before writing the report.
- Nested subagent result from v3: supported root cause is split platform context ownership.
  - `SkiaYoga::platformContext` exists in `cpp/SkiaYoga.hpp:19-20`.
  - `g_platformContext` exists in `cpp/PlatformContextAccessor.cpp:7-11`.
  - iOS sets only `SkiaYoga::platformContext` in `ios/PlatformContextFactoryBridge.mm:16-18`.
  - Android sets only `SetPlatformContext(ctx)` in `android/src/main/cpp/SkiaYogaModuleNative.cpp:114-116`.
  - Shared code reads both forms:
    - converters use `GetPlatformContext()` such as `cpp/JSIConverter+SkImage.hpp:54`.
    - Yoga text/image/paragraph paths call `SkiaYoga::getPlatformContext()` at `cpp/YogaNode.hpp:707`, `cpp/YogaNode.hpp:742`, `cpp/YogaNode.cpp:1033`, `cpp/YogaNode.cpp:1542`, and `cpp/YogaNode.cpp:1585`.
- Nested subagent result from v4: partially supported root cause is raw parent lifetime.
  - `YogaNode` owns children via `std::vector<std::shared_ptr<YogaNode>>` but keeps `_parent` as a raw pointer in `cpp/YogaNode.hpp:410-411`.
  - `insertChild` sets `_parent = this` and stores the child at `cpp/YogaNode.cpp:857-860`.
  - `removeChild` and `removeAllChildren` clear `_parent` at `cpp/YogaNode.cpp:871-883`.
  - `YogaNode::~YogaNode()` only frees `_node` at `cpp/YogaNode.cpp:218-223`.
  - Later `setStyle` and `setCommand` can reach invalidation paths that recursively dereference `_parent` at `cpp/YogaNode.cpp:1226-1243`.
  - View detach looked less suspicious because `detachViewRoot` clears the root and the renderer copies the shared root under mutex.
- Refuted or contract-aligned evidence:
  - Nitro hybrid method signatures align across `src/specs/SkiaYoga.nitro.ts:37-42`, `nitrogen/generated/shared/c++/HybridSkiaYogaSpec.hpp:54-58`, and `cpp/SkiaYoga.hpp:22-26`.
  - Android JNI names line up between `android/src/main/java/com/margelo/nitro/skiayoga/SkiaYogaView.java:70-86`, `android/src/main/cpp/jni/include/JniSkiaYogaView.h:30-43`, and `android/src/main/cpp/cpp-adapter.cpp:5-11`.
  - `android/CMakeLists.txt:17-33` includes the generated Nitro sources.
- Open uncertainty:
  - `nativeID` / `nativeId` is plausible but not fully proven.
  - JS uses `nativeID` in `src/YogaCanvas.tsx:351`.
  - iOS legacy handles `nativeID` in `ios/SkiaYogaViewManager.mm:36-38`.
  - iOS Fabric reads `newProps.nativeId` in `ios/SkiaYogaView.mm:191-193`.
  - Android likely relies on inherited `SkiaBaseViewManager` behavior that was not present locally.

## 5. Root-Cause Risks

- Ownership: raw `_parent` pointers make ancestor invalidation fragile when subtrees are removed or reparented.
- Lifetime: child nodes are shared-owned, but parent references are non-owning and can outlive safe traversal assumptions.
- Threading: the split platform-context model can diverge between JSI converters and Yoga-node paths, depending on which native bridge initialized last.
- Invalidation: recursive invalidation through `_parent` creates a crash surface if a node is detached but still reachable from a stale call path.
- Memory: the destructor only releasing `_node` suggests cleanup relies on external ownership discipline rather than local invariants.
- Platform mismatch: iOS and Android initialize platform context through different state channels, so shared code can observe inconsistent context provenance.

## 6. Contract Mismatches

- No generator contract mismatch was found in the Nitro surface; the spec, generated bindings, and `cpp/SkiaYoga` signatures align.
- No JNI naming mismatch was found between Java, JNI header, and native adapter.
- The main contract risk is semantic rather than syntactic: platform context is represented by two APIs with different ownership expectations.

## 7. Prioritized Implementation Tasks

1. Unify platform-context ownership behind one native source of truth and remove split state.
2. Replace raw `_parent` usage with an explicit non-crashing ownership model or defensive weak linkage.
3. Add lifetime guards around invalidation paths that can run after detachment or teardown.
4. Normalize platform initialization between iOS and Android so converters and Yoga paths resolve context through one pathway.
5. Add focused native tests for parent-removal, teardown, and context initialization ordering.

## 8. Quality, Maintainability, Performance, and Security Review Notes

- Quality: the architecture is functional but currently depends on implicit native invariants that are easy to break.
- Maintainability: duplicated platform-context state is the clearest long-term maintenance hazard.
- Performance: the architecture is not obviously CPU-bound from the evidence reviewed, but extra indirection during invalidation and context lookup can complicate hot paths.
- Security: no direct security issue was evidenced, but stale raw-pointer traversal can become memory-safety relevant if exercised after teardown.

## 9. Final Worktree Status

- Only `worker-progress/worker-002-native-architecture-audit.md` was created or updated by this worker.
- Product code was left unchanged.
