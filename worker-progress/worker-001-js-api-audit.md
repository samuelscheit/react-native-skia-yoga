# Worker 001 JS/TS API Audit Recovery

## Goal Lifecycle

- V5 `create_goal` objective used exactly: `Validate and finalize the JS/TS API audit report for react-native-skia-yoga from prior tmux worker evidence without changing product code.`
- V5 `create_goal` succeeded before shell/file inspection. The required visible gate message was emitted exactly after the tool returned, and v5 is the accepted completion pass for this report.
- V5 `update_goal(status: "complete")`: yes, called after this report was written, the final worktree status was recorded, and no required cleanup remained.
- V5 goal-tool blockers: none.
- V3 visible goal gate passed. The accepted v3 log starts with `GOAL_CREATED: Audit the JS/TS API, reconciler, JSX runtime, interaction layer, and example usage for react-native-skia-yoga without changing product code.` See `worker-logs/worker-001-js-api-audit-v3.jsonl:3`.
- V3 `update_goal(status: "complete")`: not found in the v3 JSONL log. The v3 turn failed at the end with usage-limit errors before report write/completion. See `worker-logs/worker-001-js-api-audit-v3.jsonl:209-213`.
- V3 goal-tool blockers: no goal-tool blocker recorded; terminal blocker was usage limit, not repo state.
- V4 produced a detailed draft report, but `worker-logs/worker-001-js-api-report-v4.jsonl` is not usable for acceptance because it only contains `[worker-001-v4 exit status 1]`.

## Scope And Commands

This recovery used the accepted v3 evidence as primary input, then verified only high-signal file references in the current worktree. No product code was changed.

V3 scope:

- Audited package entrypoints, JSX runtime/type declarations, `src/index.ts`, `src/YogaCanvas.tsx`, `src/Reconciler.ts`, `src/jsx.ts`, specs, interactivity, examples, typecheck harness, selected native runtime files, and generated Nitro C++ types.
- Spawned two nested read-only hypothesis agents. Agent `019e0dd3-23a9-7b91-8635-2900159356ff` was asked to check README/example/public API alignment but did not return before the v3 turn ended. Agent `019e0dd3-23dc-7843-8a4c-7075ba646df9` was asked to check style/spec/command runtime drift and returned completed findings. See `worker-logs/worker-001-js-api-audit-v3.jsonl:62-65` and `worker-logs/worker-001-js-api-audit-v3.jsonl:208`.
- Ran read-only discovery and source reads: `pwd`, `rg --files -g '!ORCHESTRATOR.md'`, `git status --short`, `nl -ba` over package, README, JS/TS source, specs, examples, tsconfigs, JSX runtime files, and selected C++ files.
- Ran targeted searches over examples/API/runtime: `rg -n "react-native-skia-yoga|jsxImportSource|YogaCanvas|<group|<rect|..."`, `rg -n "getChildren|hitTest|setInteractionConfig|computeLayout|layout"`, `rg -n "export (function|const|class|interface|type)|export \\*|export \\{"`, `rg -n "\\b(Canvas|View|Text)\\b"`, `rg -n "@ts-ignore|@ts-expect-error|any|globalThis|console\\.log|console\\.error|throw new Error|require\\("`, and `rg -n "SharedValue|YogaDeepAnimated|styleNestedRoots|commandNestedRoots|matrix|borderTopLeftRadius|cornerRadius|textStyle|paragraphStyle|stroke"`.
- Ran verification probes: `bun run typecheck` in the root and example contexts, `ls example/node_modules/.bin/tsc`, `ls node_modules/.bin/tsc`, `which bun`, `which tsc`, `ls -la node_modules`, `ls -la example/node_modules`, and `find lib -maxdepth 2 -type f`.
- V3 typecheck result: both typecheck attempts failed because `tsc` was not installed and neither root nor example `node_modules` existed. See `worker-logs/worker-001-js-api-audit-v3.jsonl:189-195`.

