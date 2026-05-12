# Worker 168 - Post-worker-167 root-cause audit

## Summary

Report-only audit completed for Worker 167. I accept Worker 167's proof
boundary: public packed TypeScript and Node VM Reconciler source-level
transform variant breadth/drift proof only.

Worker 167 closed the gap Worker 166 selected. The packed consumer verifier
and the Reconciler animated-binding verifier now derive the public transform
operation inventory from `src/specs/style.ts`, cover all ten current public
transform operation keys, and fail if their case tables drift by operation key
or exported type alias.

The next strongest locally unblocked target is whole `style.matrix`
`SharedValue` public/Reconciler proof. Native/materialized matrix paths are
already covered, but the packed-consumer and Reconciler source-path checks do
not yet focus on public whole-matrix dynamic authoring/delivery or the
unsupported nested-matrix-entry boundary.

## Worker 167 acceptance decision

Accepted.

Worker 167 changed:

- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `worker-progress/worker-167-transform-variant-drift-guard.md`

The proof is coherent:

- Both verifier scripts parse `src/specs/style.ts` with TypeScript, find the
  exported `Transform` alias, and walk the referenced exported
  single-property numeric transform aliases.
- Both scripts assert their local transform case tables match the source
  inventory by `{ key, typeName }`, so an added, removed, reordered, renamed,
  or rekeyed public transform operation will fail the verifier unless the case
  table is updated intentionally.
- The packed consumer now compiles inventory-backed static `style.transform`
  arrays and inventory-backed nested `SharedValue<number>` transform leaves for
  `rotateX`, `rotateY`, `rotateZ`, `scale`, `scaleX`, `scaleY`,
  `translateX`, `translateY`, `skewX`, and `skewY`.
- The Reconciler verifier now table-drives nested `style.transform`
  SharedValue leaf listener coverage across the same operation list while
  preserving the existing whole `SharedValue<Transform>` case.

## Evidence reviewed

- `worker-progress/worker-167-transform-variant-drift-guard.md`.
- `scripts/verify-package-typescript-consumer.mjs`: inspected the public
  transform inventory extraction, package transform case table, generated
  packed-consumer static/dynamic transform fixtures, and drift assertion.
- `scripts/verify-reconciler-animated-bindings.mjs`: inspected the matching
  inventory extraction, nested transform binding table, listener/update/cleanup
  assertions, and drift assertion.
- `src/specs/style.ts`: confirmed current public `Transform` operations are
  `rotateX`, `rotateY`, `rotateZ`, `scale`, `scaleX`, `scaleY`,
  `translateX`, `translateY`, `skewX`, and `skewY`.
- `src/jsx.ts` and `src/Reconciler.ts`: reviewed adjacent dynamic style
  boundaries, especially whole `style.matrix` typing and the Reconciler's
  runtime rejection of nested SharedValue entries inside matrix arrays.
- `scripts/verify-yoganode-nitro-materialization.mjs`: confirmed Worker 161's
  generated materialized transform breadth and existing materialized matrix
  coverage remain separate proof layers.
- `scripts/verify-yoganode-native-hit-testing.mjs` and
  `scripts/verify-yoganode-native-commands-render.mjs`: confirmed Worker 163's
  host-native transform/render consumer evidence remains separate.
- Recent reports: Workers 161, 162, 163, 164, 165, 166, and 167.
- Read-only challenger `next_target_challenger`: independently recommended
  whole `style.matrix` `SharedValue` public/Reconciler proof as the strongest
  next locally unblocked target.

## Commands run

All Node/npm checks used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `npm run check:package-typescript-consumer`: passed; output included
  inventory-backed transform authoring and the source inventory match:
  `rotateX, rotateY, rotateZ, scale, scaleX, scaleY, translateX, translateY,
  skewX, skewY`.
- `npm run check:reconciler-animated-bindings`: passed; output included
  dynamic `style.transform` SharedValue leaves for every public transform
  operation plus whole `SharedValue<Transform>`.
- `npm run check:yoganode-nitro-materialization`: passed; output preserved
  generated materialized matrix and transform coverage.
- `npm run check:feasible-matrix`: passed all 28 commands; total command
  duration `4m 50s`.
- `git diff --check`: passed before writing this report and again before the
  commit.
- Focused `NodeStyle` source probe: reported 80 public `NodeStyle` fields,
  `missing generated: none`, and `missing native reference: none`.

## Platform blocker reprobe

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the
  `iphonesimulator` SDK cannot be located.
- `pod`: not found.
- `gradle`: not found.
- `adb`: not found.
- `cmake`: not found.
- `ninja`: not found.
- `java -version`: failed because no Java runtime is available.
- `ANDROID_HOME`: unset.
- `ANDROID_SDK_ROOT`: unset.

