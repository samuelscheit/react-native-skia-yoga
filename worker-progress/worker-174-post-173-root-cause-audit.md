# Worker 174 - Post-worker-173 root-cause audit

## Summary

Report-only audit completed for Worker 173. I accept Worker 173's generated/native
style corner-radius proof as scoped.

Worker 173 closed the target Worker 172 selected at the generated/native state
and hit-test layers: materialized generated `setStyle(...)` now proves all four
SkPoint-capable style corner keys reach native `NodeStyle`, `_clipsToBounds`,
and `_clipToBoundsRadii`; native hit testing now proves rounded style-radius
clipping is consumed by `YogaNode::hitTestTagAt` / `hitTestInternal`.

The next strongest locally unblocked root-cause target is bounded raster
evidence for style corner-radius clipping in `YogaNode::renderToContext()`.
Worker 173 intentionally does not prove pixel output or exact render fidelity,
and the existing command/render verifier has the host-native raster harness
needed to close a narrow part of that remaining render boundary.

## Changed files

- `worker-progress/worker-174-post-173-root-cause-audit.md`

## Worker 173 acceptance decision

Accepted as scoped.

Worker 173 changed:

- `scripts/verify-yoganode-nitro-materialization.mjs`
- `scripts/verify-yoganode-native-hit-testing.mjs`
- `worker-progress/worker-173-native-corner-radius-proof.md`

The proof is coherent:

- `scripts/verify-yoganode-nitro-materialization.mjs` source-guards generated
  `NodeStyle.hpp` for all four optional `std::variant<double, SkPoint>` corner
  fields and generated property reads.
- The materialized host-JSC probe sets
  `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, and
  `borderBottomLeftRadius` through the generated `setStyle(...)` wrapper.
- The probe asserts two SkPoint variants and two scalar variants in
  `YogaNode::_style`, then asserts `_clipsToBounds`, `_clipToBoundsRadii`, the
  expected `SkRRect` corner-slot mapping, and no explicit `style.clip` state.
- The native hit-test verifier adds a direct style-corner-radius case that
  inserts a full-size child, proves rounded top-left and bottom-right corners
  reject hits, proves points inside the rounded bounds hit, and proves an unset
  square corner remains hittable.
- The proof stays separate from explicit `style.clip` RRect/path/rect cases and
  from `RRectCmd` command corner-radius evidence.

Important limits:

- This is not per-key, per-variant exhaustive testing. It proves all four keys
  are generated/materialized and uses representative SkPoint/scalar variants.
- Generated materialized delivery and native hit-test consumption are proven as
  adjacent layers, not as a full React Native app runtime path.
- The render path is source-confirmed to use `_clipToBoundsRadii`, but Worker
  173 does not add raster pixel evidence.

## Evidence reviewed

- `worker-progress/worker-173-native-corner-radius-proof.md`.
- `scripts/verify-yoganode-nitro-materialization.mjs`:
  generated corner-key source guards, `makeCornerRadiusStyle(...)`,
  `assertGeneratedCornerRadiusStyle(...)`, `_clipToBoundsRadii` assertions,
  point-clipping assertions, and proof-boundary output.
- `scripts/verify-yoganode-native-hit-testing.mjs`:
  `styleCornerRadiiClipToBounds()` and adjacent overflow / explicit clip
  cases.
- `nitrogen/generated/shared/c++/NodeStyle.hpp`:
  all four corner fields are `std::optional<std::variant<double, SkPoint>>` and
  generated `fromJSI` / `canConvert` reads use those variants.
- `cpp/YogaNode.cpp` and `cpp/YogaNode.hpp`:
  `YogaNode::setStyle(...)` resets clip state, maps style corner radii into
  `detail::CornerRadii`, stores `_clipToBoundsRadii`, consumes it in
  `renderToContext()` by clipping the canvas to an RRect path, and consumes it
  in `pointPassesClipping()` before hit-test traversal.
- `scripts/verify-yoganode-native-commands-render.mjs`:
  existing host-native raster harness and current proof boundary. It covers
  many command/style pixels but does not yet name style corner-radius clipping
  pixels.
- `scripts/verify-package-typescript-consumer.mjs` and
  `scripts/verify-reconciler-animated-bindings.mjs`:
  existing dynamic corner-radius public/Reconciler proof remains representative
  for `borderTopLeftRadius`; it does not yet include an all-four-key sweep or
  separate whole scalar `SharedValue<number>` Reconciler update proof.
- Recent reports: Workers 171, 172, and 173.

## Commands run

All Node/npm verification commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `git diff --check`: passed before report creation.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`: passed.
- `node --check scripts/verify-yoganode-native-hit-testing.mjs`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 24s. The matrix
  removed its generated `tsconfig.tsbuildinfo` artifact and its matrix-owned
  temp parent.

Focused command evidence:

- `check:yoganode-nitro-materialization` reported generated materialized
  all-four style corner-radius delivery into `_style` SkPoint/scalar variants,
  `_clipsToBounds`, and `_clipToBoundsRadii`.
