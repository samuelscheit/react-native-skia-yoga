# Worker 110 - Dynamic JSX Type Boundary

## Scope And Changed Files

Changed files:

- `scripts/verify-package-typescript-consumer.mjs`
- `worker-progress/worker-110-dynamic-jsx-type-boundary.md`

No product TypeScript source, native C++, generated Nitro artifacts, package metadata, public exports, README, example files, or ignored dependency trees were changed. In particular, `src/specs/commands.ts`, `src/specs/SkiaYoga.nitro.ts`, `src/index.ts`, and `index.d.ts` were read for boundary evidence and left unchanged.

## Root-Cause Evidence And API-Boundary Decision

Source evidence confirmed the ambiguity selected by worker 109:

- Public JSX authoring types are dynamic by design. `src/jsx.ts` defines `YogaAnimatedProp<T> = T | SharedValue<T>` and `YogaDeepAnimated<T>` for scalar, opaque Skia, array, and object leaves. The command props for `rrect.cornerRadius`, `circle.radius`, `path.stroke`, `path.trimStart`, `path.trimEnd`, `line.from`, `points.points`, and `blurMaskFilter.blur` use those dynamic public types.
- The top-level public surface is the JSX/YogaCanvas authoring API. `src/index.ts` and `index.d.ts` export `YogaCanvas`, JSX prop types, and interactivity types. They do not export `NodeCommand`, `NodeCommandNative`, `NodeCommandKind`, `createYogaNode`, `SkiaYoga`, or command payload types.
- The spec command payloads remain transport/codegen-adjacent. `src/specs/commands.ts` still models selected native command leaves as transport-shaped numbers, for example `RoundedRectCommandPayload.cornerRadius?: number`, `PathCommandPayload.trimEnd?: number`, `PathCommandPayload.trimStart?: number`, `BlurMaskFilterCommandPayload.blur?: number`, and `CircleCommandPayload.radius?: number`; `NodeCommandNative` is a Nitro `CustomType` over `NodeCommandTransport`.
- `src/specs/SkiaYoga.nitro.ts` re-exports those command payload types for the spec module and uses `YogaNode.setCommand(command: NodeCommandNative)`. That is a native/spec contract, not the supported top-level JSX authoring surface.
- `package.json.files` publishes `src`, so deep imports of spec files are physically present in the tarball. This worker did not add an `exports` map or claim deep-import prevention.

Decision: keep `src/specs/*` command payload types transport-shaped and prove the supported public authoring API through the packed top-level JSX/YogaCanvas surface. I did not widen Nitro/codegen-facing payload types to `SharedValue`/`YogaDeepAnimated`, because that would misrepresent actual transport: JS-listener paths resolve snapshots to plain values, while native-bound paths mirror selected leaves through Worklets `Synchronizable` objects rather than passing Reanimated `SharedValue` objects as the native command payload type.

## Implementation Summary

- Extended `scripts/verify-package-typescript-consumer.mjs` so the temporary packed consumer imports public entrypoints from the installed tarball and compiles representative dynamic JSX command props with `jsxImportSource: "react-native-skia-yoga"`.
- Added compile-only `SharedValue<number>` placeholders and a compile-only `SkPath` placeholder inside the consumer fixture. These values are type placeholders only; the fixture is compiled by TypeScript and not executed.
- Hardened public-boundary negatives so the installed package root rejects `NodeCommandKind`, `NodeCommand`, `NodeCommandNative`, `PathCommandPayload`, and `CircleCommandPayload` in addition to the existing internal `reconciler`, `createYogaNode`, `SkiaYoga`, native node, root-container, host-context, and interaction-plumbing negatives.
- Updated verifier output so a passing run explicitly names packed dynamic JSX command-prop coverage and the top-level internal export rejections.

## Packed Consumer Dynamic JSX Proof Details

The packed consumer verifier still:

- runs `npm pack --json --ignore-scripts` into a verifier temp directory outside the repo;
- installs `react-native-skia-yoga` from that tarball into a temporary consumer;
- avoids `paths` and `baseUrl` shortcuts in the consumer `tsconfig.json`;
- compiles the consumer with `jsx: "react-jsx"` and `jsxImportSource: "react-native-skia-yoga"`;
- verifies the packed install is a real directory outside the repository, not a symlink.

New packed TypeScript coverage compiles these public JSX command props from the installed package:

- native-bound dynamic leaves: `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd`;
- JS-listener or nested dynamic leaves: `path.stroke.miter_limit`, `line.from.x`, and `points.points[0].x`.

The same packed consumer now asserts that unsupported top-level internals are not root public exports, including `NodeCommand`, `NodeCommandNative`, `NodeCommandKind`, representative command payload types, `createYogaNode`, and `SkiaYoga`.

## Proof Boundary And Residual Exclusions

Proven:

- Packed package TypeScript consumer behavior from an installed tarball.
- Top-level public JSX/YogaCanvas authoring types compile representative dynamic `SharedValue` command props under `jsxImportSource: "react-native-skia-yoga"`.
- Top-level package boundary rejects representative internal command transport and native plumbing exports.
- Spec command payload types were intentionally left transport-shaped and not promoted to the top-level authoring API.

Not proven:

- Prevention of deep imports from `src/specs/*`; the package currently publishes `src` and has no `exports` map.
- Real Reanimated `SharedValue` delivery.
- UI-runtime Worklets execution.
- Real JS listener scheduling.
- Actual React Native bridge delivery.
- C++ command conversion from this TypeScript fixture.
- Native rendering or exact render fidelity.
- Nitro registry install inside a React Native runtime.
- Platform-native app runtime, iOS/Android build/run, simulator/device launch, image asset loading/decoding, or RNGH native delivery.

