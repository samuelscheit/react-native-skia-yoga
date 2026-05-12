# Worker 172 - Post-worker-171 root-cause audit

## Summary

Report-only audit completed for Worker 171. I accept Worker 171's proof
boundary as scoped: public packed TypeScript plus Node VM Reconciler
source-level proof for representative dynamic SkPoint-capable
`style.borderTopLeftRadius` authoring and delivery.

The strongest next locally unblocked target is not a pure per-key Reconciler
corner-radius sweep. It is generated/native style corner-radius proof: prove
that materialized `setStyle(...)` delivers SkPoint-capable style corner radii
into native `NodeStyle`, `_clipToBoundsRadii`, render clipping, and hit-test
clipping. A small per-key JS/Reconciler sweep remains useful as secondary drift
coverage.

## Worker 171 acceptance decision

Accepted as scoped.

Worker 171 changed:

- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `worker-progress/worker-171-corner-radius-dynamic-proof.md`

The proof is coherent:

- The packed consumer now imports `SkPoint` and compiles
  `style.borderTopLeftRadius` as `SharedValue<number>`,
  `SharedValue<SkPoint>`, and nested `{ x, y }` `SharedValue<number>` leaves.
- The packed consumer rejects an invalid corner-radius point leaf with
  `@ts-expect-error`.
- The Reconciler verifier proves nested `borderTopLeftRadius.x` and
  `borderTopLeftRadius.y` SharedValue leaves, whole
  `SharedValue<SkPoint>`, listener keys, initial snapshots, `runOnJS` payloads,
  full style rebuilds, invalidation, cleanup, ignored late emits, explicit
  invalid-shape errors, and no native command mirrors.
- `src/jsx.ts` and `src/Reconciler.ts` use shared corner-key lists, so the
  source machinery applies to all four SkPoint-capable corner keys.

Limits and caveats:

- Worker 171's direct Reconciler proof is representative for
  `borderTopLeftRadius`; it is not per-key runtime proof for all four corner
  keys.
- Public TypeScript proves scalar `SharedValue<number>` authoring, but the
  Reconciler verifier does not separately exercise whole scalar
  `SharedValue<number>` corner-radius normalization. That remains a focused JS
  completion gap if the project wants exact scalar-update behavior codified.
- The report does not overclaim React Native bridge, real Reanimated delivery,
  platform build/run, native presentation, or pixels.

## Evidence reviewed

- `worker-progress/worker-171-corner-radius-dynamic-proof.md`.
- `scripts/verify-package-typescript-consumer.mjs`: `SkPoint` import,
  dynamic scalar/point/nested corner-radius fixtures, invalid point-leaf
  negative fixture, and summary output.
- `scripts/verify-reconciler-animated-bindings.mjs`: corner-radius error
  constants, nested-leaf proof, whole-point proof, invalid-shape proof, and
  final verifier output.
- `src/jsx.ts`: `YogaStyleCornerRadiusKey` lists
  `borderBottomLeftRadius`, `borderBottomRightRadius`, `borderTopLeftRadius`,
  and `borderTopRightRadius`; `YogaAnimatedCornerRadius` accepts scalar,
  `SkPoint`, `SharedValue<SkPoint>`, and animated point leaves.
- `src/Reconciler.ts`: `styleNestedRoots` contains the four corner keys;
  `assertSupportedCornerRadiusValue(...)` accepts number, SkPoint,
  `SharedValue<number>`, `SharedValue<SkPoint>`, and numeric animated leaves.
- `cpp/YogaNode.cpp`, `cpp/YogaNode.hpp`, and generated `NodeStyle.hpp`:
  generated `NodeStyle` already has all four optional
  `std::variant<double, SkPoint>` corner fields, while `YogaNode::setStyle(...)`
  maps them into `_clipToBoundsRadii`, render clipping, and hit-test clipping.
- Existing native verifiers: current native materialization/hit-test/render
  checks cover explicit `style.clip`, overflow clipping, transform/matrix,
  and `rrect.cornerRadius`, but not style corner-radius clipping from
  `borderTopLeftRadius` or the other SkPoint-capable style keys.
- Nested explorer `acceptance_challenger`: independently accepted Worker 171
  as scoped and identified the same representative-key/platform boundary.
- Nested explorer `next_target_challenger`: independently ranked native style
  corner-radius materialization/clipping proof above a pure per-key Reconciler
  sweep.

## Commands run

