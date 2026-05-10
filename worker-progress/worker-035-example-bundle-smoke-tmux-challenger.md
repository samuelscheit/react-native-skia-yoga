# Worker 035 Example Bundle Smoke Challenger

## Goal lifecycle

- Goal created: `Read-only challenge worker 035 example bundle smoke implementation.`
- Challenger mode: read-only for product/source/config files.
- Report file written as the only allowed filesystem change.
- Final status: ready for `update_goal(status="complete")` after this report write.

## Patch reviewed

- `package.json`: adds root-owned `check:example-bundle` script pointing at `scripts/verify-example-bundle-export.mjs`.
- `scripts/verify-example-bundle-export.mjs`: new verifier reviewed from working tree contents; it is currently untracked in `git status`, so it must be included with the patch when committed.
- `example/metro.config.js`: removes `console.log(finalConfig)`, so Metro no longer dumps the full config during export.

## Commands/probes run

- `git diff -- package.json example/metro.config.js scripts/verify-example-bundle-export.mjs`
- `sed -n '1,260p' scripts/verify-example-bundle-export.mjs`
- `git status --short --branch`
- `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`
- `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' \) -print`
- `npm run check:example-bundle`: passed. It exported to `/tmp/rnskia-example-export.rIaTE0` and reported cleanup.
- Post-smoke cleanup probes:
  - `/tmp` probe returned no `rnskia-example-export.*` paths.
  - repo probe returned no `dist`, `.expo`, or `rnskia-example-export.*` paths at max depth 2.
- `bun run typecheck` from `example/`: passed (`tsc -p tsconfig.skiayoga.json --noEmit`).
- `rg -n "worker-035|035-example|check:example-bundle|bun run typecheck|typecheck" worker-progress package.json scripts example/metro.config.js`: found no worker 035 report/evidence that worker 035 itself ran `cd example && bun run typecheck`.

## Verdict and required fixups

Verdict: accept with small fixups.

Required fixups:

- Process/provenance fixup: worker 035 needs to record or run `cd example && bun run typecheck`. I found no worker 035 progress report or other evidence that the worker itself ran it. The command did pass when run by this challenger.
- Commit hygiene fixup: ensure the untracked `scripts/verify-example-bundle-export.mjs` file is included with the patch, because `package.json` now references it.

No product/source/config code fix is required by this challenge based on the observed behavior.

## Target assessment

- Repo-owned root script guards the example Expo export path: satisfied by `package.json` `check:example-bundle`.
- Verifier is bounded and cannot hang indefinitely: satisfied. The script uses a 180s timeout, sends `SIGTERM`, then escalates to `SIGKILL` after 5s.
- Export output is written outside the repo: satisfied. The script uses `mkdtempSync` under `/tmp` when available and asserts the real output path is not inside the repo.
- Temporary output cleanup: satisfied for success and ordinary failure paths by `finally`, plus explicit `SIGINT`/`SIGTERM` cleanup handlers.
- `example/metro.config.js` no longer dumps full Metro config: satisfied.
- No generated export artifacts left in repo or `/tmp`: satisfied by post-smoke probes.

## Quality/maintainability/performance/security notes

- Quality: the smoke verifier exercises the actual Expo iOS export path from the root script and catches Metro/export regressions that typecheck alone will not catch.
- Maintainability: the script is small and explicit. A minor future hardening would be to place the outside-repo assertion under the same cleanup guard, but the current `/tmp` path makes that failure mode unlikely in this worktree.
- Performance: local smoke export completed quickly and the 180s cap prevents runaway CI/runtime hangs.
- Security: command execution uses `spawn` without shell interpolation, uses the local `example/node_modules/.bin/expo`, and only deletes the verifier-owned `mkdtempSync` output directory.

## Final status

Challenger review complete. Patch behavior is acceptable; only the typecheck provenance and untracked-file inclusion fixups remain.
