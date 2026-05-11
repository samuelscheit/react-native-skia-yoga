# Summary

Post-worker-119 baseline is green in this worktree. I changed only this report:

- `worker-progress/worker-120-post-119-root-cause-audit.md`

No product source, verifier script, package metadata, generated Nitro output, README, master planning/progress file, dependency tree, or prior worker report was edited.

Worker 119's accepted proof boundary is supported by the current source, verifier, and report: selected value-bearing `SkSamplingOptions`, `TextStyle`, and `ParagraphStyle` `toJSI(...)` serialization is covered, while broader style parity, CSS string preservation, platform/native runtime, RN bridge/runtime, UI-runtime Worklets/Reanimated, image loading, and exact fidelity remain out of scope.

Recommended next target: canonicalize the public style prop from `antiaAlias` to `antiAlias`, ideally keeping `antiaAlias` as a legacy alias with canonical precedence. This is the strongest local target I found because it fixes an authored public style contract and native behavior spelling mismatch, not just another bounded serialization slice.

# Baseline Verification

Worktree:

- `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-120-post-119-root-cause-audit`
- Branch: `worker/120-post-119-root-cause-audit`
- HEAD at audit: `bbb8957 Accept worker 119 and queue next audit`

Commands run:

- `git diff --check`: passed.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: `5m 49s`.
  - Matrix temp parent: `/tmp/rnskia-feasible-matrix-QE96Ok`.
  - Matrix removed newly created `tsconfig.tsbuildinfo`.
  - Matrix removed its temp parent.
  - Remaining new tracked artifacts after matrix cleanup: none.

Notable matrix evidence:

- `check:yoganode-native-commands-render` passed and reported selected value-bearing `SkSamplingOptions`, `SkTextStyle`, and `SkParagraphStyle` serialization.
- `check:package-typescript-consumer`, `check:package-surface`, `check:yoganode-nitro-materialization`, `check:rnsk-yoga-view-runtime`, `typecheck`, `lint-ci`, example typecheck, example bundle, and example native-generation checks all passed.
- The matrix proof boundary remains feasible local package/source/example metadata checks plus Node VM, host-JSC, and host-native probes. It does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.

Current platform build/run gap remains blocked locally:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because full Xcode is not selected.
- `pod`: unavailable on `PATH`.
- `java`: `/usr/bin/java`, but `java -version` failed because no Java runtime is installed.
- `adb`, `cmake`, `ninja`, and `gradle`: unavailable on `PATH`.
- `ANDROID_HOME` and `ANDROID_SDK_ROOT`: unset.

# Worker 119 Acceptance Check

Accepted source boundary:

- `cpp/JSIConverter+SkSamplingOptions.hpp:26` emits only parser-compatible `{ B, C }` or `{ filter, mipmap }` shapes.
- `cpp/JSIConverter+SkTextStyle.hpp:99` writes selected stable fields: `fontSize`, numeric `color`, `fontFamilies`, conditional `heightMultiplier`, `halfLeading`, `letterSpacing`, `wordSpacing`, and `locale`.
- `cpp/JSIConverter+SkTextStyle.hpp:132` still parses additional fields that are intentionally not serialized yet.
- `cpp/JSIConverter+SkParagraphStyle.hpp:103` writes selected paragraph controls plus flattened selected default text-style fields, and `cpp/JSIConverter+SkParagraphStyle.hpp:123` intentionally omits flattened TextStyle `heightMultiplier` to avoid colliding with paragraph `heightMultiplier`.

Accepted verifier/report boundary:

- `scripts/verify-yoganode-native-commands-render.mjs:1705` and nearby assertions cover direct sampling/text-style/paragraph-style `toJSI(...) -> fromJSI(...)` cases.
- `scripts/verify-yoganode-native-commands-render.mjs:1803` and nearby assertions cover selected NodeCommand image/text/paragraph serialization and round trips.
- `scripts/verify-yoganode-native-commands-render.mjs:177` excludes unsupported `maxAniso`, every style field, CSS string preservation, exact typography/shaping/render fidelity, Nitro materialization, platform build/run, native presentation, UI-runtime Worklets/Reanimated, JS scheduling, image loading/decoding/assets, texture-backed images, and exact image fidelity.
- `worker-progress/worker-119-value-bearing-style-tojsi.md` states the same bounded proof and exclusions.

Delegated proof-boundary challenge result:

- A read-only nested explorer independently confirmed the source/verifier/report support worker 119's accepted boundary.
- It also called out one wording risk: in paragraph serialization, the flat `heightMultiplier` key is paragraph height, not independent flattened TextStyle height. I preserve that narrower claim here.

# Candidate Targets Ranked

1. Canonical `style.antiAlias` public/native contract.

Classification: locally unblocked public API and native style behavior target.

Evidence: `src/specs/style.ts:247`, generated `NodeStyle`, `cpp/YogaNode.cpp:678`, examples, and verifier helpers all use the misspelled `antiaAlias`. Upstream RN Skia public paint props use `antiAlias`, and native Skia APIs are `setAntiAlias(...)` / `isAntiAlias()`. A consumer writing the expected `antiAlias` prop is outside this package's typed/generated/native contract today.

Why it ranks first: it corrects a direct authored JSX style prop and native behavior spelling mismatch. It is smaller, more user-facing, and less overclaim-prone than broad text/paragraph style serialization breadth. It can be verified locally from packed TypeScript authoring through generated `NodeStyle` and host-native paint state.

2. Bounded additional `TextStyle` `toJSI(...)` serialization.

Classification: locally unblocked converter/runtime proof target.

Evidence: `JSIConverter+SkTextStyle.hpp` parses decoration, decoration color/thickness/style, foreground/background color, font features, font style, shadows, and text baseline, but worker 119 serializes only a selected subset. This was the nested candidate explorer's first recommendation.