## Verification Commands And Results

Focused final checks:

- `git diff --check`: passed with no output.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed with no output.
- `npm run check:package-typescript-consumer`: passed.
  - Output names packed dynamic JSX command-prop coverage for `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, `path.trimEnd`, `path.stroke.miter_limit`, `line.from.x`, and `points.points[0].x`.
  - Output names public-boundary rejection of internal top-level exports including `NodeCommand`, `createYogaNode`, and `SkiaYoga`.
- `npm run typecheck`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 9s`.
  - `check:package-typescript-consumer`: passed in `9.7s` and included the new dynamic JSX output.
  - `check:package-surface`: passed in `2.0s`.
  - `typecheck`: passed in `1.2s`.
  - `lint-ci`: passed in `2.6s`.
  - `bun run specs`: passed in `1.3s`.
  - Matrix cleanup reported no remaining new tracked artifacts and removed `/tmp/rnskia-feasible-matrix-8e6FP0`.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- Expo prebuild emitted the existing Android edge-to-edge warning during native-generation checks.
- One preliminary matrix run was intentionally terminated after challenger feedback identified the missing `NodeCommand` top-level negative checks. Its SIGTERM cleanup completed and removed `/tmp/rnskia-feasible-matrix-Nwbpn0`; it is not acceptance evidence.

## Nested Challenger Documentation

Initial spawn attempt:

- A first `spawn_agent` call with `fork_turns="all"` plus explicit `agent_type` was rejected by the tool before an agent was created.
- No nested evidence is claimed from that failed spawn.

Completed challenger:

- Nested agent: `/root/challenger_api_boundary`.
- Prompt summary: read-only challenge of the API-boundary decision in this worktree; inspect prior worker context plus `scripts/verify-package-typescript-consumer.mjs`, `package.json`, `src/jsx.ts`, `src/index.ts`, `index.d.ts`, `src/specs/commands.ts`, and `src/specs/SkiaYoga.nitro.ts`; decide whether spec command payload types should be widened or kept internal/transport-shaped; identify package exposure risks; recommend verifier changes; include any acceptance evidence and remaining unproven items; do not edit files.
- Result: completed and closed.
- Challenger recommendation:
  - Keep `src/specs/*` command payload types internal/transport-shaped.
  - Do not widen them to `SharedValue`/`YogaDeepAnimated` unless the project explicitly makes spec command payload types a supported public authoring API.
  - Treat `package.json.files` publishing `src` and lack of an `exports` map as a deep-import exposure risk, not as top-level public API.
  - Add root negative checks for `NodeCommandKind`, `NodeCommand`, `NodeCommandNative`, and representative command payload types.
- Response:
  - Kept spec/source/public export files unchanged.
  - Added the recommended root negative checks to the packed TypeScript consumer verifier.
  - Did not add an `exports` map or claim deep-import prevention.
- Challenger evidence claimed:
  - `node --check scripts/verify-package-typescript-consumer.mjs && node --check scripts/verify-package-surface.mjs`: passed.
  - `npm run check:package-typescript-consumer`: passed and reported dynamic `SharedValue` JSX coverage.
  - `npm run check:package-surface`: passed.
  - `npm pack --dry-run --json --ignore-scripts`: confirmed `src/specs/*` is included.
  - The challenger did not rerun the full feasible matrix; final acceptance evidence is from the local final commands above.
- Closure evidence: `close_agent /root/challenger_api_boundary` returned completed status, and `list_agents` afterward showed only `/root`.

## Cleanup And Status Evidence

Cleanup/status probes after the final matrix and before this report:

- `git status --short --branch --ignored=matching`:
  - `## worker/110-dynamic-jsx-type-boundary`
  - `M scripts/verify-package-typescript-consumer.mjs`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output after removing the verifier-created `tsconfig.tsbuildinfo`.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, package TypeScript consumer, package consumer, example native generation, example export, YogaNode command/render, YogaNode Nitro materialization, AnimatedDouble, and RNSkYogaView roots: no output.
- Active nested-agent status after closing the challenger: only `/root`.

After this report is written, final tracked status is expected to add only:

- `?? worker-progress/worker-110-dynamic-jsx-type-boundary.md`

Ignored `node_modules` and `example/node_modules` were pre-existing dependency trees and were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The verifier now proves the actual supported authoring surface from an installed tarball instead of relying on source-tree static JSX only.
- Public boundary negatives now include representative command transport internals, directly matching the boundary decision.
- The report keeps compile-only TypeScript proof separate from runtime command delivery/rendering proof.

Maintainability:

- The change stays in the existing packed TypeScript consumer verifier and does not introduce a new verifier script or public API abstraction.
- Dynamic cases are readable, representative, and tied to the exact props called out by the target.
- Nitro/spec transport types remain stable and continue to reflect the current generated/native boundary.

Performance:

- Added TypeScript fixture cases are compile-only and fixed-size.
- The focused packed consumer check remained under ten seconds in the final matrix.

Security:

- No new runtime execution path, dynamic eval, shell interpolation, package lifecycle script behavior, or user-controlled input handling was added.
- Temporary package work remains under existing verifier-owned temp roots and is removed by the verifier.
- Public root internals are guarded by `@ts-expect-error` negatives in the packed consumer fixture.
