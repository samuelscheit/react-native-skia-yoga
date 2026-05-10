# Worker 088 - Nitro YogaNode materialization

## Scope And Files Changed

- Added `scripts/verify-yoganode-nitro-materialization.mjs`.
- Added `check:yoganode-nitro-materialization` to `package.json`.
- Added the verifier temp prefix and command to `scripts/verify-feasible-matrix.mjs`.
- Added this report: `worker-progress/worker-088-nitro-yoganode-materialization.md`.
- No product C++/TS runtime behavior was changed.

## Current Gap Proof

Before editing, the accepted checks still bypassed the Nitro materialized object surface:

- `scripts/verify-yoganode-jsi-raw-methods.mjs` directly converted `NodeStyle`, directly called native `YogaNode::setStyle(...)`, and directly called raw JSI methods `setInteractionConfig()` / `hitTest()`. Its success output explicitly said it did not claim Nitro `toObject()` / prototype materialization proof.
- `scripts/verify-yoganode-native-commands-render.mjs` directly called `YogaNode::setCommand(...)` after `JSIConverter<NodeCommand>::fromJSI(...)`, then rendered native command classes. Its proof boundary also explicitly excluded Nitro `toObject()` / prototype materialization.
- Source search over the existing host-native verifiers found no `node->toObject(...)` call and no generated-wrapper call path for `setCommand`, `setStyle`, `computeLayout`, or `layout` from a returned JS object.

Prior risk was source-confirmed from worker 078 and the local crash report:

- `worker-progress/worker-078-yoganode-jsi-raw-methods.md` records that the earlier host probe reached `probe: materialize YogaNode JS object` and crashed.
- `~/Library/Logs/DiagnosticReports/yoganode-jsi-raw-methods-2026-05-10-162022.ips` still exists and shows `SIGSEGV` with frames through `margelo::nitro::getRuntimeId(...)`, `JSICache::getOrCreateCache(...)`, `PropNameIDCache::get(...)`, `HybridFunction::toJSFunction(...)`, `HybridObjectPrototype::createPrototype(...)`, and `HybridObject::toObject(...)`.
- Current Nitro source explains that path: `HybridObject::toObject(...)` calls `getPrototype(...)`, attaches NativeState, and caches a weak object; prototype creation creates JS functions; `JSICache::getOrCreateCache(...)` logs with `getRuntimeId(runtime)`; `getRuntimeId(...)` calls `ThreadUtils::getThreadName()`.

Rejected hypotheses:

- Existing raw-method coverage already proved generated wrapper execution: rejected; it uses direct C++ calls and says it does not prove materialization.
- Existing command/render coverage already proved JS-facing `setCommand`: rejected; it calls `YogaNode::setCommand(...)` directly, not `object.setCommand(...)` through Nitro `HybridFunction`.
- A product runtime fix was required for this target: rejected after the focused verifier passed by linking the real host-compatible iOS `ThreadUtils.cpp`. The prior crash is best classified here as a host-verifier platform/linker support gap around `ThreadUtils`, not a confirmed product `YogaNode::toObject()` failure.

## Implementation Details And Proof Boundary

The new verifier:

- Creates a verifier-owned temp root with prefix `rnskia-yoganode-nitro-materialization-`.
- Performs source assertions that the old verifiers still do not claim/perform materialization, generated `HybridYogaNodeSpec` still registers `setCommand`, `setStyle`, `computeLayout`, and `layout`, and Nitro materialization still reaches `ThreadUtils`.
- Builds a host-JSC executable against real `YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, Nitro `HybridObject` / prototype / cache sources, React Native JSC, Yoga, RN Skia macOS archives, `AnimatedDouble.cpp`, `ColorParser.cpp`, `PlatformContextAccessor.cpp`, and the real iOS `ThreadUtils.cpp`.
- Creates `std::shared_ptr<YogaNode>`, calls `node->toObject(runtime)`, asserts the returned value is a JS object, asserts NativeState exists, and dynamic-casts that NativeState back to the original `YogaNode` and generated `HybridYogaNodeSpec`.
- Calls `node->toObject(runtime)` a second time and asserts it returns the cached live JS object.
- Asserts materialized members `setCommand`, `setStyle`, `computeLayout`, and `layout` exist.
- Invokes generated JS-facing wrappers through `jsi::Function::callWithThis(...)`:
  - `setCommand({ type: "group", data: { rasterize: true } })`
  - `setStyle({ width: 64, height: 32 })`
  - `computeLayout(200, 100)`
  - `layout` getter via `object.getProperty(runtime, "layout")`
- Asserts native side effects:
  - real `GroupCmd` installed and `rasterizesSubtree()` reflects the payload;
  - native `NodeStyle` width/height are populated;
  - native Yoga layout is computed with width `64` and height `32`;
  - generated layout getter returns the same stable values.
- Adds stable negative assertions for generated `setStyle` invalid arity and generated `setCommand` invalid payload shape.

Proof boundary:

- Proven: host-JSC Nitro `YogaNode::toObject(runtime)` materialization, prototype creation with generated members, NativeState wrapping the original `YogaNode`, generated wrapper execution for selected methods/getter, and direct native state/layout evidence from those generated calls.
- Not proven: Nitro module registry install, React Native runtime integration, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, RNGH native delivery, dynamic Worklets-backed `AnimatedDouble`, image assets/decoding/loading, or exact render fidelity.

## Verification Commands And Results

Pre-edit/baseline evidence:

- `rg -n "toObject\\(|callWithThis|getPropertyAsFunction\\(|getNativeState|hasNativeState|setNativeState|HybridYogaNodeSpec|setCommand\\(|setStyle\\(|computeLayout\\(|layout" scripts/...`: confirmed existing raw/command verifiers do not materialize a YogaNode or call generated wrappers from a returned object.
- `rg -n "materialize|toObject|SIGSEGV|getRuntimeId|HybridObjectPrototype|DiagnosticReports|prototype" worker-progress/worker-078-yoganode-jsi-raw-methods.md worker-progress/worker-087-post-086-root-cause-audit.md`: confirmed prior documented crash and next-target rationale.
- `find "$HOME/Library/Logs/DiagnosticReports" -maxdepth 1 -name 'yoganode-jsi-raw-methods-2026-05-10-162022.ips' -print`: found the worker 078 crash report.
- `rg -n "exception|termination|SIGSEGV|getRuntimeId|HybridObjectPrototype|..." "$HOME/Library/Logs/DiagnosticReports/yoganode-jsi-raw-methods-2026-05-10-162022.ips"`: confirmed `SIGSEGV` in the `getRuntimeId` / prototype materialization stack.
- `npm run check:yoganode-jsi-raw-methods`: passed before editing with the old raw-method boundary.

Implementation iteration:

- First `npm run check:yoganode-nitro-materialization`: failed at compile time because JSI selected the variadic `callWithThis` template for pointer/count calls. Fixed by explicitly casting to `const jsi::Value*` and `size_t`.

Final checks:

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `node --check scripts/verify-feasible-matrix.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:yoganode-jsi-raw-methods`: passed.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:feasible-matrix`: passed with 27 commands in `4m 3s`; new entry `[19/27] npm run check:yoganode-nitro-materialization` passed in `27.2s`.
- `git diff --check`: passed.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs; commands exited 0.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining new tracked artifacts, and removed matrix temp parent `/tmp/rnskia-feasible-matrix-fgwkYX`.

## Matrix Update

- `package.json` now includes `check:yoganode-nitro-materialization`.
- `scripts/verify-feasible-matrix.mjs` now includes temp prefix `rnskia-yoganode-nitro-materialization-`.
- The feasible matrix now runs 27 commands and includes the new verifier after `check:yoganode-jsi-raw-methods`.
- The full matrix passed after the wiring change.

## Nested Challenger Documentation

- Nested challenger: `/root/nitro_materialization_challenger`.
- Prompt:

```text
You are a focused read-only challenger for worker 088 in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-088-nitro-yoganode-materialization. Do not edit files. Inspect the repo sources relevant to Nitro YogaNode materialization: cpp/YogaNode.*, nitrogen/generated/shared/c++/HybridYogaNodeSpec.*, node_modules/react-native-nitro-modules/cpp/core/HybridObject.cpp, prototype/HybridObjectPrototype.cpp, Prototype.hpp, core/HybridFunction.hpp, jsi/JSIHelpers.hpp, jsi/JSICache.cpp, platform/ThreadUtils* implementations, and scripts/verify-yoganode-jsi-raw-methods.mjs. Challenge these hypotheses: (1) a host-JSC verifier can safely call std::shared_ptr<YogaNode>->toObject(runtime); (2) generated JS-facing methods such as setCommand, setStyle, computeLayout, and layout can be invoked from the returned object; (3) likely blockers are runtime ID/cache/prototype/NativeState/ThreadUtils/linker shims. Return concise findings with file/line references, root-cause risks, recommended narrow verifier shape, and whether you claim any acceptance evidence. No edits.
```

