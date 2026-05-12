# Worker 205: Fresh Unblocked Gap Audit

## Summary

I challenged Worker 204's conclusion against the current repo evidence.

Worker 204 is still right that another generic generated/native layout breadth worker is not justified. The accepted local proof chain is green and already covers the exact Worker 202/203 dynamic layout field-alignment target.

I did find one concrete locally unblocked root-cause target that is not speculative breadth: deterministic native validation for layout unit strings. Public `Percentage` is currently broad `string` because Nitro cannot express template-literal percentages, generated `NodeStyle` accepts arbitrary strings for all percentage-shaped layout fields, and `YogaNode::setStyle(...)` stores those strings while either silently applying no Yoga setter or partially parsing malformed percent strings.

## Changed Files

- `worker-progress/worker-205-fresh-unblocked-gap-audit.md`

No product runtime/source files, verifier scripts, package metadata, generated artifacts, or existing worker reports were modified.

## Current Proof Surface

- Worker 199 proves packed public TypeScript/JSX authoring and source-level Reconciler JS listener delivery for representative dynamic layout style fields.
- Worker 201 proves same-node sequential generated materialized `setStyle(...)` update/reset behavior for representative layout categories, native `NodeStyle`, selected Yoga getters, invalidation, `computeLayout(...)`, and generated `layout`.
- Worker 203 closes Worker 202's exact field-alignment gap for `start`, `end`, `marginLeft`, `marginRight`, and `inset`.
- Worker 204 accepts Worker 203 and correctly warns that the local proof remains host-JSC/generated-wrapper evidence, not real RN bridge/runtime or platform app proof.
- The current feasible matrix still has 28 commands and passed in this worktree.

## Candidate Gaps Reviewed

- Package/public API: package exports, packed surface, source-first runtime files, JSX runtime subpaths, and packed consumer checks are green. No export/surface target outranks the layout-string contract issue.
- TypeScript declarations: root `index.d.ts` mirrors `src/index.ts`; packed consumer proof is green. The notable type boundary is `src/specs/style.ts` where `Percentage = string` is unavoidable for Nitro today but makes runtime validation important.
- Reconciler/runtime source behavior: dynamic style delivery remains generic and green in `check:reconciler-animated-bindings`; I found no stronger source-level Reconciler target.
- Generated Nitro materialization: positive generated-wrapper layout proofs are green, but there is no invalid layout-unit string rejection proof.
- Host-native command/render/hit-test/runtime smoke coverage: command/render, hit-testing, lifetime/runtime smoke, raw JSI methods, AnimatedDouble, and `RNSkYogaView` host runtime checks are green.
- Example metadata/native generation: bundle export and temp-workspace native generation are green; full app build/run remains blocked by local platform tooling.
- Verification hygiene: `scripts/verify-feasible-matrix.mjs` has structured 28-command coverage, matrix-owned temp parent isolation, cleanup accounting, and a green run.
- Lower-ranked evidence question: invalid string `style.backgroundColor` currently parses through an optional CSS parser and can no-op when parsing fails, but the layout-unit issue is broader, affects Yoga layout state, and crosses public types, generated conversion, and native setter behavior.

## Commands Run

- `sed -n '1,240p' WORKER_BRIEF.md` - read worker rules first.
- Inspected `MASTER_PLAN.md`, `MASTER_PROGRESS.md`, `scripts/verify-feasible-matrix.mjs`, and worker reports 199-204.
- Spawned read-only challengers:
  - `recent_reports_challenger` completed and found no post-204 gap in the requested docs, with the same overclaim boundaries as Worker 204.
  - `candidate_gap_challenger` did not return a substantive audit after a follow-up and was closed as incomplete.
- `git status --short --branch --untracked-files=all` - clean before writing this report.
- `git log --oneline --decorate -n 12` - confirmed current main/worker ancestry through Worker 204.
- `node -e ... package.json ...` - inspected package entrypoints, files, exports, and scripts.
- `rg` and `nl` inspections across `src/specs/style.ts`, `src/jsx.ts`, `src/Reconciler.ts`, `cpp/YogaNode.cpp`, `nitrogen/generated/shared/c++/NodeStyle.hpp`, and relevant verifier scripts.
- `git diff --check` - passed before this report.
- `node --check scripts/verify-feasible-matrix.mjs` - passed.
- `npm run check:package-typescript-consumer` - passed.
- `npm run check:yoganode-nitro-materialization` - passed.
- `npm run check:feasible-matrix` - passed all 28 commands in 4m 57s; cleanup removed `tsconfig.tsbuildinfo`, left no remaining new tracked artifacts, and removed the matrix temp parent.

## Evidence Gathered

