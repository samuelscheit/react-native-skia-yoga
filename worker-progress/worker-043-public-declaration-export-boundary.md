# Worker 043 Public Declaration Export Boundary

## Goal lifecycle

- `create_goal` objective: `Clean up the public declaration and export boundary.`
- First visible gate message: `GOAL_CREATED: Clean up the public declaration and export boundary.`
- Goal completion is deferred until report write, final `git diff --check`, final status capture, and cleanup checks are complete.

## Baseline

- Branch: `worker/043-public-declaration-export-boundary`
- Initial HEAD: `d61bbe74052e0a38bc954c35a35549f84cbfbe1f`
- Initial status: no tracked changes; ignored local state only:
  - `!! example/node_modules`
  - `!! node_modules`

## Public API decision

Public top-level API:

- `YogaCanvas` from `react-native-skia-yoga`.
- `YogaCanvasProfileSample`.
- Public JSX/intrinsic/style/prop types exported from `src/jsx.ts`, including `YogaIntrinsicElements`, `YogaNodeStyle`, and node prop/style helper types.
- Public interaction prop/event/handler types needed to type supported interaction props: `YogaHitSlop`, `YogaInteractiveProps`, `YogaPanEvent`, `YogaPanHandler`, `YogaPointerEvent`, `YogaPointerEvents`, and `YogaPressHandler`.
- `react-native-skia-yoga/jsx-runtime` and `react-native-skia-yoga/jsx-dev-runtime` declaration contracts for `jsx: "react-jsx"` plus `jsxImportSource: "react-native-skia-yoga"`.

Internal top-level API:

- `reconciler`, `createYogaNode`, `SkiaYogaObject`, `SkiaYoga`, `YogaNodeFinal`, `YogaRootContainer`, `SkiaYogaHostContext`, `YogaInteractionRegistry`, `YogaNodeInteractionConfig`, `YogaNormalizedHitSlop`, and native/generated specs.

Evidence:

- README documents `jsxImportSource: "react-native-skia-yoga"` and lowercase intrinsic nodes at `README.md:21`, then imports only `YogaCanvas` from the top-level package at `README.md:37` and `README.md:76`.
- Example code imports `YogaCanvas` and `YogaCanvasProfileSample` at `example/app/(tabs)/benchmark.tsx:11`, and imports `YogaNodeStyle` at `example/components/StyleShowcaseScreen.tsx:3`.
- The packed TypeScript consumer verifier imports `YogaCanvas`, `YogaCanvasProfileSample`, `YogaIntrinsicElements`, `YogaNodeStyle`, and JSX runtime subpaths at `scripts/verify-package-typescript-consumer.mjs:224`.

## Root cause

- The root declaration entrypoint was a wholesale `export * from "./src/index"`, so TypeScript consumers inherited every source-barrel export.
- The JSX runtime declaration files similarly re-exported source runtime modules wholesale.
- `src/index.ts` exported implementation modules including `./Reconciler`, `./util`, and `SkiaYoga` from `./SkiaYogaObject`; `src/SkiaYogaObject.ts` performs native/global installation at import time, so exposing it as public API made an implementation detail part of the top-level contract.
- `src/Reconciler.ts` and `src/util.ts` depended on `YogaNodeFinal` through `./index`, forcing an internal native node type to live in the public source barrel.

## Implementation

Changed files:

- `src/index.ts`: replaced wildcard exports with an explicit allowlist for `YogaCanvas`, `YogaCanvasProfileSample`, JSX/public prop types, and public interaction handler/event types.
- `index.d.ts`: replaced the wholesale source-barrel re-export with the same explicit public declaration allowlist.
- `jsx-runtime.d.ts` and `jsx-dev-runtime.d.ts`: replaced source runtime re-exports with direct React runtime exports plus the package `JSX` namespace.
- `src/internalTypes.ts`: added an internal-only home for `YogaNodeFinal`.
- `src/Reconciler.ts` and `src/util.ts`: now import `YogaNodeFinal` from `./internalTypes` instead of `./index`.
- `scripts/verify-package-typescript-consumer.mjs`: added packed-consumer positive coverage for `jsx-dev-runtime` and negative `@ts-expect-error` coverage for internal top-level names.
- `scripts/verify-package-surface.mjs`: added source/declaration boundary assertions and kept source-first runtime files explicitly in the pack manifest checks.

Source files remain in the packed package intentionally because the package is React Native source-first (`package.json` still publishes `src` and `main`/`react-native` point at `src/index`). The boundary fixed here is the supported top-level package API, not the physical absence of internal source files from the tarball.

## Guard coverage