These are environment/toolchain blockers, not repo verification failures.
Platform-native app build/run, simulator/device launch, CocoaPods install, and
Gradle/Android build proof remain blocked locally.

## Next target recommendation

Assign the next implementation worker to whole `style.matrix` `SharedValue`
public/Reconciler proof.

Rationale:

- Public JSX special-cases `matrix` as `YogaAnimatedProp<YogaStyleMatrix>`,
  which supports a whole `SharedValue<MatrixArray | SkMatrixNative>` shape
  without allowing nested array-entry SharedValues.
- `src/Reconciler.ts` explicitly rejects nested `SharedValue` entries inside
  matrix arrays and tells users to animate the whole matrix instead, but the
  current packed-consumer/Reconciler checks do not focus on that contract.
- Native/materialized matrix delivery is already covered through
  `check:yoganode-nitro-materialization`, and matrix consumers are covered
  through host-native hit-testing/render checks. The missing layer is the
  public/Reconciler source path into those existing native proofs.
- This avoids duplicating Worker 161 materialized transform proof, Worker 163
  host-native transform render/hit-test proof, Worker 165 public/Reconciler
  transform authoring proof, and Worker 167 transform drift guarding.

Recommended scope:

- Extend `check:package-typescript-consumer` with packed-consumer fixtures for
  whole `style.matrix` `SharedValue<NonNullable<YogaNodeStyle["matrix"]>>`
  authoring, including representative 9- and 16-value matrix arrays if
  practical.
- Add a packed-consumer negative fixture for unsupported nested
  `SharedValue<number>` entries inside a matrix array if the public type
  surface currently rejects it.
- Extend `check:reconciler-animated-bindings` with source-level whole
  `style.matrix` SharedValue listener coverage: initial snapshot, top-level
  listener key, update delivery through `runOnJS`, full style rebuild,
  invalidation, cleanup, ignored late emits, and no native command mirror.
- Add or preserve a Reconciler negative assertion that nested matrix
  SharedValue entries fail with the existing explicit error.
- Rerun `check:yoganode-nitro-materialization` and
  `check:yoganode-native-hit-testing` as adjacent matrix/native evidence, not
  as new platform-runtime proof.

## Proof boundary and overclaim risks

Accepted after Worker 167:

- Public packed TypeScript transform authoring for all current public transform
  operation keys.
- Node VM source-level Reconciler JS style listener delivery for nested
  `style.transform` SharedValue leaves across all current public transform
  operation keys.
- Drift guarding from `src/specs/style.ts` public `Transform` aliases to both
  verifier case tables by key and type alias.
- Existing generated materialized transform and host-native transform
  render/hit-test proof layers remain green and separate.

Not proven:

- Actual React Native bridge delivery.
- Nitro registry install in a React Native runtime.
- Platform app runtime, iOS/Android build/run, simulator/device behavior, or
  native presentation.
- UI-runtime Worklets execution, real Reanimated delivery, RNGH delivery, or
  transformed gesture delivery.
- Host-native render/hit-test beyond existing Worker 163 coverage.
- Exact transform geometry, exact render fidelity, or exhaustive runtime
  transform behavior.

Overclaim risks:

- Worker 167's drift guard proves source/case-table alignment, not platform
  behavior.
- The inventory extractor intentionally assumes the public `Transform` alias is
  an array of exported single-property numeric aliases. That is a useful guard
  for the current public contract, but it is not a general TypeScript type
  equivalence proof.
- Future matrix work should not claim native matrix rendering merely because
  the public/Reconciler source path is covered; native/materialized matrix
  proof remains an adjacent boundary.

## Cleanup status

- Report-only scope was preserved.
- Product source, verifier scripts, generated files, package metadata, docs,
  and examples were not edited by this worker.
- The feasible matrix removed its generated `tsconfig.tsbuildinfo` artifact and
  its matrix-owned temp parent.
- The read-only challenger returned and was closed.
- Before this report was written, the worktree was clean.
- After this report, the only intended tracked change is
  `worker-progress/worker-168-post-167-root-cause-audit.md`.

## Recommended next tasks

- Implement the whole `style.matrix` `SharedValue` public/Reconciler proof
  target described above.
- Keep style corner-radius dynamic/runtime proof as the next candidate after
  matrix if no stronger source-confirmed gap appears.
- Keep public/generated `NodeStyle` inventory drift guarding as useful hygiene,
  but lower than a concrete public/Reconciler matrix path proof.
- Keep platform-native build/run and real RN/Nitro/Reanimated/RNGH runtime
  proof blocked until the local toolchain prerequisites change.

Goal finished.