- `check:yoganode-native-hit-testing` reported style corner-radius clipping in
  `YogaNode::hitTestTagAt` / `hitTestInternal`.
- `check:yoganode-native-commands-render`, through the feasible matrix, still
  reports broad bounded raster coverage for commands, transforms, layer,
  images, text, and paragraphs, but not style corner-radius clipping pixels.

## Platform blocker reprobe

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `command -v pod gradle adb cmake ninja`: produced no paths.
- Follow-up per-tool probe confirmed:
  `pod=not found`, `gradle=not found`, `adb=not found`,
  `cmake=not found`, `ninja=not found`.
- `java -version`: failed because no Java runtime is available.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

These are local environment/toolchain blockers, not repo verification failures.
Full CocoaPods install, Gradle build, simulator/device launch, platform-native
app runtime, and native presentation proof remain blocked locally.

## Next target recommendation

Assign the next implementation worker to add bounded raster evidence for style
corner-radius clipping in `scripts/verify-yoganode-native-commands-render.mjs`.

Recommended scope:

- Add a host-native raster case that creates a clipped parent with style
  corner radii, inserts a full-size colored child, renders through real
  `YogaNode::renderToContext()`, and asserts transparent pixels in rounded
  clipped corners plus colored pixels inside the rounded bounds.
- Include at least one SkPoint style corner radius and one scalar style corner
  radius, preferably matching the upper-left/lower-right evidence already used
  by Worker 173.
- Assert the style-radius case remains distinct from explicit `style.clip`
  RRect/path/rect state and from `RRectCmd::cornerRadius`.
- Update the command/render verifier output and proof boundary to name bounded
  style corner-radius raster clipping only, without claiming exact renderer
  fidelity or platform presentation.
- Run `node --check scripts/verify-yoganode-native-commands-render.mjs`,
  `npm run check:yoganode-native-commands-render`,
  `npm run check:yoganode-nitro-materialization`,
  `npm run check:yoganode-native-hit-testing`, and
  `npm run check:feasible-matrix`.

Why this is stronger than the JS completion alternatives:

- Worker 173 leaves render/pixel behavior as an explicit proof boundary, and
  `YogaNode::renderToContext()` has a source-confirmed `_clipToBoundsRadii`
  branch that is not currently pixel-tested.
- The existing host-native command/render verifier is locally green and already
  owns bounded raster assertions, so this is locally unblocked.
- A JS all-four-key/scalar `SharedValue<number>` completion pass is still useful
  but lower priority: the public/Reconciler source already shares the four-key
  lists and Worker 171 proved representative dynamic behavior for
  `borderTopLeftRadius`.

## Proof boundary and overclaim risks

Accepted after Worker 173:

- Host-JSC materialized generated `YogaNode::setStyle(...)` delivery for all
  four SkPoint-capable style corner fields.
- Native `YogaNode::setStyle(...)` mapping into `_style`,
  `_clipsToBounds`, and `_clipToBoundsRadii`.
- Bounded native hit-test consumption of style corner radii through rounded
  `pointPassesClipping()` and `hitTestInternal()` traversal.

Not proven:

- React Native bridge delivery.
- Nitro module registry install in a React Native runtime.
- iOS/Android app build or launch.
- Simulator/device behavior or native platform presentation.
- UI-runtime Worklets execution or real Reanimated SharedValue delivery.
- RNGH native delivery.
- Native raster pixels for style corner-radius clipping.
- Exact render fidelity, exact hit-test fidelity beyond the asserted points,
  image asset loading/decoding, exact saveLayer/GPU blend fidelity, exact
  typography, or platform renderer fidelity.
- Per-key JS/Reconciler proof for all four corner keys, and separate whole
  scalar `SharedValue<number>` corner-radius update proof.

Overclaim risks to avoid in the next worker:

- Do not describe a host-raster pixel test as platform-native presentation.
- Do not describe bounded corner-pixel assertions as exact render fidelity.
- Do not imply real Reanimated/UI-runtime delivery from Node VM Reconciler or
  host-JSC verifier evidence.

## Cleanup status

- Report-only scope was preserved.
- Product source, verifier scripts, generated files, package metadata, docs,
  and examples were not edited by this worker.
- Existing ambiguous local artifacts such as `node_modules`,
  `example/node_modules`, `example/ios`, `example/android`, `example/.expo`,
  `lib`, `.DS_Store`, and `tsconfig.tsbuildinfo` were not removed.
- The feasible matrix removed only its generated `tsconfig.tsbuildinfo` and
  matrix-owned temp parent.
- Before this report was written, the worktree was clean.

## Recommended next tasks

- Implement the bounded style corner-radius raster clipping proof described
  above.
- After that, consider a compact JS/Reconciler follow-up that inventory-checks
  all four SkPoint-capable corner keys and explicitly proves whole scalar
  `SharedValue<number>` corner-radius updates.
- Keep full platform-native app build/run and real RN/Nitro/Reanimated/RNGH
  runtime proof blocked until local toolchain prerequisites change.

Goal finished.