Why below `antiAlias`: this is a real adjacent post-119 gap, but it primarily tightens converter round-trip completeness. The `antiAlias` target fixes a public authoring surface that users hit before native serialization.

3. Additional `ParagraphStyle` controls and bounded `strutStyle` serialization.

Classification: locally unblocked but broader and more overclaim-prone.

Evidence: RN Skia's paragraph parser accepts `disableHinting`, `replaceTabCharacters`, `textDirection`, `textHeightBehavior`, and `strutStyle`; this package serializes only selected paragraph controls today. This should follow TextStyle or be split into a narrow field-by-field proof.

4. `SkSamplingOptions::maxAniso`.

Classification: not selected.

Evidence: the installed RN Skia parser accepts `{ B, C }` or `{ filter, mipmap }`, and RN Skia's public `SamplingOptions` type is `CubicResampler | FilterOptions`. Supporting anisotropy needs an explicit JS API/parser decision before serialization.

5. Nested `image.sampling.filter` / `sampling.mipmap` SharedValue leaves and generic `YogaDeepAnimated<T>` union cleanup.

Classification: lower priority.

Worker 117/118 already closed whole `SharedValue<SamplingOptions>` authoring for `image.sampling` and kept nested sampling leaves rejected while `SamplingOptions` remains opaque. A broader helper rewrite previously risked regressions in optional nested fields.

6. Platform-native app runtime, RN bridge delivery, Nitro registry install in app, UI-runtime Worklets/Reanimated delivery, image loading/texture-backed behavior, and exact render/typography fidelity.

Classification: high value but blocked or overclaim-prone locally.

Current local tooling still blocks honest iOS/Android app build/run proof. Host/source checks remain useful, but they do not close real app runtime, bridge, asset-loading, or exact fidelity gaps.

# Recommended Next Target

Select exactly one next implementation target:

> Canonicalize the public style antialias prop as `antiAlias` across the TypeScript spec, generated/native style application, examples, and local verifiers.

Likely implementation files:

- `src/specs/style.ts`
- `nitrogen/generated/shared/c++/NodeStyle.hpp` after `bun run specs`
- `cpp/YogaNode.cpp`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-yoganode-native-commands-render.mjs`
- Possibly `scripts/verify-yoganode-nitro-materialization.mjs`
- Example/demo type fixtures that currently spell `antiaAlias`
- Next worker report

Implementation shape:

- Add canonical `antiAlias?: boolean` to the public style spec.
- Prefer `antiAlias` in generated/native application.
- Preserve `antiaAlias` as a legacy alias unless the next worker intentionally chooses a breaking removal. If both are present, `antiAlias` should win.
- Update examples and verifier literals to the canonical spelling.
- Add packed-consumer TypeScript coverage for `style={{ antiAlias: false }}`.
- Add host-native proof that canonical `antiAlias` reaches `SkPaint::setAntiAlias(...)`.

Recommended verification commands:

- `bun run specs`
- `node --check scripts/verify-package-typescript-consumer.mjs`
- `node --check scripts/verify-yoganode-native-commands-render.mjs`
- `npm run check:package-typescript-consumer`
- `npm run check:yoganode-native-commands-render`
- `npm run check:yoganode-nitro-materialization` if generated materialized `setStyle(...)` assertions are expanded
- `npm run typecheck`
- `cd example && bun run typecheck`
- `npm run check:feasible-matrix`
- `git diff --check`

# Proof Boundary And Risks

Recommended proof boundary for the next worker:

- Prove public packed TypeScript consumers can author canonical `style.antiAlias`.
- Prove generated `NodeStyle` admits the canonical field.
- Prove host-native `YogaNode::setStyle(...)` applies canonical `antiAlias` to the SkPaint anti-alias flag.
- If preserving the typo, prove `antiaAlias` remains a legacy alias and that `antiAlias` takes precedence.

Do not claim:

- Full paint-style parity.
- Exact anti-aliased pixel equivalence across platforms.
- iOS/Android app build/run, native platform presentation, React Native bridge delivery, Nitro registry install in a running app, UI-runtime Worklets/Reanimated delivery, RNGH native delivery, image loading/decoding, texture-backed behavior, or exact render/typography fidelity.

Overclaim risks:

- Renaming without alias support could be a deliberate breaking change, but it should be called out as such.
- Keeping both spellings requires explicit precedence to avoid ambiguous behavior.
- Host-native paint-state proof is not the same as platform presentation proof.

Nested candidate challenge:

- A read-only nested explorer ranked additional `TextStyle` serialization first and argued it is the strongest direct post-119 continuation.
- I ranked canonical `antiAlias` above it because it fixes a public authored prop and native style behavior spelling mismatch. The TextStyle slice remains the strongest adjacent converter follow-up if the orchestrator chooses to stay strictly on post-119 serialization breadth.

# Cleanup And Status

Cleanup/status before writing this report:

- `git diff --check`: passed.
- `git diff --stat`: no output.
- `git status --short --branch --ignored=matching` showed only ignored dependency trees:
  - `!! example/node_modules`
  - `!! node_modules`
- `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: no output.
- `find /tmp /private/tmp -maxdepth 1 \( -name 'rnskia-*' -o -name 'rnskia.*' \) -print`: no output.
- Active verifier/debug process scan found no current verifier, compiler, platform build, debugger, Metro, or matrix process for this worktree. A broad scan matched an unrelated pre-existing `worker-032` tmux command outside this assigned worktree; it was not touched.
- Nested explorers were closed after completion.
- No product files changed.

Expected final status after this report:

- `?? worker-progress/worker-120-post-119-root-cause-audit.md`
- ignored `example/node_modules`
- ignored `node_modules`

Goal finished.
