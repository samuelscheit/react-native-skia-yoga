# Worker 039 Package TypeScript Consumer Smoke

## Goal lifecycle

- `create_goal` objective: `Add packed-package TypeScript consumer smoke coverage.`
- Required visible gate emitted immediately after goal creation:
  `GOAL_CREATED: Add packed-package TypeScript consumer smoke coverage.`
- `update_goal(status="complete")` is reserved until implementation, this report, final `git diff --check`, final status capture, and cleanup checks are complete.

## Baseline

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-039-package-typescript-consumer-smoke`
- Branch: `worker/039-package-typescript-consumer-smoke`
- HEAD: `365b49ae1246ac004c235b5a595c63d405728ca3`
- Initial `git status --short --branch`: `## worker/039-package-typescript-consumer-smoke`

## Root-cause explanation

Existing checks covered source and example topology, but not the artifact a real consumer installs:

- `npm run typecheck` compiles repo source with repo-local path mappings.
- `cd example && bun run typecheck` maps `react-native-skia-yoga` to `../`, so it does not consume the packed package installed in `node_modules`.
- `check:package-surface` proves files are present in an `npm pack --dry-run` manifest, but does not resolve the package declarations from a separate TypeScript project.
- `check:package-lifecycle` installs a packed tarball into a temporary consumer, but stops after install and does not compile public entrypoints or the JSX runtime contract.

The new verifier closes that gap by packing the package to a real `.tgz`, installing that tarball into a temporary project outside the repo, and running TypeScript from that consumer with `jsx: "react-jsx"` and `jsxImportSource: "react-native-skia-yoga"`.

## Implementation summary

- Added `scripts/verify-package-typescript-consumer.mjs`.
  - Creates a temp root under the OS temp directory.
  - Runs `npm pack --json --ignore-scripts --pack-destination <temp>/tarball` from the repo root.
  - Writes a standalone temporary consumer project under `<temp>/consumer`.
  - Installs the package as a `file:` dependency pointing at the packed tarball, not as a workspace link or source path.
  - Runs the consumer-local TypeScript compiler with `tsc -p tsconfig.json --noEmit`.
  - Verifies the installed package directory is not a symlink and its real path is not inside the repo.
  - Removes the entire temp root in `finally`.
- Added `check:package-typescript-consumer` to `package.json`.
- The verifier script remains private because `package.json` `files` does not publish `scripts/`; `npm run check:package-surface` still reported 119 packed files after this change.

## Temporary consumer design

- Package tarball creation:
  - Uses `npm pack --json --ignore-scripts --pack-destination` with a destination under `mkdtemp`.
  - Parses npm's JSON manifest for the generated tarball filename instead of scraping shell output.
- Install strategy:
  - Writes a consumer `package.json` with `"react-native-skia-yoga": "file://.../react-native-skia-yoga-0.0.1.tgz"`.
  - Runs `npm install --ignore-scripts --no-audit --no-fund --package-lock=false --prefer-offline --legacy-peer-deps`.
  - Uses the example app's peer versions for `react`, `react-native`, `@shopify/react-native-skia`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`, and `react-native-nitro-modules`.
  - Installs `typescript` and `@types/react` from the example app. It also installs `@types/react-reconciler` from the root dev dependency because the current package publishes source declarations that reach `src/Reconciler.ts`.
- TypeScript config:
  - `jsx: "react-jsx"`
  - `jsxImportSource: "react-native-skia-yoga"`
  - `strict: true`
  - `skipLibCheck: true`
  - No `paths` or `baseUrl`; the script asserts these are absent.
- Consumer source shape:
  - Imports `YogaCanvas`, `YogaCanvasProfileSample`, `YogaIntrinsicElements`, and `YogaNodeStyle` from `"react-native-skia-yoga"`.
  - Imports `Fragment` from `"react-native-skia-yoga/jsx-runtime"` to force subpath type resolution.
  - Builds a `YogaCanvas` tree using lowercase intrinsic elements verified against `src/jsx.ts`: `<rect>`, `<group>`, `<rrect>`, `<circle>`, and `<text>`.
  - Uses valid props from the package JSX types: `style`, `hitSlop`, `onPress`, `preciseHit`, `cornerRadius`, `radius`, `text`, and `textStyle`.
