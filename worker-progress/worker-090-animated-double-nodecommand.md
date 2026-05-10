# Worker 090 - AnimatedDouble NodeCommand proof

## Scope And Files Changed

- Extended `scripts/verify-yoganode-native-commands-render.mjs`.
- Updated `scripts/verify-animated-double-synchronizable.mjs` proof-boundary text/source-shape assertion so it remains the raw `AnimatedDouble` verifier and no longer claims the command path is excluded.
- Added this report: `worker-progress/worker-090-animated-double-nodecommand.md`.
- No product C++ changes were needed.
- Did not edit `package.json` or `scripts/verify-feasible-matrix.mjs`; the existing `check:yoganode-native-commands-render` matrix entry was expanded in place.

## Current Gap Proof

Before editing:

- `npm run check:animated-double-synchronizable`: passed, but its output proved raw host-JSC/native `JSIConverter<AnimatedDouble>` extraction/resolution only and explicitly said command-converter integration was not proven.
- `npm run check:yoganode-native-commands-render`: passed, but its output explicitly excluded dynamic Worklets-backed `AnimatedDouble` resolution.
- `rg` source proof showed the command-render verifier used static numeric props:
  - `circle.radius = 8.0`
  - `rrect.cornerRadius = 5.0`
  - `blurMaskFilter.blur = 4.0`
  - `path.trimStart = 0.0`
  - `path.trimEnd = 1.0`

Rejected hypotheses:

- Worker 089 already proved the command path: rejected; it stopped at `JSIConverter<AnimatedDouble>`.
- Numeric/static command props proved dynamic behavior: rejected; they do not create a Worklets `Synchronizable` NativeState object.
- Product code needed a fix: rejected after the verifier proved `NodeCommand` conversion, draw-time resolution, fallback, mutation, and dynamic raster-cache bypass with existing C++.
- Path trim should be included in this pass: rejected as optional and more brittle; circle/rrect/blur were enough to prove the selected command-prop path deterministically.

## Implementation Details

The command-render native probe now constructs the same Worklets shape worker 089 proved:

- `worklets::makeSerializableNumber(...)`
- `worklets::extractSerializableOrThrow(...)`
- `std::make_shared<worklets::Synchronizable>(...)`
- `worklets::SerializableJSRef::newNativeStateObject(...)`

New converter-side assertions prove:

- Static numeric `circle.radius`, `rrect.cornerRadius`, `blurMaskFilter.blur`, `path.trimStart`, and `path.trimEnd` remain non-dynamic and distinct.
- Dynamic `circle.radius`, `rrect.cornerRadius`, and `blurMaskFilter.blur` pass through real `JSIConverter<NodeCommand>::fromJSI(...)`.
- Converted `NodeCommand` variants contain dynamic `AnimatedDouble` values, preserve the original `Synchronizable` identity, and do not invent a static fallback.
- With RN Skia main runtime unset, the dynamic payload resolves to no value; after `BaseRuntimeAwareCache::setMainJsRuntime(&runtime)`, it resolves the current `Synchronizable` number; after `Synchronizable::setBlocking(...)`, it observes the changed number.
- Plain JS object and non-`Synchronizable` `SerializableJSRef` negatives fail through `NodeCommand` conversion with source-owned `AnimatedDouble` error text. The negative is exercised through `circle.radius`; the other selected props use the same `JSIConverter<AnimatedDouble>` path.

New render/runtime assertions prove:

- Dynamic `CircleCmd` falls back to layout radius with no main runtime, resolves the initial dynamic radius with main runtime set, then renders the mutated radius after `setBlocking(...)`.
- Dynamic `RRectCmd` falls back to zero corner radius with no main runtime, resolves the initial dynamic corner radius, then renders the zero-radius mutation.
- Dynamic `BlurMaskFilterCmd` falls back to zero blur with no main runtime, resolves the initial blur, then removes outside blur pixels after mutation to zero.
- A rasterized `GroupCmd` with a dynamic circle child reports dynamic subtree content, does not cache the dynamic subtree, and renders the mutated child without stale cache reuse.

## Proof Boundary

Proven:

- Host-native macOS C++ compile/link for the updated command-render probe.
- Real Worklets `Synchronizable` NativeState JSI objects through real `JSIConverter<NodeCommand>::fromJSI(...)`.
- Selected dynamic `AnimatedDouble` command props: `circle.radius`, `rrect.cornerRadius`, and `blurMaskFilter.blur`.
- Static numeric command props remain covered and distinct.
- Real `YogaNode::setCommand()`, `renderToContext()`, object state, bounded pixels/regions, no-main-runtime fallback behavior, main-runtime resolution, `setBlocking(...)` mutation observation, and dynamic raster-cache bypass.

Not proven:

- UI-runtime Worklets execution.
- Reanimated SharedValue delivery.
- `executeOnUIRuntimeSync`.
- JS listener scheduling.
- RNGH delivery.
- Nitro module registry install.
- React Native runtime integration.
- iOS/Android app build/run, simulator/device launch, or native platform presentation.
- Image asset loading/decoding or exact render fidelity.
- Every `AnimatedDouble` command prop; `path.trimStart` / `path.trimEnd` remain static coverage only.

## Verification Results

Pre-edit gap proof:

- `npm run check:animated-double-synchronizable`: passed; raw `AnimatedDouble` only, no command integration.
- `npm run check:yoganode-native-commands-render`: passed; excluded dynamic Worklets-backed `AnimatedDouble` resolution.
- `rg ... scripts/verify-yoganode-native-commands-render.mjs scripts/verify-animated-double-synchronizable.mjs`: showed static numeric command props and explicit dynamic exclusion.

