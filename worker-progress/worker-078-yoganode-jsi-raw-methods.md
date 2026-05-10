# Worker 078 - YogaNode JSI raw-method boundary

## Goal Lifecycle And GOAL_CREATED Evidence

- `create_goal` objective: `Finalize YogaNode hybrid/JSI raw-method boundary verification and report.`
- Exact first visible gate text emitted by this finalizer: `GOAL_CREATED: Finalize YogaNode hybrid/JSI raw-method boundary verification and report.`
- Prior worker log inspected after the goal gate:
  - `../worker-logs/worker-078-yoganode-jsi-raw-methods.jsonl`
  - `../worker-logs/worker-078-yoganode-jsi-raw-methods-finalize.jsonl`

## Summary

- Kept the product change that removes YogaNode's manual raw `setStyle` registration and helper, because source inspection confirms a real overlap with generated `HybridYogaNodeSpec` ownership of `setStyle`.
- Accepted the new standalone verifier and retained its `package.json` and feasible-matrix wiring.
- Repaired the verifier boundary by keeping compile/link coverage plus direct host-JSC execution of the remaining raw methods, while explicitly rejecting Nitro `toObject()` / prototype materialization proof in this host harness.
- Cleaned stale worker-owned verifier temp directories left by earlier worker-078 attempts and confirmed no live `lldb`, `debugserver`, or `yoganode-jsi-raw-methods` processes remained.

## Changed Files

- `cpp/YogaNode.cpp`
- `cpp/YogaNode.hpp`
- `package.json`
- `scripts/verify-feasible-matrix.mjs`
- `scripts/verify-yoganode-jsi-raw-methods.mjs`

## Root Cause And Decision

Confirmed source-level overlap:

- `nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp` registers generated `setStyle`.
- `cpp/YogaNode.hpp` also tried to register raw `setStyle` after `HybridYogaNodeSpec::loadHybridMethods()`.
- `node_modules/react-native-nitro-modules/cpp/prototype/Prototype.hpp` still guards against duplicate method names before registration.

Original worker evidence in `../worker-logs/worker-078-yoganode-jsi-raw-methods.jsonl` showed the host harness crashed when it called `YogaNode::toObject()`:

- The probe reached `probe: materialize YogaNode JS object`.
- macOS crash report `~/Library/Logs/DiagnosticReports/yoganode-jsi-raw-methods-2026-05-10-162022.ips` showed `SIGSEGV` at `margelo::nitro::getRuntimeId(facebook::jsi::Runtime&)` during `HybridObjectPrototype::createPrototype(...)`.
- The prior worker also launched `lldb`; the log shows it hung after `run`, so no debugger-backed proof is claimed.

Decision:

- Keep the product fix: generated `setStyle` remains the only JS-facing `setStyle` owner.
- Keep the verifier, but narrow it to honest proof:
  - source-level duplicate-registration invariant,
  - compile/link coverage against real YogaNode/Nitro/Yoga/RN Skia sources,
  - direct host-JSC execution of raw `setInteractionConfig()` and `hitTest()`.
- Do not claim `toObject()` or Nitro prototype materialization proof in this harness.

## Verifier Proof Boundary

Accepted proof:

- Source invariant: generated HybridYogaNodeSpec method names and manual YogaNode raw registrations do not overlap.
- Host-native compile/link: `clang++` links a real executable against `cpp/YogaNode.cpp`, generated Nitro specs, React Native JSC sources, upstream Yoga sources, RN Skia macOS archives, and Nitro/JSI helper sources.
- Host-JSC runtime execution:
  - calls `YogaNode::loadHybridMethods()` without duplicate-name overlap,
  - converts a generated `NodeStyle` object through `JSIConverter<NodeStyle>::fromJSI(...)`,
  - executes raw `setInteractionConfig()` with numeric and object `hitSlop`,
  - executes raw `hitTest()` with valid and invalid JSI inputs.

Explicitly not proven:

- Nitro `toObject()` / prototype materialization in this host harness.
- iOS/Android native app build/run, simulator/device launch, platform view presentation, UI-runtime Worklets execution, or RNGH native delivery.

## Commands Run And Results

Targeted file and log inspection:

- `git status --short --ignored`: confirmed dirty worker-owned scope only in `cpp/YogaNode.cpp`, `cpp/YogaNode.hpp`, `package.json`, `scripts/verify-feasible-matrix.mjs`, and new `scripts/verify-yoganode-jsi-raw-methods.mjs`.
- `git diff --stat` and `git diff -- ...`: confirmed the product patch removes only raw `setStyle` registration/implementation and wires the new verifier.
- `sed -n ... worker-progress/worker-076-post-075-root-cause-audit.md`: confirmed worker 076 predicted the exact `setStyle` overlap.
- `sed -n ... ../worker-logs/worker-078-yoganode-jsi-raw-methods*.jsonl`: confirmed prior `toObject()` crash and `lldb` hang.
- `sed -n ... ~/Library/Logs/DiagnosticReports/yoganode-jsi-raw-methods-2026-05-10-162022.ips`: confirmed `SIGSEGV` in Nitro `getRuntimeId(runtime)` during prototype creation.

Required focused verification:

- `node --check scripts/verify-yoganode-jsi-raw-methods.mjs`: passed.
- `npm run check:yoganode-jsi-raw-methods`: passed.
- `npm run check:yoganode-native-hit-testing`: passed.
- `npm run check:yoganode-native-runtime`: passed.
- `git diff --check`: passed.
- `npm run check:feasible-matrix`: passed twice in this finalizer; accepted final rerun completed all 25 commands in `3m 37s` with `npm run lint-ci` clean.

Additional final-state checks:

- `npm run lint-ci`: passed after removing an unused `lstatSync` import from `scripts/verify-yoganode-jsi-raw-methods.mjs`.
- Final `git status --short --ignored`: only the intended worker-owned changes remained; ignored `node_modules` trees were unchanged.

## Cleanup Status

- Before cleanup, `find /tmp /private/tmp -maxdepth 1 ...` found stale worker-owned roots from earlier worker-078 attempts:
  - `rnskia-yoganode-jsi-raw-methods-*`
  - one empty `rnskia-feasible-matrix-zIDjgN`
- Removed those stale directories explicitly.
- Final temp-root probe:
  - `find /tmp /private/tmp -maxdepth 1 \( -name 'rnskia-yoganode-jsi-raw-methods-*' -o -name 'rnskia-feasible-matrix-*' \) -print`
  - Result: no matches.
- Final process probe:
  - `ps -Ao pid,ppid,etime,comm,args | awk '$4=="lldb" || $4=="debugserver" || $4=="yoganode-jsi-raw-methods" {print}'`
  - Result: no matches.
- Final `git status --short --ignored` still showed only intended tracked edits plus ignored `node_modules` directories.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The accepted change removes a real duplicate-registration root cause instead of masking the crash.
- The verifier now matches what the host harness can actually prove.

Maintainability:

- Generated `setStyle` ownership is unambiguous.
- The verifier documents its proof boundary in its own success output, reducing future false claims.
- Final linter warning in the verifier was removed.

Performance:

- No product runtime overhead was added.
- The verifier remains focused and compile-heavy only in explicit check commands.

Security:

- The verifier uses structured `spawnSync` argument arrays and verifier-owned temp roots.
- Cleanup was constrained to worker-owned verifier prefixes.
- No arbitrary input is executed inside the JSI runtime; probe inputs are fixed literals.

## Nested Subagent Usage

- None in this finalizer.
- Reason: the prior worker already attempted a nested challenger and left concrete crash/log evidence. This finalizer's job was a narrow dirty-worktree audit, verifier repair, focused reruns, and cleanup, so another nested agent would have added latency without improving the acceptance boundary.
