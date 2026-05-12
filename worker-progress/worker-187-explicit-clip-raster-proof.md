# Worker 187 - Explicit Clip Raster Proof

## Summary

Added bounded host-native raster proof for explicit `style.clip` rect, rrect,
and path rendering, plus `invertClip` rect rendering, in
`scripts/verify-yoganode-native-commands-render.mjs`.

The new cases use a `GroupCmd` parent and full-size `RectCmd` child. They
assert native explicit clip state and bounded raster pixels through
`YogaNode::renderToContext()`:

- Rect clip preserves an inside child pixel and clears pixels before/after the
  clip.
- RRect clip preserves a center child pixel and clears a rounded-corner pixel
  plus an outside pixel.
- Path clip preserves a circle-center child pixel and clears outside/path-edge
  pixels.
- `invertClip` rect clears the inside clip pixel and preserves outside child
  pixels.

No product/native source change was needed.

## Changed files

- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-187-explicit-clip-raster-proof.md`

## Commands run

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed
  with no output.
- `npm run check:yoganode-native-commands-render`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands in 4m 19s.

## Evidence gathered

- The updated native command/render verifier compiled and linked a host
  executable against real `YogaNode.cpp`, generated Nitro specs, React Native
  JSC, upstream Yoga, RN Skia macOS archives, Worklets shared-item sources, and
  helper sources.
- The executable rendered real `RectCmd`, `GroupCmd`, and the broader existing
  command set through `YogaNode::renderToContext()` onto raster `SkSurface`s.
- New explicit clip cases assert the parent is a `GroupCmd`, the child is a
  full-size `RectCmd`, implicit bounds/radius clipping is not active, and the
  correct `_clipRect`, `_clipRRect`, or `_clipPath` slot is populated.
- The rect, rrect, and path cases assert in-clip child pixels survive while
  out-of-clip pixels remain transparent.
- The `invertClip` rect case asserts `_style.invertClip=true`, an inside clip
  pixel is transparent, and outside clip pixels remain painted.
- The verifier output now states bounded explicit `style.clip`
  rect/rrect/path and `invertClip` rect raster coverage in its evidence and
  proof boundary lines.
- Existing lower-stack checks stayed green:
  `check:yoganode-native-hit-testing` still proves explicit clip/invert hit-test
  behavior, and `check:yoganode-nitro-materialization` still proves generated
  materialized clip/invert state delivery.
- The feasible matrix reran the updated command/render verifier and reported
  the new explicit clip raster proof in its `[17/28]` output.

## Proof boundary and overclaim risks

Proven:

- Host-native macOS C++ `YogaNode::renderToContext()` raster behavior for
  explicit `style.clip` rect, rrect, and path shapes using a `GroupCmd` parent
  and full-size `RectCmd` child.
- Host-native macOS C++ `invertClip` rect raster behavior using the same
  bounded harness pattern.
- Pixel-level assertions only at the selected coordinates named by the
  verifier.

Not proven:

- Platform app runtime, iOS/Android app build or launch, simulator/device
  presentation, React Native bridge delivery, Nitro registry install in a real
  React Native runtime, UI-runtime Worklets execution, real Reanimated
  delivery, RNGH native delivery, image loading, or exact render fidelity beyond
  the asserted host-raster pixels.
- Any broader exact path/rrect antialiasing or geometry fidelity beyond the
  selected in/out pixel assertions.

## Cleanup status

- Report and verifier scope only; no product/native source was edited.
- Ambiguous ignored/local artifacts such as `node_modules/`,
  `example/node_modules/`, `example/ios/`, `example/android`, `example/.expo`,
  `lib/`, `.DS_Store`, and `tsconfig.tsbuildinfo` were preserved unless a
  verifier owned cleanup.
- `npm run check:feasible-matrix` removed its matrix-owned temp parent
  `/tmp/rnskia-feasible-matrix-iQXGr3` and its newly created
  `tsconfig.tsbuildinfo`; it reported no remaining new tracked artifacts.

## Recommended next tasks

- Run a post-worker audit to confirm the new bounded render proof should be
  accepted as the next lower-stack explicit clip evidence.
- Keep platform-native app/runtime delivery, React Native bridge behavior, real
  Reanimated/UI-runtime delivery, and exact render-fidelity expansion as
  separate future tasks.

Goal finished.