V4 scope:

- Read the v3 JSONL log with `wc -l`, `sed`, `rg`, and `jq` extraction. `jq` emitted useful data but exited with a parse error because the final `[worker-001-v3 exit status 0]` line is not JSON.
- Verified nested subagent presence with `rg -n "019e0dd3-23a9|019e0dd3-23dc|spawn_agent|collab_tool_call"`.
- Verified current source line references with read-only `nl -ba ... | sed -n ...` commands for `package.json`, `README.md`, `src/index.ts`, `src/YogaCanvas.tsx`, `src/jsx.ts`, `src/specs/style.ts`, `src/specs/commands.ts`, `src/specs/SkiaYoga.nitro.ts`, `src/interactivity.ts`, `src/Reconciler.ts`, `cpp/YogaNode.cpp`, `nitrogen/generated/shared/c++/NodeStyle.hpp`, `scripts/sync-example-links.mjs`, `src/jsx-runtime*.ts`, `src/jsx-runtime-types.ts`, example tsconfigs, the typecheck harness, and transform demos.
- Verified packaging/runtime gaps with `find lib -maxdepth 2 -type f`, `rg -n "origin" cpp android ios nitrogen/generated src example README.md`, `which tsc`, `which bun`, `ls -la node_modules`, and `ls -la example/node_modules`.
- Created only `worker-progress/worker-001-js-api-audit.md`.

## Current Public API Summary

- Package entrypoints currently point runtime consumers at source but type consumers at generated output: `main`, `module`, `react-native`, and `source` point to `src/index`, while `types` points to `lib/index.d.ts`; `lib` is also listed in published files. See `package.json:5-14`.
- Root JS/TS API exports `SkiaYoga`, all interactivity APIs, the reconciler, JSX types, utilities, and `YogaCanvas`. `YogaNodeFinal` adds `setCommand`, `draw`, `getChildren`, `hitTest`, and `setInteractionConfig` to the generated native `YogaNode` interface. See `src/index.ts:1-20`.
- `YogaCanvas` is the public React component. Its props extend Skia `CanvasProps` and add `animationBindingMode?: "native" | "js"`, `gesture?: GestureType`, `onProfileSample`, and `profilingEnabled`. See `src/YogaCanvas.tsx:20-25` and `src/YogaCanvas.tsx:79-89`.
- JSX primitives are lowercase intrinsic elements, not exported React components: `blurMaskFilter`, `circle`, `group`, `image`, `line`, `oval`, `paragraph`, `path`, `points`, `rect`, `rrect`, and `text`. See `src/jsx.ts:161-174`.
- Node command props are declared in `src/jsx.ts` and generated/native command specs in `src/specs/commands.ts`. Required command payloads include `path`, `line.from`, `line.to`, and `points`; many other command fields are optional. See `src/jsx.ts:101-159` and `src/specs/commands.ts:103-172`.
- Style API is `YogaNodeStyle = NodeStyle`, with Yoga layout fields, Skia paint fields, transform fields, `origin`, `matrix`, clipping, and layer fields. See `src/jsx.ts:30-31` and `src/specs/style.ts:160-259`.
- Interactivity is available on all JSX nodes through `YogaInteractiveProps`: press handlers, pan handlers, `pointerEvents`, `hitSlop`, and `preciseHit`. The registry normalizes these into `YogaNodeInteractionConfig` and calls native `setInteractionConfig`. See `src/interactivity.ts:38-55` and `src/interactivity.ts:115-158`.
- The TypeScript JSX runtime source files re-export React runtimes while supplying package-owned JSX namespace types. See `src/jsx-runtime.ts:1-16`, `src/jsx-dev-runtime.ts:1-16`, and `src/jsx-runtime-types.ts:1-14`.

## Tested Hypotheses And Evidence

### H1: Package/type declarations are not publish-consumable from this worktree

Supported.

