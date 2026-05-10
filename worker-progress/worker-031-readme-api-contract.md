# Worker 031 README API Contract

## Goal lifecycle

- Goal created first with objective: `Complete worker 031 README/API contract drift report and bounded verification.`
- This finalizer stayed scoped to the existing README/package metadata patch and did not broaden into source/runtime/type shim changes.
- `update_goal(status="complete")` is the final action after this report and verification are complete.

## Root cause

- The public package contract drift had two roots:
  - README usage showed lowercase intrinsic Yoga/Skia nodes such as `<rect />`, `<text />`, and `<group />` without documenting the consumer TypeScript setting that makes the package-owned JSX namespace available.
  - Published package metadata still pointed `repository`, `bugs`, and `homepage` at stale Nitro URLs, which would send npm consumers to the wrong public repository and issue tracker.
- This was not a runtime or generated-shim bug. The accepted nested review confirmed the custom JSX runtime and declarations already align with the documented `jsxImportSource` setup.

## Changes

- Updated [`README.md`](../README.md) with an Installation section that lists the peer dependencies consumers must provide.
- Updated [`README.md`](../README.md) with a TypeScript Setup section documenting:
  - `jsx: "react-jsx"`
  - `jsxImportSource: "react-native-skia-yoga"`
  - the existing `example/` setup as intentional reference behavior
- Updated [`package.json`](../package.json) public metadata from stale Nitro URLs to `SamuelScheit/react-native-skia-yoga` for:
  - `repository.url`
  - `bugs.url`
  - `homepage`
- No product source, runtime, generated, or type shim files were changed.

## Nested subagent results

- No new nested subagent was spawned in this finalizer because the completed nested result already covered the remaining uncertainty.
- The previous fixup's nested challenger attempt is not accepted evidence:
  - the first spawn failed with a full-history fork/agent-type error
  - the later wait targeted the parent/current thread instead of a completed nested reviewer
  - a second narrower spawn in that same fixup also failed with the same fork error
- Accepted nested evidence came later from [`worker-logs/worker-031-readme-api-contract-finalize.jsonl`](../../worker-logs/worker-031-readme-api-contract-finalize.jsonl), completed item `item_12`:
  - `jsxImportSource: "react-native-skia-yoga"` is appropriate because `src/jsx-runtime.ts`, `src/jsx-dev-runtime.ts`, `src/jsx-runtime-types.ts`, root runtime declaration shims, and example tsconfigs are aligned.
  - stale `repository`, `bugs`, and `homepage` URLs are real public package contract drift because they are published package metadata.
  - no code/runtime/type shim files need changes beyond the README/package metadata patch.

## Verification

Inherited valid evidence from [`worker-logs/worker-031-readme-api-contract-fixup.jsonl`](../../worker-logs/worker-031-readme-api-contract-fixup.jsonl):

- `npm run lint-ci` passed.
- `npm run typecheck` passed.
- `bun run specs` passed.
- `git diff --check` passed.
- `npm pack --dry-run --json` passed and included the updated `README.md` and `package.json` in the packed manifest.
- `find . -maxdepth 1 -name '*.tgz' -print` printed nothing before the pack dry run.

Fresh verification in this finalizer:

- Reviewed the current patch:
  - [`README.md`](../README.md) now documents peer dependencies and `jsxImportSource`.
  - [`package.json`](../package.json) now points package metadata to `SamuelScheit/react-native-skia-yoga`.
- `git diff --check` passed with no output.
- `git status --short --branch` before writing this report showed only:
  - `## worker/031-readme-api-contract`
  - ` M README.md`
  - ` M package.json`
- `find . -maxdepth 1 -name '*.tgz' -print` printed nothing before and after the bounded package lifecycle run.
- Leftover package-lifecycle process check before rerun found no matching `rnskia-package-lifecycle`, `verify-package-lifecycle`, or `check:package-lifecycle` process.
- `bun run check:package-lifecycle` was run through a detached Node wrapper with a 180 second timeout and process-group termination on timeout. It passed and reported:
  - verifier PATH shim exposes `node`, `npm`, and `tar` while keeping `bun` unavailable
  - `npm pack --dry-run --json` kept private scripts out of the tarball manifest
  - packed `package.json` has no root `preinstall`, `install`, or `postinstall` hooks
  - temporary consumer install succeeded with lifecycle scripts enabled and Bun hidden from `PATH`
- Post-verifier process check found no leftover package-lifecycle verifier process.

## Quality / Maintainability / Performance / Security Review

- Quality: the README now documents the actual JSX runtime contract consumers need for lowercase intrinsic nodes, and package metadata points to the correct public repo.
- Maintainability: the fix keeps consumer guidance close to the usage example and avoids unnecessary changes to shims that already match the example tsconfigs.
- Performance: documentation and metadata-only changes have no runtime cost.
- Security: no new install hooks, scripts, native code paths, or runtime behavior were introduced; the bounded lifecycle verifier also confirmed the packed package still avoids root lifecycle hooks.

## Remaining risks / blockers

- No remaining blocker for the README/package metadata contract patch.
- Native simulator/device runtime behavior was not rerun because this worker is scoped to README/API contract drift and no runtime files changed.
- The package-lifecycle verifier passed in this finalizer; there is no current local npm verifier blocker.

## Files changed

- [`README.md`](../README.md)
- [`package.json`](../package.json)
- [`worker-progress/worker-031-readme-api-contract.md`](worker-031-readme-api-contract.md)

## Final git status

- `## worker/031-readme-api-contract`
- ` M README.md`
- ` M package.json`
- `?? worker-progress/worker-031-readme-api-contract.md`
