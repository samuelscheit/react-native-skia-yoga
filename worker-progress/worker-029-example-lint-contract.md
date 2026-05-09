# Worker 029 Example Lint Contract

## Goal lifecycle

- Goal created first with exact objective: `Apply nested-review fixups for worker 029 example lint contract.`
- This fixup worker continued from a partial accepted patch after the original `gpt-5.5` worker hit a Codex usage limit before addressing the nested reviewer scope concern and before writing the report.
- This finalizer used a smaller model only because the original `gpt-5.5` worker exhausted usage.
- I reviewed the existing diff before editing, kept the accepted targeted cleanups, narrowed the ESLint override, fixed the root shell inline style directly, then reran the required verification matrix.

## Root cause

- The original lint-contract change disabled `react-native/no-inline-styles` for `example/app/**/*.tsx`, which was broader than the actual intent.
- Most example tab screens intentionally use inline style objects as part of the documentation surface, but `example/app/_layout.tsx` is app shell infrastructure rather than a style-demo screen.
- The root cause was an override boundary that mixed demo content with shell code. The correct fix is to scope the override to the demo/typecheck fixture paths and keep real shell files under the normal rule.

## Changes

- Narrowed the ESLint override in `.eslintrc.js` from `example/app/**/*.tsx` to:
  - `example/app/(tabs)/**/*.tsx`
  - `example/types/**/*.tsx`
- Fixed the remaining app-shell inline style in `example/app/_layout.tsx` by introducing `StyleSheet.create({ root: { flex: 1 } })` and using that constant on `GestureHandlerRootView`.
- Preserved the existing targeted cleanups already present in the worktree:
  - module-scope tab icon renderers in `example/app/(tabs)/_layout.tsx`
  - exported style coverage sentinel in `example/app/(tabs)/styles/registry.ts`
  - named assertion helper for typecheck fixtures in `example/types/skiayoga-typecheck.tsx`
  - removal of stale commented `__dirname` plumbing in `example/babel.config.js`

## Nested subagent results

- No new nested subagent was spawned in this fixup because the completed nested reviewer result from the original worker log was readable and sufficient.
- Inherited completed nested reviewer conclusion:
  - strategy was correct overall
  - `example/app/**/*.tsx` was broader than needed because it also covered `example/app/_layout.tsx`
  - preferred override scope was `example/app/(tabs)/**/*.tsx` plus `example/types/**/*.tsx`
  - `example/app/_layout.tsx` should be fixed directly with a readable style constant
- This fixup implemented that recommendation exactly.

## Verification

- `npm run lint-ci`
  - passed with 0 errors and 0 warnings
- `npm run typecheck`
  - passed
- `bun run specs`
  - passed
  - no additional generated diffs remained afterward
- `cd example && bun run typecheck`
  - passed
- `git diff --check`
  - passed
- `find . -maxdepth 1 -name '*.tgz' -print`
  - no `.tgz` artifacts found
- `git status --short --branch`
  - confirmed only the intended tracked file changes listed below

## Quality/maintainability/performance/security review

- Quality: the lint contract now matches file purpose more precisely and no longer hides shell-file inline styles.
- Maintainability: the override is smaller and easier to reason about, while the root layout uses a conventional style constant.
- Performance: restoring `react-native/no-inline-styles` coverage for the root shell avoids suppressing a real app-structure case; the runtime behavior is unchanged.
- Security: no security-relevant changes were introduced.

## Remaining risks/blockers

- The example override still intentionally relaxes `react-native/no-inline-styles` inside demo tabs and typecheck fixtures. That is deliberate for documentation readability, but future non-demo infrastructure should stay outside those paths.
- No current blockers remain for orchestrator review.

## Files changed

- `.eslintrc.js`
- `example/app/(tabs)/_layout.tsx`
- `example/app/(tabs)/styles/registry.ts`
- `example/app/_layout.tsx`
- `example/babel.config.js`
- `example/types/skiayoga-typecheck.tsx`
- `worker-progress/worker-029-example-lint-contract.md`

## Final git status

```text
## worker/029-example-lint-contract
 M .eslintrc.js
 M example/app/(tabs)/_layout.tsx
 M example/app/(tabs)/styles/registry.ts
 M example/app/_layout.tsx
 M example/babel.config.js
 M example/types/skiayoga-typecheck.tsx
?? worker-progress/worker-029-example-lint-contract.md
```
