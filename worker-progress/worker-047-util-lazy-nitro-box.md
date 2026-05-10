# Worker 047 - util lazy Nitro box

## Goal lifecycle
- `create_goal` objective: `Fix util NitroModules.box import-time side effect.`
- Required visible gate emitted exactly: `GOAL_CREATED: Fix util NitroModules.box import-time side effect.`
- `update_goal(status: "complete")`: completed after report, final `git diff --check`, final status capture, and cleanup checks passed. Worker reported time used: 570 seconds.

## Baseline
- Worktree: `/Users/user/Developer/Developer/respond/react-native-skia-yoga-workspace/worker-047-util-lazy-nitro-box`
- Branch: `worker/047-util-lazy-nitro-box`
- HEAD at start: `536847f4dcd220465fb0067a8076dd7f3029c512`
- Initial tracked status: `git status --short --branch` returned only `## worker/047-util-lazy-nitro-box`.
- Ignored local state observed during final status capture: `example/node_modules`, `node_modules`, `tsconfig.tsbuildinfo`.

## Root cause
- `src/index.ts` publicly exports `YogaCanvas`.
- `src/YogaCanvas.tsx` imports `createYogaNode` from `./util`.
- `src/Reconciler.ts` also imports `createYogaNode` from `./util`.
- Before this change, `src/util.ts` evaluated `NitroModules.box(NitroModules)` at module import time, so the public source entrypoint could box Nitro before any Yoga node creation was requested.
- The existing verifier was blind to this path because it stubbed `src/util.ts` during the public import-only check.

## Product decision
- `NitroModules.box(NitroModules)` is now lazy and cached in `src/util.ts`.
- `createYogaNode()` still contains the `"worklet"` node creation body and still creates `YogaNode` hybrid objects only when called.
- Repeated `createYogaNode()` calls reuse the boxed Nitro proxy and still unbox per explicit node creation.
- No new global mutation was introduced. `globalThis.SkiaYoga` remains untouched by import-only and `createYogaNode()` paths.
- Worklets/Nitro note: Babel transform evidence showed `createYogaNode.__closure` now captures only `lazyNitroModulesBox`; the worklet body reads `lazyNitroModulesBox.current.unbox()` and does not directly capture `NitroModules`. The lazy accessor boxes on first direct call, and should also box during Worklets serialization if the captured object is cloned before UI-runtime execution.

## Implementation summary
- Changed `src/util.ts`:
  - replaced the top-level boxed Nitro constant with `createNitroModulesBox()`, a cached `nitroModulesBox`, and `lazyNitroModulesBox.current`;
  - kept `createYogaNode()` as the explicit workletized YogaNode factory.
- Changed `scripts/verify-skia-yoga-object-lazy-init.mjs`:
  - removed the `src/util.ts` project stub;
  - kept the `Reconciler` stub, while allowing `YogaCanvas -> util` to evaluate;
  - added negative public import-only assertions for Nitro boxing/unboxing, native lookup/install, hybrid creation, logging, and `globalThis.SkiaYoga`;
  - added explicit `createYogaNode()` call-time coverage: 0 boxes on import, 1 box across two calls, 2 unboxes, and 2 `YogaNode` hybrid creations;
  - added `YogaCanvas` runtime root creation coverage: public import has 0 boxes, rendering creates 1 `YogaNode` lazily.

## Verification
- `git diff --check`: passed.
- `npm run check:skia-yoga-object-lazy-init`: passed.
- `npm run check:package-typescript-consumer`: passed.
- `npm run check:package-surface`: passed.
- `npm run typecheck`: passed.
- `npm run lint-ci`: passed.
- `cd example && bun run typecheck`: passed.
- `bun run specs`: passed and regenerated matching Nitrogen output.
- `npm run check:example-bundle`: passed; temporary export output was cleaned.
- `bun run check:install-isolation`: passed.
- `perl -e 'alarm 600; exec @ARGV' bun run check:package-lifecycle`: passed.
- `npm run check:rn-skia-imports`: passed.
- `bun run check:android-skia-archives`: passed.
- `bun run check:yoganode-native-lifetime`: passed.
- `bun run check:yoganode-native-runtime`: passed.

## Cleanup evidence
All requested cleanup probes returned empty output:
- `find . -maxdepth 3 \( -name '*.tgz' -o -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find "$(node -p "require('node:os').tmpdir()")" -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`
- `find /tmp -maxdepth 1 \( -name 'rnskia-package-typescript-consumer-*' -o -name 'rnskia-package-lifecycle-*' -o -name 'react-native-skia-yoga-*.tgz' -o -name 'rnskia-example-export.*' \) -print | sort`

## Nested challenger
- First nested spawn prompt: read-only challenger to review public import-only side effects, explicit `createYogaNode()` and `YogaCanvas` runtime paths, Worklets/Nitro closure safety, verifier regression strength, and cleanup evidence.
- First nested spawn result: failed immediately because a full-history fork cannot change `agent_type`.
- Retry prompt: same read-only review, using `fork_turns: "none"` and no model or agent override as required.
- Retry result: stalled; after repeated waits it was closed with `previous_status.completed: null`.
- No nested acceptance verdict is claimed.

## Quality review
- Maintainability: the lazy cache is small and local to `src/util.ts`; the verifier now covers the actual public import chain instead of bypassing `util`.
- Performance: first node creation performs one box; later nodes reuse it and only unbox/create the requested `YogaNode`.
- Security and safety: no new dynamic module loading, filesystem access, network access, or global writes were added.
- Remaining risk: the Worklets runtime behavior relies on serializing the captured lazy accessor object so its enumerable `current` getter resolves the boxed Nitro proxy before UI-runtime use. The transformed worklet no longer captures `NitroModules` directly, which avoids the unsafe direct HybridObject capture, but this should still be treated as runtime-sensitive.

## Final status
- Intentional tracked changes before report: `src/util.ts`, `scripts/verify-skia-yoga-object-lazy-init.mjs`.
- This report file is intentional.
- No commits were made.