All Node/npm commands used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed; output included dynamic
  SkPoint-capable `style.borderTopLeftRadius` public authoring and invalid
  point-leaf rejection.
- `npm run check:reconciler-animated-bindings`: passed; output included dynamic
  `style.borderTopLeftRadius` nested leaf and whole `SharedValue<SkPoint>`
  source-level delivery proof.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 12s and removed
  its generated `tsconfig.tsbuildinfo` plus matrix-owned temp parent.

## Platform blocker reprobe

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `command -v pod`: not found.
- `command -v gradle`: not found.
- `command -v adb`: not found.
- `command -v cmake`: not found.
- `command -v ninja`: not found.
- `java -version`: failed because no Java runtime is available.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

These are local platform/toolchain blockers, not repo verification failures.

## Next target recommendation

Assign the next implementation worker to generated/native style
corner-radius proof.

Recommended scope:

- Extend `check:yoganode-nitro-materialization` with materialized generated
  `setStyle(...)` cases for SkPoint-capable style corner radii, at minimum
  `borderTopLeftRadius: { x, y }` plus an opposite corner, and preferably all
  four generated `NodeStyle` corner fields.
- Assert generated conversion populates native `_style` corner fields with the
  expected `double` or `SkPoint` variant and updates `_clipsToBounds` plus
  `_clipToBoundsRadii`.
- Extend `check:yoganode-native-hit-testing` or
  `check:yoganode-native-commands-render` with bounded evidence that style
  corner radii affect rounded clipping. Keep this distinct from existing
  explicit `style.clip` RRect and `rrect.cornerRadius` command evidence.
- If adding a JS/Reconciler completion pass, keep it secondary and include the
  currently unproved whole scalar `SharedValue<number>` corner-radius path plus
  an inventory/case-table check for the four corner keys.

Why this beats a pure per-key Reconciler sweep:

- The JS type/Reconciler source already shares the same four-key lists, and
  Worker 171 proved the representative public/Reconciler behavior.
- The lower-stack behavior is render- and hit-test-affecting: corner-radius
  style values drive native rounded clipping through `_clipToBoundsRadii`.
- Existing native proof is adjacent but not equivalent; explicit clip RRects
  and `rrect` commands do not prove style corner-radius clipping.
- Host-JSC/native verifier paths are locally green and unblocked, while
  platform app build/run remains blocked.

## Proof boundary and overclaim risks

Accepted after Worker 171:

- Public packed TypeScript authoring and rejection for representative dynamic
  `style.borderTopLeftRadius`.
- Node VM source-level Reconciler JS style-listener delivery for nested
  `borderTopLeftRadius` leaves and whole `SharedValue<SkPoint>`.
- Explicit Reconciler invalid-shape errors and no native command mirror use for
  the covered cases.

Not proven:

- Per-key runtime proof for all four SkPoint-capable corner keys.
- Separate whole scalar `SharedValue<number>` Reconciler normalization/update
  proof.
- Generated/native delivery of style corner radii into `_clipToBoundsRadii`.
- Rounded style-radius clipping in native hit-testing or raster rendering.
- React Native bridge delivery, Nitro registry install in a React Native
  runtime, iOS/Android build/run, simulator/device behavior, native
  presentation, UI-runtime Worklets execution, real Reanimated delivery, RNGH
  native delivery, exact pixels, or exact render fidelity.

## Cleanup status

- Report-only scope was preserved.
- Product source, verifier scripts, generated files, package metadata, docs,
  and examples were not edited.
- Existing ambiguous local artifacts such as `node_modules`,
  `example/node_modules`, `example/ios`, `example/android`, `example/.expo`,
  `lib`, `.DS_Store`, and `tsconfig.tsbuildinfo` were not removed.
- The feasible matrix removed only its matrix-owned temp parent and generated
  tracked `tsconfig.tsbuildinfo` cleanup target.
- Both nested explorer agents completed and were closed.
- Before this report was written, the worktree was clean.

## Changed files

- `worker-progress/worker-172-post-171-root-cause-audit.md`

## Recommended next tasks

- Implement the generated/native style corner-radius proof target above.
- Keep a compact JS/Reconciler follow-up for all-four-key drift and whole scalar
  `SharedValue<number>` corner-radius behavior if it is not included in that
  worker.
- Keep full platform-native app build/run and real RN/Nitro/Reanimated/RNGH
  runtime proof blocked until local toolchain prerequisites change.

Goal finished.
