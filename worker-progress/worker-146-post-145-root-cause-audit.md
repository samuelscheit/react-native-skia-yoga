# Worker 146 - Post-worker-145 root-cause audit

## Summary

This was a report-only post-worker-145 audit. Worker 145 closed the bounded
RN Skia style/sampling serializer inventory target: the command/render verifier
now reads the installed public RN Skia type files, classifies current
`SkTextStyle`, `SkParagraphStyle`, `SkStrutStyle`, and `SamplingOptions`
fields, and fails on missing/stale inventory drift before native compilation.

Selected next target: fix and prove `YogaNode::setStyle(...)` paint-ordering for
explicit SkPaint-backed style fields when `backgroundColor` is supplied as an
`SkPaint`. Worker 121 already fixed this ordering for `antiAlias` only. Current
source still applies `borderWidth`/stroke width, `strokeCap`, `strokeJoin`,
`strokeMiter`, and `dither` before the `backgroundColor` `SkPaint` assignment;
that later `_paint = p` can overwrite the explicit style fields. This is a
concrete source-confirmed root-cause target, stronger than an inventory-only
NodeStyle proof pass.

## Baseline

- Worktree:
  `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-146-post-145-root-cause-audit`
- Branch: `worker/146-post-145-root-cause-audit`
- Baseline commit reviewed: `fb62add` (`Accept worker 145 and queue next audit`)
- Initial status: clean on `worker/146-post-145-root-cause-audit`.
- Latest plan/progress state: `MASTER_PLAN.md` records worker 145 as the latest
  integration, and `MASTER_PROGRESS.md` asks for this fresh post-worker-145
  rerank while keeping platform-native proof separate until local prerequisites
  change.

Package/toolchain state sampled:

- Root Node `v26.0.0`, npm `11.12.1`, Bun `1.3.13`.
- Root installed versions sampled: RN Skia `2.4.18`, React Native `0.80.1`,
  Nitro `0.35.0`, Worklets `0.5.1`.
- Example/native folders are not tracked or present in this worker checkout;
  native project generation remains temp-workspace based.

## Evidence inspected

Required context reviewed:

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-144-post-143-root-cause-audit.md`
- `worker-progress/worker-145-style-serializer-inventory.md`

Relevant current source, verifier, example, generated, and dependency files
reviewed:

- `scripts/verify-yoganode-native-commands-render.mjs`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-package-typescript-consumer.mjs`
- `scripts/verify-reconciler-animated-bindings.mjs`
- `src/jsx.ts`
- `src/specs/style.ts`
- `src/specs/commands.ts`
- `cpp/YogaNode.cpp`
- `cpp/YogaNode.hpp`
- `cpp/JSIConverter+NodeCommand.hpp`
- `cpp/JSIConverter+SkTextStyle.hpp`
- `cpp/JSIConverter+SkParagraphStyle.hpp`
- `cpp/JSIConverter+SkSamplingOptions.hpp`
- `nitrogen/generated/shared/c++/NodeStyle.hpp`
- `README.md`
- `example/types/skiayoga-typecheck.tsx`
- `example/app/(tabs)/components/paragraph.tsx`
- `node_modules/@shopify/react-native-skia/src/skia/types/Paragraph/TextStyle.ts`
- `node_modules/@shopify/react-native-skia/src/skia/types/Paragraph/ParagraphStyle.ts`
- `node_modules/@shopify/react-native-skia/src/skia/types/Image/Image.ts`

Key evidence:

- Worker 145's report states it added the installed-source RN Skia inventory and
  changed no product runtime/source behavior.
- `scripts/verify-yoganode-native-commands-render.mjs` now has explicit buckets
  for installed public `SkTextStyle`, `SkParagraphStyle`, `SkStrutStyle`,
  `SamplingOptions.CubicResampler`, `SamplingOptions.FilterOptions`, and the
  `SamplingOptions` union.
- The same verifier checks duplicate, missing, and stale inventory entries
  before compiling the native command/render probe.
- Current installed RN Skia types match that inventory: `SkTextStyle` includes
  `fontVariations` as the single intentionally unsupported text-style field;
  `SamplingOptions` remains `CubicResampler | FilterOptions`.
- Public JSX still intentionally limits simple `<text textStyle>` to
  `fontSize` and `color`, while rich flattened and nested paragraph text style
  remains supported through `<paragraph paragraphStyle>`.
- Native simple `TextCmd` conversion still rejects rich simple-text keys with a
  clear error, and README text-styling guidance matches that boundary.
- `src/specs/style.ts` exposes 80 public `NodeStyle` fields, and generated
  `NodeStyle.hpp` includes all 80.
- A focused field probe found no public `NodeStyle` field missing from generated
  C++ and no field absent from `YogaNode.cpp`; the NodeStyle explorer refined
  that `invertClip` is not consumed inside `setStyle(...)` but is consumed later
  during draw/hit-test paths through `_style.invertClip`.
- Worker 121's report explicitly says `antiAlias` was moved after
  `backgroundColor` handling so a supplied `SkPaint` background cannot override
  explicit anti-alias state, and it leaves other paint fields such as `dither`
  with pre-existing ordering.