Final focused checks:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-animated-double-synchronizable.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed; output now includes selected dynamic Worklets-backed `AnimatedDouble` NodeCommand props and dynamic raster-cache bypass.
- `npm run check:animated-double-synchronizable`: passed; output now states it proves raw extraction/resolution while command/render separately owns selected NodeCommand coverage.
- `git diff --check`: passed.

Aggregate matrix:

- `npm run check:feasible-matrix`: passed.
- Matrix size: 28 commands.
- Expanded entry: `[17/28] npm run check:yoganode-native-commands-render`, passed in `33.3s`.
- Dependent entry: `[18/28] npm run check:animated-double-synchronizable`, passed in `8.4s`.
- Total matrix duration: `4m 43s`.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining new tracked artifacts, and removed `/tmp/rnskia-feasible-matrix-2LPyXu`.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- A preliminary matrix run was intentionally terminated after challenger feedback identified dynamic raster-cache coverage as a useful strengthening target. Its SIGTERM cleanup completed and removed the matrix temp parent; it is not claimed as acceptance evidence.

## Matrix Update

- `package.json` was not changed.
- `scripts/verify-feasible-matrix.mjs` was not changed.
- The existing `check:yoganode-native-commands-render` matrix command now covers selected dynamic `AnimatedDouble` NodeCommand behavior.
- The full matrix passed after the expansion.

## Nested Challenger Documentation

First challenger attempt:

- Nested challenger: `/root/animated_nodecommand_challenger`.
- Prompt: read-only challenge of the planned dynamic Worklets-backed `AnimatedDouble` NodeCommand verifier shape, selected props, fallback/mutation proof, negative cases, product-code need, and proof-boundary cautions.
- Result: the agent disappeared from the live-agent list without returning a result. No acceptance evidence is claimed.

Second challenger:

- Nested challenger: `/root/animated_nodecommand_challenger_v2`.
- Prompt:

```text
Read-only focused challenger for worker 090 in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-090-animated-double-nodecommand. Do not edit files. Inspect the current changed scripts and relevant C++ only: scripts/verify-yoganode-native-commands-render.mjs, scripts/verify-animated-double-synchronizable.mjs, cpp/JSIConverter+NodeCommand.hpp, cpp/JSIConverter+AnimatedDouble.hpp, cpp/AnimatedDouble.cpp, cpp/YogaNode.hpp, cpp/YogaNode.cpp, and Worklets Serializable/Synchronizable sources as needed. Challenge whether the verifier now genuinely proves dynamic Worklets-backed AnimatedDouble objects through JSIConverter<NodeCommand>::fromJSI for circle.radius, rrect.cornerRadius, and blurMaskFilter.blur, plus bounded render/fallback/mutation behavior. Identify any overclaims, missed negative cases, maintainability concerns, and whether product code changes appear necessary. Return concise findings. Do not run long verification commands and do not claim acceptance evidence unless you actually run checks.
```

- Result: completed, read-only.
- Findings:
  - Dynamic direct render was proven, but rasterized group stale-cache behavior was not yet exercised.
  - Negative coverage through `circle.radius` was narrow but acceptable because selected props share `JSIConverter<AnimatedDouble>`.
  - String-based source-shape assertions in the raw verifier are brittle; the native probes are the meaningful evidence.
  - No product-code changes appeared necessary.
- Response:
  - Added `assertDynamicRasterizedGroupBypassesCache(...)`.
  - Kept the report/proof boundary explicit that negative coverage is through `circle.radius`, not every prop.
  - Left the raw verifier source-shape assertion narrow and documented that native probe execution is the semantic proof.
- Acceptance evidence from challenger: none claimed; it did not run long verifier commands.
- Closure evidence: `close_agent /root/animated_nodecommand_challenger_v2` returned completed status; final `list_agents` showed only `/root`.

## Cleanup And Status Evidence

Final cleanup/status probes before this report:

- `git diff --check`: passed.
- Verifier temp-prefix probe under `/tmp` and `/private/tmp`: no output.
- Repo tarball/build-info/generated native directory probe: no output.
- Active verifier/debug process probe for `node .*verify-`, `clang++`, verifier binaries, `lldb`, and `debugserver`: no output.
- `git status --short --branch --ignored=matching`:
  - `M scripts/verify-animated-double-synchronizable.mjs`
  - `M scripts/verify-yoganode-native-commands-render.mjs`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- After this report is written, status adds only `?? worker-progress/worker-090-animated-double-nodecommand.md`.

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier/debug processes remained. Ignored dependency trees were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The proof uses real Worklets `Synchronizable` NativeState objects and real `NodeCommand` conversion, not JS stubs.
- Dynamic behavior is asserted at converter state, command state, render pixels/regions, and raster-cache behavior.
- Product code remained unchanged because the existing native implementation satisfied the proof.

Maintainability:

- Coverage stays in the existing command/render verifier, keeping command proof discoverable.
- The raw `AnimatedDouble` verifier remains focused on extraction/resolution and points to the command-render verifier for selected NodeCommand integration.
- Dynamic path trim was left out to keep deterministic assertions tight.

Performance:

- Added raster surfaces are small.
- The expanded command-render verifier passed in `33.3s` inside the matrix.
- Full feasible matrix remained bounded at `4m 43s`.

Security:

- Verifier execution still uses structured spawn argument arrays.
- JSI inputs are fixed verifier-owned literals and native objects.
- Cleanup remains constrained to verifier-owned temp roots and matrix-owned temp parent accounting.
- No network access, installs beyond existing verifier behavior, arbitrary user input, or broad temp deletion was introduced.
