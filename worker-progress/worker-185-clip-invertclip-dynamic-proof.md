# Worker 185 - Clip / InvertClip Dynamic Proof

## Summary

Implemented the dynamic top-level `style.clip` / `style.invertClip` public and
Reconciler proof selected by Worker 184.

During packed-consumer coverage, the first TypeScript run exposed a real public
type-boundary gap: `style.clip` accepted a `SharedValue` of the whole clip union,
but rejected exact member forms such as `SharedValue<SkRect>`,
`SharedValue<SkRRect>`, and `SharedValue<SkPath>` because Reanimated
`SharedValue` is invariant. Fixed that narrowly in `src/jsx.ts` by allowing
distributed union-member `SharedValue` forms only for `style.clip`.

Added packed package TypeScript coverage for dynamic clip rect/rrect/path
authoring and `style.invertClip: SharedValue<boolean>`, plus negative coverage
that `style.clip` still rejects `SharedValue<number>`.

Added Reconciler VM proof for top-level `style.clip` and `style.invertClip`
listeners across rect/rrect/path clip payloads, including initial snapshots,
updates, full style rebuilds, invalidation, cleanup, ignored late emits, and no
native command mirror.

## Changed files

- `src/jsx.ts`
  - Added `YogaAnimatedUnionStyleProp<T>`.
  - Scoped distributed union-member `SharedValue` support to `style.clip`.
- `scripts/verify-package-typescript-consumer.mjs`
  - Added public clip union extraction for `SkRect`, `SkRRect`, and `SkPath`.
  - Added packed-consumer positive cases for `style.clip` rect/rrect/path
    `SharedValue` forms and `style.invertClip: SharedValue<boolean>`.
  - Added packed-consumer negative coverage rejecting `style.clip:
    SharedValue<number>`.
- `scripts/verify-reconciler-animated-bindings.mjs`
  - Added rect/rrect/path `style.clip` cases with companion
    `style.invertClip` SharedValue coverage.
  - Asserted top-level listener keys only: `clip` and `invertClip`.
  - Asserted full style rebuilds, invalidation, listener cleanup, ignored late
    emits, and no `createSynchronizable` / `setBlocking` native command mirror.
- `worker-progress/worker-185-clip-invertclip-dynamic-proof.md`
  - Recorded this report.

## Commands run

- `git diff --check`: passed.
- `node --check scripts/verify-package-typescript-consumer.mjs`: passed.
- `node --check scripts/verify-reconciler-animated-bindings.mjs`: passed.
- First `npm run check:package-typescript-consumer`: failed before the type fix,
  proving the public `style.clip` union-member `SharedValue` gap.
- `npm run check:package-typescript-consumer`: passed after the fix.
- `npm run check:reconciler-animated-bindings`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 15s.

## Evidence gathered

- Worker 184 selected this target and documented the expected boundary:
  public packed TypeScript plus Node VM source-level Reconciler proof, not a
  platform runtime claim.
- `src/specs/style.ts` exposes `clip?: SkPathNative | SkRRectNative |
  SkRectNative` and `invertClip?: boolean`.
- `src/jsx.ts` now keeps ordinary style-key behavior while adding the missing
  distributed `SharedValue` support for `style.clip` union members. The fix is
  scoped to `style.clip`; `style.invertClip` still uses the ordinary scalar
  style path.
- Packed consumer coverage now proves an installed tarball accepts
  `SharedValue<SkRect>`, `SharedValue<SkRRect>`, `SharedValue<SkPath>`, and
  `SharedValue<boolean>` for `invertClip`, and rejects `SharedValue<number>`
  for `style.clip`.
- Reconciler coverage now proves rect/rrect/path `style.clip` payloads with
  companion `style.invertClip` register only top-level listener keys
  `clip` / `invertClip`, resolve initial values, update through `runOnJS`,
  rebuild full host styles, invalidate, clean up, ignore late emits, and avoid
  native command mirrors.
- `npm run check:reconciler-animated-bindings` output reports dynamic
  `style.clip` SharedValue listeners covering rect/rrect/path payloads with
  companion `style.invertClip: SharedValue<boolean>`.
- `npm run check:feasible-matrix` reran the updated packed consumer and
  Reconciler checks, then reran the existing lower-stack materialized
  `clip`/`invertClip` verifier as part of the full 28-command matrix.

## Proof boundary and overclaim risks

Proven:

- Public TypeScript authoring from a packed tarball for dynamic top-level
  `style.clip` rect/rrect/path `SharedValue` forms and
  `style.invertClip: SharedValue<boolean>`.
- Node VM source-level Reconciler behavior for top-level `style.clip` /
  `style.invertClip` JS style listeners.
- Reconciler listener lifecycle, snapshot resolution, update delivery,
  full-style rebuild, invalidation, cleanup, ignored late emits, and lack of
  native command mirror creation for the new dynamic source-level cases.

Not proven:

- Platform app runtime.
- React Native bridge delivery.
- Nitro registry installation inside a running React Native app.
- UI-runtime Worklets execution or real Reanimated SharedValue delivery.
- RNGH native delivery.
- Simulator/device launch or iOS/Android build/run.
- New native rendering, native conversion, hit-test, or raster fidelity beyond
  the already separate lower-stack materialized/native checks.

Overclaim risks:

- The Reconciler proof uses local VM stubs; it is not evidence of real UI
  scheduling or device/runtime delivery.
- The path clip payload in the Reconciler verifier is an opaque source-level
  placeholder; real native `SkPath` materialization remains owned by the
  existing Nitro/native materialization verifier.
- `src/Reconciler.ts` still does not treat `clip` as a nested style root; this
  work proves whole top-level `SharedValue` delivery, not nested
  `clip.x`/`clip.rect.rx` leaf listeners.

## Cleanup status

- No root checkout or other worktree was touched.
- `npm run check:feasible-matrix` removed its matrix-owned temp parent and
  removed generated `tsconfig.tsbuildinfo`.
- Preserved ambiguous ignored/local artifacts: `node_modules/` and
  `example/node_modules/`.
- Final status before report showed only the intentional tracked edits.

## Recommended next tasks

- Merge this branch after orchestrator review.
- Keep any stronger platform-native/Reanimated/UI-runtime claim as a separate
  task with a real runtime harness.

Goal finished.
