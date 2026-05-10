# Worker 035 Example Bundle Smoke

## Goal lifecycle

- Original worker goal: `Implement example JS bundle smoke verification and remove the Metro config dump.`
- Current fixup goal: `Apply worker 035 bundle smoke review fixups and finalize verification evidence.`
- Scope honored: kept full native build/run out of scope and did not edit product source.
- Tmux challenger report is preserved unchanged at `worker-progress/worker-035-example-bundle-smoke-tmux-challenger.md`.

## Implementation summary

- Added a root package script, `check:example-bundle`, that runs `scripts/verify-example-bundle-export.mjs`.
- Added `scripts/verify-example-bundle-export.mjs`.
  - Runs `bun --bun ./node_modules/.bin/expo export --platform ios --output-dir <tmp> --no-bytecode --no-minify`.
  - Uses `cwd` set to `example`.
  - Writes output under `/tmp/rnskia-example-export.*` when `/tmp` is available, otherwise under `os.tmpdir()`.
  - Asserts the real output path is outside the repository.
  - Enforces a 180 second timeout, sends `SIGTERM`, and escalates to `SIGKILL` after 5 seconds.
  - Removes the temporary output in `finally`, with additional `SIGINT`/`SIGTERM` cleanup handlers.
- Fixup hardening: moved the outside-repository assertion inside the same `try/finally` cleanup guard as the export, so the temp directory is removed even if that assertion fails.
- Removed `console.log(finalConfig)` from `example/metro.config.js` while preserving the same exported `finalConfig` object shape.

## Files changed

- `package.json`
- `scripts/verify-example-bundle-export.mjs`
- `example/metro.config.js`
- `worker-progress/worker-035-example-bundle-smoke.md`
- `worker-progress/worker-035-example-bundle-smoke-tmux-challenger.md` was written earlier by the read-only tmux challenger and left unchanged during this fixup.

## Original worker evidence

- `npm run check:example-bundle`: passed.
  - Exported iOS bundle to `/tmp/rnskia-example-export.OE2IGj`.
  - Metro config dump was absent from the output.
  - Verifier reported successful cleanup.
- Cleanup checks after the smoke run: passed.
  - `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
  - `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' \) -print`: no output.
- `git diff --check`: passed.
- `npm run lint-ci`: passed.
- `npm run typecheck`: passed.
- `bun run specs`: passed; generated 2/2 HybridObjects.
- `npm run check:package-surface`: passed.
  - npm pack manifest includes 118 files.
  - All 30 files under `cpp/` are published.
  - Representative iOS, Android, Nitrogen, and package entrypoint files are published.
  - Podspec source metadata points at the canonical repository.
- `perl -e 'alarm shift; exec @ARGV' 240 bun run check:package-lifecycle`: passed.
  - Packed package has no lifecycle hooks.
  - Temporary consumer install succeeded with lifecycle scripts enabled and Bun hidden from `PATH`.
- Earlier notes claimed example typecheck coverage, but the review fixup required fresh worker-owned evidence for the exact command form below.
- `find . -maxdepth 1 -name '*.tgz' -print`: no output.

Observed non-blocking local warning:

- npm commands print `npm warn Unknown user config "minimum-release-age"`. This is inherited local npm configuration noise and did not block any required command.

## Tmux challenger evidence

- Read-only tmux challenger completed and wrote `worker-progress/worker-035-example-bundle-smoke-tmux-challenger.md`.
- `npm run check:example-bundle`: passed.
  - Exported to `/tmp/rnskia-example-export.rIaTE0`.
  - Reported cleanup.
- Post-smoke cleanup probes: passed.
  - `/tmp` probe returned no `rnskia-example-export.*` paths.
  - Repo probe returned no `dist`, `.expo`, or `rnskia-example-export.*` paths at max depth 2.
- `bun run typecheck` from `example/`: passed (`tsc -p tsconfig.skiayoga.json --noEmit`).
- Tmux challenger verdict: accept with small fixups.
  - It confirmed the verifier is bounded, exports the intended iOS Expo path from a root script, writes outside the repo, cleans up temp output, and leaves the Metro config shape intact.
  - It confirmed no `/tmp` or repo export artifacts remained after its smoke run.
  - It requested process/provenance fixups: record worker 035's own exact `cd example && bun run typecheck` result and ensure the untracked verifier script is included with the patch.
  - It also noted a future hardening opportunity to place the outside-repo assertion under the same cleanup guard; this fixup implements that hardening.

## Fixup evidence

- `cd example && bun run typecheck`: passed during this fixup.
  - Output: `$ tsc -p tsconfig.skiayoga.json --noEmit`
  - Exit code: 0
- `scripts/verify-example-bundle-export.mjs` remains present for inclusion with the patch and is referenced by `package.json`.

## Required final verification

Completed after the script/report update:

- `npm run check:example-bundle`: passed.
  - Exported iOS bundle to `/tmp/rnskia-example-export.YYI8IA`.
  - Verifier reported successful cleanup.
  - npm again printed the non-blocking local `minimum-release-age` config warning.
- `cd example && bun run typecheck`: passed.
  - Output: `$ tsc -p tsconfig.skiayoga.json --noEmit`
- `git diff --check`: passed with no output.
- `find /tmp -maxdepth 1 -name 'rnskia-example-export.*' -print`: no output.
- `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-example-export.*' \) -print`: no output.
- `git status --short --branch`:

```text
## worker/035-example-bundle-smoke
 M example/metro.config.js
 M package.json
?? scripts/verify-example-bundle-export.mjs
?? worker-progress/worker-035-example-bundle-smoke-tmux-challenger.md
?? worker-progress/worker-035-example-bundle-smoke.md
```

Additional final sanity rerun after writing the verification evidence:

- `npm run check:example-bundle`: passed and cleaned `/tmp/rnskia-example-export.058jIO`.
- `cd example && bun run typecheck`: passed with `$ tsc -p tsconfig.skiayoga.json --noEmit`.
- `git diff --check`: passed with no output.
- Both required export-artifact probes returned no output.
- `git status --short --branch` remained unchanged from the status block above.

## Quality / maintainability / performance / security review

- Quality: the new check covers the currently working app-level JS/Metro export path that lint, typecheck, specs, and package-surface checks do not exercise.
- Maintainability: the one-off shell probe from worker 034 is now a repo-owned package script with explicit command arguments and cleanup behavior.
- Performance: the check is single-platform iOS export only and bounded at 180 seconds, so it should stay lightweight compared with native build/run.
- Security: removing the Metro config dump avoids logging resolver internals and absolute local paths. The verifier uses `spawn` without shell interpolation and only removes the directory it created with `mkdtempSync`.

## Remaining risks/blockers

- This is JS bundle/export coverage only; it does not prove native iOS or Android runtime behavior.
- Full native build/run remains out of scope and locally blocked by the previously documented Xcode/CocoaPods/Java/Android SDK/Gradle/ADB/CMake/Ninja/native project prerequisites.
- RN Skia private import cleanup in `src/YogaCanvas.tsx` remains product debt and should be handled separately after this verifier is available.
- Managed nested subagent review remained unreliable in the original worker run; completed review evidence is from the read-only tmux challenger.

## Final status

Fixups complete. Required final verification passed, no generated example export artifacts remain in `/tmp` or the repository, and `scripts/verify-example-bundle-export.mjs` is present for inclusion with the patch.