- Result: completed and closed.
- Challenger findings:
  - Confirmed `HybridObject::toObject()` requires a shared-owned object and assigns NativeState from `shared()`.
  - Confirmed generated `HybridYogaNodeSpec` registers `setCommand`, `setStyle`, `computeLayout`, and `layout`.
  - Confirmed generated calls depend on `HybridFunction` retrieving NativeState and dynamic-casting it to the generated spec type.
  - Identified `JSICache::getOrCreateCache(...)` -> `getRuntimeId(...)` -> `ThreadUtils::getThreadName()` as the likely host blocker.
  - Recommended a focused verifier that calls `toObject(runtime)`, asserts NativeState/prototype members, and calls generated wrappers through `callWithThis`.
- Acceptance evidence from challenger:
  - It ran `node scripts/verify-yoganode-jsi-raw-methods.mjs` and confirmed the existing raw-method verifier passed.
  - It did not claim materialization acceptance evidence; the materialization proof is from this worker's new verifier and matrix run.
- Closure evidence: `close_agent /root/nitro_materialization_challenger` returned completed status; final `list_agents` showed only `/root`.

## Cleanup And Status Evidence

Cleanup/status probes after verification and before report creation:

- `git status --short --ignored=matching`:
  - `M package.json`
  - `M scripts/verify-feasible-matrix.mjs`
  - `?? scripts/verify-yoganode-nitro-materialization.mjs`
  - `!! example/node_modules`
  - `!! node_modules`
- `find /tmp /private/tmp -maxdepth 1 \( -name 'rnskia-yoganode-nitro-materialization-*' -o -name 'rnskia-yoganode-jsi-raw-methods-*' -o -name 'rnskia-yoganode-commands-render-*' -o -name 'rnskia-feasible-matrix-*' \) -print`: no output.
- `find . -maxdepth 1 -name '*.tgz' -print`: no output.
- `find . example -maxdepth 1 \( -name 'tsconfig.tsbuildinfo' -o -name '*.tsbuildinfo' \) -print`: no output.
- `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: no output.
- `pgrep -af 'node .*verify-|clang\+\+|yoganode-nitro-materialization|yoganode-jsi-raw-methods|yoganode-native-commands-render|rnsk-yoga-view-runtime|lldb|debugserver'`: no output.
- `list_agents`: only `/root`.

Final status after report creation:

- `M package.json`
- `M scripts/verify-feasible-matrix.mjs`
- `?? scripts/verify-yoganode-nitro-materialization.mjs`
- `?? worker-progress/worker-088-nitro-yoganode-materialization.md`
- ignored dependency trees only: `example/node_modules`, `node_modules`

Final cleanup probes after report creation:

- `git diff --check`: passed.
- Temp-prefix probe for Nitro materialization, raw methods, command render, and feasible matrix: no output.
- Tarball probe: no output.
- Build-info probe: no output.
- Generated example native directory probe: no output.
- Active verifier process probe: no output.
- `list_agents`: only `/root`.

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier processes remained. Ignored `node_modules` and `example/node_modules` are pre-existing dependency trees and were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The verifier closes the exact JS-facing bridge gap without claiming app/runtime boundaries.
- It asserts materialization, NativeState identity, generated method presence, generated wrapper calls, side effects, cache stability, and stable negative paths.
- The earlier crash surface is treated as a source-confirmed verifier support gap and addressed by linking real platform `ThreadUtils`.

Maintainability:

- The check is separate from the raw-method verifier, keeping direct raw-method coverage and generated materialization coverage distinct.
- It follows the existing host-native verifier pattern for temp roots, Nitro header shims, structured compiler invocation, archive discovery, and explicit proof-boundary output.
- No generated Nitro files or product runtime files were manually edited.

Performance:

- The focused verifier uses small payloads and no raster rendering.
- It passed standalone in roughly the same range as the existing host-native checks and passed inside the matrix in `27.2s`.
- No product runtime overhead was added.

Security:

- Shell execution uses structured `spawnSync` argument arrays.
- JSI inputs are fixed verifier-owned literals.
- Cleanup is constrained to verifier-owned temp roots and matrix-owned temp parent accounting.
- No external network, installs, arbitrary user input, or broad temp deletion was introduced.
