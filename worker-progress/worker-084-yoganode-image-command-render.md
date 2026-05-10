# Worker 084 - YogaNode ImageCmd command/render verification

## Scope And Files Changed

- Extended `scripts/verify-yoganode-native-commands-render.mjs`.
- Added this report: `worker-progress/worker-084-yoganode-image-command-render.md`.
- Did not edit `package.json` or `scripts/verify-feasible-matrix.mjs`; the existing matrix command was expanded in place.
- No product C++ behavior change was made.

## Required Context Read

- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-080-yoganode-native-commands-render.md`
- `worker-progress/worker-082-yoganode-more-native-commands-render.md`
- `worker-progress/worker-083-post-082-root-cause-audit.md`
- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verifier-temp-utils.mjs`
- Native command/render sources:
  - `cpp/YogaNode.hpp`
  - `cpp/YogaNode.cpp`
  - `cpp/NodeCommand.hpp`
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `cpp/JSIConverter+SkImage.hpp`
  - `cpp/PlatformContextAccessor.hpp`
  - `cpp/PlatformContextAccessor.cpp`
  - RN Skia `JsiSkImage` and recorder drawing/fit headers under `node_modules/@shopify/react-native-skia/cpp`
- JS/spec surfaces:
  - `src/Reconciler.ts`
  - `src/specs/commands.ts`
  - `src/specs/SkiaYoga.nitro.ts`

## Current Gap Proof

Before editing, the current verifier covered real geometry/filter/path command classes but not `ImageCmd`:

- `rg -n "dynamic_cast<margelo::nitro::RNSkiaYoga::.*Cmd|command\\.setProperty\\(runtime, \\\"type\\\"|rendered real|Proof boundary|text/paragraph/image" scripts/verify-yoganode-native-commands-render.mjs` showed command builders and `dynamic_cast` assertions only for `rect`, `group`, `points`, `line`, `oval`, `circle`, `rrect`, `blurMaskFilter`, and `path`.
- The same pre-edit verifier output said it rendered `RectCmd`, `GroupCmd`, `PointsCmd`, `LineCmd`, `OvalCmd`, `CircleCmd`, `RRectCmd`, `BlurMaskFilterCmd`, and `PathCmd`, and explicitly excluded `text/paragraph/image command fidelity`.
- `rg -n "ImageCmd|NodeCommandKind::IMAGE|image" ...` showed the repo already had the native `ImageCmd` class, the `NodeCommandKind::IMAGE` converter branch, `JSIConverter<sk_sp<SkImage>>`, and JS/spec `image` command surfaces. The gap was verification coverage, not absence of product code.
- Baseline `npm run check:yoganode-native-commands-render` passed before the edit with the pre-existing geometry/filter/path proof boundary only.

Rejected hypotheses:

- Worker 080/082 coverage already proved image rendering: rejected; their verifier output and `rg` evidence excluded `ImageCmd`.
- A plain JS `image` object can count as image coverage: rejected; `JSIConverter<sk_sp<SkImage>>` requires a `RNSkia::JsiSkImage` host object or null.
- Asset loading or decoding should be bundled into this verifier: rejected; this check uses only an in-memory synthetic `SkImage`.
- Exact scaled image pixels are safe with default linear sampling: rejected as brittle; the added payload passes nearest sampling for deterministic scaled quadrant samples.
- A nonzero child image is the best layout assertion: rejected because `YogaNode::drawInternal()` translates by layout offset while `ImageCmd::setLayout()` also stores layout left/top in `props.rect`; this verifier uses a zero-offset root image node.

## Implementation Details

The existing `check:yoganode-native-commands-render` verifier now adds a bounded real image command path:

- `makeQuadrantImage()` creates a deterministic 4x4 raster `SkImage` in memory with red, green, blue, and yellow quadrants.
- `imageCommand()` wraps that image in a real `RNSkia::JsiSkImage` host object via `jsi::Object::createFromHostObject(...)`, sets `fit: "fill"`, and passes nearest sampling.
- The command payload is converted through the existing `convertCommand()` helper, which calls `JSIConverter<NodeCommand>::fromJSI(...)`; the image field then flows through `JSIConverter<sk_sp<SkImage>>::fromJSI(...)`.
- `assertImageHostObjectCommandRender()` installs the converted command with real `YogaNode::setCommand()`, asserts `_commandKind == IMAGE`, asserts the installed real `ImageCmd` via `dynamic_cast`, and verifies the converted image is non-null with 4x4 dimensions.
- Rendering uses `YogaNode::renderToContext()` onto a 12x12 raster `SkSurface`.
- The test asserts Yoga/layout-derived image bounds for an 8x8 root and samples stable quadrant pixels at interior points plus transparent pixels outside the layout.
- `assertConverterErrorImage()` adds a negative assertion that a plain JS object in `data.image` fails during `NodeCommand` conversion with an image-scoped `JSError`.

