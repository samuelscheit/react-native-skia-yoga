# Worker 089 - AnimatedDouble Synchronizable proof

## Scope And Files Changed

- Fixed `cpp/AnimatedDouble.cpp` so `AnimatedDouble` owns stable Worklets `SerializableJSRef` and `Synchronizable` type validation instead of relying on Worklets' assertion-only mismatch path.
- Added `scripts/verify-animated-double-synchronizable.mjs`.
- Added `check:animated-double-synchronizable` to `package.json`.
- Added the verifier temp prefix and command to `scripts/verify-feasible-matrix.mjs`.
- Updated `scripts/verify-yoganode-native-commands-render.mjs` and `scripts/verify-yoganode-nitro-materialization.mjs` to link the Worklets shared-item sources required by the stronger `AnimatedDouble.cpp` RTTI checks.
- Added this report: `worker-progress/worker-089-animated-double-synchronizable.md`.

## Current Gap Proof

Existing accepted checks did not prove this boundary:

- `check:reconciler-animated-bindings` proves source-level JS mirror behavior with local stubs for `createSynchronizable` and `Synchronizable.setBlocking`.
- `check:yoganode-native-commands-render` links real `AnimatedDouble.cpp`, but only proves numeric/static fallback behavior and explicitly excludes dynamic Worklets-backed `AnimatedDouble` resolution.
- Worker 088 proved Nitro `YogaNode::toObject()` and selected generated wrapper execution, but explicitly excluded dynamic Worklets-backed `AnimatedDouble`.

The root-cause issue found during implementation was narrower than the original proof gap:

- Worklets `extractSynchronizableOrThrow(...)` extracts a `SerializableJSRef`, then uses `react_native_assert` for the final `Synchronizable` dynamic cast.
- In this host verifier style (`-DNDEBUG`, no `REACT_NATIVE_DEBUG`), `react_native_assert` is compiled out, so a non-`Synchronizable` `SerializableJSRef` can return `nullptr` instead of throwing.
- Before the fix, `canExtractAnimatedSynchronizable(...)` called that Worklets extractor directly, so it could report success for the wrong Worklets serializable type.

## Implementation Details

- `extractAnimatedSynchronizable(...)` now:
  - requires a JSI object with NativeState;
  - requires that NativeState to be a Worklets `SerializableJSRef`;
  - requires the wrapped `Serializable` to dynamic-cast to Worklets `Synchronizable`;
  - throws `jsi::JSError` with `AnimatedDouble`-owned messages for plain objects and wrong Serializable types.
- `canExtractAnimatedSynchronizable(...)` now calls the same source-owned extraction path and catches failures.
- The new verifier builds a bounded host-JSC executable against real:
  - `cpp/AnimatedDouble.cpp`;
  - React Native JSC/JSI sources;
  - RN Skia `RuntimeAwareCache.cpp`;
  - Worklets `Serializable.cpp`, `Synchronizable.cpp`, `SynchronizableAccess.cpp`, and `WorkletRuntimeRegistry.cpp`.
- The verifier constructs the same native-state shape used by Worklets `createSynchronizable`: a real `std::shared_ptr<worklets::Synchronizable>` wrapped with `SerializableJSRef::newNativeStateObject(...)`.
- I did not thread the dynamic value through `JSIConverter<NodeCommand>::fromJSI(...)`. The focused `AnimatedDouble` proof is strong, and command integration would add Skia command/render dependencies while still not proving UI-runtime Worklets execution.

## Proven Boundary

Proven:

- Host-JSC/native Worklets `Synchronizable` extraction into `AnimatedDouble`.
- `JSIConverter<AnimatedDouble>::canConvert(...)` accepts a real Worklets `Synchronizable` NativeState object.
- `JSIConverter<AnimatedDouble>::fromJSI(...)` extracts the same `Synchronizable` and sets `AnimatedDouble::isDynamic()`.
- Plain JS objects and non-`Synchronizable` Worklets `SerializableJSRef` objects are rejected with stable source-owned failures.
- `AnimatedDouble::resolve()` returns fallback while RN Skia main runtime is unset.
- After `RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime)`, `Synchronizable::getBlocking()->toJSValue(runtime)` converts to a JS number and `AnimatedDouble::resolve()` returns it.
- `Synchronizable::setBlocking(...)` mutation is observed by a later `AnimatedDouble::resolve()`.

Not proven:

- UI-runtime Worklets execution.
- Reanimated SharedValue delivery.
- `executeOnUIRuntimeSync`.
- Real JS listener scheduling.
- RNGH delivery.
- Nitro module registry install.
- React Native runtime integration.
- iOS/Android app build/run, simulator/device launch, or native platform presentation.
- Image asset/decoding/loading or exact render fidelity.
- Dynamic `AnimatedDouble` through `JSIConverter<NodeCommand>::fromJSI(...)`.

## Verification Results

