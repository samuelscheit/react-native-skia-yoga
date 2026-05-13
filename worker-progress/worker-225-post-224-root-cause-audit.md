# Worker 225: Post-Worker 224 Root-Cause Audit

## Summary

Worker 224 closed the intended interaction `hitSlop` finite-native-float
boundary without a correctness blocker.

The implementation validates scalar `hitSlop`, object
`left/right/top/bottom/horizontal/vertical` numeric leaves, and combined
edge-plus-axis sums on both the JS registry boundary and the native raw
`YogaNode.setInteractionConfig(config)` boundary. Invalid numeric payloads
reject before JS tag/handler/native forwarding and before native interaction
state mutation.

The main proof boundary is appropriately local: JS source-level registry
runtime coverage, host-JSC/native raw-method execution, host-native hit-testing
regression coverage, and the feasible local matrix. It does not prove full app
bridge delivery, iOS/Android build/run, simulator/device behavior, UI-runtime
Worklets, Reanimated delivery, or RNGH native delivery.

## Changed Files

- `worker-progress/worker-225-post-224-root-cause-audit.md`

## Evidence Reviewed

- `WORKER_BRIEF.md`
- `MASTER_PLAN.md`
- `MASTER_PROGRESS.md`
- `worker-progress/worker-223-post-222-root-cause-audit.md`
- `worker-progress/worker-224-hit-slop-finite-validation.md`
- Worker 224 implementation history:
  - `7a3e3bd Validate interaction hitSlop numeric payloads`
  - `de071c7 Merge worker 224 hitSlop finite validation`
  - `f2bf22c Accept worker 224 hitSlop validation`
- Source and verifier files inspected:
  - `src/interactivity.ts`
  - `cpp/YogaNode.cpp`
  - `cpp/YogaNode.hpp`
  - `scripts/verify-gesture-interaction-runtime.mjs`
  - `scripts/verify-yoganode-jsi-raw-methods.mjs`
  - `scripts/verify-yoganode-native-hit-testing.mjs`
  - `cpp/JSIConverter+SkTextStyle.hpp`
  - `cpp/JSIConverter+SkParagraphStyle.hpp`
  - `cpp/JSIConverter+AnimatedDouble.hpp`
  - `cpp/AnimatedDouble.cpp`
  - `cpp/JSIConverter+NodeCommand.hpp`
  - `src/jsx.ts`
  - `src/specs/SkiaYoga.nitro.ts`

## Commands Run

