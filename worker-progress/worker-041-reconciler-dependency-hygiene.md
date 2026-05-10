# Worker 041 Reconciler Dependency Hygiene

## Goal lifecycle

- Goal was created with objective: `Complete and verify the reconciler dependency hygiene handoff.`
- Required visible gate emitted immediately after goal creation:
  `GOAL_CREATED: Complete and verify the reconciler dependency hygiene handoff.`
- `update_goal(status="complete")` is reserved until this report, final whitespace check, final status capture, and cleanup checks are complete.

## Summary

- Completed the package-surface dependency hygiene fix for direct `react-reconciler` imports.
- Moved `@types/react-reconciler` from root `devDependencies` into published `dependencies`.
- Added direct published dependency `react-reconciler: "0.31.0"`.
- Kept `react-native-nitro-modules` in published `dependencies`.
- Updated `bun.lock` so the root package dependency graph matches `package.json`; the direct `react-reconciler` dependency now owns `scheduler@0.25.0`, while `react-native` keeps `scheduler@0.26.0` under its scoped lock entry.
- Removed the temporary consumer's own `@types/react-reconciler` dev dependency from `scripts/verify-package-typescript-consumer.mjs`.
- Added verifier guards and concrete success output proving:
  - the temporary consumer devDependencies are `@types/react` and `typescript`;
  - the packed package declares `react-reconciler: 0.31.0`;
  - the packed package declares `@types/react-reconciler: ^0.32.1`.

## Files changed

- `package.json`
- `bun.lock`
- `scripts/verify-package-typescript-consumer.mjs`
- `worker-progress/worker-041-reconciler-dependency-hygiene.md`

## Verifier evidence

`npm run check:package-typescript-consumer` passed and printed:

```text
Packed package TypeScript consumer verifier passed:
- npm pack created a real tarball outside the repository.
- A temporary consumer installed react-native-skia-yoga from that tarball.
- Consumer TypeScript used jsx: react-jsx and jsxImportSource: react-native-skia-yoga.
- Public package entrypoints and lowercase intrinsic JSX compiled from the installed package.
- Temporary consumer devDependencies: @types/react, typescript (no @types/react-reconciler).
- Packed dependency react-reconciler: 0.31.0.
- Packed dependency @types/react-reconciler: ^0.32.1.
```

The temp consumer no longer declares `@types/react-reconciler`; the only verifier-generated dev dependencies are `@types/react` and `typescript`.

The packed artifact assertion reads the installed package's packed `package.json` from the temporary consumer and fails unless `dependencies.react-reconciler` and `dependencies["@types/react-reconciler"]` are non-empty strings.

## Acceptance commands

- Npm-run acceptance commands printed the same non-blocking warning:
  `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`
- `git diff --check`: PASS, no output.
- `npm run check:package-typescript-consumer`: PASS. Verifier output is quoted above.
- `npm run typecheck`: PASS. Output:

```text
> react-native-skia-yoga@0.0.1 typecheck
> tsc --noEmit
```

- `npm run lint-ci`: PASS. Output:

```text
> react-native-skia-yoga@0.0.1 lint-ci
> eslint --resolve-plugins-relative-to ./node_modules/@react-native/eslint-config ".eslintrc.js" "**/*.{js,mjs,ts,tsx}"
```

- `npm run check:package-surface`: PASS. Output:

```text
Package surface verifier passed:
- npm pack manifest includes 119 files.
- All 30 files under cpp/ are published.
- Representative iOS, Android, Nitrogen, and package entrypoint files are published.
- Podspec source metadata points at the canonical repository.
```

- `bun run check:package-lifecycle`: PASS. Output:

```text
Package lifecycle verifier passed:
- Verifier PATH shim exposes node/npm/tar while keeping bun unavailable.
- npm pack --dry-run --json kept private scripts out of the tarball manifest.
- Packed package.json has no root preinstall, install, or postinstall hooks.
- Temporary consumer install succeeded with lifecycle scripts enabled and Bun hidden from PATH.
```

- `npm run check:rn-skia-imports`: PASS. Output:

```text
RN Skia import verifier passed:
- Tracked source does not import private RN Skia internals.
- Worker progress reports and Markdown planning notes were not scanned.
```

- `cd example && bun run typecheck`: PASS. Command was run with `example` as cwd. Output:

```text
$ tsc -p tsconfig.skiayoga.json --noEmit
```

- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' \) -print | sort`: PASS, no output.
- `git status --short --branch --ignored`: PASS. Final output:

```text
## worker/041-reconciler-dependency-hygiene
 M bun.lock
 M package.json
 M scripts/verify-package-typescript-consumer.mjs
?? worker-progress/worker-041-reconciler-dependency-hygiene.md
!! example/node_modules
!! node_modules
!! tsconfig.tsbuildinfo
```

## Prior challenger attempt

- The prior worker's first internal challenger spawn attempt errored because full-history fork parameters were invalid for that managed subagent shape.
- The prior worker's second attempt spawned a read-only challenger.
- The prior worker became stuck waiting before any challenger final result was available.
- No new nested managed subagent was spawned for this completion task; the local verifier and acceptance matrix were sufficient.

## Final status and artifacts

- Final post-report `git diff --check`: PASS, no output.
- Final post-report `git status --short --branch --ignored`:

```text
## worker/041-reconciler-dependency-hygiene
 M bun.lock
 M package.json
 M scripts/verify-package-typescript-consumer.mjs
?? worker-progress/worker-041-reconciler-dependency-hygiene.md
!! example/node_modules
!! node_modules
!! tsconfig.tsbuildinfo
```

- The required `/tmp` cleanup probe returned no matching `rnskia-package-typescript-consumer-*`, `rnskia-package-lifecycle-*`, or `react-native-skia-yoga-*.tgz` paths.
- Ignored artifacts left in place:
  - `example/node_modules`
  - `node_modules`
  - `tsconfig.tsbuildinfo`

## Residual risk and follow-up

- Residual risk is low for the targeted package dependency hygiene issue: the packed consumer now proves the package, not the consumer, supplies `react-reconciler` and its type package.
- `@types/react-reconciler` is a published dependency because the package still publishes source-first TypeScript declarations that resolve through `src/Reconciler.ts`; a future declaration-boundary cleanup could reduce that public surface.
- No native iOS/Android runtime behavior was revalidated by this task.