- `node --check scripts/verify-animated-double-synchronizable.mjs`: passed.
- `node --check scripts/verify-feasible-matrix.mjs`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:animated-double-synchronizable`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:yoganode-native-commands-render`: passed after adding Worklets shared-item sources to the helper link list.
- `npm run check:yoganode-nitro-materialization`: passed after the same link-list update.
- `npm run check:feasible-matrix`: passed with 28 commands in `4m 46s`.
  - New entry `[18/28] npm run check:animated-double-synchronizable` passed in `7.4s`.
  - The matrix removed newly created `tsconfig.tsbuildinfo`.
  - The matrix temp parent `/tmp/rnskia-feasible-matrix-M9hXpJ` was empty before removal and was removed.
- `git diff --check`: passed.

Expected npm warning on npm-script runs:

- `Unknown user config "minimum-release-age". This will stop working in the next major version of npm.`

## Cleanup And Status Evidence

Final cleanup/status probes:

- Temp-prefix probe for `rnskia-animated-double-synchronizable-*`, command render, Nitro materialization, feasible matrix, package, example export, and example native generation roots under `/tmp` and `/private/tmp`: no output.
- Repo tarball probe: no output.
- Build-info probe under repo root and `example`: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Strict active verifier process probe for `node ... scripts/verify-*`, `clang++`, verifier binaries, `lldb`, and `debugserver`: no output.
- Final `git status --short --branch --ignored=matching` before this report:
  - `M cpp/AnimatedDouble.cpp`
  - `M package.json`
  - `M scripts/verify-feasible-matrix.mjs`
  - `M scripts/verify-yoganode-native-commands-render.mjs`
  - `M scripts/verify-yoganode-nitro-materialization.mjs`
  - `?? scripts/verify-animated-double-synchronizable.mjs`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- After this report was written, status adds only `?? worker-progress/worker-089-animated-double-synchronizable.md` to the intentional tracked changes above.

## Nested Challenger Documentation

- Nested challenger: `/root/synchronizable_challenger`.
- Prompt:

```text
Read-only challenger for worker 089 in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-089-animated-double-synchronizable. Do not edit files. Inspect the repo and node_modules sources relevant to dynamic Worklets-backed AnimatedDouble/Synchronizable proof: cpp/JSIConverter+AnimatedDouble.hpp, cpp/AnimatedDouble.cpp, cpp/JSIConverter+NodeCommand.hpp, cpp/YogaNode.*, src/Reconciler.ts, scripts/verify-yoganode-native-commands-render.mjs, scripts/verify-yoganode-nitro-materialization.mjs, Worklets Synchronizable/Serializable/JSIWorkletsModuleProxy sources, RN Skia RuntimeAwareCache. Answer: can a bounded host-JSC verifier construct or extract a real Worklets Synchronizable NativeState object, pass it through JSIConverter<AnimatedDouble>::fromJSI, prove canConvert/isDynamic/resolve fallback/main-runtime/update behavior, and optionally thread it through NodeCommand? Identify exact APIs/classes, likely compile/link sources, pitfalls, stable negative cases, and proof-boundary cautions. No long verification commands and no acceptance claims unless actually run.
```

- Result: completed.
- Challenger findings:
  - A bounded host-JSC verifier is feasible.
  - The exact object shape must be `SerializableJSRef` NativeState wrapping a `Synchronizable`; attaching `Synchronizable` directly as NativeState would not match Worklets extraction.
  - The useful APIs are `SerializableJSRef::newNativeStateObject(...)`, `makeSerializableNumber(...)`, `Synchronizable`, `JSIConverter<AnimatedDouble>`, and `BaseRuntimeAwareCache::setMainJsRuntime(...)`.
  - Recommended avoiding `Synchronizable::toJSValue()` unless installing `__synchronizableUnpacker`; scalar `getBlocking()->toJSValue(runtime)` is safe.
  - Noted that Worklets' wrong-Serializable negative is compile-mode dependent because of `react_native_assert`.
  - Confirmed optional `NodeCommand` threading is feasible via `circle.radius`, but should not be overclaimed as UI-runtime Worklets proof.
- Acceptance evidence from challenger: none claimed. It was read-only feasibility evidence and did not run the new verifier.
- This worker used the challenger warning about wrong Serializable type as the root-cause lead and fixed the repo-owned `AnimatedDouble` boundary to make that negative stable.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The verifier exercises real native Worklets objects and real `AnimatedDouble.cpp`, not JS stubs.
- The product fix removes assertion-mode-dependent converter behavior at the `AnimatedDouble` boundary.
- Existing command-render and Nitro materialization checks remain green after the stronger `AnimatedDouble.cpp` link requirements.

Maintainability:

- The new verifier is narrowly named and scoped, keeping dynamic value extraction separate from command raster proof.
- Source-shape assertions document why the proof exists and protect against accidentally reclassifying JS mirror checks as native Worklets proof.
- Existing host verifiers now link explicit Worklets shared-item sources rather than relying on unresolved dynamic RTTI symbols.

Performance:

- The focused verifier passed in `7.4s` inside the matrix.
- It avoids Skia archive and raster rendering work because those are not needed for the extraction/resolution proof.
- No product runtime polling or extra synchronization was added.

Security:

- Shell execution uses structured `spawnSync` argument arrays.
- JSI inputs are fixed verifier-owned literals.
- Cleanup is constrained to verifier-owned temp roots and matrix-owned temp parent accounting.
- No network access, installs, arbitrary user input, or broad temp deletion was introduced.
