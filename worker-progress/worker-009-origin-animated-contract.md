# Worker 009 Report: Origin and Nested Animated Style Contract

## Goal lifecycle
- Goal created and kept active through verification and report writing.
- Scope stayed on the existing origin/animated style contract patch in this worktree.
- Goal can be marked complete after this report is written and verification has passed.

## Root cause
- `origin` was still exposed in the public style contract even though runtime behavior did not implement transform-origin semantics.
- The original mismatch was between the TS/spec surface, examples, generated Nitrogen bindings, and reconciler runtime behavior.
- The reconciler already had an explicit runtime guard for `style.origin`, so the fix direction is to remove public exposure rather than simulate support.

## Contract decision
- `origin` is not part of the supported public style contract.
- The runtime guard stays intentional as a hard failure for unsupported input.
- Nested animated style support remains, but only for shapes the runtime can normalize safely:
  - scalar corner radii
  - `transform`
  - `matrix` with whole-value shared animation, not nested shared entries

## Changes
- Removed `origin` from the style spec in [`src/specs/style.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/specs/style.ts).
- Updated [`src/jsx.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/jsx.ts) to use a narrower `YogaAnimatedStyle` contract instead of the overly permissive deep object recursion for `style`.
- Kept the reconciler guard in [`src/Reconciler.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/Reconciler.ts) that throws on `style.origin`.
- Removed the public origin demo from [`example/app/(tabs)/styles/transform-demos.tsx`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/app/(tabs)/styles/transform-demos.tsx).
- Updated the showcase registry copy in [`example/app/(tabs)/styles/registry.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/app/(tabs)/styles/registry.ts).
- Extended [`example/types/skiayoga-typecheck.tsx`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/types/skiayoga-typecheck.tsx) to cover the unsupported `origin` shape and the supported nested animated corner-radius shapes.
- Regenerated Nitrogen output in [`nitrogen/generated/shared/c++/NodeStyle.hpp`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/nitrogen/generated/shared/c++/NodeStyle.hpp) so the generated C++ contract no longer includes `origin`.

## Nested subagent results
- No nested subagents were spawned.
- Verification did not reveal an ambiguous root cause that required delegation.

## Verification
- `bun run specs` passed and regenerated Nitrogen successfully.
- `npm run typecheck` passed.
- Targeted search confirmed active `origin` references are limited to:
  - the intentional runtime guard in [`src/Reconciler.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/Reconciler.ts)
  - the negative typecheck coverage in [`example/types/skiayoga-typecheck.tsx`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/types/skiayoga-typecheck.tsx)
- Targeted search also confirmed there are no remaining public example/spec references for `origin` under `src`, `example`, or `nitrogen/generated`.

## Quality, maintainability, performance, security review
- Quality: the contract is now aligned across TS, examples, reconciler, and generated bindings.
- Maintainability: the runtime guard preserves a single explicit failure path instead of allowing silent misbehavior.
- Performance: no new runtime work was added beyond the existing guard and style normalization.
- Security: no security-sensitive surfaces were changed.

## Files changed
- [`example/app/(tabs)/styles/registry.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/app/(tabs)/styles/registry.ts)
- [`example/app/(tabs)/styles/transform-demos.tsx`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/app/(tabs)/styles/transform-demos.tsx)
- [`example/types/skiayoga-typecheck.tsx`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/example/types/skiayoga-typecheck.tsx)
- [`nitrogen/generated/shared/c++/NodeStyle.hpp`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/nitrogen/generated/shared/c++/NodeStyle.hpp)
- [`src/Reconciler.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/Reconciler.ts)
- [`src/jsx.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/jsx.ts)
- [`src/specs/style.ts`](/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-009-origin-animated-contract/src/specs/style.ts)

## Remaining risks
- The runtime still rejects `style.origin` rather than implementing transform-origin semantics.
- If native transform-origin support is added later, this contract will need a deliberate re-expansion across spec, runtime, and examples.
