# Worker 112 - Package Export Boundary

## Scope And Changed Files

Objective: guard published `src/specs/*` deep imports and prove the package export boundary.

Changed files:

- `package.json`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-package-surface.mjs`
- `worker-progress/worker-112-package-export-boundary.md`

No README, package entrypoint source/declaration files, `scripts/verify-package-codegen-autolinking.mjs`, native C++ files, generated Nitro artifacts, spec files, example native folders, or ignored dependency trees were changed.

## Root-Cause Evidence And Decision

Source and package evidence confirmed the worker-111 target:

- `package.json` preserved source-first fields: `main`, `module`, `react-native`, and `source` pointed at `src/index`, with root declarations at `index.d.ts`.
- `package.json.files` published `src`, and `codegenConfig.jsSrcsDir` remained `./src/specs`.
- `src/index.ts` and `index.d.ts` exported the supported `YogaCanvas`, JSX authoring types, and interaction types only.
- `src/specs/SkiaYoga.nitro.ts` re-exported `NodeCommandKind`, `NodeCommand`, `NodeCommandNative`, and command payload types from `./commands`; those are native/spec transport types, not public authoring API.
- A pre-change packed-tarball probe confirmed `src/specs/commands.ts`, `src/specs/SkiaYoga.nitro.ts`, `src/specs/NativeSkiaYoga.ts`, and `src/specs/SkiaYogaViewNativeComponent.ts` were physically published, and a temporary TypeScript consumer using legacy `moduleResolution: "Node"` accepted representative deep imports without an `exports` map.

Decision: add a resolver-level package `exports` map while keeping source/spec files physically packed for React Native codegen, Nitrogen, and autolinking. Supported authoring imports are the package root plus `jsx-runtime` and `jsx-dev-runtime`; `./package.json` is exported only as package metadata compatibility, not as authoring API.

## Implementation Summary

- Added `package.json.exports` for:
  - `.`
  - `./jsx-runtime`
  - `./jsx-dev-runtime`
  - `./package.json`
- Omitted all `./src/*` and `./src/specs/*` export keys.
- Kept `main`, `module`, `types`, `react-native`, `source`, `files`, and `codegenConfig.jsSrcsDir` unchanged.
- Extended `check:package-typescript-consumer` with a second packed-consumer TypeScript config using `moduleResolution: "Bundler"` and `resolvePackageJsonExports: true`.
- Extended `check:package-surface` to assert the exact export map, preserved entrypoint fields, preserved `codegenConfig.jsSrcsDir`, and physical publication of the required `src/specs` files.

## Packed Consumer Root/JSX Runtime Proof

`npm run check:package-typescript-consumer` passed from an installed tarball outside the repo. It still compiles the public root and JSX runtime authoring surface, including lowercase intrinsic JSX under `jsxImportSource: "react-native-skia-yoga"` and representative dynamic `SharedValue` command props.

The new Bundler-mode config also positively imports:

- `react-native-skia-yoga`
- `react-native-skia-yoga/jsx-runtime`
- `react-native-skia-yoga/jsx-dev-runtime`

## Deep-Import Negative Proof

The packed TypeScript consumer now has `@ts-expect-error` negatives under `moduleResolution: "Bundler"` for representative unsupported deep imports:

- `react-native-skia-yoga/src/specs/commands`
- `react-native-skia-yoga/src/specs/SkiaYoga.nitro`
- `react-native-skia-yoga/src/specs/NativeSkiaYoga`
- `react-native-skia-yoga/src/specs/SkiaYogaViewNativeComponent`

If a future export map exposes those subpaths, the `@ts-expect-error` directives become unused and the verifier fails.

## Codegen, Autolinking, And Surface Preservation

`npm run check:package-surface` passed and now asserts:

- source-first entrypoint fields remain `src/index`;
- `types` remains `index.d.ts`;
- `codegenConfig.jsSrcsDir` remains `./src/specs`;
- only the root entrypoint, JSX runtime subpaths, and package metadata are exported;
- `src/specs/commands.ts`, `src/specs/SkiaYoga.nitro.ts`, `src/specs/NativeSkiaYoga.ts`, `src/specs/SkiaYogaViewNativeComponent.ts`, and `src/specs/style.ts` remain packed.

`npm run check:package-codegen-autolinking` passed from an installed tarball. It used the installed package's `./src/specs` filesystem path, admitted the expected RN codegen files, documented the non-RN-codegen spec support files, and resolved RN CLI iOS/Android metadata from the installed package.

## Proof Boundary And Residual Exclusions

Proven:

- package exports constrain compliant resolvers for the packed package;
- public root and JSX runtime subpaths still typecheck from an installed tarball;
- representative `src/specs` deep imports are blocked under TypeScript Bundler resolution;
- required source/spec files remain physically published for codegen/autolinking.

Not claimed:

- filesystem secrecy. The files remain in the tarball by design.
- older or non-compliant resolvers that ignore package `exports` are blocked.
- UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, actual native bridge delivery, C++ command conversion, RNGH native delivery, image asset loading/decoding, exact render fidelity, Nitro registry install, platform-native app runtime, or full React Native runtime integration.

## Verification Commands And Results

- Pre-change packed deep-import probe: passed; published `src/specs` files were deep-importable by legacy TypeScript Node resolution before the `exports` map.
- `npx prettier --write package.json scripts/verify-package-typescript-consumer.mjs scripts/verify-package-surface.mjs`: passed; npm printed the existing `minimum-release-age` warning.
- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-package-surface.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:package-surface`: passed.
- `npm run check:package-codegen-autolinking`: passed.
- `npm run typecheck`: passed; it created `tsconfig.tsbuildinfo`, which was removed before the matrix run.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 28s`.
  - Included `check:package-lifecycle`, `check:rn-codegen-schema`, direct RN codegen parser CLI, `bun run specs`, `lint-ci`, example typecheck, example bundle, and example native-generation checks.
  - Matrix cleanup removed the newly created `tsconfig.tsbuildinfo` and removed `/tmp/rnskia-feasible-matrix-DCnMxI`.

Expected inherited warnings:

- npm `minimum-release-age` config warning.
- Expo Android edge-to-edge warning during native-generation checks.

## Nested Challenger Documentation

- Nested agent: `/root/boundary_challenger`.
- Prompt summary: read-only focused challenge of the `exports` map approach, package metadata risks, TypeScript resolver mode, package-surface assertions, and codegen/autolinking preservation; do not edit files.
- Result: completed and closed.
- Challenger recommendations:
  - Do not add `./src/*` or `./src/specs/*` export keys.
  - Keep `files: ["src", ...]` and `codegenConfig.jsSrcsDir: "./src/specs"` unchanged.
  - Put `types` first in conditional exports.
  - Add exact export-map checks to `verify-package-surface.mjs`.
  - Add a Bundler-mode TypeScript packed-consumer negative fixture for `src/specs` deep imports.
  - Leave `verify-package-codegen-autolinking.mjs` focused on installed filesystem codegen.
- Response:
  - Followed those recommendations.
  - Included `./package.json` as metadata compatibility.
  - Added representative negatives for `commands`, `SkiaYoga.nitro`, `NativeSkiaYoga`, and `SkiaYogaViewNativeComponent`.
- Challenger evidence claimed: it ran `npm run check:package-surface`, `npm run check:package-typescript-consumer`, `npm run check:package-codegen-autolinking`, and `git status --short` on the pre-implementation tree. It explicitly did not claim acceptance evidence for the final export-map implementation.
- Closure evidence: `close_agent /root/boundary_challenger` returned a completed result; final `list_agents` showed only `/root`.

## Cleanup And Status Evidence

Final probes after the matrix:

- `git diff --check`: passed.
- `git status --short --branch --ignored=matching` showed only:
  - `M package.json`
  - `M scripts/verify-package-surface.mjs`
  - `M scripts/verify-package-typescript-consumer.mjs`
  - ignored `example/node_modules` and `node_modules`
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- `/tmp` and `/private/tmp` verifier-prefix probe for package, feasible-matrix, example, tarball, and worker-112 baseline temp roots: no output.
- Active verifier/debug process probe for `node .*scripts/verify-`, `clang++`, `rnskia-yoganode`, `rnskia-feasible`, `lldb`, and `debugserver`: no output on rerun.
- `list_agents`: only `/root` running after closing the challenger.

After this report is written, the final tracked status is expected to also include `?? worker-progress/worker-112-package-export-boundary.md`.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The fix addresses the actual package resolver boundary instead of changing spec payload types or hiding files that codegen needs.
- Verifiers now distinguish physical publication from supported resolver entrypoints.
- The negative tests use an exports-aware resolver and fail closed if `src/specs` is later exported.

Maintainability:

- The export map is small and exact.
- Package-surface assertions keep entrypoint metadata, condition order, and required packed files explicit.
- The TypeScript verifier reuses the existing packed-consumer harness and adds one targeted config/file.

Performance:

- Runtime code paths are unchanged.
- The extra packed TypeScript compile is fixed-size and added about one compile step to `check:package-typescript-consumer`; the full feasible matrix remained within the established runtime range.

Security:

- The change narrows compliant resolver access to internal native/spec transport modules.
- No new lifecycle hooks, shell interpolation, runtime eval, network-facing code, or native execution path was added.
- Temp artifacts remain verifier-owned and were cleaned up.