- `package.json` advertises `types: "lib/index.d.ts"` and includes `lib` in package files, but `find lib -maxdepth 2 -type f` returns `find: lib: No such file or directory`. See `package.json:5-14`.
- Root JSX runtime declaration shims point at generated `lib` files: `jsx-runtime.d.ts:1` exports from `./lib/jsx-runtime`, and `jsx-dev-runtime.d.ts:1` exports from `./lib/jsx-dev-runtime`.
- Runtime JS shims do not point at package-generated JSX runtimes. They re-export React directly: `jsx-runtime.js:1-3` uses `require("react/jsx-runtime")`, and `jsx-dev-runtime.js:1-3` uses `require("react/jsx-dev-runtime")`.
- The source runtime files that would provide package-owned JSX namespace types exist under `src/`, not root `lib/`. See `src/jsx-runtime.ts:1-16` and `src/jsx-dev-runtime.ts:1-16`.

Root cause: publication metadata assumes a generated `lib` build exists, but the checked worktree and root runtime shims are source-first. TypeScript consumers that follow package `types` or `jsx-runtime.d.ts` will resolve missing files unless a build step runs before publication/consumption.

### H2: README and examples describe different public APIs

Supported.

- README usage starts with `import { Canvas, View, Text } from "react-native-skia-yoga"` and uses `<Canvas>`, `<View>`, and child text content. See `README.md:10-40`.
- Current exports do not include `Canvas`, `View`, or `Text`; `src/index.ts:6-20` exports `YogaCanvas` plus type/reconciler utilities.
- Current JSX contract uses lowercase intrinsic nodes and explicit text props. See `src/jsx.ts:117-174`.
- README interactivity section is closer to the current API and uses `YogaCanvas`, `<group>`, `<rrect>`, handlers, `preciseHit`, and `hitSlop`. See `README.md:43-104`.
- Examples and typecheck harness follow the newer lowercase surface. See `example/types/skiayoga-typecheck.tsx:71-180`, `example/components/CommandDemoScreen.tsx:3-22`, and `example/components/StyleShowcaseScreen.tsx:3-59`.

Root cause: README introductory API was not migrated with the breaking JSX/API change, while examples and type tests were.

### H3: Native optional style fields treat omission as "no change", conflicting with React prop removal/defaulting

Supported by v3 nested agent `019e0dd3-23dc-7843-8a4c-7075ba646df9` and verified in source.

- The nested agent concluded: "Removing style props leaves stale native state" and identified the root cause as native absent-field semantics conflicting with React removed/default semantics. See `worker-logs/worker-001-js-api-audit-v3.jsonl:208`.
- JS applies the current resolved style wholesale with `instance.setStyle(resolvedStyle)`. See `src/Reconciler.ts:841-853`.
- Native style application commonly mutates only present optionals. Examples: width only changes when `style.width` is present (`cpp/YogaNode.cpp:347-368`), background color only when present (`cpp/YogaNode.cpp:618-630`), and opacity only when present (`cpp/YogaNode.cpp:632-634`).
- Some native fields do reset when omitted, for example clip fields reset in the `else` block. See `cpp/YogaNode.cpp:685-704`. This inconsistency is itself contract risk.

Likely failure mode: rendering `<rect style={{ opacity: 0.5 }} />` and later `<rect style={{}} />` can leave the native paint alpha at `0.5` instead of restoring default opacity. Similar stale state can occur for layout and paint properties.

Root cause: JS sends an object that represents the current React props, but native interprets absent fields as "leave previous state alone" for many properties. A root fix needs explicit default/reset semantics across the JS/native style contract, not per-field patches.

### H4: Optional command props can also stick after removal

Supported by v3 nested agent and verified in source.