- Cleanup guarantees:
  - The tarball, consumer project, `node_modules`, and generated consumer files all live under the temp root.
  - `rmSync(tempRoot, { recursive: true, force: true })` runs in `finally`, so success and failure paths clean the verifier output.

## Nested challenger

- Spawned managed read-only challenger `/root/typescript_consumer_challenger`.
- Prompt summary: inspect `scripts/verify-package-typescript-consumer.mjs`, `package.json`, `src/jsx.ts`, `src/index.ts`, `jsx-runtime.d.ts`, and existing verifier patterns; return whether the new verifier satisfies the packed-package TypeScript consumer smoke requirements and identify gaps.
- Result: the challenger did not return a verdict after the initial wait window.
- Follow-up asked it to stop exploration and return only a concise verdict.
- It still did not return before the second wait timed out.
- `close_agent` returned previous status `{"completed":null}`.
- No nested acceptance evidence is claimed.

## Verification commands and results

- `npx prettier --write package.json scripts/verify-package-typescript-consumer.mjs`: passed. `package.json` was unchanged; the new script was formatted.
- `npm run check:package-typescript-consumer`: passed after implementation. Output confirmed real tarball creation outside the repo, temporary consumer install from the tarball, consumer TypeScript using `jsx: react-jsx` and `jsxImportSource: react-native-skia-yoga`, and public entrypoints/lowercase intrinsic JSX compiling from the installed package.
- Final post-report `git diff --check`: passed with no output.
- `npm run typecheck`: passed.
- `npm run lint-ci`: passed.
- `npm run check:package-surface`: passed. It reported 119 packed files, all 30 `cpp/` files, representative iOS/Android/Nitrogen/package entrypoint files, and canonical podspec source metadata.
- `bun run check:package-lifecycle`: passed. It reported Bun hidden from the verifier `PATH`, dry-run pack kept private scripts out, packed `package.json` has no lifecycle hooks, and temporary consumer install succeeded with lifecycle scripts enabled.
- `npm run check:rn-skia-imports`: passed. It reported tracked source does not import private RN Skia internals and worker progress/Markdown notes were not scanned.
- `cd example && bun run typecheck`: passed.
- Non-blocking npm warning observed on npm commands: `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Cleanup evidence

- Final post-report `find . -maxdepth 2 \( -name dist -o -name '.expo' -o -name 'rnskia-*' -o -name '*.tgz' \) -print`: no output.
- Final post-report `find /tmp -maxdepth 1 -name 'rnskia-package-typescript-consumer-*' -print`: no output.
- Final `git status --short --branch`:
  - `## worker/039-package-typescript-consumer-smoke`
  - ` M package.json`
  - `?? scripts/verify-package-typescript-consumer.mjs`
  - `?? worker-progress/worker-039-package-typescript-consumer-smoke.md`

## Quality, maintainability, performance, and security review

- Quality: the smoke exercises the package as a real installed artifact and catches declaration/runtime-subpath resolution that repo-local path checks can miss.
- Maintainability: the script follows the existing verifier style: small Node ESM script, synchronous process/filesystem APIs, explicit error messages, and no shell command composition.
- Performance: the check avoids native iOS/Android builds and bounds npm install and TypeScript compile with timeouts.
- Security: install scripts are disabled for the smoke consumer, audit/funding network side work is disabled, and temp output is confined to an OS temp directory that is removed in `finally`.

## Remaining risks

- The smoke installs peer packages from the registry/cache using the example app versions, so a completely offline environment without those packages cached may fail during `npm install`.
- The consumer explicitly installs `@types/react-reconciler` because the package currently publishes source TypeScript through declarations. A future packaging improvement could publish generated `.d.ts` files or move required type support into package dependencies so consumers do not need that internal type package.
- This verifier proves TypeScript/package entrypoint resolution, not native platform build or runtime behavior.
