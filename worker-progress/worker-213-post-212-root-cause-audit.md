# Worker 213: Post-212 Root-Cause Audit

## Summary

Audited Worker 212's layout numeric finite validation from the isolated
`worker/213-post-212-root-cause-audit` worktree.

Worker 212 is accepted. The implementation is correctly scoped to finite-number
validation for numeric Yoga layout style fields, runs before native
`YogaNode::setStyle(...)` mutation, is covered by the generated materialized
Nitro verifier, and does not overclaim exhaustive numeric validation.

The next strongest locally unblocked root-cause target is deterministic
finite-number validation for `style.matrix` array / `SkMatrix` payloads and
`style.transform` operation leaves. That gap is source-confirmed, affects both
render and hit-test matrix behavior, and can be verified through the existing
generated materialized host-JSC harness without requiring platform app tooling.

## Worker 212 Acceptance Decision

Accepted.

Evidence inspected:

- Merge commit `3a6a1b8 Merge worker 212 layout numeric finite validation`.
- Acceptance docs commit `c076a29 Accept worker 212 layout numeric validation`.
- Implementation commit `00d5af9 Validate finite numeric layout styles`.
- Worker report
  `worker-progress/worker-212-layout-numeric-finite-validation.md`.
- Key paths: `cpp/YogaNode.cpp`,
  `scripts/verify-yoganode-nitro-materialization.mjs`,
  `src/specs/style.ts`, and
  `nitrogen/generated/shared/c++/NodeStyle.hpp`.

The acceptance docs commit only changed `MASTER_PLAN.md` and
`MASTER_PROGRESS.md`. The product/verifier implementation is in `00d5af9`.

## Commands Run

- `git diff --check HEAD~2 HEAD` - passed with no output.
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed
  with no output.
- `npm run check:yoganode-nitro-materialization` - passed. The verifier output
  explicitly includes generated materialized `setStyle(...)` rejection for
  non-finite border-width, `strokeMiter`, `opacity`, and Worker 212 layout
  numeric fields, preserving prior `_style`, `_paint`, Yoga, clip, layer,
  matrix, and computed-layout state.
- `npm run check:feasible-matrix` - passed all 28 commands in `5m 38s`.
  Cleanup removed newly created `tsconfig.tsbuildinfo`, reported no remaining
  new tracked artifacts, and removed the matrix temp parent
  `/tmp/rnskia-feasible-matrix-oRMphr`.

Platform blocker reprobes:

- `xcode-select -p` returned `/Library/Developer/CommandLineTools`.
- `xcodebuild -version` failed because full Xcode is not selected.
- `xcrun --sdk iphonesimulator --show-sdk-path` failed because the simulator
  SDK cannot be located.
- `xcrun simctl list devices available` failed because `simctl` is unavailable.
- `pod --version`, `gradle --version`, `adb version`, `cmake --version`, and
  `ninja --version` failed with command not found.