- JS command construction sends `undefined`/omitted values for many optional command fields: text `font`/`textStyle` (`src/Reconciler.ts:660-665`), points `pointMode` (`src/Reconciler.ts:688-692`), blur filter fields (`src/Reconciler.ts:699-704`), and rrect/circle scalar fields (`src/Reconciler.ts:650-657`).
- Native update methods reset some optional command state but not all. `PathCmd` resets `stroke` and `fillType` when absent (`cpp/YogaNode.cpp:1486-1500`), but `BlurMaskFilterCmd` only updates `blurStyle` and `respectCTM` if values are present (`cpp/YogaNode.cpp:1450-1458`), `TextCmd` only updates `font` if present (`cpp/YogaNode.cpp:1461-1477`), and `PointsCmd` only updates `mode` if present (`cpp/YogaNode.cpp:1512-1518`).
- The nested agent described this as "the same absent-means-unchanged semantic leaking into React command updates." See `worker-logs/worker-001-js-api-audit-v3.jsonl:208`.

Likely failure mode: removing `blurStyle`, `respectCTM`, `font`, or `pointMode` in React props leaves the previous native command value active. This is visible contract drift, not just an internal implementation detail.

### H5: `origin` is public in TS/spec/examples but absent from native transform semantics

Supported by v3 nested agent and verified in source.

- `origin?: [number, number]` is part of `NodeStyle`. See `src/specs/style.ts:252-255`.
- The reconciler treats `origin` as a nested animated style root. See `src/Reconciler.ts:112-119`.
- Examples explicitly showcase `origin: [80, 40]`. See `example/app/(tabs)/styles/transform-demos.tsx:38-54` and `example/app/(tabs)/styles/registry.ts:53-59`.
- Generated Nitro C++ stores/converts `origin`, but native transform application reads `matrix` and `transform`; source search found no C++ transform use of `origin` outside generated storage. See `nitrogen/generated/shared/c++/NodeStyle.hpp:280-281`, `cpp/YogaNode.cpp:706-720`, and the V4 `rg -n "origin" cpp android ios nitrogen/generated src example README.md` result.

Likely failure mode: TypeScript and examples promise transform-origin behavior, but rendered output rotates/scales around the native default because `origin` is ignored during matrix construction.

Root cause: spec/examples moved ahead of native transform implementation. Until native transform-origin math exists, the JS/API surface should not advertise it as supported.

### H6: Deep animated style typing accepts shapes that runtime/native conversion do not support

Supported by v3 nested agent and verified in source.

- `YogaDeepAnimated<T>` recursively permits `SharedValue` inside arrays and objects. See `src/jsx.ts:61-74`.
- `matrix` accepts `SkMatrixNative | MatrixArray`; matrix arrays are numeric tuples. See `src/specs/style.ts:103-135` and `src/specs/style.ts:252-255`.
- Runtime traversal only descends into roots listed in `styleNestedRoots`: corner radii, `origin`, and `transform`. It does not list `matrix`. See `src/Reconciler.ts:112-119`.
- `bindAnimatedValues` returns nested values untouched when `shouldTraverseNestedValue` is false. See `src/Reconciler.ts:381-445`.
- Generated native conversion expects matrix arrays to be tuples of numbers, not tuples containing `SharedValue` objects. See `nitrogen/generated/shared/c++/NodeStyle.hpp:279-281`.

Likely failure mode: a value such as `style={{ matrix: [sharedX, 0, ...] }}` can type-check through `YogaDeepAnimated`, then leak a `SharedValue` object to a native converter expecting numbers.

Root cause: the public generic animated type is broader than the runtime traversal/conversion contract. Prefer a breaking type narrowing or an explicit JS normalization layer over accepting impossible shapes.

### H7: `SharedValue<SkPoint>` corner radius normalization produces the wrong runtime shape

Supported by v3 nested agent and verified in source.

