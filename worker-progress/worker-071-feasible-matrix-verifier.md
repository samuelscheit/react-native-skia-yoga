# Worker 071 - Feasible matrix verifier

## Goal Lifecycle

- `create_goal` objective: `Add an aggregate feasible-matrix verifier with cleanup accounting.`
- Exact first visible gate text emitted by this worker: `GOAL_CREATED: Add an aggregate feasible-matrix verifier with cleanup accounting.`
- Pre-completion `get_goal` evidence showed status `active`, the same objective, `tokensUsed: 149282`, and `timeUsedSeconds: 612`.
- Final `update_goal(status: "complete")` evidence is recorded in the tmux log: `tokensUsed: 161256` and `timeUsedSeconds: 676`.

## Summary

- Added `check:feasible-matrix` as a root package script.
- Added `scripts/verify-feasible-matrix.mjs`, a repo-owned Node runner for the accepted feasible local matrix.
- The runner uses structured `spawn()` calls with `shell: false` for every command.
- The historically shell-shaped `cd example && bun run typecheck` behavior is implemented as `bun run typecheck` with `cwd` set to `example/`; the code documents that this preserves the working-directory behavior without broad shell interpolation.
- The runner prints per-command start/pass/fail lines, working directory, durations, a final command summary, proof-boundary text, and cleanup accounting.

## Files Changed

- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `worker-progress/worker-071-feasible-matrix-verifier.md`

## Matrix Command List

The aggregate runner executes this stable feasible local matrix in order:

1. `npm run check:package-codegen-autolinking`
2. `npm run check:package-typescript-consumer`
3. `npm run check:package-surface`
4. `npm run check:package-lifecycle`
5. `npm run check:install-isolation`
6. `npm run check:rn-codegen-schema`
7. `node node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js src/specs/NativeSkiaYoga.ts src/specs/SkiaYogaViewNativeComponent.ts`
8. `npm run check:skia-yoga-object-lazy-init`
9. `npm run check:reconciler-animated-bindings`
10. `npm run check:gesture-interaction-runtime`
11. `npm run check:yogacanvas-lifecycle-runtime`
12. `npm run check:rn-skia-imports`
13. `npm run check:android-skia-archives`
14. `npm run check:yoganode-native-lifetime`
15. `npm run check:yoganode-native-runtime`
16. `npm run typecheck`
17. `npm run lint-ci`
18. `cd example && bun run typecheck` behavior via structured `cwd: example`
19. `bun run specs`
20. `npm run check:example-bundle`
21. `npm run check:example-native-generation`
22. `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`

## Proof Boundary

This verifier proves only the accepted feasible local package/source/example metadata matrix.

It does not claim CocoaPods install, Gradle build, simulator/device launch, native app runtime, native Skia rendering in the app, UI-runtime Worklets execution, or RNGH native delivery.

## Cleanup Accounting Design

- At startup, the runner snapshots tracked artifacts before any matrix command runs.
- It tracks known temp roots from `node:os.tmpdir()` and `/tmp`, constrained to exact verifier prefixes:
  - `rnskia-example-export.`
  - `rnskia-example-native-generation-`
  - `rnskia-package-codegen-autolinking-`
  - `rnskia-package-consumer-`
  - `rnskia-package-lifecycle-`
  - `rnskia-package-typescript-consumer-`
  - `rnskia-yoganode-lifetime-`
  - `rnskia-yoganode-runtime-`
- It tracks repository artifacts:
  - `example/ios`
  - `example/android`
  - `example/.expo`
  - `tsconfig.tsbuildinfo`
  - `example/tsconfig.tsbuildinfo`
  - repo-root `*.tgz`
- Pre-existing tracked artifacts are preserved.
- Newly observed artifacts are removed only if they were absent from the initial snapshot, match the constrained known paths/prefixes, and have modification evidence consistent with this run.
- The aggregate run created `tsconfig.tsbuildinfo`; the runner removed it during final cleanup and reported no remaining new tracked artifacts.