- `java -version` failed because no Java Runtime is available.
- `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `ANDROID_NDK_HOME`, `JAVA_HOME`, and
  `JDK_HOME` were unset.

## Proof Boundary

Accepted:

- Native finite-number validation now covers direct `optional<double>` layout
  scalars: `aspectRatio`, `flex`, `flexGrow`, `flexShrink`, `gap`, `rowGap`,
  and `columnGap`.
- Native finite-number validation now covers numeric branches of layout unit
  variants: `flexBasis`, size constraints, position edges, margins, padding,
  and inset aliases.
- The validation call remains pre-mutation in `YogaNode::setStyle(...)`: after
  layout-string and background-color validation, before `invalidateLayout()`,
  `_style = style`, Yoga reset, paint reset, layer reset, clip reset, or matrix
  reset.
- The verifier source guards tie the public TypeScript fields, generated
  `NodeStyle` transport, and native validator inventory together.
- Generated materialized `YogaNode.setStyle(...)` negative coverage proves
  JS-facing rejection and preservation of previous selected style, Yoga layout,
  computed layout, paint, clip, layer, and matrix state.

Rejected as overclaim if implied:

- Exhaustive numeric style validation.
- Radius, `SkPoint`, matrix-array / `SkMatrix`, transform-leaf, command numeric
  payload, or hit-slop finite validation.
- Range semantics such as non-negative dimensions, opacity clamping, or radius
  bounds.
- React Native bridge delivery, Nitro registry install inside a real React
  Native runtime, iOS/Android app build/run, simulator/device launch, native
  platform presentation, UI-runtime Worklets execution, Reanimated delivery, or
  RNGH native delivery.

## Remaining Gaps

- `style.matrix` remains a public `SkMatrixNative | MatrixArray` field.
  Generated `NodeStyle` transports it as `std::shared_ptr<SkMatrix>` or 9-/16-
  value double tuples, while `makeMatrixPointer(...)` stores the pointer or
  casts tuple entries to `SkScalar` without finite validation.
- `style.transform` remains a public array of operation objects with numeric
  leaves. Generated transform structs use `double`, and native style
  application casts to `float`, applies rotate/scale/translate, and computes
  skew tangents without a pre-mutation finite guard.
- `_matrix` is not inert state: render concatenates it into the canvas and
  hit testing inverts/maps through it. Existing positive verifiers prove
  delivery and use, but not deterministic rejection of NaN/Infinity inputs.
- Radius fields remain a separate numeric style surface:
  `borderRadius` plus per-corner scalar / `SkPoint` radii are delivered and
  used for clipping and hit testing, but non-finite payloads are not rejected.
- Command numeric payloads and interaction hit-slop numeric payloads remain
  separate non-style validation surfaces. Some dynamic command behavior is
  covered by host verifiers, but finite-number rejection is not exhaustive.
- Full platform-native app build/run remains blocked by local toolchain
  availability, not by new repository evidence.

## Next Recommended Target

Rank 1: finite-number validation for `style.matrix` and `style.transform`
numeric payloads.

Recommended scope:

- Extend the existing pre-mutation `YogaNode::setStyle(...)` validation path to
  reject non-finite matrix entries and transform operation leaves before
  layout invalidation or native state reset.
- Cover public matrix-array delivery as materialized by Nitro, and include
  transform leaves for every current public operation: `rotateX`, `rotateY`,
  `rotateZ`, `scale`, `scaleX`, `scaleY`, `translateX`, `translateY`, `skewX`,
  and `skewY`.
- Preserve the existing valid matrix/transform behavior, including transform
  precedence over matrix, empty-transform fallback, and empty-transform reset.
- Add generated materialized negative cases proving deterministic rejection and
  preservation of prior `_style`, `_matrix`, clip/radius, paint, Yoga, and
  computed-layout state.
- Add source guards so public/generated/native matrix and transform inventories
  cannot drift silently.
- Verify with `git diff --check`, `node --check
  scripts/verify-yoganode-nitro-materialization.mjs`, `npm run
  check:yoganode-nitro-materialization`, and `npm run check:feasible-matrix`.

Rationale:

- This is the same root-cause class as Workers 206, 208, 210, and 212: public
  runtime inputs that TypeScript/Nitro cannot make safe must be rejected
  deterministically before native mutation.
- It is broader runtime risk than radius-only validation because one
  non-finite matrix or transform value can affect rendering, child traversal,
  and hit-test coordinate inversion for the whole node subtree.
- It is locally verifiable today through the existing generated materialized
  host-JSC harness and already has positive delivery/render/hit-test anchors.

Rank 2: finite validation for scalar and `SkPoint` corner-radius style
payloads, with clipping/radius preservation proof.

Rank 3: finite validation for selected command numeric payloads and hit-slop
inputs, scoped separately from `setStyle(...)`.

Highest-value blocked target: real React Native runtime/platform proof once
full Xcode/simulator/CocoaPods or Android Java/SDK/Gradle/ADB/CMake/Ninja
prerequisites are available.

## Quality, Maintainability, Performance, Security

- Quality: Worker 212 keeps validation centralized and deterministic, and the
  generated materialized proof enters the JS-facing wrapper path rather than
  only raw C++.
- Maintainability: the numeric layout inventory is manual but guarded across
  public specs, generated C++, and native source. Future numeric additions
  should enter the validator or be explicitly documented as excluded.
- Performance: the added checks are constant-time optional/variant inspections
  before the heavier style reset and Yoga mutation work.
- Security: rejecting NaN/Infinity layout values reduces undefined-state
  propagation into Yoga layout and downstream render/hit-test code. Remaining
  matrix/transform/radius numeric surfaces keep that class of risk.

## Cleanup Status

- Report-only scope was preserved.
- No product source, verifier scripts, package metadata, generated files,
  examples, or master docs were edited by Worker 213.
- The feasible matrix removed its owned temp parent and generated
  `tsconfig.tsbuildinfo`.
- Final pre-report status showed only expected ignored dependency symlinks:
  `node_modules` and `example/node_modules`.
- This branch should commit only
  `worker-progress/worker-213-post-212-root-cause-audit.md`.

Goal finished.
