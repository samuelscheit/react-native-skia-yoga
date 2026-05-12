# Worker 170 - Post-worker-169 root-cause audit

## Summary

Report-only audit completed for Worker 169. I accept Worker 169's proof
boundary: public packed TypeScript and Node VM Reconciler source-level whole
`style.matrix` `SharedValue` proof only.

Worker 169 closed the gap Worker 168 selected. The packed consumer now proves
whole `style.matrix` `SharedValue` authoring for representative 9- and
16-value matrix arrays and rejects nested `SharedValue<number>` entries inside
matrix arrays. The Reconciler verifier now proves whole-matrix listener setup,
initial snapshots, updates through the top-level `matrix` key, full style
rebuild, invalidation, cleanup, ignored late emits, no native command mirror,
and the existing explicit nested-matrix error.

The next strongest locally unblocked target is dynamic style corner-radius
public/Reconciler proof for the four SkPoint-capable corner style keys.

The managed Worker 170 subagent stalled without producing a report or worktree
changes. Orchestration closed the stuck agent and recovered this report from
the assigned worktree.

## Worker 169 acceptance decision

Accepted.

Worker 169 changed:

- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `worker-progress/worker-169-matrix-sharedvalue-proof.md`

The proof is coherent:

- Packed consumer fixtures define `PublicMatrix`, `PublicMatrix9`, and
  `PublicMatrix16`, then compile static and whole `SharedValue<PublicMatrix>`
  9-/16-value matrix styles from an installed tarball.
- The packed consumer negative fixture uses `@ts-expect-error` on a nested
  `SharedValue<number>` matrix array entry, proving the public type surface
  rejects nested matrix entry SharedValues while accepting a SharedValue for
  the whole matrix.
- The Reconciler verifier adds a whole `style.matrix` SharedValue case that
  asserts initial 9-value snapshots, 16-value updates through `runOnJS` with
  the top-level `matrix` key, full style rebuild, invalidation, listener
  cleanup, ignored late emits, and no native command mirror.
- The Reconciler verifier adds direct and whole-snapshot negative cases for the
  existing explicit nested-matrix SharedValue error.

## Evidence reviewed

- `worker-progress/worker-169-matrix-sharedvalue-proof.md`.
- `scripts/verify-package-typescript-consumer.mjs`: inspected public matrix
  aliases, static and dynamic matrix fixtures, and the nested matrix negative
  fixture.
- `scripts/verify-reconciler-animated-bindings.mjs`: inspected whole-matrix
  listener/update/cleanup coverage and nested-matrix explicit-error coverage.
- `src/jsx.ts`: reviewed `YogaAnimatedCornerRadius` and the special
  `YogaStyleCornerRadiusKey` handling for `borderBottomLeftRadius`,
  `borderBottomRightRadius`, `borderTopLeftRadius`, and
  `borderTopRightRadius`.
- `src/Reconciler.ts`: reviewed `styleNestedRoots`,
  `assertSupportedCornerRadiusValue(...)`, and the explicit corner-radius
  error paths.
- `scripts/verify-package-typescript-consumer.mjs` currently has only static
  `borderRadius` style smoke coverage, not focused dynamic corner-radius
  public authoring coverage.
- `scripts/verify-reconciler-animated-bindings.mjs` currently covers generic
  style SharedValue paths plus transform/matrix/layer cases, but no focused
  style corner-radius SharedValue number, SharedValue<SkPoint>, or animated
  `{ x, y }` leaf cases.

## Commands run

All Node/npm checks used:

```sh
PATH=/Users/user/.nvm/versions/node/v26.1.0/bin:$PATH
```

- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- `git diff --check`: passed before writing this report.
- `npm run check:package-typescript-consumer`: passed and reported whole
  `style.matrix` SharedValue 9-/16-value arrays plus nested matrix entry
  rejection.
