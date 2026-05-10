# Worker 094 - Reconciler Native Command Binding Coverage

## Scope And Changed Files

- Expanded `scripts/verify-reconciler-animated-bindings.mjs`.
- Added this report: `worker-progress/worker-094-reconciler-native-command-bindings.md`.
- Product source was not changed; the expanded verifier did not expose a product bug.
- Did not edit package metadata, native build files, example app files, planning docs, or ignored local artifacts.
- Ignored dependency artifacts such as `node_modules` and `example/node_modules` were left untouched.

## Implementation Summary

- Replaced the single native-mode `circle.radius` proof with a table-driven native binding case list.
- Each native case now creates a fresh Reconciler VM harness, avoiding module-level `sharedNativeBindingStates` and listener-id reuse across cases.
- Each case proves `createInstance(type, propsWithSharedValue, nativeContainer)` registers one `SharedValue` listener, creates a `Synchronizable` mirror seeded from the current snapshot, stores that mirror in the host command payload at the expected prop path, marks the node natively animated, and invalidates on activation.
- Each case emits a new `SharedValue` value and proves the original mirror is updated through `setBlocking(...)` without rebuilding host commands, invalidating through the JS listener callback path, or using `runOnJS`.
- Each case commits to a plain non-`SharedValue` command prop and proves the native listener is removed, native animation is marked inactive, the plain command prop is applied, and later `SharedValue` emits are ignored.
- Existing JS-mode command binding coverage remains focused on `circle.radius`, preserving proof that native bindings disabled means JS listener callbacks, `runOnJS`, command rebuild, invalidation, and cleanup still work.
- Existing shared-refcount and detach cleanup coverage remains focused on two `circle.radius` nodes sharing one `SharedValue`; it exercises shared mirror reuse and final-listener cleanup, not every command prop.

## Native Cases And Drift Guard

Native-bound command prop cases now covered:

- `blurMaskFilter.blur`
- `circle.radius`
- `path.trimEnd`
- `path.trimStart`
- `rrect.cornerRadius`

The verifier now parses `src/Reconciler.ts` with the TypeScript AST and extracts the `supportsNativeCommandBinding(...)` source whitelist from the structured function shape:

- Confirms nested command paths are rejected through the `path.length !== 1` guard.
- Confirms the function switches on `type`.
- Extracts each `path[0] === "..."` return expression, including the `path.trimEnd || path.trimStart` case.
- Confirms the default branch returns `false`.
- Compares the extracted whitelist, sorted, to the verifier case table.

This is intended to fail loudly if Reconciler adds, removes, or reshapes native command binding support without the verifier being updated.

## Proof Boundary

Proven by this worker:

- Source-level Reconciler host-config behavior inside the existing Node VM harness.
- YogaCanvas still maps `animationBindingMode="native"` into `nativeCommandBindingsEnabled`.
- Native command binding source delivery for every current `supportsNativeCommandBinding(...)` whitelist entry.
- Local Worklets/Reanimated stubs prove calls to `createSynchronizable`, `SharedValue.addListener`, `Synchronizable.setBlocking`, `SharedValue.removeListener`, and absence of `runOnJS` in the native mirror path.
- Existing JS-mode command binding, animated style listener, shared native binding refcount, detach cleanup, and `clearContainer` cleanup coverage remains intact.

Not proven here:

- UI-runtime Worklets execution.
- Real Reanimated `SharedValue` delivery.
- Actual native bridge delivery.
- C++ `JSIConverter<NodeCommand>` conversion.
- Platform-native app proof, simulator/device launch, or native presentation.
- Image asset loading/decoding.
- Exact render fidelity.
- Nitro module registry install.
- React Native runtime integration.

The separate `check:yoganode-native-commands-render` verifier continues to own host-native C++ conversion/render evidence for selected dynamic `AnimatedDouble` command props.

## Verification Commands And Results

- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:reconciler-animated-bindings`: passed.
  - Output names all five whitelisted native-bound props.
  - Output states the Node VM source-level proof boundary and residual exclusions.
- `npm run check:feasible-matrix`: passed all 28 commands in `4m 50s`.
  - Matrix entry `[9/28] npm run check:reconciler-animated-bindings` passed in `970ms`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-hWoQXW` was empty before removal and was removed.
- `git diff --check`: passed before and after report creation.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- No installs or platform-native app builds were introduced.

## Nested Explorer Documentation

- Nested explorer: `/root/explore_reconciler_bindings`.
- Prompt summary: read-only inspection of `scripts/verify-reconciler-animated-bindings.mjs`, `src/Reconciler.ts`, and relevant prior reports; answer how the current native proof works, the exact whitelist shape, safest table-driven expansion, and risks around JS-mode/refcount cleanup; do not edit files; state commands and acceptance claims.
- Result: completed and closed.
- Explorer findings:
  - The current proof was representative through `circle.radius`, not exhaustive.
  - The source whitelist is exactly `blurMaskFilter.blur`, `circle.radius`, `path.trimEnd`, `path.trimStart`, and `rrect.cornerRadius`.
  - Native cases should run in fresh harnesses because Reconciler native binding state is module-level.
  - JS-mode coverage and the two-node shared-refcount detach sequence should remain separate.
  - It suggested refactoring the product whitelist into a data table, but I did not take that route because this task's expected ownership is the verifier unless a product bug is exposed.
- Explorer commands: read-only `rg`/`sed`/`nl`, `git status --short --branch`, and `npm run check:reconciler-animated-bindings`.
- Explorer acceptance evidence: claimed only focused verifier evidence, not full acceptance. This report's acceptance evidence comes from the local commands above.

## Cleanup And Status Evidence

Cleanup/status probes after the full matrix and before this report:

- `git status --short --branch --ignored=matching`:
  - `M scripts/verify-reconciler-animated-bindings.mjs`
  - ignored dependency trees only: `example/node_modules`, `node_modules`
- Verifier temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, reconciler bindings, package, example, YogaNode, AnimatedDouble, and RNSkYogaView temp roots: no output.
- Repo tarball probe for `*.tgz` and `*.tar.gz`, excluding dependency trees: no output.
- Repo build-info probe for `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Active verifier/debug process probe for `node .*verify-`, `clang++`, `lldb`, and `debugserver`: no output; `pgrep` exited 1 as expected for no matches.
- `list_agents`: only `/root` after closing the nested explorer.

After this report was written, final tracked status added only:

- `?? worker-progress/worker-094-reconciler-native-command-bindings.md`

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier/debug processes remained. Ignored dependency trees were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The expanded verifier now covers every current native Reconciler command-binding whitelist entry with the same behavioral assertions.
- The source AST guard prevents the verifier output from claiming "all whitelisted props" if the source whitelist changes.
- Proof boundaries are explicit in both verifier output and this report.

Maintainability:

- Native cases are centralized in one small table with per-case values and path fixtures.
- Shared helper assertions keep behavior consistent across props.
- JS-mode and refcount tests remain focused on their separate mechanisms instead of being conflated with the exhaustive native prop list.

Performance:

- Each native case uses a small VM harness and local stubs only.
- The focused reconciler verifier still passed under one second inside the matrix.
- The full feasible matrix remained at `4m 50s`.

Security:

- The verifier uses fixed local source files and local VM stubs.
- No network access, package installs, arbitrary user input, broad temp deletion, or platform-native execution was added.
- Cleanup remained constrained to existing matrix/verifier-owned paths.