- `src/specs/style.ts` defines `Percentage = string` and uses it for many layout unit fields: edges, size constraints, flex basis, margins, padding, insets, and width.
- `nitrogen/generated/shared/c++/NodeStyle.hpp` represents those fields as `std::variant<std::string, double>` and `canConvert(...)` accepts any string for those properties.
- `cpp/YogaNode.cpp` has two central helpers, `setYGValueOrPercent(...)` and `setYGEdgeValue(...)`, that handle string values only when the string is `auto` and the field has an auto setter, or when the string ends in `%` and the field has a percent setter.
- If a string is neither accepted `auto` nor percent-shaped, those helpers return without calling any Yoga setter. `_style` still stores the invalid string because `YogaNode::setStyle(...)` assigns `_style = style` before applying Yoga setters.
- Percent parsing uses `std::stof(...)` on the substring before `%` without checking full-string consumption. That means malformed percent strings with a numeric prefix can be partially accepted, while malformed strings without a numeric prefix throw through a different path.
- Width has special handling for `fit-content`, `max-content`, and `stretch`, then delegates every other string to the same helper. Other fields do not have analogous explicit validation.
- Current positive proofs cover valid `auto`, percent, and width-special cases, but the grep/source review found no invalid layout-unit string rejection case in package, Reconciler, materialization, or host-native verifiers.

## Platform Blocker Reprobe

Local platform-native build/run and real React Native runtime proof remain blocked:

- `xcode-select -p`: `/Library/Developer/CommandLineTools`.
- `xcodebuild -version`: failed because the active developer directory is Command Line Tools, not full Xcode.
- `xcrun --sdk iphonesimulator --show-sdk-path`: failed because the `iphonesimulator` SDK cannot be located.
- `xcrun simctl list runtimes available`: failed because `simctl` is unavailable.
- `pod --version`: command not found.
- `gradle --version`: command not found.
- `adb version`: command not found.
- `cmake --version`: command not found.
- `ninja --version`: command not found.
- `java -version`: failed because no Java runtime is available.
- Android/JDK env probe printed no `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `ANDROID_NDK_HOME`, `ANDROID_NDK_ROOT`, `JAVA_HOME`, or `JDK_HOME`.

## Next Target Recommendation

1. Strongest locally unblocked implementation target: deterministic Yoga layout unit string validation.

   Exact files/behavior: update `cpp/YogaNode.cpp` so `setYGValueOrPercent(...)`, `setYGEdgeValue(...)`, and width's special-value path validate string inputs by field. Accept only the supported values: finite full-string numeric percentages where a percent setter exists, `auto` only where an auto setter exists, and width-only `fit-content`, `max-content`, and `stretch`. Reject unsupported strings such as `left: "10px"`, `padding: "auto"`, `minWidth: "auto"`, `width: "bogus"`, and malformed/partially parsed percentages with deterministic JS-facing errors.

   Proof shape: add focused host-JSC generated materialized `setStyle(...)` negative cases in `scripts/verify-yoganode-nitro-materialization.mjs`, plus a small positive guard that valid `auto`, `%`, and width-special strings still work. This is the right proof boundary because generated `NodeStyle` conversion is where arbitrary strings enter native style state.

   Why it outranks alternatives while platform tooling is blocked: it is a concrete public/generated/native contract mismatch, not more coverage breadth. It prevents silent layout divergence and inconsistent native state for inputs the public type cannot statically narrow today.

2. Highest-value blocked target: real React Native runtime/platform proof for bridge delivery, Nitro registry installation, UI-runtime Worklets/Reanimated delivery, and actual iOS/Android presentation. This should retake priority once the platform toolchain is available.

3. Not recommended next: another broad layout or render coverage expansion without a specific source-backed defect. The current feasible matrix already covers the accepted local proof chain.

## Proof Boundary And Overclaim Risks

Proven now:

- Feasible local package/source/example metadata checks pass.
- Focused public TypeScript consumer and host-JSC materialization checks pass.
- Platform toolchain blockers are still local environment blockers.
- Source evidence shows arbitrary layout-unit strings can cross generated `NodeStyle` conversion and reach native `YogaNode::setStyle(...)` without deterministic validation.

Not proven now:

- Actual React Native bridge delivery.
- Nitro registry installation inside a React Native runtime.
- UI-runtime Worklets/Reanimated delivery.
- iOS/Android build/run, simulator/device launch, or native platform presentation.
- Exact Yoga conformance, exhaustive layout combinations, or render fidelity.
- The proposed validation behavior is not implemented in this worker; it is the next target recommendation.

## Cleanup Status

- No platform tooling was installed.
- No native projects were generated in the worktree.
- The feasible matrix removed its matrix-owned temp parent and reported no remaining new tracked artifacts.
- Ignored dependency symlinks/artifacts were left untouched as expected.

## Final Git Status Summary

Expected final `git status --short --branch --untracked-files=all` summary after this report correction is committed:

- `## worker/205-fresh-unblocked-gap-audit`
- no tracked changes
- ignored `node_modules` and `example/node_modules` symlinks are expected

Goal finished.
