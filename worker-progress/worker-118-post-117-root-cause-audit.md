# Worker 118 - Post-117 Root-Cause Audit

## Summary

This was a read-only audit of the post-worker-117 state. I changed only this report:

- `worker-progress/worker-118-post-117-root-cause-audit.md`

No product source, verifier script, package metadata, generated Nitro output, README, master planning/progress file, dependency tree, or prior worker report was edited.

The post-worker-117 baseline is green in this worktree. `git diff --check` passed, and `npm run check:feasible-matrix` passed all 28 accepted local commands in 3m 58s.

Worker 117's accepted proof boundary is reflected in the current source and verifiers:

- `src/jsx.ts` keeps `SamplingOptions` opaque and explicitly widens `YogaImageProps.sampling` to accept `SharedValue<SamplingOptions>`.
- `scripts/verify-package-typescript-consumer.mjs` proves packed consumers can author whole `SharedValue<SamplingOptions>` for `image.sampling`.
- The same packed-consumer verifier keeps nested `sampling={{ filter: sharedFilter }}` rejected.
- `scripts/verify-reconciler-animated-bindings.mjs` covers the top-level opaque `image.sampling` JS listener path.
- Lowercase intrinsic typing is owned by the documented JSX runtime contract, not by a global JSX augmentation.

Recommended next target: add bounded value-bearing `toJSI(...)` serialization for `SkSamplingOptions`, `skia::textlayout::TextStyle`, and `skia::textlayout::ParagraphStyle`, with host-JSC/native verifier coverage for selected stable fields. This is now the strongest locally unblocked root-cause target because worker 117 closed the stronger public `image.sampling` type mismatch, while these three converters still parse meaningful JS values but serialize empty objects.

Nested delegated check: a read-only challenger agent independently ranked the same converter serialization target first and was closed after completion. It claimed no acceptance evidence.

## Baseline Verification

Repository context:

- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-118-post-117-root-cause-audit`
- Branch: `worker/118-post-117-root-cause-audit`
- HEAD: `a4dba75 Accept worker 117 and update next audit`

Required verification:

- `git diff --check`: passed before report writing.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: 3m 58s.
  - Matrix temp parent: `/tmp/rnskia-feasible-matrix-1CGQQd`.
  - Cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Cleanup removed the matrix temp parent.
  - Remaining new tracked artifacts after cleanup: none.

Notable matrix evidence:

- `check:package-typescript-consumer` passed and reported packed consumer coverage for `image.sampling` plus rejection of unsupported nested sampling SharedValue leaves.
- `check:reconciler-animated-bindings` passed and reported JS listener coverage for top-level opaque `image.sampling`.
- `check:yoganode-native-commands-render` passed and still states that value-exact `paragraphStyle`, `textStyle`, and `sampling` serialization is outside the current proof boundary.
- `check:yoganode-nitro-materialization`, `check:rnsk-yoga-view-runtime`, host-native command/render checks, package/codegen/autolinking checks, example bundle export, and temp-workspace example native generation all passed within their documented local proof boundaries.

Platform-native build/run gap remains separate and locally blocked:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `command -v pod`: no output.
- `command -v java`: `/usr/bin/java`, but `java -version` failed with no Java runtime installed.
- `command -v adb`, `cmake`, `ninja`, and `gradle`: no output.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: empty.

The feasible matrix proof boundary remains local package/source/example metadata, Node VM harnesses, host-JSC/native probes, generated native scaffolding checks, and synthetic in-memory Skia render/converter checks. It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, real Reanimated delivery, actual RN bridge delivery, RNGH native delivery, Nitro registry install inside a running app, real image asset loading/decoding, texture-backed image behavior, or exact render/typography fidelity.

## Worker 117 Acceptance Check

Accepted source boundary:

- `src/jsx.ts` imports `SamplingOptions` and `SharedValue`.
- `SamplingOptions` remains in `YogaOpaqueValue`, so nested sampling leaves are not part of the typed public contract.
- `YogaDeepAnimated<T>` is still distributive, but `YogaImageProps.sampling` is specifically widened to `YogaDeepAnimated<SamplingOptions> | SharedValue<SamplingOptions>`.
- `commandPropKeys.image` in `src/Reconciler.ts` includes `sampling`.
- `bindAnimatedValues(...)` checks top-level `SharedValue` before nested traversal, so a whole `SharedValue<SamplingOptions>` is covered by the JS listener path.
- `commandNestedRoots` does not include `sampling`, which is consistent with keeping `SamplingOptions` opaque and not supporting nested sampling SharedValue leaves.

Accepted verifier boundary:

- `scripts/verify-package-typescript-consumer.mjs` declares `sharedSampling: SharedValue<SamplingOptions>` and compiles `<image sampling={sharedSampling} />` from an installed packed package.
- The same verifier declares a negative `YogaIntrinsicElements["image"]` fixture with `sampling: { filter: sharedSamplingFilter }` under `@ts-expect-error`, preserving rejection of nested sampling leaves.
- The packed consumer output reports the supported dynamic JSX set including `image.sampling`, and reports that nested `image.sampling` SharedValue leaves remain rejected while sampling stays opaque.
- `scripts/verify-reconciler-animated-bindings.mjs` includes a table-driven case for `image.sampling` described as `top-level opaque image.sampling command prop`; it checks listener registration under `sampling`, command rebuild on update, invalidation, cleanup, and no post-cleanup updates.

Accepted JSX runtime boundary:

- README documents `jsxImportSource: "react-native-skia-yoga"` for lowercase intrinsic nodes.
- `src/jsx-runtime.ts`, `src/jsx-dev-runtime.ts`, `jsx-runtime.d.ts`, and `jsx-dev-runtime.d.ts` own `export namespace JSX`.
- `src/jsx.ts` no longer declares a global JSX or React JSX augmentation.
- This keeps worker 117's fix from reintroducing duplicate global intrinsic declaration drift.

## Candidate Targets Ranked

1. Bounded value-bearing `toJSI(...)` for `SkSamplingOptions`, `TextStyle`, and `ParagraphStyle`.

Classification: locally unblocked product-source converter target.

Root-cause value: highest remaining local target. These converters currently parse meaningful JS payloads but serialize empty objects:

- `cpp/JSIConverter+SkSamplingOptions.hpp`: `fromJSI(...)` delegates to RN Skia `SamplingOptionsFromValue(...)`; `toJSI(...)` ignores `arg` and returns `jsi::Object(runtime)`.
- `cpp/JSIConverter+SkTextStyle.hpp`: `fromJSI(...)` applies many text-style fields, including Yoga's CSS string color support; `toJSI(...)` ignores `arg` and returns an empty object.
- `cpp/JSIConverter+SkParagraphStyle.hpp`: `fromJSI(...)` reads RN Skia paragraph style values and applies flattened text-style fields; `toJSI(...)` ignores `arg` and returns an empty object.
- `JSIConverter<NodeCommand>::toJSI(...)` now emits `image.sampling`, `text.textStyle`, and `paragraph.paragraphStyle` fields, but those fields only have object-presence proof because the nested converters are empty-object serializers.

Expected verification shape:

- Extend `scripts/verify-yoganode-native-commands-render.mjs` with direct host-JSC/native assertions for selected stable fields.
- For sampling, cover both public shapes: filter/mipmap and cubic B/C, using Skia's `useCubic`, `cubic`, `filter`, and `mipmap` fields.
- For text style, cover a bounded stable subset such as `fontSize`, numeric `color`, font families, height/height override, letter spacing, word spacing, and locale where getters are stable.
- For paragraph style, cover selected paragraph controls such as `textAlign`, `maxLines`, `heightMultiplier`, `ellipsis` where defensible, plus the flattened/default text style already used by this package.
- Add selected `toJSI(...) -> fromJSI(...)` round trips for the chosen fields.
- Keep broad or lossy fields out of scope unless the implementation can prove a stable public shape.

Likely files:

- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- Next worker report

2. Exported `YogaDeepAnimated<T>` union-helper caveat.

Classification: locally unblocked type/API investigation, but lower value than candidate 1.

Root-cause value: medium. Worker 117 fixed the concrete authored prop, `YogaImageProps.sampling`, but the exported helper `YogaDeepAnimated<SamplingOptions>` remains distributive as a generic helper. A broad non-distributive rewrite was already probed by worker 117 and regressed worker-110 style cases such as `path.stroke.miter_limit: SharedValue<number>`.

Expected verification shape:

- Add focused type probes only if the project decides `YogaDeepAnimated<T>` itself should promise whole-union `SharedValue<T>` support for arbitrary unions.
- Preserve worker-110 dynamic JSX cases and optional nested leaves.
- Avoid changing the helper for one type if that only obscures the API boundary already solved on `YogaImageProps.sampling`.

Likely files:

- `src/jsx.ts`
- `scripts/verify-package-typescript-consumer.mjs`
- Possibly example typecheck fixtures

3. Worker 117 global JSX augmentation removal follow-up.

Classification: not recommended unless undocumented global intrinsic support becomes an explicit product goal.

Root-cause value: low right now. The documented contract is `jsxImportSource`, the example uses it, the packed consumer uses it, and package runtime subpaths export the JSX namespace. Restoring global augmentation risks reintroducing the duplicate declaration drift that worker 117 removed.

Expected verification shape if product goals change:

- Define an explicit no-`jsxImportSource` public contract first.
- Prove no duplicate global declaration conflicts when intrinsic prop shapes evolve.
- Preserve the current `jsxImportSource` packed-consumer path.

4. Nested `image.sampling.filter` / `sampling.mipmap` SharedValue leaves.

Classification: locally testable but not a substantiated public contract bug.

Root-cause value: low. `SamplingOptions` is intentionally opaque in `src/jsx.ts`, and the packed-consumer verifier explicitly rejects nested sampling leaves. Adding runtime traversal by putting `sampling` into `commandNestedRoots` would expose an untyped JavaScript affordance rather than close a supported public type mismatch.

Expected verification shape if intentionally adopted later:

- First change the public type contract to allow nested sampling leaves.
- Then add `sampling` to `commandNestedRoots`.
- Add packed-consumer positive and Reconciler JS listener coverage for nested sampling fields.

5. Actual React/Reconciler-to-native bridge delivery and Nitro registry install inside a real app.

Classification: high value but blocked locally for honest proof.

Root-cause value: high. Current source-level and host-native checks cover many pieces independently, but they still do not prove a real React Native bridge delivers commands into native conversion inside an app process, nor that `SkiaYoga.install()` is registered in a running RN app.

Local blockers remain full Xcode/CocoaPods/Java/Android SDK/ADB/CMake/Ninja/Gradle.

6. UI-runtime Worklets execution and real Reanimated SharedValue delivery.

Classification: high value but blocked locally for honest proof.

Root-cause value: high. Current evidence includes Babel transform guards, Node VM listener checks, host-JSC Synchronizable extraction, and selected host-native dynamic `AnimatedDouble` command/render probes. None of those prove UI-runtime Worklets execution or real Reanimated delivery.

7. Real image asset loading/decoding and texture-backed image behavior.

Classification: blocked or overclaim-prone locally.

Root-cause value: medium-high for user-visible behavior. Existing host-native tests use synthetic in-memory `SkImage`/`JsiSkImage` objects and prove fit/default/invalid behavior, but they do not prove React Native/Expo asset resolution, `useImage`, local/remote decoding, texture-backed behavior, or platform presentation.

8. Exact render fidelity, typography, glyph geometry, font fallback, paragraph shaping, and path/stroke geometry.

Classification: partially sliceable locally but broad and overclaim-prone.

Root-cause value: lower for the next slot. Existing command/render coverage already includes bounded path/stroke, dynamic path trim, CSS color strings, paragraph measurement, and representative raster/state checks. Exact fidelity needs much tighter fixtures, stable fonts/backends, or platform runtime proof.

## Recommended Next Target

Select exactly one next implementation target:

> Add bounded value-bearing `toJSI(...)` serialization for `SkSamplingOptions`, `skia::textlayout::TextStyle`, and `skia::textlayout::ParagraphStyle`.

Why it outranks alternatives:

- The source gap is concrete and currently present in three product converters.
- Worker 113 made `NodeCommand::toJSI(...)` broader, but explicitly left these nested value surfaces as object-presence only.
- Worker 117 closed the stronger public `image.sampling` type-boundary issue, so this converter asymmetry is now the clearest locally unblocked root-cause target.
- The existing host-native command/render verifier already compiles the right C++ surface, creates a JSC runtime, serializes representative commands, and can be expanded without platform-native tooling.
- It tightens real runtime/native serialization behavior rather than adding another audit-only report or a speculative public type expansion.

Expected implementation files:

- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- Next worker progress report

Expected verification commands:

- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization`
- `npm run check:feasible-matrix`
- `git diff --check`