- `NodeStyle` allows per-corner radii as `number | SkPoint`. See `src/specs/style.ts:231-238`.
- `YogaDeepAnimated` allows a `SharedValue<SkPoint>` object value. See `src/jsx.ts:61-74`.
- `normalizeStyle` treats any shared corner radius as scalar and rewrites it to `{ x: value, y: value }`. See `src/Reconciler.ts:121-151`.
- Because corner radii are traversed nested style roots, a `SharedValue<SkPoint>` becomes `{ x: shared.value, y: shared.value }`, where each field is itself a point object. Native conversion expects a `SkPoint` with numeric `x`/`y`. See `src/Reconciler.ts:112-119`, `src/Reconciler.ts:381-445`, and `nitrogen/generated/shared/c++/NodeStyle.hpp:268-271`.
- Examples cover static point radii, not animated point radii. See `example/app/(tabs)/styles/paint-demos.tsx:65-71`.

Likely failure mode: animated point radii either fail native conversion or produce invalid corner radii. This is caused by scalar-radius normalization running before it knows whether a shared value contains a number or a point.

## Contract Mismatches

- README initial usage is legacy named-component API, while actual exports and examples use `YogaCanvas` plus lowercase JSX primitives. See `README.md:10-40`, `src/index.ts:6-20`, and `src/jsx.ts:161-174`.
- Root package type metadata and root JSX `.d.ts` files require generated `lib`, but this worktree has no `lib` directory. See `package.json:5-14`, `jsx-runtime.d.ts:1`, and `jsx-dev-runtime.d.ts:1`.
- Root JSX runtime JS and declarations disagree: JS delegates to React runtime, declarations delegate to package-generated runtime types. See `jsx-runtime.js:1-3`, `jsx-dev-runtime.js:1-3`, `jsx-runtime.d.ts:1`, and `jsx-dev-runtime.d.ts:1`.
- Type/spec/examples include `origin`, but native transform construction ignores it. See `src/specs/style.ts:254`, `example/app/(tabs)/styles/transform-demos.tsx:39-48`, and `cpp/YogaNode.cpp:706-720`.
- Type system permits nested animated values more broadly than the reconciler/native converter supports. See `src/jsx.ts:61-74`, `src/Reconciler.ts:112-119`, `src/Reconciler.ts:406-408`, and `nitrogen/generated/shared/c++/NodeStyle.hpp:279-281`.
- Typecheck harness rejects known legacy props and covers happy-path shared values, but does not cover prop removal/defaulting, nested `SharedValue` matrix entries, `SharedValue<SkPoint>` corner radii, publication entrypoint resolution, or runtime reset semantics. See `example/types/skiayoga-typecheck.tsx:26-65` and `example/types/skiayoga-typecheck.tsx:71-180`.
- Example tsconfigs use `jsxImportSource: "react-native-skia-yoga"`, but package `tsconfig.json` uses classic `jsx: "react"` and emits to `lib`. See `example/tsconfig.json:3-15`, `example/tsconfig.skiayoga.json:3-9`, and `tsconfig.json:3-15`.

## Root-Cause Risks And Likely Failure Modes

- Publication risk: source-first runtime fields plus missing `lib` types can break external TypeScript consumers before runtime.
- React semantics risk: prop removal does not reliably reset native style/command state, so UI can display stale layout, paint, text, blur, or point-mode values.
- Spec drift risk: generated types can contain fields that native runtime ignores. `origin` is the clearest example.
- Type unsoundness risk: broad `YogaDeepAnimated` accepts nested animated shapes that the runtime either does not traverse or converts incorrectly.
- Test confidence risk: v3 and v4 could not run typecheck because `tsc` is unavailable and both `node_modules` directories are absent. V3 recorded `bun run typecheck` failing with `tsc: command not found`; V4 verified `which tsc` returns `tsc not found`.
- Example coverage risk: examples validate many static/happy-path visual APIs but not React update semantics, removal/default behavior, or malformed-but-type-accepted animated shapes.

## Prioritized JS/TS Implementation Tasks

