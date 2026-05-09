# Worker 008 Reset Semantics Report

## Goal Lifecycle

- Goal objective: `Fix text fallback alpha semantics in the reset patch, preserving fallback alpha unless style opacity is explicit.`
- `create_goal` succeeded before any file inspection or commands that changed product state.
- The required visible gate message was emitted immediately after the goal tool returned.
- No goal-tool blocker was encountered.

## Root Cause

The previous reset patch correctly moved text fallback color selection into `YogaNode::drawInternal()`, but it overreached on alpha handling.

The regression was:

- `fallbackPaintColor()` was always merged with the current paint alpha
- that preserved explicit `style.opacity`
- but it also discarded the fallback text alpha when `style.opacity` was omitted

The root fix is to treat style opacity as the only reason to borrow the current paint alpha. If opacity is absent, the fallback color should keep its own alpha.

## Contract Decision

The corrected contract is:

- text fallback color applies only when `style.backgroundColor` is absent
- explicit `style.backgroundColor` still wins over text fallback color
- when `style.opacity` is present, text fallback color uses the style-applied paint alpha
- when `style.opacity` is absent, text fallback color keeps its own alpha
- optional style or command prop omission still resets to default

This remains a breaking semantic change by design where omission means reset, not retention, but the fallback alpha now matches the intended precedence.

## Changes

Current product changes in this worktree are confined to:

- [`cpp/YogaNode.cpp`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-008-reset-semantics/cpp/YogaNode.cpp)
- [`cpp/YogaNode.hpp`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-008-reset-semantics/cpp/YogaNode.hpp)

What the patch does:

- Introduces `defaultYogaStyleNode()` and `resetYogaStyle()` so `setStyle` can copy Yoga defaults before applying incoming style.
- Clears native paint, layer, clip, and matrix state at the start of `setStyle` so omitted style props cannot leak across updates.
- Keeps `transform`/`matrix` selection behavior intact after reset: a present `transform` wins, otherwise a present `matrix` is applied.
- Moves text draw color into a command-level fallback path and exposes `fallbackPaintColor()` on `YogaNodeCommand` so style paint can win when explicit.
- Preserves explicit `style.opacity` when text fallback color is applied by combining the fallback RGB with the current paint alpha instead of replacing the full color.
- Resets `BlurMaskFilterCmd` props before applying new values.
- Resets `TextCmd` font to the default font before applying optional font overrides.
- Stores the text fallback color in `TextCmd` instead of mutating the shared node paint directly.
- Makes `PointsCmd` default back to `SkCanvas::PointMode::kPoints_PointMode` when `pointMode` is omitted.

## Nested Subagent Results

No new nested subagent was spawned in this worker finalization pass.

Prior evidence from the worker logs shows the earlier implementation attempt did use nested read-only hypothesis checking, which is the evidence relevant to this task:

- The prior v2/v3/fixup logs document a nested read-only explorer used to check the reset/default hypothesis against the same native code paths.
- That evidence supported the root cause that stale native state was preserved when optionals were omitted.
- The finalizer logs also show the worker continued investigating style/command reset semantics rather than patching a symptom.

## Verification

Completed verification:

- `git diff --check`: passed.
- Focused readback confirmed `YogaNode::drawInternal()` now preserves fallback alpha unless `style.opacity` is present, in which case it borrows the style-applied paint alpha.
- Final `git status --short`:
  - `M cpp/YogaNode.cpp`
  - `M cpp/YogaNode.hpp`
  - `?? worker-progress/worker-008-reset-semantics.md`

No broad build or install work was run, per instruction.

## Quality / Maintainability / Performance / Security Review

- Quality: the patch fixes the root reset contract instead of layering conditionals on top of stale native state.
- Maintainability: resetting the node and command state up front makes future optional-prop handling easier to reason about.
- Performance: the extra reset work is linear in the existing style application path and should be negligible compared with layout/draw work.
- Security: no new security-sensitive surface was introduced; the only low-level concern is ensuring the fallback paint color remains consistent with the text command contract.

## Files Changed

- [`cpp/YogaNode.cpp`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-008-reset-semantics/cpp/YogaNode.cpp)
- [`cpp/YogaNode.hpp`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-008-reset-semantics/cpp/YogaNode.hpp)
- [`worker-progress/worker-008-reset-semantics.md`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-008-reset-semantics/worker-progress/worker-008-reset-semantics.md)

## Remaining Risks

- `defaultYogaStyleNode()` uses a static Yoga node to source defaults; that is intentional for this patch, but it should be kept under watch if Yoga initialization or shutdown semantics change.
- The text fallback path now depends on `fallbackPaintColor()`; if future command types need different color precedence, they should implement that explicitly rather than inheriting accidental paint state.
- The fallback alpha split now depends on `_style.opacity.has_value()` as the explicit opacity signal; if that contract changes, `drawInternal()` should be revisited.
