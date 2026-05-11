# Worker 117 - Sampling SharedValue Type Boundary

## Summary

Root cause: `image.sampling` used `YogaDeepAnimated<SamplingOptions>`, but RN Skia defines `SamplingOptions` as the union `CubicResampler | FilterOptions`. Because `YogaDeepAnimated<T>` is distributive, the public prop accepted branch-specific `SharedValue<CubicResampler>` and `SharedValue<FilterOptions>` but rejected the common authoring shape `SharedValue<SamplingOptions>`.

Fix: `YogaImageProps.sampling` now explicitly accepts the whole opaque `SharedValue<SamplingOptions>` while preserving the existing `YogaDeepAnimated<SamplingOptions>` branch-specific behavior. The redundant global JSX augmentation in `src/jsx.ts` was removed so the documented package JSX runtime remains the single owner for lowercase intrinsic elements under `jsxImportSource: "react-native-skia-yoga"`. This avoided duplicate global JSX merge failures in the example typecheck when the `image` prop shape changed.

Nested sampling leaves remain unsupported. The verifier keeps `sampling={{ filter: sharedFilter }}` rejected while `SamplingOptions` remains opaque.

## Changed Files

- `src/jsx.ts`
  - Widened `YogaImageProps.sampling` to `YogaDeepAnimated<SamplingOptions> | SharedValue<SamplingOptions>`.
  - Removed the redundant global JSX / `React.JSX` augmentation; lowercase intrinsic typing remains provided by the package JSX runtime for the documented `jsxImportSource` setup.
- `scripts/verify-package-typescript-consumer.mjs`
  - Added packed-consumer positive coverage for `<image sampling={sharedSampling} />` where `sharedSampling: SharedValue<SamplingOptions>`.
  - Added a packed-consumer negative check that nested `image.sampling` SharedValue leaves remain rejected.
  - Kept worker-110 packed dynamic JSX cases in the same fixture.
- `scripts/verify-reconciler-animated-bindings.mjs`
  - Added a Node VM/source-level JS listener case for top-level opaque `image.sampling`.
- `worker-progress/worker-117-sampling-sharedvalue-type-boundary.md`

No native C++, generated Nitro specs, package metadata, package exports, public root command transport exports, example native folders, dependency trees, or ignored local artifacts were intentionally changed.

## Verification

Pre-fix probe:

- Focused in-memory TypeScript probe before edits: failed as expected.
  - `SharedValue<SamplingOptions>` was rejected for `YogaIntrinsicElements["image"]["sampling"]`.
  - Diagnostic included: `Type 'SharedValue<SamplingOptions>' is not assignable to type 'CubicResampler | FilterOptions | SharedValue<CubicResampler> | SharedValue<FilterOptions> | undefined'.`
  - Nested `sampling: { filter: SharedValue<FilterMode> }` was also rejected.

Implementation-shape probes:

- A naive non-distributive `YogaDeepAnimated<T>` probe failed worker-110 coverage: optional nested fields such as `path.stroke.miter_limit` started requiring `SharedValue<number | undefined>` and rejected `SharedValue<number>`.
- A first targeted inline sampling fix passed focused package probes but failed the aggregate matrix at `cd example && bun run typecheck` because duplicate global JSX declarations no longer had identical `image` props.
- Removing the redundant global JSX augmentation made the documented `jsxImportSource` path the single owner and fixed the example typecheck.

Final verification commands/results:

- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- Focused post-fix in-memory TypeScript probe: passed.
  - Accepted `SharedValue<SamplingOptions>`, `SharedValue<FilterOptions>`, and `SharedValue<CubicResampler>` for `image.sampling`.
  - Kept nested `{ filter: SharedValue<FilterMode> }` rejected via `@ts-expect-error`.
- `npm run check:package-typescript-consumer`: passed.
  - Packed consumer compiled worker-110 dynamic JSX cases plus `image.sampling`.
  - Packed consumer rejected nested `image.sampling` SharedValue leaves.
  - Public boundary still rejected internal top-level exports such as `NodeCommand`, `createYogaNode`, and `SkiaYoga`.
- `npm run check:reconciler-animated-bindings`: passed.
  - JS command listener path now includes top-level opaque `image.sampling`.