- Current `YogaNode::setStyle(...)` still resets `_paint`, then applies
  `borderWidth` to `_paint.setStrokeWidth(...)`, applies `strokeCap`,
  `strokeJoin`, `strokeMiter`, and `dither`, then handles `backgroundColor`.
  When `backgroundColor` holds `SkPaint`, the code assigns `_paint = p`,
  overwriting those earlier explicit paint settings.
- `antiAlias`, `opacity`, and `blendMode` are already applied after that
  `backgroundColor` branch, so the selected bug is bounded to the explicit paint
  fields still applied before SkPaint replacement.
- Current command/render verifier coverage names generated `NodeStyle`
  transport and SkPaint state only for canonical/legacy `antiAlias` ordering;
  it does not prove the other style-owned paint fields survive a SkPaint
  `backgroundColor`.

Delegated checks that affected the conclusion:

- `style_runtime_challenge` confirmed worker 145 fully closed the bounded
  RN Skia style/sampling inventory target, ran syntax/focused verifier checks,
  and did not find a stronger target in the inherited buckets of platform
  build/run, rich simple `TextCmd`, or broad runtime/fidelity proof.
- `platform_toolchain_recheck` confirmed temp-workspace native project
  generation is locally unblocked, but full native build/run remains blocked:
  active developer directory is Command Line Tools, `xcodebuild` requires full
  Xcode, simulator/iPhone SDK lookup fails, CocoaPods is absent, Java is absent,
  Android SDK env vars are unset, and Android build tools are missing.
- `node_style_inventory_challenge` found the selected target. It ranked
  SkPaint-backed style ordering above NodeStyle inventory because the ordering
  issue is source-confirmed, while the NodeStyle inventory gap is mostly missing
  explicit drift/proof coverage rather than an unmapped-field bug.

## Verification commands

Required checks:

- `/usr/bin/time -p git diff --check`: passed, `real 0.01`.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands,
  matrix command duration `4m 41s`, `/usr/bin/time` `real 280.99`.

Notable feasible-matrix evidence:

- `check:yoganode-native-commands-render` passed and printed the worker-145
  RN Skia field inventory summary plus bounded host-native command/render
  evidence.
- `check:package-typescript-consumer` passed and still proves simple text style
  accepts `fontSize`/`color`, rejects rich simple-text fields, accepts rich
  paragraph styling, accepts static and dynamic nested
  `paragraphStyle.textStyle`, and rejects nested `image.sampling` SharedValue
  leaves.
- `check:reconciler-animated-bindings` passed and still covers native command
  binding mirrors plus JS listener paths for opaque `image.sampling`, nested
  paragraph text-style leaves, nested stroke, and nested-array command props.
- `check:yoganode-nitro-materialization` passed and still proves materialized
  `setStyle(width/height/antiAlias)` delivery, generated/raw method execution,
  command wrapper breadth, and returned-child identity/prototype behavior.
- `check:example-native-generation` and the preserve-local-artifacts probe
  passed, proving temp-workspace Expo prebuild/native metadata generation and
  cleanup without using this checkout's `example/ios`, `example/android`, or
  `example/.expo` as generation targets.
- Matrix cleanup removed generated `tsconfig.tsbuildinfo`, removed the
  matrix-owned temp parent `/tmp/rnskia-feasible-matrix-WkDnxf`, and reported no
  remaining new tracked artifacts.

Focused checks/probes:

- NodeStyle field probe:
  `node - <<'NODE' ...` extracted public fields from `src/specs/style.ts`,
  compared them against generated `NodeStyle.hpp`, and searched `YogaNode.cpp`.
  Result: `NodeStyle fields: 80`, `missing generated: none`, and no field absent
  from `YogaNode.cpp`.
