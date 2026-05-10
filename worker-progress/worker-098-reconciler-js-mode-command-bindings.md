# Worker 098 - Reconciler JS-mode Command Bindings

## Scope And Changed Files

Changed files:

- `scripts/verify-reconciler-animated-bindings.mjs`
- `worker-progress/worker-098-reconciler-js-mode-command-bindings.md`

No product TypeScript, native C++, package metadata, generated files, example app files, or other verifier scripts were changed. The expanded verifier did not expose a product bug, so `src/Reconciler.ts` was left untouched.

## Source-confirmed Gap

Worker 094 made the native command-binding side exhaustive for the current `supportsNativeCommandBinding(...)` whitelist: `blurMaskFilter.blur`, `circle.radius`, `path.trimEnd`, `path.trimStart`, and `rrect.cornerRadius`.

The remaining gap was the JS listener path. Before this change, `scripts/verify-reconciler-animated-bindings.mjs` still used one representative JS-mode command case, while the public JSX surface in `src/jsx.ts` broadly exposes `YogaDeepAnimated` command props, including nested `path.stroke`, `line.from` / `line.to`, and `points.points` leaves.

The current `src/Reconciler.ts` source supports broader JS-mode cases:

- `commandPropKeys` includes root command props such as `group.rasterize`, `line.from`, `path.stroke`, and `points.points`.
- `commandNestedRoots` includes `from`, `to`, `stroke`, `textStyle`, `paragraphStyle`, and `points`.
- `bindAnimatedValues(...)` creates a native mirror only when `nativeCommandBindingsEnabled` is true and `supportsNativeCommandBinding(type, path)` accepts the path; otherwise it registers a JS listener, stores the current value by dotted key, and returns the snapshot.
- Array traversal is source-supported under allowed nested roots. For `points.points.0.x`, the first segment is `points`, so the array is traversed with stringified indexes and the listener key becomes `points.0.x`.
- `resolveAnimatedCommand(...)` uses the same nested-root snapshot path when rebuilding command payloads after JS listener updates.

## Implementation Summary

I expanded `check:reconciler-animated-bindings` with a table-driven JS command listener case list, while keeping the native mirror case table and whitelist drift guard separate.

Selected JS-mode cases:

- `circle.radius`: preserves the prior proof that a native-whitelisted command prop falls back to JS listeners when native command bindings are disabled.
- `group.rasterize`: unsupported-native top-level command prop with native command bindings enabled, proving required JS fallback.
- `line.from.x`: nested object command prop under an allowed nested root.
- `path.stroke.miter_limit`: post-worker-096 public stroke miter field, source-representable in the Reconciler payload because Reconciler forwards `props.stroke`.
- `points.points.0.x`: nested-array command prop leaf, proving array traversal under the `points` nested root.

Each JS case now asserts listener registration, no `createSynchronizable(...)` mirror, expected listener key/path, initial command payload placement, `runOnJS` key/value delivery, command rebuild with the updated value, invalidation on the JS listener path, no native `setBlocking(...)`, cleanup by plain update/delete/unmount as appropriate, and no late rebuild/invalidation/`runOnJS` bridge after cleanup.

## Product Bug Status

No product source change was needed. The expanded verifier confirmed the current Reconciler source already supports the selected JS-mode root, nested object, post-096 stroke, and nested-array command paths.

## Proof Boundary

Proven:

- Source-level Reconciler host-config behavior inside the existing Node VM harness.
- JS command listener scheduling, command payload placement, `runOnJS` key/value delivery, invalidation, and cleanup for representative native-disabled, unsupported-native, nested object, post-096 stroke, and nested-array command props.
- Unsupported-native command props use the JS listener path when native command bindings are enabled.
- Native-bound props in the worker-094 table still use native mirrors and still match the source whitelist.

Not proven:

- UI-runtime Worklets execution.
- Real Reanimated `SharedValue` delivery.
- Actual native bridge delivery.
- C++ conversion for the new JS-mode cases.
- React Native runtime integration or Nitro module registry install.
- Platform app build/run, simulator/device launch, or native presentation.
- Image loading/decoding, native rendering, or exact render fidelity.

## Verification

- `git diff --check`: passed with no output.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed with no output.
- `npm run check:reconciler-animated-bindings`: passed. Output names the new JS command listener cases: `circle.radius`, `group.rasterize`, `line.from.x`, `path.stroke.miter_limit`, and `points.points.0.x`.
- `npm run lint-ci -- --quiet`: passed as an extra focused lint sanity check for the edited `.mjs` file.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `4m 47s`.
  - Matrix entry `[9/28] npm run check:reconciler-animated-bindings` passed in `1.1s`.
  - Matrix cleanup reported no newly created tracked artifacts.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-2loiIk` was empty before removal and was removed.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- No product source changed, so no product-source focused command beyond the Reconciler verifier was required.

## Nested Challenger Documentation

First nested challenger:

- Agent: `/root/js_mode_command_challenger`.
- Prompt summary: read-only inspection of JS-mode animated command case selection across unsupported-native top-level props, nested object props, post-worker-096 `path.stroke.miter_limit`, and array/nested-array props; identify any Reconciler bug or limitation; do not edit files or run long platform/native builds.
- Result: stalled/no result was delivered. A later `list_agents` call showed only `/root`; a close attempt reported the challenger path was not live.
- Acceptance evidence claimed: none.

Second nested challenger:

- Agent: `/root/js_mode_quick_challenger`.
- Prompt summary: short read-only check of `src/Reconciler.ts` and the verifier case selection; decide whether the five JS-mode cases are source-supported, whether `points.points.0.x` is supported, and whether product source changes are needed.
- Result: completed. It confirmed all five cases are representative and source-supported, confirmed `points.points.0.x` works through `points` as a nested root plus array index traversal, and found no Reconciler bug requiring `src/Reconciler.ts` changes.
- Commands claimed by challenger: read-only `sed` and `rg`.
- Acceptance evidence claimed: none. The acceptance evidence for this worker is the local verification commands above.

## Cleanup And Status Evidence

Cleanup/status probes after the full matrix and before final goal completion:

- `git diff --check`: passed with no output.
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, package, example, YogaNode, AnimatedDouble, Nitro materialization, and RNSkYogaView roots: no output.
- Active verifier/debug process probe for `node .*verify-`, `clang++`, `verify-yoganode`, `verify-rnsk`, `lldb`, and `debugserver`: no output.
- `list_agents`: only `/root` after closing the completed quick challenger.

Final tracked status is expected to be only:

- `M scripts/verify-reconciler-animated-bindings.mjs`
- `?? worker-progress/worker-098-reconciler-js-mode-command-bindings.md`

Ignored dependency trees `node_modules` and `example/node_modules` were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The verifier now covers the worker-097 gap directly: JS-mode command listener behavior for representative root, nested, stroke, and array payload paths.
- Assertions cover behavior, cleanup, and proof-boundary-relevant negative paths rather than only output strings.

Maintainability:

- JS-mode cases are centralized in one table, mirroring the existing native case-table style without merging native mirror and JS listener concerns.
- The native whitelist drift guard remains unchanged, so future native-binding support changes still fail loudly.

Performance:

- Added cases use the existing Node VM harness and deterministic stubs only.
- The Reconciler verifier remained about one second inside the feasible matrix.

Security:

- No network access, package installs outside existing verifiers, user input handling, broad temp deletion, or platform/device automation was added.
- The verifier uses fixed local source files and controlled VM stubs.
