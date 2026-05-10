# Worker 096 - Public path.stroke Payload Contract

## Scope

Changed files:

- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+StrokeOpts.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-096-path-stroke-contract.md`

No product TypeScript/source changes were needed. The public JSX/Reconciler path already forwards `path.stroke`; the drift was in native conversion.

## Root Cause Evidence

- `src/jsx.ts:122` defines `YogaAnimatedStrokeOpts` over `keyof StrokeOpts`, and `src/jsx.ts:175` exposes `YogaPathProps.stroke?: YogaAnimatedStrokeOpts | YogaAnimatedProp<StrokeOpts>`.
- Installed RN Skia public `StrokeOpts` uses `miter_limit?: number` at `node_modules/@shopify/react-native-skia/src/skia/types/Path/Path.ts:11-21`.
- `src/Reconciler.ts:789-795` forwards `props.stroke` into the `path` command payload, and `src/specs/commands.ts:140-145` types that payload as `stroke?: StrokeOptsNative`.
- Before this change, `cpp/JSIConverter+NodeCommand.hpp` parsed path stroke miter only from `"miterLimit"`. The current diff replaces that direct read with a public-key-first alias helper at `cpp/JSIConverter+NodeCommand.hpp:44-55` and `:258-263`.
- RN Skia itself has both shapes in different layers: public `JsiSkPath::stroke()` reads `"miter_limit"` at `node_modules/@shopify/react-native-skia/cpp/api/JsiSkPath.h:297-300`, while the recorder converter reads `"miterLimit"` at `node_modules/@shopify/react-native-skia/cpp/api/recorder/Convertor.h:917-918`.

## Implementation

- `JSIConverter<NodeCommand>` now accepts public `stroke.miter_limit` for `path` commands.
- I preserved `miterLimit` as a compatibility alias. Precedence is deterministic: if `miter_limit` is present, it wins; otherwise `miterLimit` is used as fallback.
- `JSIConverter<RNSkia::StrokeOpts>` now parses `miter_limit` with the same alias fallback and serializes `RNSkia::StrokeOpts::miter_limit` back as public `miter_limit`, not private `miterLimit`.
- `JSIConverter<RNSkia::StrokeOpts>` now parses numeric public RN Skia enum payloads for `join` and `cap`, while also accepting the existing string spellings.
- The host-native command/render verifier now builds a real public-shaped `PathCmd` stroke payload with `width`, `miter_limit`, `precision`, numeric `join`, and numeric `cap`; asserts `NodeCommand` conversion; asserts real `YogaNode::setCommand()` installed a `PathCmd`; asserts converted `RNSkia::StrokeOpts` values on `PathCmd::props.stroke`; and renders bounded raster evidence through `PathCmd::draw()`.
- Added edge coverage for `miterLimit` alias precedence, non-object `stroke`, invalid `join`, and invalid `cap`.

## Proof Boundary

Proven:

- Public-shaped `path.stroke.miter_limit` is accepted by `JSIConverter<NodeCommand>::fromJSI(...)`.
- `stroke.width`, `stroke.miter_limit`, `stroke.precision`, `stroke.join`, and `stroke.cap` are preserved into `PathCommandData`.
- `YogaNode::setCommand()` installs a real `PathCmd` from that command.
- Converted stroke options reach `PathCmd::props.stroke`, and the real `PathCmd::draw()` renders bounded raster output in the host-native verifier.
- `miter_limit` wins over `miterLimit` when both are present; `miterLimit` remains accepted as an alias.
- `JSIConverter<RNSkia::StrokeOpts>::toJSI(...)` emits public `miter_limit`.

Not proven:

- Exact path/stroke geometry fidelity or full stroke outline semantics.
- Real React Native bridge delivery, Nitro module registry install, platform app runtime, iOS/Android build/run, simulator/device presentation, UI-runtime Worklets execution, Reanimated delivery, image asset loading/decoding, text/paragraph full fidelity, or full path/stroke fidelity.

## Verification

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `npm run check:yoganode-native-commands-render`: passed. The verifier compiled/linked the host-native C++ probe and printed the new public `path.stroke` coverage, including `miter_limit` parsing, alias precedence, `StrokeOpts` public `toJSI`, non-object stroke rejection, invalid join/cap rejection, and the explicit proof boundary.
- Native header syntax/source coverage: the command/render verifier compiled a host executable including real `YogaNode.cpp`, `JSIConverter+NodeCommand.hpp`, and `JSIConverter+StrokeOpts.hpp`.
- `npm run check:feasible-matrix`: passed all 28 commands. The matrix also reran `npm run check:yoganode-native-commands-render` successfully.

## Cleanup / Status

- `git status --short --branch` after cleanup showed only the expected modified source files before this report was added.
- Repository artifact probe produced no output for `*.tgz`, `tsconfig.tsbuildinfo`, matrix temp names, or command-render temp names under the worktree.
- `example/ios`, `example/android`, and `example/.expo` were absent.
- `/tmp` probe produced no `rnskia-feasible-matrix-*`, `rnskia-yoganode-commands-render-*`, `rnskia-package-*`, or `rnskia-example-*` roots.
- Active process probe produced no verifier/debug processes after excluding the probe itself.

## Nested Challenger

Nested explorer used: `/root/stroke_contract_explorer`.

Prompt summary: inspect the public `path.stroke` contract, confirm public TypeScript shape, native stroke parser behavior, `JSIConverter+StrokeOpts` serialization, compatibility/precedence recommendation, and verifier insertion points. No edits requested.

Result summary:

- Confirmed `src/jsx.ts` exposes RN Skia public `StrokeOpts`.
- Confirmed RN Skia public `StrokeOpts` uses `miter_limit`.
- Confirmed current native path stroke parser only read `miterLimit`.
- Confirmed `JSIConverter+StrokeOpts` serialized `miterLimit`.
- Recommended keeping `miterLimit` as fallback alias with public `miter_limit` precedence.
- Identified `pathCommand()` / `assertPathHostObjectCommandRender()` as the right verifier insertion point.

Acceptance evidence claimed by nested explorer: none. It was read-only and did not run broad tests.

## Quality Review

- Maintainability: the alias helper keeps public-vs-compat precedence local and explicit. The verifier names the exact public fields under test.
- Performance: added conversion checks are constant-time property reads; no broad retry behavior or extra runtime loops were introduced.
- Security: no dynamic eval, shell interpolation, network access, or file-system expansion was added. Invalid payloads still fail locally with scoped conversion errors.
- Compatibility: public `miter_limit` is canonical, while existing `miterLimit` payloads continue to work unless the public key is also present, in which case the public key deterministically wins.
