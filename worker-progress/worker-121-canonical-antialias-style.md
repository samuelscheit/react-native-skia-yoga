# Worker 121: Canonical AntiAlias Style

## Summary

Canonicalized the public Skia paint antialias style prop to `antiAlias` while preserving the misspelled `antiaAlias` as a deprecated legacy alias. `YogaNode::setStyle(...)` now gives `antiAlias` precedence when both keys are present and applies the resolved value after `backgroundColor` materialization so a `SkPaint` background cannot override the explicit style anti-alias flag.

## Files Changed

- `src/specs/style.ts`
- `nitrogen/generated/shared/c++/NodeStyle.hpp`
- `cpp/YogaNode.cpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-yoganode-nitro-materialization.mjs`
- `example/app/(tabs)/styles/paint-demos.tsx`
- `worker-progress/worker-121-canonical-antialias-style.md`

## Implementation Details

- Added `antiAlias?: boolean` to public `NodeStyle` and kept `antiaAlias?: boolean` with a deprecation note.
- Regenerated Nitro output with `bun run specs`; generated `NodeStyle` now carries both `antiAlias` and `antiaAlias`, and the generated JSI converter reads/writes both keys.
- Updated `YogaNode::setStyle(...)` to resolve `style.antiAlias` first and fall back to `style.antiaAlias`.
- Moved anti-alias application after `backgroundColor` handling so explicit `antiAlias` also wins over a supplied `SkPaint` background paint state.
- Updated example paint demo public authoring from `antiaAlias` to `antiAlias`.
- Extended packed consumer TypeScript coverage for inline `style={{ antiAlias: false }}` and kept a `YogaNodeStyle` legacy alias typecheck fixture.
- Extended host-native command/render coverage for generated `NodeStyle` JSI transport, canonical SkPaint state, legacy alias fallback, canonical precedence, and the `SkPaint` background override order.
- Extended Nitro materialization coverage so generated JS-facing `setStyle(width/height/antiAlias)` reaches native `NodeStyle` and updates `SkPaint`.

## Verification

All required verification passed:

- `bun run specs`
- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `node --check scripts/verify-yoganode-nitro-materialization.mjs`
- `npm run check:package-typescript-consumer`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:feasible-matrix`
- `git diff --check`

Additional matrix evidence from the final `npm run check:feasible-matrix` run:

- 28/28 matrix commands passed.
- The matrix reran `npm run check:package-typescript-consumer` and confirmed packed consumer canonical `style.antiAlias` authoring plus legacy `style.antiaAlias` type compatibility.
- The matrix reran `npm run check:yoganode-native-commands-render` and confirmed generated `NodeStyle` transport plus host-native SkPaint anti-alias state for canonical, legacy fallback, precedence, and `SkPaint` background ordering.
- The matrix reran `npm run check:yoganode-nitro-materialization` and confirmed generated `setStyle(width/height/antiAlias)` delivery to native style and SkPaint state.
- The matrix reran `bun run specs`, `npm run typecheck`, and `cd example && bun run typecheck`.

## Proof Boundary

Proven:

- Public packed TypeScript consumers can author canonical `style={{ antiAlias: false }}`.
- Legacy `antiaAlias` still typechecks as a deprecated `YogaNodeStyle` key.
- Generated C++ `NodeStyle` transports both `antiAlias` and `antiaAlias`.
- Host-native `YogaNode::setStyle(...)` applies canonical `antiAlias` to `SkPaint::setAntiAlias(...)`.
- Legacy `antiaAlias` falls back when `antiAlias` is absent.
- Canonical `antiAlias` wins when both fields are present.
- Canonical `antiAlias` is applied after `backgroundColor` `SkPaint` assignment.
- Generated Nitro materialized `setStyle(...)` can deliver canonical `antiAlias` to native state.

Not claimed:

- Exact pixel/render fidelity.
- iOS or Android app build/run, simulator/device launch, or native platform presentation.
- React Native bridge delivery or Nitro module registry install inside an app runtime.
- UI-runtime Worklets execution or Reanimated SharedValue delivery.
- Image asset loading/decoding or broader paint-style parity beyond the anti-alias flag.

## Risks And Follow-Up

- The legacy `antiaAlias` alias remains part of the generated/public type surface to preserve compatibility. It is marked deprecated in the source spec, but generated C++ does not carry that deprecation metadata.
- Other paint fields such as `dither` still have their pre-existing ordering relative to `backgroundColor`; this worker only changed and proved anti-alias behavior.

## Cleanup And Status

Final `git status --short --ignored`:

```text
 M cpp/YogaNode.cpp
 M example/app/(tabs)/styles/paint-demos.tsx
 M nitrogen/generated/shared/c++/NodeStyle.hpp
 M scripts/verify-package-typescript-consumer.mjs
 M scripts/verify-yoganode-native-commands-render.mjs
 M scripts/verify-yoganode-nitro-materialization.mjs
 M src/specs/style.ts
?? worker-progress/worker-121-canonical-antialias-style.md
!! example/node_modules
!! node_modules
```

Ignored dependency directories `node_modules` and `example/node_modules` were pre-existing/local and left untouched. The feasible matrix removed its own temporary roots and generated `tsconfig.tsbuildinfo` cleanup target.

Goal finished.
