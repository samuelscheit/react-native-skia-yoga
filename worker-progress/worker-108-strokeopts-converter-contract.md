# Worker 108 - StrokeOpts Converter Contract

## Scope And Changed Files

Changed files:

- `cpp/JSIConverter+StrokeOpts.hpp`
- `scripts/verify-yoganode-native-commands-render.mjs`
- `worker-progress/worker-108-strokeopts-converter-contract.md`

No TypeScript product source, package metadata, generated Nitro artifacts, native build files, example app files, ignored dependency trees, or planning docs were changed. `cpp/JSIConverter+NodeCommand.hpp` was read for focused evidence and left unchanged.

## Root-Cause Evidence

The mismatch was source-confirmed before the fix:

- Direct `JSIConverter<RNSkia::StrokeOpts>::fromJSI(...)` rejects any top-level value that is not an object with `Invalid prop value for StrokeOpts received`.
- Direct `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)` still advertised `object`, `null`, and `undefined` as convertible even though the same direct `fromJSI(...)` rejects `null` and `undefined`. Scalars were already rejected by `canConvert(...)` and by `fromJSI(...)`.
- The public `path.stroke` command path is separate. `parseStrokeOpts(...)` in `cpp/JSIConverter+NodeCommand.hpp` treats `undefined` and `null` as omitted stroke, and rejects non-object stroke payloads with `Expected stroke object.` before converting the command data. That behavior was preserved.

## Implementation Summary

- Changed direct `JSIConverter<RNSkia::StrokeOpts>::canConvert(...)` to return `value.isObject()` only, matching the direct converter's top-level `fromJSI(...)` precondition.
- Extended the native command/render verifier with `assertStrokeOptsConverterDirectConsistency(...)`, covering:
  - valid object accepted by direct `canConvert(...)` and parsed by direct `fromJSI(...)`;
  - `null`, `undefined`, number, boolean, and string rejected by direct `canConvert(...)` and direct `fromJSI(...)`.
- Preserved and expanded public stroke coverage in the same verifier:
  - `path.stroke.miter_limit` canonical parsing;
  - deterministic `miterLimit` alias fallback and public-key precedence;
  - numeric join/cap parsing in the existing public command case;
  - string join/cap parsing in the alias-precedence public command case;
  - `StrokeOpts::toJSI(...)` public `miter_limit` spelling;
  - non-object stroke rejection and invalid join/cap rejection.

## Proof Boundary

Proven:

- Host-native macOS C++ direct `StrokeOpts` converter top-level value consistency for object, `null`, `undefined`, number, boolean, and string payloads.
- Existing public `path.stroke` command parser behavior remains intact for omitted `undefined`/`null`, non-object rejection, canonical `miter_limit`, alias fallback, numeric/string join/cap parsing, and public `toJSI(...)` spelling.
- The focused verifier compiled a host executable against real `YogaNode.cpp`, `JSIConverter+NodeCommand.hpp`, `JSIConverter+StrokeOpts.hpp`, generated Nitro specs, JSC/JSI, Yoga, RN Skia macOS archives, and required helper sources.

Not proven:

- New public `path.stroke` behavior, exact path/stroke geometry fidelity, exact render fidelity, real React Native bridge delivery, Nitro module registry install inside a React Native runtime, UI-runtime Worklets execution, real Reanimated delivery, JS listener scheduling, RNGH native delivery, platform-native app runtime, iOS/Android build/run, simulator/device presentation, image asset loading/decoding, local/remote asset resolution, texture-backed images, exact typography, paragraph shaping fidelity, or every AnimatedDouble command prop.

## Verification Commands And Results

- `git diff --check`: passed with no output.
- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed with no output.
- `npm run check:yoganode-native-commands-render`: passed. Output names direct `StrokeOpts` `canConvert`/`fromJSI` consistency for object, `null`, `undefined`, number, boolean, and string payloads, plus preserved public `path.stroke` behavior.
- `/usr/bin/time -p npm run check:feasible-matrix`: passed all 28 commands.
  - `check:yoganode-native-commands-render`: passed in `30.8s`.
  - Total command duration: `4m 49s`.
  - `/usr/bin/time` real: `289.01s`; user: `200.95s`; sys: `85.63s`.
  - Matrix cleanup removed newly created `tsconfig.tsbuildinfo`.
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-4PID1s` was empty before removal and was removed.

Notes:

- `npm` emitted the existing `minimum-release-age` warning during npm-script runs.
- Expo prebuild emitted the existing Android edge-to-edge warning during native-generation checks.

## Nested Challenger Documentation

- Nested explorer: `/root/strokeopts_contract_challenger`.
- Prompt summary: read-only inspection of the direct `StrokeOpts` converter, public `path.stroke` parser, native command/render verifier insertion points, package script context, and worker 096/106/107 reports; answer the mismatch, expected `canConvert` direction, public parser behavior, focused verifier assertions, and proof-boundary warnings; do not edit files or claim acceptance evidence without checks.
- Result: no usable result was returned. The explorer remained running after the initial wait, a finish request, and a second stop-and-return-current-findings request.
- Closure evidence: `close_agent strokeopts_contract_challenger` returned previous status `running`; `list_agents` afterward showed only `/root`.
- Acceptance evidence claimed by nested explorer: none. It did not report checks or findings before closure.

## Cleanup And Status Evidence

Final cleanup/status probes after this report:

- `git status --short --branch --ignored=matching` showed only:
  - `M cpp/JSIConverter+StrokeOpts.hpp`
  - `M scripts/verify-yoganode-native-commands-render.mjs`
  - `?? worker-progress/worker-108-strokeopts-converter-contract.md`
  - ignored dependency trees: `example/node_modules`, `node_modules`
- Temp-prefix probe under `/tmp` and `/private/tmp` for feasible matrix, command/render, Nitro materialization, raw methods, hit testing, native runtime, RNSkYogaView runtime, AnimatedDouble, package, and example roots: no output.
- Repo artifact probe for `*.tgz`, `*.tar.gz`, `*.tsbuildinfo`, `*.buildinfo`, and `*build-info*`, excluding dependency trees: no output.
- Generated example native directory probe for `example/ios`, `example/android`, and `example/.expo`: no output.
- Active verifier/debug process probe for `node .*scripts/verify-`, `clang++`, `/tmp/rnskia-*`, `lldb`, and `debugserver`: no output; `pgrep` exited 1 as expected for no matches.
- `list_agents`: only `/root` running after closing the nested explorer.

Ignored `node_modules` and `example/node_modules` were pre-existing dependency trees and were left untouched.

## Quality, Maintainability, Performance, And Security Review

Quality:

- The product change is the narrow converter contract fix selected by worker 107.
- The verifier now fails if direct `canConvert(...)` again accepts top-level values that direct `fromJSI(...)` rejects.
- Public `path.stroke` omitted/null behavior remains owned by the command parser layer, not by the direct `StrokeOpts` converter.

Maintainability:

- The implementation keeps the direct converter as a simple top-level object gate, matching local converter patterns where field validation stays in `fromJSI(...)`.
- New assertions live beside the existing stroke verifier coverage, avoiding a new verifier script or broader matrix churn.

Performance:

- The runtime product change is a constant-time predicate simplification.
- Verifier additions are small fixed JSI literals and did not materially expand the focused command/render duration.

Security:

- No network work, package installation, dynamic eval, shell interpolation, broad temp deletion, or user-controlled payload execution was added.
- Invalid direct converter payloads continue to fail locally with the existing scoped `StrokeOpts` error.