## Verification Commands

All commands below passed.

- `node --check scripts/verify-feasible-matrix.mjs`
- `npm run lint-ci -- scripts/verify-feasible-matrix.mjs`
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`
- `npm run check:feasible-matrix`
  - Passed all 22 matrix commands.
  - Total command duration reported by the runner: `2m 37s`.
  - Cleanup result removed newly created `tsconfig.tsbuildinfo`.
  - Cleanup result reported no remaining new tracked artifacts.
- `npm run check:example-native-generation`
- `node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts`
- `git diff --check`

Expected inherited npm warning on npm commands: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Nested Challenger Documentation

- Nested read-only challenger `/root/cleanup_challenger` prompt: inspect existing verifier scripts and challenge cleanup design for safe artifact accounting around temp package/native-generation/export dirs, tarballs, generated native folders, `example/.expo`, and `tsconfig.tsbuildinfo`.
  - Result: stalled. `wait_agent` timed out and `close_agent` returned `previous_status.completed: null`.
  - No challenger acceptance evidence is claimed.
- Nested read-only challenger `/root/matrix_scope_challenger` prompt: inspect package scripts, verifier scripts, and worker 070 report; challenge the aggregate matrix list, proof-boundary wording, and shell-shaped command risks.
  - Result: stalled. `wait_agent` timed out and `close_agent` returned `previous_status.completed: null`.
  - No challenger acceptance evidence is claimed.
- `list_agents` after closing both challengers showed only `/root` running.

## Cleanup Evidence

Post-verification cleanup/status probes returned empty output:

- Repository artifact probe:
  - `find . -maxdepth 3 \( -name 'tsconfig.tsbuildinfo' -o -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-package-consumer-*' -o -name 'rnskia-example-export.*' -o -name 'rnskia-example-native-generation-*' -o -name 'rnskia-yoganode-lifetime-*' -o -name 'rnskia-yoganode-runtime-*' \) -print | sort`
- Generated example artifact probe:
  - `find example -maxdepth 2 \( -path 'example/ios*' -o -path 'example/android*' -o -path 'example/.expo*' \) -print | sort`
- `/tmp` artifact probe:
  - `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-codegen-autolinking-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-package-consumer-*' -o -name 'rnskia-example-export.*' -o -name 'rnskia-example-native-generation-*' -o -name 'rnskia-yoganode-lifetime-*' -o -name 'rnskia-yoganode-runtime-*' \) -print | sort`
- `node:os.tmpdir()` artifact probe with the same prefixes.

Final `git status --short --ignored=matching` after writing this report showed only expected product edits, this report, and dependency symlinks:

- `M package.json`
- `?? scripts/verify-feasible-matrix.mjs`
- `?? worker-progress/worker-071-feasible-matrix-verifier.md`
- `!! example/node_modules`
- `!! node_modules`

## Quality, Maintainability, Performance, And Security Review

- Quality: the aggregate command is covered by syntax check, focused lint, full matrix execution, standalone native-generation verification, and cleanup probes.
- Maintainability: the matrix is centralized in one script with explicit labels, timeouts, proof-boundary output, and cleanup policy instead of requiring future workers to reconstruct command order from reports.
- Performance: the runner is sequential by design to keep cleanup attribution and failure logs simple. The full accepted matrix completed in `2m 37s` in this worker checkout.
- Security: child processes are spawned without shell interpolation. Cleanup is constrained to exact known repository paths, repo-root tarballs, and exact temp-prefix entries in known temp roots.

## Residual Risks

- Full iOS/Android native build, CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, and RNGH native delivery remain outside the local proof boundary.
- Cleanup attribution for temp prefixes assumes no unrelated concurrent process creates a matching `rnskia-*` temp artifact during the matrix run. The runner mitigates this by preserving pre-existing artifacts, constraining prefixes/parents, and checking modification timing.
- Nested challengers stalled, so the implementation has no independent nested-agent acceptance evidence beyond the direct script inspection and verification results above.