1. Fix package/type publication contract. Either ensure `lib` is generated before publish and checked by CI, or change package `types`/JSX declaration entrypoints to a real checked-in/generated path. Add a package-consumer TypeScript smoke test for `import { YogaCanvas }` and `jsxImportSource: "react-native-skia-yoga"`.
2. Align root JSX runtime declarations with runtime behavior. The source runtime files provide the intended JSX namespace; root `.d.ts` files should point to real generated files or directly to source-compatible declarations.
3. Make a breaking TS/API decision for animated shapes. Narrow `YogaDeepAnimated` so arrays such as `matrix` cannot contain nested `SharedValue` entries unless the reconciler actually traverses and normalizes them. Add negative type tests for unsupported nested shared values.
4. Fix corner-radius normalization in JS. Preserve `SharedValue<SkPoint>` as a point-valued shared object or reject it in types/runtime; do not scalar-normalize all shared values blindly.
5. Remove or clearly mark `origin` as unsupported until native transform-origin implementation lands. Keep examples and type declarations aligned with actual runtime behavior.
6. Add JS-side regression coverage for React prop removal/defaulting. At minimum, write reconciler-level tests or a focused harness that transitions props from set to omitted for style and command fields and asserts the intended native payload/reset contract.
7. Define a cross-boundary reset contract for optional style/command fields. JS can own the public contract and tests; any native reset implementation should be a separate native-focused task.
8. Update README initial usage to `YogaCanvas` and lowercase intrinsic JSX nodes. Remove `Canvas`, `View`, and `Text` imports unless compatibility wrappers are intentionally added.
9. Add CI setup that installs dependencies or restores the expected toolchain before `bun run typecheck` and example typecheck run. Current scripts cannot validate the API without `tsc`.

## Review Notes

Quality:

- The root issue is contract drift, not isolated bad fields. Package metadata, README, examples, TS types, reconciler conversion, generated specs, and native runtime need one explicit source of truth.
- `src/Reconciler.ts` uses several `as any` command casts around Skia/native payloads. That may be pragmatic, but it lets public TS types drift from actual native converter requirements.

Maintainability:

- The broad `YogaDeepAnimated` helper is convenient but hides unsupported cases. Narrower public types will be easier to maintain than recursive acceptance followed by partial traversal.
- `origin` demonstrates that adding a spec field and example without native behavior creates user-visible API debt.
- The postinstall script symlinks packages and patches dependency headers under `node_modules`. See `scripts/sync-example-links.mjs:23-46` and `scripts/sync-example-links.mjs:48-87`. This may be acceptable for local development, but it should not be part of a surprising consumer install path without clear guardrails.

Performance:

- Native command bindings are limited to scalar command paths such as `blur`, `radius`, `trimEnd`, `trimStart`, and `cornerRadius`. See `src/Reconciler.ts:318-335`. Nested animated values fall back to JS listeners and invalidation.
- `shouldUseContinuousRedraw` treats object `matrix` values specially but not matrix arrays. See `src/Reconciler.ts:541-552`. This is reasonable for SkMatrix object animation, but matrix-array typing should not imply comparable support.
- Stale native state can produce misleading performance results because the visual tree may not reflect current React props during benchmark mode switches or prop removals.

Security:

- No direct eval or network surface was identified in the audited JS/TS runtime path.
- `YogaCanvas` parses native profile samples with `JSON.parse` and catches invalid payloads, returning an empty object. See `src/YogaCanvas.tsx:63-77`.
- The dev postinstall script mutates `node_modules` and patches third-party headers. It is a supply-chain/consumer-surprise risk if shipped beyond the intended local example workflow. See `package.json:40` and `scripts/sync-example-links.mjs:39-87`.

## Final Worktree Status

- Initial V4 status before report recovery: clean (`git status --short` produced no output).
- Final V4 status after writing this report: `?? worker-progress/` from `git status --short`; the only file in that new directory is `worker-progress/worker-001-js-api-audit.md`.
- Product code changes: none.
