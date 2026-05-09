# Worker 012 Native Lifetime Regression Verifier

## Goal lifecycle

- Original worker goal: `Add focused regression coverage for YogaNode native lifetime and reparenting invariants.`
- Original worker passed the visible goal gate, proved a `clang++ -fsyntax-only` probe was feasible, added `scripts/verify-yoganode-native-lifetime.mjs`, and then hit a usage limit before package wiring, report, or final verification.
- Fixup worker goal: `Finalize focused regression coverage for YogaNode native lifetime and reparenting invariants.`
- Fixup worker passed the visible goal gate, obtained a completed nested read-only challenge result, and then hit a usage limit before edits.
- Finalizer worker goal: `Finalize the YogaNode native lifetime regression verifier and report.`
- Finalizer worker passed the visible goal gate, added the package script, wrote this report, and completed. It left its own goal active because `npm run typecheck` failed in the symlinked worker worktree from mixed root/example React Native type paths.
- Orchestrator accepted the worker-owned patch after reproducing the required checks in the main worktree, where `npm run typecheck` passed.

## Root cause/test gap

Worker 011 fixed the native lifetime root cause by replacing raw parent pointers with weak parent links, enforcing detach-before-reparent behavior, and centralizing child detach cleanup. The remaining gap was regression coverage for the exact failure shape: descendants can be retained outside their original ancestor tree, reparented, and later mutated after ancestor teardown.

## Strategy considered

A linked native runtime smoke test would be stronger, but `YogaNode.cpp` depends on React Native, Nitro, React Native Skia, Worklets, Yoga, and platform-link state. Building and linking a deterministic executable for that graph would be broader native build-system work.

The accepted verifier is therefore a focused guardrail:

- a generated native probe includes `YogaNode.cpp` and type-checks retained-descendant teardown, reparenting, destructor cleanup, and weak parent/owning child member types
- source-invariant checks assert weak parent links, destructor detach-before-free ordering, reparent detach ordering, orphan Yoga-owner rejection, vector-first insertion, and upward traversal through `weak_ptr::lock()`

## Changes

- Added `check:yoganode-native-lifetime` to `package.json`.
- Added `scripts/verify-yoganode-native-lifetime.mjs`.
- No product source, generated Nitro artifact, or lockfile changes were made.

## Nested subagent results

Worker 012 used nested read-only challenger `019e0e3c-05db-7de3-8ae7-efb8db0a5d95`, captured in `worker-logs/worker-012-native-lifetime-regression-fixup.jsonl`.

The challenger correctly warned that the verifier is syntax/source-shape coverage, not runtime behavioral proof. It would not execute ancestor teardown, exception rollback, actual parent/child consistency after reparenting, Yoga native ownership divergence, interactive count propagation, or concurrency behavior. It recommended a future linked runtime smoke test if the native build/link path becomes practical.

## Verification

Worker worktree:

- `git diff --check`: passed.
- `bun run check:install-isolation`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `npm pack --dry-run`: passed; worker removed the generated `react-native-skia-yoga-0.0.1.tgz`.
- `npm run typecheck`: failed in the isolated worker worktree because TypeScript resolved React Native types through both `react-native-skia-yoga/node_modules` and `react-native-skia-yoga/example/node_modules`.
- `bun run specs`: skipped by the worker because no specs or generated Nitro artifacts changed.

Main worktree after applying the accepted patch:

- `bun run check:yoganode-native-lifetime`: passed.
- `git diff --check`: passed.
- `bun run check:install-isolation`: passed.
- `npm run typecheck`: passed.
- `npm pack --dry-run`: passed; orchestrator removed the generated `react-native-skia-yoga-0.0.1.tgz`.
- `bun run specs`: passed; generated files were unchanged.

## Coverage limits

This verifier does not execute a native runtime. It cannot prove destructor timing, real use-after-free absence, native Yoga tree ownership consistency under execution, rollback behavior after a thrown `YGNodeInsertChild()`, interactive descendant count values, or multi-threaded/reentrant behavior.

It does provide a cheap regression guard against reverting the worker 011 ownership shape and the most important detach/reparent source invariants.

## Quality/maintainability/performance/security review

- Quality: improves the native feedback loop with a focused command that fails if the weak-parent and detach/reparent invariants are removed.
- Maintainability: the verifier is isolated under `scripts/` and exposed as a `check:*` package script.
- Performance: the check is local and compile-only; it does not run app builds or installs.
- Security: no new network access, package install path, or runtime surface is introduced.

## Files changed

- `package.json`
- `scripts/verify-yoganode-native-lifetime.mjs`
- `worker-progress/worker-012-native-lifetime-regression.md`

## Remaining risks

- A true linked native runtime smoke test remains the stronger future coverage option.
- The source-invariant checks intentionally depend on current implementation shape, so a future safe refactor may need to update the verifier.

## Final git status

Before staging in the main worktree:

- `M package.json`
- `?? scripts/verify-yoganode-native-lifetime.mjs`
- `?? worker-progress/worker-012-native-lifetime-regression.md`