- `npm run typecheck`: passed.
- `cd example && bun run typecheck`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 35s`.
  - Included `check:package-typescript-consumer`, `check:reconciler-animated-bindings`, `typecheck`, `lint-ci`, example typecheck, specs, package/codegen checks, host-native verifiers, example bundle, and example native-generation checks.
  - Matrix cleanup removed `/tmp/rnskia-feasible-matrix-pX4xm7` and reported no remaining new tracked artifacts.
- `git diff --check`: passed.

Expected npm warnings about the existing `minimum-release-age` config appeared during npm-script runs. Expo native generation emitted the existing Android edge-to-edge warning. Neither warning was introduced by this worker.

## Proof Boundary

Proven:

- Public packed TypeScript consumers can author `<image sampling={sharedSampling} />` with `sharedSampling: SharedValue<SamplingOptions>`.
- Existing worker-110 packed dynamic JSX cases still compile.
- Branch-specific `SharedValue<FilterOptions>` and `SharedValue<CubicResampler>` remain accepted.
- Nested sampling leaves such as `sampling={{ filter: sharedFilter }}` remain rejected while `SamplingOptions` stays opaque.
- The Reconciler source-level JS listener path handles a top-level opaque `image.sampling` SharedValue, rebuilds the command on update, invalidates, and cleans up the listener.
- No internal command transport types became public root exports.
- The documented `jsxImportSource: "react-native-skia-yoga"` JSX runtime path remains covered by packed consumer and example typechecks.

Not claimed:

- Nested `sampling.filter` or `sampling.mipmap` SharedValue leaf support.
- Platform-native app proof, simulator/device launch, CocoaPods install, Gradle build, or React Native runtime integration.
- UI-runtime Worklets execution, real Reanimated delivery, or actual native bridge delivery.
- Native image loading/decoding, local/remote asset resolution, texture-backed image behavior, exact image render fidelity, or value-exact `SkSamplingOptions` serialization.
- Nitro registry install inside a real app runtime.

Residual caveat:

- `YogaDeepAnimated<SamplingOptions>` as a standalone exported helper type remains distributive; the accepted whole-union support is scoped to `YogaImageProps.sampling`.
- Consumers relying on undocumented global JSX augmentation without `jsxImportSource` may no longer get Yoga-only lowercase intrinsic typing from importing the root package. The README and verifiers use the documented `jsxImportSource` contract.

## Nested Challenger

Nested agent: `/root/challenger_sampling_type_scope`.

Initial prompt summary:

- Read-only challenger in this worktree.
- Compare non-distributive `YogaDeepAnimated<T>` versus targeted `image.sampling` support.
- Look for unintended worker-110 regressions and whether nested sampling leaves should remain rejected.
- Run only short TypeScript probes if useful; do not edit files.

Initial result:

- Recommended a targeted additive sampling fix, not a fully non-distributive helper.
- Found the non-distributive helper would regress `path.stroke.miter_limit: SharedValue<number>`.
- Found replacing sampling with only `YogaAnimatedProp<SamplingOptions>` would drop existing `SharedValue<FilterOptions>` and `SharedValue<CubicResampler>` acceptance.
- Claimed no formal acceptance evidence; it did not run the packed consumer verifier or full matrix.

Follow-up prompt summary:

- After the aggregate matrix exposed duplicate global JSX declaration fallout, review the actual final shape: targeted `sampling` widening plus removal of the redundant global JSX augmentation.
- Re-check worker-110 cases, nested sampling rejection, and whether relying on the package JSX runtime is acceptable under the documented `jsxImportSource` contract.

Final challenger result:

- Accepted the final scope with caveats.
- Reported `cd example && bun run typecheck` passed.
- Reported a focused TypeScript probe with `jsxImportSource` passed for `image.sampling`, all worker-110 cases, `SharedValue<FilterOptions>`, and `SharedValue<CubicResampler>`.
- Reported nested `{ filter: SharedValue<FilterMode> }` remained rejected.
- Reported no-`jsxImportSource` Yoga-only nodes were rejected after removing global augmentation, as expected.
- Reported `node scripts/verify-reconciler-animated-bindings.mjs` passed with the new sampling case.
- Did not claim packed-consumer or full-matrix acceptance; those are from the local final commands above.

The challenger was closed after completion.

## Cleanup And Status

Final cleanup/status evidence before writing this report:

- `git diff --check`: passed.
- `git status --short --branch --ignored=matching` showed only intended tracked edits and ignored pre-existing local artifacts:
  - `M scripts/verify-package-typescript-consumer.mjs`
  - `M scripts/verify-reconciler-animated-bindings.mjs`
  - `M src/jsx.ts`
  - ignored `example/node_modules`, `node_modules`, and `tsconfig.tsbuildinfo`
- Artifact probe excluding dependency trees reported only `./tsconfig.tsbuildinfo`; it was pre-existing and left untouched per the ignored-artifact constraint.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Verifier temp-prefix probe under `/tmp` and `/private/tmp`: no output.
- Active process probes:
  - `pgrep -fl 'node .*scripts/verify-'`: no output.
  - `pgrep -fl 'clang\+\+'`: no output.
  - `pgrep -fl '/tmp/rnskia-|/private/tmp/rnskia-'`: no output.
  - `pgrep -fl 'lldb|debugserver'`: no output.
- Nested challenger was closed after its final result.

After this report is written, the expected additional tracked status is:

- `?? worker-progress/worker-117-sampling-sharedvalue-type-boundary.md`

## Quality, Maintainability, Performance, Security

Quality:

- The packed consumer now proves the exact public authoring shape selected by worker 116.
- The negative nested sampling fixture prevents accidentally claiming or exposing nested sampling leaf support.
- The Reconciler verifier makes the existing top-level runtime listener path explicit without widening native-binding behavior.
- Removing redundant global JSX augmentation prevents duplicate declaration drift from reappearing when intrinsic prop shapes evolve.

Maintainability:

- The fix is narrowly scoped to `YogaImageProps.sampling` instead of changing the shared `YogaDeepAnimated<T>` helper and risking optional-union regressions.
- The public JSX runtime remains the documented owner for lowercase intrinsic nodes.
- Verifier output names the new sampling coverage and its proof boundary.

Performance:

- Type-only widening has no runtime cost.
- The Reconciler verifier adds one fixed-size JS listener case.
- The package consumer fixture expansion did not materially affect matrix runtime.

Security:

- No new runtime I/O, shell interpolation, eval, package lifecycle hook, native memory path, or network behavior was added.
- Temporary consumer/native-generation work remains under verifier-owned temp roots and was cleaned by the existing verifiers.
- Public root export negatives still guard internal command transport and native plumbing types.