- Platform probes confirmed blockers:
  `xcode-select -p` returned `/Library/Developer/CommandLineTools`;
  `xcodebuild -version` failed because full Xcode is not selected;
  `xcrun --sdk iphonesimulator --show-sdk-path` failed because the simulator SDK
  cannot be located; `java -version` failed because no Java runtime is
  available; `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `JAVA_HOME` were unset; and
  `pod`, `gradle`, `adb`, `cmake`, `ninja`, `sdkmanager`, and `emulator` were
  not found in `PATH`.

The platform/toolchain probes intentionally produced nonzero exits where tools
are missing; those are blockers, not repo verification failures.

## Candidate ranking

1. SkPaint-backed `backgroundColor` ordering for explicit style-owned paint
   fields.

Evidence: worker 121 fixed `antiAlias` because a `backgroundColor` `SkPaint`
assignment overwrites `_paint`. The same source pattern still applies to
`borderWidth`/stroke width, `strokeCap`, `strokeJoin`, `strokeMiter`, and
`dither`, which are applied before `_paint = p`. This is a concrete product
source bug against explicit public style fields and is locally testable in the
existing host-native command/render verifier.

2. Public `NodeStyle` field inventory and native setStyle proof.

Evidence: public `NodeStyle` has 80 fields and only selected style behavior is
proved deeply. However, the quick inventory found generated C++ has every public
field and `YogaNode.cpp` references all fields, with `invertClip` consumed
outside `setStyle(...)`. This is useful proof-boundary hardening but weaker than
the concrete paint-ordering bug.

3. Platform-native iOS/Android build/run.

Evidence: temp native generation, package metadata, autolinking, host-native
runtime probes, example typecheck, and bundle export all pass. Full app
build/run remains blocked by local Xcode/CocoaPods/Java/Android SDK/tooling
gaps. It should move up only when those prerequisites change.

4. Broad runtime/fidelity proof.

Evidence: current verifiers intentionally do not claim React Native bridge
delivery, Nitro registry install inside a running app, UI-runtime Worklets or
Reanimated delivery, RNGH native delivery, image asset decoding/loading,
texture-backed image behavior, exact typography, paragraph shaping, or exact
render fidelity. These are high-value but broader and more overclaim-prone than
the selected source-confirmed bug.

5. Rich simple `TextCmd` styling.

Evidence: this is intentionally unsupported. Public types, packed-consumer
checks, native command conversion, and README docs all keep simple
`<text textStyle>` to `fontSize` and `color`, with rich typography directed to
`<paragraph />`. Expanding this would be a feature change, not a cleanup target.

6. Sampling wording or RN Skia style/sampling inventory cleanup.

Evidence: worker 145 closed this target. Future RN Skia upgrades should update
the inventory, but no current installed public sampling/style field is missing
from the inventory.

## Selected next target

Assign an implementation worker to fix SkPaint-backed `backgroundColor`
ordering for explicit style-owned paint fields in `YogaNode::setStyle(...)`.

Recommended scope:

- Preserve current behavior where `backgroundColor` as a string sets only paint
  color and `backgroundColor` as `SkPaint` provides the base paint.
- Ensure explicit public style fields win over that base paint for
  `borderWidth`/stroke width, `strokeCap`, `strokeJoin`, `strokeMiter`, `dither`,
  existing `antiAlias`, `opacity`, and `blendMode`.
- Prefer a small ordering refactor in `cpp/YogaNode.cpp`: establish the base
  paint from `backgroundColor` before applying style-owned paint overrides, or
  reapply all style-owned paint overrides after the SkPaint assignment.
- Extend `scripts/verify-yoganode-native-commands-render.mjs` with host-native
  assertions using a conflicting `SkPaint` background and explicit public style
  fields for dither/stroke width/cap/join/miter. Preserve existing antiAlias
  precedence and background-ordering assertions.
- Keep layout border widths, clip behavior, command rendering, exact pixel
  fidelity, and platform app runtime outside the proof unless directly affected
  by the fix.
- Run at least `node --check scripts/verify-yoganode-native-commands-render.mjs`,
  `npm run check:yoganode-native-commands-render`, `npm run
  check:yoganode-nitro-materialization` if setStyle materialization assertions
  change, `npm run check:package-typescript-consumer` if public typing/examples
  change, `npm run check:feasible-matrix`, and `git diff --check`.

## Proof boundary/overclaim risks

- Current local proof is strong for source/package/example/host-native
  boundaries, but it still does not prove full iOS/Android app build/run,
  simulator/device launch, native platform presentation, React Native bridge
  delivery, Nitro registry install inside a running RN app, UI-runtime Worklets
  execution, real Reanimated delivery, RNGH native delivery, image
  decoding/assets/loading, texture-backed images, exact typography, paragraph
  shaping fidelity, or exact render fidelity.
- The selected target should not claim broad `NodeStyle` fidelity. It should
  prove only that explicit SkPaint-affecting style fields survive a SkPaint
  `backgroundColor` base assignment.
- Reordering paint setup can change precedence. The next worker should state the
  intended precedence explicitly: `backgroundColor` SkPaint is the base paint,
  public style paint fields override that base, and command fallback paint still
  applies only when no style background was supplied.
- `borderWidth` has two responsibilities: Yoga border width and paint stroke
  width. The selected fix should not accidentally change Yoga layout border
  behavior while correcting paint precedence.
- `layer` owns `_layerPaint`, not `_paint`, and should not be folded into this
  bug unless new evidence shows a direct interaction.

## Cleanup status

No product source, verifier, example, generated, dependency, or planning files
were changed by this report-only audit.

The only tracked file added by this worker is:

- `worker-progress/worker-146-post-145-root-cause-audit.md`

The feasible matrix removed its generated TypeScript build-info artifact and
matrix temp parent. The selected target was not implemented in this worker.

## Recommended next tasks

- Implement the selected SkPaint-backed `backgroundColor` ordering fix and add
  bounded host-native verifier coverage for dither/stroke field precedence.
- Keep a broader `NodeStyle` inventory/proof worker as a later hardening task if
  no concrete source-confirmed bug is available after the paint-ordering fix.
- Keep platform-native build/run queued until full Xcode/CocoaPods and
  Java/Android SDK/build tools are available locally.
- Keep rich simple `TextCmd` styling as a deliberate feature proposal, not a
  cleanup item.

Goal finished.
