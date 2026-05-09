# Worker 005 Package Entrypoints

## Goal Lifecycle

- Goal created successfully with the required objective: `Verify, complete, and report the package-entrypoint patch in the worker-005 worktree after the previous worker hit a usage limit.`
- Visible goal gate was emitted immediately after `create_goal` succeeded.
- Goal status at report time: active until this report is written and completion is recorded.

## Root Cause

- The package metadata was still advertising a generated `lib/` contract even though this worktree is source-first and does not ship `lib/`.
- Root JSX runtime declaration shims were also pointing at `lib/` artifacts, which made TypeScript consumers depend on files that are not published or present in this worktree.
- The package contract needed to be made self-consistent for fresh consumers: published types and JSX runtime declarations must resolve to checked-in files that are actually packed.

## Changes

- Updated `package.json` so `types` points to `index.d.ts` instead of `lib/index.d.ts`.
- Removed `lib` from the published `files` list and added `index.d.ts` so the package tarball includes the root type entrypoint.
- Updated `jsx-runtime.d.ts` to re-export from `./src/jsx-runtime`.
- Updated `jsx-dev-runtime.d.ts` to re-export from `./src/jsx-dev-runtime`.
- Added `index.d.ts` as the root published type entrypoint that re-exports the source index surface.
- Updated the README usage example to match the actual public API: `YogaCanvas` and lowercase intrinsic JSX nodes.

## Nested Subagent Results

- No new nested subagent was needed for this pass because the remaining question was narrow and the package tarball inspection answered it directly.
- Prior worker evidence already established the underlying root cause: the published package contract was drifting toward generated `lib/` artifacts while the checked-in source tree and runtime shims were moving to source-first entrypoints.
- That prior evidence was consistent with the current verification results: the tarball now includes the real entrypoints and no `lib/` artifact is required for the published type/runtime surface.

## Verification

- `npm pack --dry-run` succeeded.
- The tarball contents include `index.d.ts`, `jsx-runtime.d.ts`, and `jsx-dev-runtime.d.ts`.
- The tarball contents do not include any `lib/` artifacts.
- `tsc --noEmit` could not run because `tsc` is not installed in this environment: `zsh:1: command not found: tsc`.
- README surface check confirmed the updated usage example now references `YogaCanvas`, `<rect>`, and `<text>` instead of legacy `Canvas`, `View`, and `Text`.

## Quality, Maintainability, Performance, Security Review

- Quality: the package contract is now internally consistent for source-first consumption and packaging. This removes the dependency on an ignored/generated `lib/` tree.
- Maintainability: a single checked-in `index.d.ts` entrypoint is easier to reason about than a split contract between source files and missing generated artifacts.
- Performance: no runtime cost was introduced. The change only affects package metadata and declaration routing.
- Security: no new execution surface was added. Packaging now exposes fewer ambiguous paths because consumers no longer need to rely on absent build output.

## Files Changed

- [`package.json`](./package.json)
- [`index.d.ts`](./index.d.ts)
- [`jsx-runtime.d.ts`](./jsx-runtime.d.ts)
- [`jsx-dev-runtime.d.ts`](./jsx-dev-runtime.d.ts)
- [`README.md`](./README.md)
- [`worker-progress/worker-005-package-entrypoints.md`](./worker-progress/worker-005-package-entrypoints.md)

## Remaining Risks

- TypeScript verification is still not fully proven in this environment because `tsc` is missing.
- This work fixes the published entrypoint contract, but it does not address unrelated root/worktree hygiene or dependency-isolation issues.
- If downstream tooling expects a transpiled JS build instead of source-first imports, that would be a separate packaging decision and should be handled explicitly rather than by reintroducing `lib/` drift.