- `scripts/verify-package-surface.mjs:130` asserts root declaration files publish expected public names and no longer re-export `./src/index`, `./src/jsx-runtime`, or `./src/jsx-dev-runtime` wholesale.
- `scripts/verify-package-surface.mjs:198` asserts `src/index.ts` does not wildcard-export implementation modules and does not expose known internal names.
- `scripts/verify-package-surface.mjs:28` and `scripts/verify-package-surface.mjs:101` explicitly keep source-first runtime files such as `src/Reconciler.ts` and `src/SkiaYogaObject.ts` in the pack manifest checks, so the verifier distinguishes physical source publication from public API support.
- `scripts/verify-package-typescript-consumer.mjs:211` writes a negative packed-consumer source file.
- `scripts/verify-package-typescript-consumer.mjs:310` checks that public imports still typecheck while internal names such as `reconciler`, `createYogaNode`, `SkiaYoga`, `YogaNodeFinal`, `YogaRootContainer`, and `YogaNodeInteractionConfig` are not available from the top-level package.

## Verification

Passed:

- `git diff --check`
- `npm run check:package-surface`
  - npm pack manifest included 120 files.
  - All 30 `cpp/` files were published.
  - Source-first runtime files remain published while public declarations/source barrel use explicit allowlists.
- `npm run typecheck`
- `npm run check:package-typescript-consumer`
  - Real tarball outside the repo.
  - Temporary consumer outside the repo.
  - No workspace/source links.
  - No `paths` or `baseUrl`.
  - `jsx: "react-jsx"` and `jsxImportSource: "react-native-skia-yoga"`.
  - Lowercase intrinsic JSX compiled.
  - `jsx-runtime` and `jsx-dev-runtime` subpath declarations resolved.
  - Internal top-level exports were rejected.
  - Temporary consumer devDependencies were only `@types/react` and `typescript`, with no consumer-side `@types/react-reconciler`.
- `npm run lint-ci`
- `cd example && bun run typecheck`
- `bun run specs`
- `npm run check:example-bundle`
- `bun run check:install-isolation`
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`
- `npm run check:rn-skia-imports`
- `bun run check:android-skia-archives`
- `bun run check:yoganode-native-lifetime`
- `bun run check:yoganode-native-runtime`

## Cleanup evidence

The required cleanup probes produced no output:

- `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

`npm run typecheck` produced an ignored `tsconfig.tsbuildinfo`; it was removed before final status capture.

## Nested challenger

Nested prompt 1:

- Spawned `/root/public_boundary_challenger` as a read-only explorer.
- Prompt asked it to review public API evidence, accidental internal exposure, JSX runtime declaration support, verifier regression strength, cleanup evidence, and verification results.
- Result: stalled. Closed after two wait windows with `completed: null`.

Nested prompt 2:

- Spawned `/root/public_boundary_challenger_retry` with `fork_turns: "none"` and no model/agent override, per retry requirement.
- Prompt repeated the same read-only review scope in a shorter form.
- Result: stalled. Closed after the retry wait windows with `completed: null`.

No nested review acceptance evidence is claimed.

## Quality review

- Maintainability: the public allowlist is duplicated between `src/index.ts` and `index.d.ts`, but the package-surface verifier now guards both copies. This is preferable to wildcard-exporting internal source modules.
- Performance: no runtime hot path behavior changed. `YogaCanvas` still imports the internal reconciler/native modules it needs.
- Security/safety: the top-level API no longer exposes the native hybrid object or native node factory. The external packed consumer still verifies no workspace links, no path aliases, and cleanup in success paths.
- Compatibility: supported top-level usage and JSX runtime contracts are preserved. Deep imports into published `src` remain physically possible because source-first React Native packaging still publishes source files; they are not supported public API.

## Final status and risks

Final `git diff --check`: passed.

Final cleanup probes: no output for repository, `os.tmpdir()`, or `/tmp` tarball/consumer/export patterns.

Final `git status --short --ignored`:

```text
 M index.d.ts
 M jsx-dev-runtime.d.ts
 M jsx-runtime.d.ts
 M scripts/verify-package-surface.mjs
 M scripts/verify-package-typescript-consumer.mjs
 M src/Reconciler.ts
 M src/index.ts
 M src/util.ts
?? src/internalTypes.ts
?? worker-progress/worker-043-public-declaration-export-boundary.md
!! example/node_modules
!! node_modules
```

Remaining risk:

- TypeScript still resolves some public helper declarations through published source type modules. That is consistent with the source-first package, but a future generated declaration build would reduce duplication and further isolate implementation files from consumer type resolution.