Optional focused checks if the implementation touches TypeScript or docs unexpectedly:

- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:package-typescript-consumer`

## Proof Boundary And Risks

Recommended proof boundary:

- Prove host-JSC/native `toJSI(...)` serialization for selected stable sampling, text-style, and paragraph-style fields.
- Prove selected `toJSI(...) -> fromJSI(...)` round trips through the current converter path.
- Keep the proof local to converter serialization shape and representative value preservation.

Do not claim:

- Full `SamplingOptions` public API expansion beyond the currently supported RN Skia shapes.
- Full `TextStyle` or `ParagraphStyle` parity.
- Preservation of original CSS color strings; current `fromJSI(...)` normalizes strings into colors.
- Font fallback correctness, exact typography, paragraph shaping fidelity, glyph geometry, or exact render fidelity.
- Real React Native bridge delivery, Nitro registry install in an app, platform-native build/run, simulator/device launch, UI-runtime Worklets execution, Reanimated SharedValue delivery, RNGH native delivery, image asset loading/decoding, local/remote asset resolution, or texture-backed image behavior.

Implementation risks to manage:

- Only serialize fields with stable public JS shapes and stable Skia getters.
- Avoid making `canConvert(...)` broader than `fromJSI(...)` actually accepts.
- Avoid serializing private or unsupported Skia-only state as though it were part of the public package contract.
- Avoid overfitting pixel/render assertions when the target is converter serialization, not render fidelity.
- Keep CSS color-string coverage separate: incoming CSS strings can be tested as color-equivalent numeric output, not string round-trip.

Nested challenger result:

- The delegated read-only challenger ranked bounded value-bearing `toJSI(...)` first.
- It ranked a post-worker-117 JSX/global-boundary follow-up lower because the README and verifiers document `jsxImportSource`.
- It kept native bridge/platform and UI-runtime Worklets gaps separate as blocked for honest local proof.
- It claimed no acceptance evidence because it performed read-only inspection only.

## Cleanup And Status

Final pre-report cleanup/status evidence:

- `git status --short --ignored` before writing this report showed only ignored dependency trees:
  - `!! example/node_modules`
  - `!! node_modules`
- `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: no output.
- `find /tmp /private/tmp -maxdepth 1 \( -name 'rnskia-*' -o -name 'rnskia.*' \) -print`: no output.
- Active process scan for verifier scripts, feasible matrix, `clang++`, `xcodebuild`, `gradle`, `adb`, `lldb`, `debugserver`, and Metro: no output.
- Nested challenger agent was closed after its completed result.

Expected status after this report is written:

- `?? worker-progress/worker-118-post-117-root-cause-audit.md`
- Ignored `example/node_modules`
- Ignored `node_modules`

Product files changed: none.

Goal finished.