- `npm run check:reconciler-animated-bindings`: passed and reported whole
  `style.matrix` SharedValue listener/update/cleanup coverage plus explicit
  nested-matrix rejection.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:feasible-matrix`: passed 28/28 in `4m 12s`.

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

These remain local environment/toolchain blockers, not repo verification
failures.

## Next target recommendation

Assign Worker 171 to dynamic style corner-radius public/Reconciler proof.

Rationale:

- `src/jsx.ts` intentionally exposes richer public corner-radius style
  authoring for `borderBottomLeftRadius`, `borderBottomRightRadius`,
  `borderTopLeftRadius`, and `borderTopRightRadius`: static numbers, static
  `SkPoint` values, whole `SharedValue<number>`, whole `SharedValue<SkPoint>`,
  and `{ x, y }` objects whose leaves can be `SharedValue<number>`.
- `src/Reconciler.ts` has explicit validation/error text for these corner
  radius value shapes, which makes this a source-confirmed public/Reconciler
  contract rather than speculative coverage.
- Current packed-consumer coverage does not focus on these public dynamic
  style shapes.
- Current Reconciler animated-binding coverage does not prove listener keys,
  initial snapshots, updates, full style rebuild, cleanup, and error behavior
  for corner-radius point leaves or whole point SharedValues.
- This target does not duplicate Worker 161 materialized matrix/transform
  proof, Worker 163 host-native transform render/hit-test proof, Worker 165
  transform public/Reconciler proof, Worker 167 transform drift proof, or Worker
  169 matrix public/Reconciler proof.

Recommended Worker 171 scope:

- Extend `check:package-typescript-consumer` with packed-consumer fixtures for
  static and dynamic `borderTopLeftRadius` or another representative
  SkPoint-capable corner key:
  - `SharedValue<number>`
  - `SharedValue<SkPoint>`
  - `{ x: SharedValue<number>, y: SharedValue<number> }`
  - a representative invalid point leaf rejected with `@ts-expect-error`
- Extend `check:reconciler-animated-bindings` with source-level corner-radius
  style delivery cases:
  - nested `{ x, y }` SharedValue leaves using stable listener keys
  - whole `SharedValue<SkPoint>` snapshots and updates
  - initial snapshot, `runOnJS` update, full style rebuild, invalidation,
    cleanup, ignored late emits, and no native mirror
  - explicit invalid shape/error assertions for unsupported values
- Rerun `check:yoganode-nitro-materialization` as adjacent native style
  evidence if useful, without claiming platform runtime behavior.

## Proof boundary and overclaim risks

Accepted after Worker 169:

- Public packed TypeScript whole `style.matrix` `SharedValue` authoring for
  representative 9- and 16-value matrix arrays.
- Packed public TypeScript rejection of nested `SharedValue<number>` matrix
  entries.
- Node VM source-level Reconciler delivery for whole `style.matrix`
  SharedValues.
- Node VM source-level Reconciler rejection of nested matrix SharedValue
  entries with the existing explicit error.

Not proven:

- Actual React Native bridge delivery.
- Nitro registry install in a React Native runtime.
- Platform app runtime, iOS/Android build/run, simulator/device behavior, or
  native presentation.
- UI-runtime Worklets execution, real Reanimated delivery, RNGH delivery, or
  transformed gesture delivery.
- Exact matrix render/hit-test fidelity beyond existing adjacent native checks.

Future corner-radius proof should keep the same boundary: public packed
TypeScript and Node VM Reconciler source-level evidence only unless a separate
native/platform harness is added.

## Cleanup status

- Report-only scope was preserved.
- Product source, verifier scripts, generated files, package metadata, docs,
  and examples were not edited by this recovery audit.
- The feasible matrix removed its generated `tsconfig.tsbuildinfo` artifact and
  its matrix-owned temp parent.
- The stalled managed Worker 170 agent was closed before orchestration
  continued recovery work.
- Before this report was written, the worktree was clean.
- After this report, the only intended tracked change is
  `worker-progress/worker-170-post-169-root-cause-audit.md`.

## Recommended next tasks

- Launch Worker 171 for dynamic style corner-radius public/Reconciler proof.
- Keep platform-native app build/run and real RN/Nitro/Reanimated/RNGH runtime
  proof blocked until the local toolchain prerequisites change.

Goal finished.
