# Worker 027 React Native Deep Import Fix

## Goal lifecycle

- Original worker goal was created first and emitted the required visible line:
  `GOAL_CREATED: Fix React Native deep imports in SkiaYogaViewNativeComponent.`
- The original worker applied the narrow source patch, ran the required checks, and then hit a Codex usage limit before it could write a report.
- First finalizer goal was created first and emitted the required visible line:
  `GOAL_CREATED: Finalize worker 027 React Native deep import fix after usage exhaustion.`
- The first finalizer revalidated the patch, ran the required verification, obtained a completed nested reviewer result, and then hit a Codex usage limit immediately before report writing.
- This worker is report-only. I did not change product code; I only recovered the final report from the completed evidence.

## Root cause

- `src/specs/SkiaYogaViewNativeComponent.ts` was using deprecated React Native deep imports:
  - `react-native/Libraries/Utilities/codegenNativeComponent`
  - `react-native/Libraries/Types/CodegenTypes`
- Those imports are unnecessary in the current React Native surface because the installed package already exports the needed symbols from the top level.
- The contract issue was not in Nitro generation. The spec surface itself was already correct; the problem was the import path drift against React Native’s supported export surface.

## Changes

- `src/specs/SkiaYogaViewNativeComponent.ts` now imports:
  - `codegenNativeComponent` from top-level `react-native`
  - `CodegenTypes` and `ViewProps` as types from top-level `react-native`
- `pointerEvents` now uses `CodegenTypes.WithDefault<...>` instead of the deep-imported `WithDefault`.
- No generated Nitro artifact changes were required or produced for this import-only patch.

## Nested subagent results

- The finalizer ran a nested read-only reviewer that inspected the installed React Native export/type surface.
- Reviewer conclusion:
  - `codegenNativeComponent` is valid from top-level `react-native` at runtime and in TypeScript.
  - `CodegenTypes.WithDefault` is valid as a TypeScript-only top-level `react-native` namespace import.
  - `CodegenTypes` should remain a `type` import because the inspected files did not show a runtime `CodegenTypes` export.
  - Nitro-generated artifacts should not change because the props surface did not change.
  - The remaining risk is RN version/export-surface skew if older supported versions are added later.

## Verification

- Focused search in `src/specs/SkiaYogaViewNativeComponent.ts` for the deprecated deep-import strings returned nothing.
- `git diff -- src/specs/SkiaYogaViewNativeComponent.ts` shows only the import cleanup and `pointerEvents` type adjustment.
- `git diff --name-only` showed only `src/specs/SkiaYogaViewNativeComponent.ts` before this report was added.
- `git diff --check` passed.
- `find . -maxdepth 1 -name '*.tgz' -print` printed nothing.
- `npm run typecheck` passed.
- `npm run lint-ci` passed with 178 warnings and 0 errors.
- `bun run specs` passed and regenerated no unexpected artifact diffs.
- `git diff --name-only` remained limited to the spec file until this report was created.

## Quality / maintainability / performance / security review

- Quality: the patch removes unsupported internal dependency paths and aligns the spec with the supported public React Native surface.
- Maintainability: the spec is less coupled to RN internals, which reduces upgrade fragility and avoids relying on deep import contracts.
- Performance: no runtime performance change is expected from the import rewrite.
- Security: there is no direct security issue here, but avoiding unsupported internal entrypoints reduces supply-chain and upgrade ambiguity.

## Remaining risks / blockers

- The only material risk is future React Native export-surface drift across any older versions that may still be in the supported range.
- No local blocker remained for this fix; the patch was already verified before report recovery.

## Files changed

- `src/specs/SkiaYogaViewNativeComponent.ts`
- `worker-progress/worker-027-react-native-deep-imports.md`

## Final git status

- `## worker/027-react-native-deep-imports`
- ` M src/specs/SkiaYogaViewNativeComponent.ts`
- `?? worker-progress/worker-027-react-native-deep-imports.md`
