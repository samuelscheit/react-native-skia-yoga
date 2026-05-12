# Worker 212: layout numeric finite validation

## Summary

Implemented deterministic pre-mutation finite-number validation in
`YogaNode::setStyle(...)` for numeric Yoga layout style fields.

Invalid `NaN`/`Infinity` layout numbers now throw before `invalidateLayout()`,
`_style` replacement, Yoga reset/mutation, paint reset/mutation, layer reset,
clip reset, or matrix reset. Existing percentage/`auto`/width-special string
validation remains unchanged, Worker 210 paint/border finite validation remains
in the same pre-mutation validator, and finite out-of-range values keep existing
behavior.

## Changed files

- `cpp/YogaNode.cpp`
  - Added a finite-number validator overload for numeric branches of
    `std::optional<std::variant<std::string, double>>`.
  - Extended `validateFiniteNumericStyleFields(...)` to cover layout scalars and
    layout unit variants before native mutation.
- `scripts/verify-yoganode-nitro-materialization.mjs`
  - Added source guards for public/generated/native layout numeric field wiring.
  - Strengthened pre-mutation source guards to require validation before
    layout invalidation, style replacement, Yoga reset, paint/layer/clip/matrix
    resets.
  - Extended generated materialized negative coverage for non-finite direct
    layout scalars and numeric branches of layout unit variants.
  - Extended the preservation baseline to assert previous `_style` optionals,
    selected Yoga getter state, paint, clip, layer, matrix, and computed layout
    state survive rejected inputs.
- `worker-progress/worker-212-layout-numeric-finite-validation.md`
  - This report.

## Covered inventory

Direct `optional<double>` layout scalars:

- `aspectRatio`, `flex`, `flexGrow`, `flexShrink`, `gap`, `rowGap`,
  `columnGap`

Numeric branches of layout variants:

- `flexBasis`, `width`, `height`, `minWidth`, `minHeight`, `maxWidth`,
  `maxHeight`
- `top`, `right`, `bottom`, `left`, `start`, `end`
- `margin`, `marginTop`, `marginBottom`, `marginLeft`, `marginRight`,
  `marginStart`, `marginEnd`, `marginHorizontal`, `marginVertical`
- `padding`, `paddingTop`, `paddingBottom`, `paddingLeft`, `paddingRight`,
  `paddingStart`, `paddingEnd`, `paddingHorizontal`, `paddingVertical`
- `inset`, `insetHorizontal`, `insetVertical`

Preserved from earlier workers:

- Worker 206 layout unit string behavior for finite percentages, allowed
  `auto`, and width-only `fit-content`/`max-content`/`stretch`.
- Worker 210 finite validation for the border-width family, `strokeMiter`, and
  `opacity`.

Intentional exclusions:

- Radius fields (`borderRadius` and per-corner scalar/`SkPoint` variants),
  `SkPoint` payloads, matrix arrays, transform operation leaves, command
  numeric payloads, and any range semantics such as non-negative dimensions or
  opacity clamping.

## Verification results

- `git diff --check` - passed
- `node --check scripts/verify-yoganode-nitro-materialization.mjs` - passed
- `npm run check:yoganode-nitro-materialization` - passed
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 18s

The materialization verifier compiles and runs a host-JSC probe against real
`YogaNode.cpp`, generated `HybridYogaNodeSpec.cpp`, generated `NodeStyle.hpp`,
Nitro, Yoga, React Native JSC, and RN Skia macOS archives. The new negative loop
uses generated JS-facing `setStyle(...)` on materialized YogaNodes and verifies
the deterministic message shape:

`Invalid numeric style value for <field>: expected a finite number.`

## Proof boundary and overclaim risks

- Proves source-level public/generated/native wiring for the listed layout
  fields and native pre-mutation ordering in `YogaNode::setStyle(...)`.
- Proves generated materialized Nitro `setStyle(...)` rejection for the listed
  finite numeric layout inventory through a host-JSC executable.
- Proves rejected non-finite layout values preserve selected previous
  `_style` optionals, Yoga getters, `_paint`, Yoga border state, clip, layer,
  matrix, and computed layout state from the verifier baseline.
- Does not prove exhaustive numeric style validation. Radius, `SkPoint`, matrix
  array, and transform numeric surfaces remain out of scope.
- Does not prove exact Yoga conformance beyond asserted getter/layout values,
  React Native bridge delivery, Nitro registry install inside a React Native app,
  iOS/Android simulator or device runtime, UI-runtime Worklets execution,
  Reanimated delivery, or RNGH native delivery.

## Quality, maintainability, performance, security

- Quality: validation is deterministic and centralized in the existing
  pre-mutation numeric validator.
- Maintainability: the source guards make the manual layout numeric inventory
  fail loudly if public/generated/native wiring drifts.
- Performance: the added checks are constant-time optional/variant inspections
  before the heavier style reset and Yoga mutation work.
- Security: rejecting non-finite layout values prevents NaN/Infinity propagation
  into Yoga and downstream layout/render state.

## Cleanup status

- No public TypeScript contracts, generated Nitro artifacts, package metadata,
  master docs, examples, or unrelated verifiers were edited.
- `npm run check:feasible-matrix` removed its generated `tsconfig.tsbuildinfo`
  and matrix-owned temp parent.
- Ignored `node_modules` symlinks were left untouched.
- Worktree changes before commit are limited to the three owned files.

Goal finished.