Proof boundary:

- Proven: host-native macOS C++ compile/link for the updated command-render probe; synthetic in-memory raster `SkImage`; real `RNSkia::JsiSkImage` host-object image payload; `JSIConverter<NodeCommand>::fromJSI(...)`; `YogaNode::setCommand()`; real `ImageCmd` type installation; `YogaNode::renderToContext()` raster behavior for `fit: "fill"` with nearest sampling and bounded pixels.
- Still not proven: image decoding, local/remote/Expo asset loading, `useImage`, texture-backed images, all image fit modes, text/paragraph fidelity, Nitro `toObject()` / prototype materialization, dynamic Worklets-backed `AnimatedDouble`, UI-runtime Worklets execution, RNGH native delivery, iOS/Android app build/run, simulator/device launch, or native platform surface presentation.

## Verification Commands And Results

Gap/baseline:

- `rg -n "dynamic_cast<margelo::nitro::RNSkiaYoga::.*Cmd|command\\.setProperty\\(runtime, \\\"type\\\"|rendered real|Proof boundary|text/paragraph/image" scripts/verify-yoganode-native-commands-render.mjs`: showed no `ImageCmd` builder/assertion before the edit.
- `rg -n "ImageCmd|NodeCommandKind::IMAGE|image" scripts/verify-yoganode-native-commands-render.mjs cpp/YogaNode.hpp cpp/YogaNode.cpp cpp/JSIConverter+NodeCommand.hpp cpp/JSIConverter+SkImage.hpp src/specs/commands.ts src/Reconciler.ts src/specs/SkiaYoga.nitro.ts`: showed native and JS/spec image support existed while the verifier excluded image coverage.
- Baseline `npm run check:yoganode-native-commands-render`: passed before the edit with the old proof boundary excluding image command fidelity.

Syntax and focused checks:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `node --check scripts/verify-feasible-matrix.mjs`: passed.
- `npm run check:yoganode-native-commands-render`: passed after the edit; output now includes real `ImageCmd` rendering and real `JsiSkImage` host-object image conversion/rendering.

Affected host-native checks:

- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:yoganode-jsi-raw-methods`: passed.
- `npm run check:rnsk-yoga-view-runtime`: passed.

Aggregate matrix and diff:

- `npm run check:feasible-matrix`: passed.
- Matrix size: 26 commands.
- Updated existing entry: `[17/26] npm run check:yoganode-native-commands-render`, passed in `27.8s`.
- Total matrix duration: `3m 58s`.
- Matrix cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining new tracked artifacts, and removed matrix temp parent `/tmp/rnskia-feasible-matrix-1f9KDw`.
- `git diff --check`: passed before and after the matrix run.

## Matrix Update

- `package.json` was not edited.
- `scripts/verify-feasible-matrix.mjs` was not edited.
- The existing `check:yoganode-native-commands-render` matrix entry now covers real `ImageCmd` in addition to worker 080/082 command classes.
- The full 26-command matrix passed after the verifier expansion.

## Nested Challenger Documentation

- Nested challenger: `/root/imagecmd_challenger`.
- Prompt:

```text
Read-only challenger for worker 084 in /Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-084-yoganode-image-command-render. Do not edit files. Inspect the repo enough to challenge the implementation plan for adding bounded host-native ImageCmd command/render verification to scripts/verify-yoganode-native-commands-render.mjs. Focus on: how to construct a tiny deterministic SkImage in memory; how to wrap it in a real RNSkia::JsiSkImage host object; required headers/sources/linkage; exact ImageCmd payload fields and fit mode options; whether ImageCmd::setLayout/render behavior makes fill or none stable; how to add a plain-JS image negative assertion; and overclaims to avoid. Return concise findings with source references and any pitfalls. Do not claim test acceptance evidence unless you actually run a bounded check; prefer no long verification commands.
```

- Result: completed.
- Challenger findings:
  - Recommended a deterministic raster `SkImage` made from a tiny `SkSurface`.
  - Confirmed the `image` payload shape is `type: "image"` and `data: { fit?, image?, sampling? }`.
  - Confirmed valid fit strings and recommended `fit: "fill"` as the safest bounded render check.
  - Warned that nonzero-offset image nodes may be risky because image layout left/top can be applied both by `drawInternal()` translation and `ImageCmd::setLayout()`.
  - Recommended nearest sampling for scaled color-boundary assertions.
  - Recommended a plain-JS image negative assertion and warned not to use `null` as that negative case.
  - Warned against claiming asset decoding, `useImage`, platform image providers, texture-backed images, iOS/Android presentation, or all fit modes.
- Acceptance evidence from challenger: none claimed. It was read-only and did not run the verifier.
- Closure evidence: `close_agent /root/imagecmd_challenger` returned the completed result; final `list_agents` showed only `/root`.

## Cleanup And Status Evidence

Cleanup/status probes before report creation:

- `git status --short --ignored=matching`:
  - `M scripts/verify-yoganode-native-commands-render.mjs`
  - `!! example/node_modules`
  - `!! node_modules`
- `find /tmp /private/tmp -maxdepth 1 \( -name 'rnskia-yoganode-commands-render-*' -o -name 'rnskia-feasible-matrix-*' -o -name 'rnskia-yoganode-hit-testing-*' -o -name 'rnskia-yoganode-jsi-raw-methods-*' -o -name 'rnskia-rnsk-yoga-view-runtime-*' \) -print`: no output.
- `find . -maxdepth 1 -name '*.tgz' -print`: no output.
- `find . example -maxdepth 1 \( -name 'tsconfig.tsbuildinfo' -o -name '*.tsbuildinfo' \) -print`: no output.
- `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: no output.
- Process-table probe excluding itself for active `node .*verify-`, `clang++`, verifier binaries, `lldb`, and `debugserver`: no output.

Final cleanup/status probes after report creation:

- `git diff --check`: passed.
- `git status --short --ignored=matching`:
  - `M scripts/verify-yoganode-native-commands-render.mjs`
  - `?? worker-progress/worker-084-yoganode-image-command-render.md`
  - `!! example/node_modules`
  - `!! node_modules`
- `find /tmp /private/tmp -maxdepth 1 \( -name 'rnskia-yoganode-commands-render-*' -o -name 'rnskia-feasible-matrix-*' -o -name 'rnskia-yoganode-hit-testing-*' -o -name 'rnskia-yoganode-jsi-raw-methods-*' -o -name 'rnskia-rnsk-yoga-view-runtime-*' \) -print`: no output.
- `find . -maxdepth 1 -name '*.tgz' -print`: no output.
- `find . example -maxdepth 1 \( -name 'tsconfig.tsbuildinfo' -o -name '*.tsbuildinfo' \) -print`: no output.
- `find . -maxdepth 3 \( -name '*build-info*' -o -name '*.buildinfo' -o -name '*.tsbuildinfo' \) -print`: no output.
- `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: no output.
- Process-table probe excluding itself for active `node .*verify-`, `clang++`, verifier binaries, `lldb`, and `debugserver`: no output.
- `list_agents`: only `/root` running.

No verifier-owned temp output, tarballs, build-info files, generated example native directories, or active verifier processes remained. Ignored `node_modules` and `example/node_modules` are pre-existing dependency trees and were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The verifier now covers real `ImageCmd` construction and raster output instead of fake commands or direct `_command` injection.
- Image coverage uses a real RN Skia `JsiSkImage` host object and a negative plain-JS payload assertion.
- Pixel checks are deterministic and bounded to one stable fit/sampling case.

Maintainability:

- Extending the existing verifier keeps command/render proof in one place.
- The new helpers mirror the existing command-builder/assertion style.
- No package or matrix wiring churn was needed.

Performance:

- The synthetic image is 4x4 and render surfaces are small.
- The expanded standalone verifier still passed in the same broad range as prior command-render checks; matrix command 17 passed in `27.8s`.

Security:

- Shell execution remains structured through existing `spawnSync` argument arrays.
- Probe inputs are fixed literals.
- The JSI runtime only receives fixed verifier-owned objects.
- Cleanup remains constrained to verifier-owned temp roots and matrix-owned temp parent accounting.
