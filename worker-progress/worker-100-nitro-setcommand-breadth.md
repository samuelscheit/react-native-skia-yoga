# Worker 100 - Nitro setCommand Breadth

## Scope And Changed Files

Changed files:

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `worker-progress/worker-100-nitro-setcommand-breadth.md`

No product C++ or TypeScript source was changed. The expanded verifier did not expose a product bug.

## Source-confirmed Proof Gap

Before this change, `check:yoganode-nitro-materialization` proved host-JSC `YogaNode::toObject(runtime)`, generated prototype method/getter materialization, generated `setStyle`, generated `computeLayout`, generated `layout`, and one generated `setCommand(group)` call.

The gap was confirmed from the current verifier and accepted worker context:

- `scripts/verify-yoganode-nitro-materialization.mjs` only built and invoked `makeGroupCommand(...)` for generated `setCommand(...)`.
- `worker-progress/worker-088-nitro-yoganode-materialization.md` documents generated `setCommand({ type: "group", ... })` as the selected command payload.
- `worker-progress/worker-099-post-098-root-cause-audit.md` explicitly selected generated `YogaNode.setCommand(...)` breadth beyond `group`.
- `check:yoganode-native-commands-render` already owns direct native conversion/render proof for these command families, so this worker stayed focused on the generated JS-facing wrapper path from materialized YogaNode objects.

## Implementation Summary

I extended `scripts/verify-yoganode-nitro-materialization.mjs` inside the existing host-JSC C++ probe.

The verifier now preserves the existing materialization coverage for:

- `YogaNode::toObject(runtime)` and cached object stability.
- NativeState identity back to the original `YogaNode`.
- Generated members `setCommand`, `setStyle`, `computeLayout`, and `layout`.
- Generated `setCommand(group)`, `setStyle`, `computeLayout`, `layout`, and stable negative cases.

New generated `setCommand(...)` cases use fresh shared/materialized YogaNode instances per command kind:

- `line`: nested `from` / `to` object payload, asserted through `YogaNodeCommandKind::LINE`, real `LineCmd`, and `basePoint1()` / `basePoint2()` values.
- `points`: array payload, asserted through `YogaNodeCommandKind::POINTS`, real `PointsCmd`, `pointMode: "lines"`, and both base point values.
- `path`: public-shaped `stroke.miter_limit` payload using a real `RNSkia::JsiSkPath` host object, asserted through `YogaNodeCommandKind::PATH`, real `PathCmd`, and native `stroke.width`, `stroke.miter_limit`, `stroke.precision`, `stroke.join`, and `stroke.cap`.

Fresh nodes were used because `YogaNode::setCommand()` intentionally rejects changing command kind after initialization.

## Product Bug Status

No product source change was needed. The generated wrapper, `JSIConverter<NodeCommand>`, and `YogaNode::setCommand()` path already handled the selected line, points, and public path stroke payloads.

## Proof Boundary

Proven:

- Host-JSC Nitro `YogaNode::toObject(runtime)` materialization.
- Generated JS-facing `YogaNode.setCommand(...)` wrapper execution for `group`, `line`, `points`, and public-shaped `path.stroke.miter_limit`.
- The generated wrapper returns `undefined`.
- The materialized object NativeState is the original shared `YogaNode`.
- Native `_commandKind`, `_command`, concrete command class, and representative payload state are correct for the selected cases.
- Existing generated `setStyle`, `computeLayout`, and `layout` materialization coverage remains intact.

Not proven:

- Actual React Native bridge delivery.
- Nitro module registry install inside a React Native runtime.
- Platform app runtime, iOS/Android build/run, simulator/device launch, or native presentation.
- UI-runtime Worklets execution or real Reanimated `SharedValue` delivery.
- RNGH native delivery.
- Image asset loading/decoding.
- Exact render fidelity or full command-set coverage.

## Verification Commands And Results

- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: passed. The host probe compiled and linked, then reported generated `setCommand(line)`, `setCommand(points)`, and `setCommand(path)` wrapper coverage in addition to the existing group/style/layout coverage.
- `git diff --check`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 56s`.
  - Matrix entry `[20/28] npm run check:yoganode-nitro-materialization` passed in `37.7s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-2mx2Kp` was empty before removal and was removed.

No focused product-source command was needed because no product source file changed.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- `bun run specs` ran inside the feasible matrix and left no tracked generated diff.

## Nested Challenger Documentation

- Nested agent: `/root/setcommand_materialization_challenger`.
- Prompt summary: read-only challenge of the planned verifier expansion for materialized generated `setCommand(line)`, `setCommand(points)`, and `setCommand(path)` cases; inspect source/verifier shape; identify exact native fields, path host-object construction, immutability pitfalls, NativeState checks, return-value assertions, and proof-boundary risks; do not edit files, install packages, or run long builds.
- Result: completed.
- Challenger findings:
  - Confirmed current materialization coverage only proved generated `setCommand(group)` among command payloads.
  - Recommended fresh shared/materialized `YogaNode` instances per command kind.
  - Recommended common assertions for wrapper `undefined`, NativeState identity, `_commandKind`, non-null `_command`, and concrete `dynamic_cast`.
  - Recommended `LineCmd::basePoint1()` / `basePoint2()`, `PointsCmd::basePoints()` plus point mode, and `PathCmd::props.stroke` assertions.
  - Confirmed `RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path))` is the right host-object construction for this verifier.
- Commands claimed by challenger: source-only `rg`, `sed`, `nl -ba`, `node -e` package script inspection, and `git status --short`.
- Nested acceptance evidence: none claimed. The challenger did not run the Nitro verifier, clang, or any long verifier.
- Closure evidence: `close_agent /root/setcommand_materialization_challenger` returned completed status; final `list_agents` showed only `/root`.

## Cleanup And Status Evidence

Cleanup/status probes after verification and before this report:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/100-nitro-setcommand-breadth`
  - `M scripts/verify-yoganode-nitro-materialization.mjs`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Temp-prefix probe under `/tmp` and `/private/tmp` for Nitro materialization, command render, feasible matrix, package, example, AnimatedDouble, RNSkYogaView, hit testing, raw methods, native runtime, and native lifetime roots: no output.
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Active verifier/debug process probe for `node .*verify-`, `clang++`, verifier binaries, `lldb`, and `debugserver`: no output.
- `list_agents`: only `/root` after closing the nested challenger.

Final cleanup/status probes after adding this report:

- `git diff --check`: passed with no output.
- `git status --short --branch --ignored=matching`:
  - branch: `worker/100-nitro-setcommand-breadth`
  - `M scripts/verify-yoganode-nitro-materialization.mjs`
  - `?? worker-progress/worker-100-nitro-setcommand-breadth.md`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Temp-prefix probe under `/tmp` and `/private/tmp`: no output.
- Repo artifact probe for tarballs and build-info files: no output.
- Generated example native directory probe: no output.
- Active verifier/debug process probe: no output.
- `list_agents`: only `/root`.

Ignored dependency trees were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The verifier now covers the exact remaining generated-wrapper gap across nested object, array, and public stroke payload shapes.
- Assertions check generated wrapper behavior and native side effects directly, not only output text.
- Existing group/style/layout materialization proof is preserved.

Maintainability:

- Coverage stays in the verifier that already owns Nitro materialized YogaNode objects.
- Fresh-node helper structure documents and respects the native command-kind immutability contract.
- Path construction reuses the established real `JsiSkPath` host-object pattern from the command/render verifier.

Performance:

- The added checks use small fixed JSI payloads and no raster rendering.
- The full matrix remained bounded; the edited materialization entry passed in `37.7s`.

Security:

- Shell execution remains structured through existing `spawnSync` argument arrays.
- Probe inputs are fixed verifier-owned literals.
- No network access, package installs, arbitrary user input, broad retry behavior, or broad temp deletion was added.