- `git diff --check de071c7^1 de071c7` - passed.
- `node --check scripts/verify-gesture-interaction-runtime.mjs` - passed.
- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs` - passed.
- `npm run typecheck` - passed.
- `npm run check:gesture-interaction-runtime` - passed.
- `npm run check:yoganode-jsi-raw-methods` - passed.
- `npm run check:yoganode-native-hit-testing` - passed.
- `npm run check:feasible-matrix` - passed, 28/28 commands in 5m 36s.
- Platform blocker probes:
  - `xcode-select -p` - `/Library/Developer/CommandLineTools`.
  - `xcrun --find xcodebuild` - failed, `xcodebuild` unavailable.
  - `command -v pod` - failed, CocoaPods unavailable.
  - `java -version` - failed, no Java runtime located.
  - `printenv ANDROID_HOME` - unset.
  - `printenv ANDROID_SDK_ROOT` - unset.
  - `command -v adb` - failed.
  - `command -v gradle` - failed.
  - `command -v cmake` - failed.
  - `command -v ninja` - failed.

## Findings

- JS scalar validation is in the right place. `normalizeHitSlop(...)` rejects
  non-finite and native-float-overflowing scalar numbers before returning an
  inset object.
- JS object validation covers the intended inventory. The source validates
  numeric `left`, `right`, `top`, `bottom`, `horizontal`, and `vertical` leaves
  before addition, then validates the resulting edge-plus-axis values before
  forwarding native config.
- JS side-effect ordering is fixed for invalid numeric hitSlop values.
  `configureNode(...)` now normalizes hitSlop before allocating or storing a
  new event tag, replacing handlers, or calling `setInteractionConfig(...)`.
  The verifier asserts rejected numeric payloads do not call native, do not
  replace an existing handler, and do not consume the next event tag.
- Native raw parsing validates before mutation. `YogaNode::setInteractionConfig`
  reads pointer events and hitSlop into locals, validates hitSlop, and only
  then assigns `_pointerEvents`, `_hitSlop`, `_preciseHit`, `_eventTag`, and
  self-interaction state.
- Native state-preservation proof is meaningful. The raw-method verifier
  snapshots `_hitSlop`, `_pointerEvents`, `_preciseHit`, `_eventTag`,
  `_selfInteractive`, `_interactiveDescendantCount`, and parent interactive
  count before each invalid hitSlop call, then checks they are preserved.
- Omitted/default behavior is preserved. JS omitted hitSlop still normalizes to
  zero insets, native omitted hitSlop uses the default-zero `HitSlopInsets`,
  and object edge/axis omissions default to `0`.
- Unsupported non-number behavior was not broadened into a new validation
  contract. Non-number hitSlop leaves still follow the existing JS coercion or
  native fallback behavior unless the value is a number that now fails finite
  validation. The proof should not be read as exhaustive unsupported-type
  behavior coverage.
- Verifier coverage is representative rather than cartesian. It proves each
  object key is routed through the guarded path and proves positive/negative
  combined overflow cases, but it does not independently test every invalid
  number kind on every key. The shared helper/source shape supports the
  broader claim.
- No product regression was found. The rerun focused checks and full feasible
  matrix passed.

## Recommended Next Target

Select deterministic finite-number validation for public text and paragraph
style numeric leaves.

Why it ranks first:

- It is the broadest remaining public authoring surface with source-confirmed
  unchecked numeric reads. `YogaTextStyle` and `YogaParagraphStyle` are public
  JSX types, and `applyTextStyle(...)` still reads values such as `fontSize`,
  `decoration`, `decorationThickness`, `decorationStyle`,
  `fontFeatures[].value`, `fontStyle.weight/width/slant`,
  `heightMultiplier`, `letterSpacing`, `wordSpacing`,
  `shadows[].blurRadius`, and `textBaseline` through raw `asNumber()`.
- The paragraph path reuses text-style conversion for flattened and nested
  `paragraphStyle.textStyle` fields, so one converter-boundary fix can cover
  both public paragraph forms while preserving the existing flattened-over-
  nested precedence.
- Local proof is already strong enough: command/render and Nitro
  materialization verifiers exercise TextCmd, ParagraphCmd, public text style
  inventory, nested paragraph text style, and same-type command state
  preservation patterns.
- It is less policy-sensitive than dynamic `AnimatedDouble` mutation-time
  validation, and it is more public-facing than raw `hitTest(x, y)` or
  generated `computeLayout(width, height)` argument validation.

Implementation guidance:

- Inventory public numeric leaves from the installed RN Skia text, paragraph,
  and strut style fields before editing.
- Add finite checks at the converter boundary before mutating local
  `TextStyle` or `ParagraphStyle` state.
- Preserve existing public behavior for unsupported rich simple
  `text.textStyle` fields, unsupported `fontVariations`, CSS color strings,
  flattened/nested paragraph precedence, omitted/null fields, and current
  serialization shapes.
- Prove rejected updates preserve prior same-type TextCmd/ParagraphCmd state
  through direct command conversion and generated materialized `setCommand(...)`
  paths. Avoid exact typography/font/render-fidelity claims.

## Candidate Comparison

- Dynamic `AnimatedDouble` mutation-time finite validation remains important,
  but it needs an explicit contract decision. Current local proof already
  covers static finite validation and selected dynamic `Synchronizable`
  extraction, resolution, and `setBlocking(...)` mutation observation. It does
  not prove UI-runtime Worklets or real Reanimated delivery.
- Raw `hitTest(x, y)` still casts unchecked numbers to `float`, and generated
  `computeLayout(width, height)` still casts optional doubles to float before
  Yoga layout. Both are locally testable through host-JSC/materialized wrappers,
  but they are narrower than the text/paragraph public authoring surface.
- Platform/runtime proof is still externally blocked in this environment by
  Command Line Tools-only Xcode selection, missing `xcodebuild`, missing
  CocoaPods, missing Java runtime, unset Android SDK variables, and absent
  `adb`, `gradle`, `cmake`, and `ninja`.

## Proof Boundary

Proven for Worker 224:

- JS `YogaInteractionRegistry` hitSlop normalization and finite validation.
- Invalid numeric JS hitSlop rejection before native forwarding, handler
  replacement, or event-tag consumption.
- Native host-JSC execution of real `YogaNode::setInteractionConfig(...)`.
- Native invalid hitSlop rejection before interaction state mutation.
- Preservation of node and parent interaction counts after rejected native
  updates.
- Valid finite hitSlop still participates in native hit testing.
- Full accepted feasible local matrix remains green.

Not proven:

- React Native bridge delivery inside a real app.
- Nitro registry installation in a full React Native app runtime.
- iOS/Android build, install, simulator, device, or platform view presentation.
- CocoaPods or Gradle integration.
- UI-runtime Worklets execution or real Reanimated `SharedValue` delivery.
- RNGH native delivery.
- Exhaustive future interaction fields outside the guarded hitSlop inventory.
- Exhaustive unsupported-type side effects beyond the numeric validation
  target.

## Cleanup Status

No product/source/test files were edited. The feasible matrix reported no newly
created tracked artifacts and removed its matrix temp parent. Pre-existing
ignored local artifacts are preserved: `node_modules/`, `example/node_modules/`,
and `tsconfig.tsbuildinfo`.

## Quality / Maintainability / Performance / Security Review

Quality: Worker 224 validates at the two relevant boundaries and verifies both
JS registry behavior and native raw-method state preservation. The remaining
coverage caveat is only that per-key invalid-number cases are representative,
not a full cartesian matrix.

Maintainability: the helper names and error labels keep the guarded hitSlop
inventory explicit. The JS and native code use matching scalar, leaf, and
combined-value validation shapes.

Performance: validation is constant-time and runs only during interaction
configuration updates. Hit-test traversal and rendering paths do not receive
new per-frame work.

Security and robustness: rejecting non-finite and native-float-overflowing
hitSlop values prevents invalid bounds from entering interaction routing and
prevents rejected config updates from corrupting prior interaction state.

Goal finished.
