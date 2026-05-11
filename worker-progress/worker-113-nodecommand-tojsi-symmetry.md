# Worker 113 - NodeCommand toJSI Symmetry

## Scope and Changed Files

- `cpp/JSIConverter+NodeCommand.hpp`
  - Completed representative/current `NodeCommand` `toJSI(...)` payload serialization for command families that `fromJSI(...)` already parsed but `toJSI(...)` only partially emitted.
  - Added small local helpers for numeric enum output, `SkPoint`/point arrays, and path stroke serialization through the existing `RNSkia::StrokeOpts` converter.
- `scripts/verify-yoganode-native-commands-render.mjs`
  - Extended the existing host-JSC/native command-render verifier with direct `JSIConverter<NodeCommand>::toJSI(...)` payload shape assertions and representative `toJSI(...)` followed by `fromJSI(...)` round-trip assertions.
  - Updated verifier output and proof boundary text.

No package metadata, public TypeScript declarations, generated Nitro artifacts, package export-boundary files, or example native folders were intentionally changed.

## Root-Cause Evidence and Converter-Symmetry Decision

Current source showed that `JSIConverter<NodeCommand>::fromJSI(...)` parsed more payload fields than `toJSI(...)` emitted:

- `blurMaskFilter`: `fromJSI(...)` parsed `blur`, `blurStyle`, and `respectCTM`; `toJSI(...)` emitted only `blur`.
- `image`: `fromJSI(...)` parsed `fit`, `image`, and `sampling`; `toJSI(...)` emitted only `fit`.
- `path`: `fromJSI(...)` parsed `fillType`, `path`, `stroke`, `trimEnd`, and `trimStart`; `toJSI(...)` emitted no payload fields.
- `paragraph`: `fromJSI(...)` parsed `paragraph`, `paragraphStyle`, and `text`; `toJSI(...)` emitted only `text`.
- `line`: `fromJSI(...)` parsed `from` and `to`; `toJSI(...)` emitted no payload fields.
- `points`: `fromJSI(...)` parsed `pointMode` and `points`; `toJSI(...)` emitted no payload fields.

Decision:

- Emit numeric enum values for `blurStyle`, `fillType`, `pointMode`, path stroke `join`, and path stroke `cap`. The existing `fromJSI(...)` parsers accept numeric enums, and reconstructing strings would add fragile reverse mappings.
- Keep `AnimatedDouble` behavior aligned with `JSIConverter<AnimatedDouble>::toJSI(...)`, which serializes the resolved numeric value. Dynamic Worklets-backed values round-trip back as static resolved numbers in this converter path.
- Use existing structured converters where available:
  - `JSIConverter<SkPath>` for `path`.
  - `JSIConverter<std::optional<sk_sp<SkImage>>>` for `image`.
  - `JSIConverter<std::optional<SkSamplingOptions>>` for `sampling`.
  - `JSIConverter<std::optional<std::shared_ptr<RNSkia::JsiSkParagraph>>>` for `paragraph`.
  - `JSIConverter<std::optional<skia::textlayout::ParagraphStyle>>` for `paragraphStyle`.
  - `JSIConverter<RNSkia::StrokeOpts>` for path stroke output, preserving public `miter_limit` spelling and omitting the private `miterLimit` alias.

Fields that cannot honestly be claimed as value-exact today:

- `SkSamplingOptions::toJSI(...)`, `ParagraphStyle::toJSI(...)`, and `TextStyle::toJSI(...)` currently emit object-shaped payloads without value-complete style/sampling reconstruction. The verifier proves object presence and acceptance through the converter path, not value-exact sampling or paragraph/text style serialization.

## Implementation Summary

- Added `#include "JSIConverter+StrokeOpts.hpp"` to reuse the existing public stroke converter.
- Added local helpers:
  - `optionalNumericEnumToJSI(...)`
  - `pointToJSI(...)`
  - `pointsToJSI(...)`
  - `pathStrokeOptsToJSI(...)`
- Filled `toJSI(...)` payload fields for:
  - `blurMaskFilter.blurStyle`
  - `blurMaskFilter.respectCTM`
  - `image.image`
  - `image.sampling`
  - `path.fillType`
  - `path.path`
  - `path.stroke`
  - `path.trimEnd`
  - `path.trimStart`
  - `paragraph.paragraph`
  - `paragraph.paragraphStyle`
  - `line.from`
  - `line.to`
  - `points.pointMode`
  - `points.points`

## Command-Family Serialization Coverage

- `blurMaskFilter`: emits `blur`, numeric `blurStyle`, and `respectCTM`.
- `image`: emits `fit`, `image`, and `sampling`.
- `path`: emits numeric `fillType`, `path`, `stroke`, `trimEnd`, and `trimStart`; stroke output keeps public `miter_limit` and verifies no `miterLimit` output.
- `paragraph`: emits `paragraph`, `paragraphStyle`, and `text`.
- `line`: emits `from` and `to` point objects.
- `points`: emits numeric `pointMode` and `points` array.

Existing closer-to-symmetric families (`rrect`, `text`, `group`, and `circle`) were left structurally unchanged.

## Round-Trip and Converter Proof Details

The host-JSC/native verifier now creates representative native `NodeCommand` values, serializes each through `JSIConverter<NodeCommand>::toJSI(...)`, checks the public-shaped payload, then feeds the serialized object back through `JSIConverter<NodeCommand>::fromJSI(...)`.

Covered assertions include:

- `blurMaskFilter`
  - Numeric `blurStyle` output for string input `"inner"`.
  - `respectCTM: true`.
  - `blur` as a resolved number.
  - Round-trip back to `SkBlurStyle::kInner_SkBlurStyle`.
- Dynamic `AnimatedDouble`
  - Worklets-backed `blur` serializes as the resolved numeric value and round-trips as static resolved numeric payload.
- `image`
  - `fit` output.
  - `image` host object output and round-trip width/height evidence from synthetic in-memory `SkImage`.
  - `sampling` object presence and converter acceptance.
- `path`
  - Numeric `fillType` output for string input `"evenOdd"`.
  - `JsiSkPath` host-object output and path bounds evidence.
  - Public `stroke.miter_limit` output and no `stroke.miterLimit` output.
  - Numeric stroke `join` and `cap`.
  - `trimStart` and `trimEnd` numeric output and round-trip.
- `paragraph`
  - Explicit `paragraph: null` output and round-trip as present null optional payload.
  - `paragraphStyle` object presence and converter acceptance.
  - `text` output and round-trip.
- `line`
  - `from` and `to` point object output and round-trip coordinates.
- `points`
  - Numeric `pointMode` output for string input `"polygon"`.
  - Two-point array output and round-trip coordinates.

## Proof Boundary and Residual Exclusions

This work proves host-JSC/native converter serialization shape and representative `toJSI(...)`/`fromJSI(...)` round trips inside the existing command/render verifier.

It does not prove platform-native app behavior, React Native bridge delivery, generated Nitro wrapper return paths, UI-runtime Worklets execution, real Reanimated `SharedValue` delivery, Nitro registry install inside React Native, simulator/device behavior, RNGH native delivery, image asset loading or decoding, texture-backed image delivery, exact image render fidelity, exact typography, paragraph shaping fidelity, or value-exact `paragraphStyle`/`textStyle`/`sampling` serialization beyond current converter support.

## Verification Commands and Results

- `node --check scripts/verify-yoganode-native-commands-render.mjs`: passed.
- `git diff --check`: passed before report.
- `npm run check:yoganode-native-commands-render`: passed.
  - The verifier output now explicitly reports representative `NodeCommand` `toJSI(...)` payload shape and `toJSI(...)`/`fromJSI(...)` round-trip coverage for `blurMaskFilter`, `image`, `path`, `paragraph`, `line`, and `points`.
- `npm run check:yoganode-nitro-materialization`: passed.
- `npm run check:animated-double-synchronizable`: passed.
- `npm run typecheck`: passed.
- `npm run check:feasible-matrix`: passed all 28 commands.
  - Total command duration: 4m 10s.
  - Passed included `check:yoganode-native-commands-render`, `check:animated-double-synchronizable`, `check:yoganode-nitro-materialization`, `typecheck`, `lint-ci`, `cd example && bun run typecheck`, `bun run specs`, `check:example-bundle`, `check:example-native-generation`, and the local artifact preservation probe.
- `git diff --check`: rerun after report writing before completion.

## Nested Challenger Documentation

- First read-only challenger:
  - Prompt: inspect `NodeCommand` `fromJSI(...)`/`toJSI(...)` symmetry, verify whether the planned missing fields and host-JSC coverage were adequate, and do not edit files.
  - Result: the agent stalled before producing a useful finding. It was closed.
  - Acceptance evidence claimed: none.
- Second read-only challenger:
  - Prompt: quickly inspect the current diff/source for missing `NodeCommand` `toJSI(...)` fields, enum/stroke spelling choices, lossy converter cases, and verification gaps; do not edit files or run broad checks.
  - Result: found no missing required fields; agreed with numeric enum output and `miter_limit` handling; confirmed `SkSamplingOptions`, `ParagraphStyle`, and `TextStyle` are bounded by existing object-shaped converters; confirmed dynamic `AnimatedDouble` resolved-number behavior is correctly bounded.
  - Acceptance evidence claimed: none. It inspected source/diff only and did not run checks.

## Cleanup and Status Evidence

- Feasible matrix cleanup:
  - Matrix temp parent `/tmp/rnskia-feasible-matrix-OqOLhY` was removed by the verifier after all 28 commands passed.
- Extra temp cleanup:
  - Found an empty stale `/private/tmp/rnskia-feasible-matrix-IpQraX` directory and removed it after confirming no matching active verifier/debug process.
- Final temp-prefix probe:
  - `find /tmp /private/tmp ... rnskia-*` returned no verifier-prefix temp directories.
- Final active-process probe:
  - `ps -axo pid,command | rg 'node .*scripts/verify-|clang\\+\\+|/tmp/rnskia-|rnskia-feasible|lldb|debugserver' | rg -v 'rg |find /tmp /private/tmp'`: no matches.
- Final generated example native directory probe:
  - `find example -maxdepth 1 \( -name ios -o -name android -o -name .expo \) -print`: no output.
- Final artifact probe:
  - `find . ... '*.tgz' '*.tar.gz' '*.tsbuildinfo' '*.buildinfo' '*build-info*'`: reported `./tsconfig.tsbuildinfo`.
  - This ignored artifact was left in place because the task explicitly says not to touch or remove ignored local artifacts such as `tsconfig.tsbuildinfo`. The feasible matrix also treated it as a pre-existing local artifact before its aggregate run.
- Final ignored status:
  - Only ignored dependency artifacts plus `tsconfig.tsbuildinfo` are shown: `node_modules`, `example/node_modules`, and `tsconfig.tsbuildinfo`.
- Final live-agent probe:
  - `list_agents` showed only `/root`.

## Quality, Maintainability, Performance, and Security Review

- Quality:
  - The implementation keeps `toJSI(...)` spelling aligned with the existing public payload accepted by `fromJSI(...)`, including `miter_limit`, `blurStyle`, `respectCTM`, `fillType`, `trimStart`, `trimEnd`, `pointMode`, `from`, `to`, and `points`.
  - The verifier checks direct payload shape before round-trip conversion so regressions are visible at the serialization boundary, not only after `fromJSI(...)` accepts a value.
- Maintainability:
  - New helpers are local to `JSIConverter+NodeCommand.hpp` and small enough to avoid a broader abstraction.
  - Existing converters are reused for Skia host objects, sampling/style objects, and stroke options.
- Performance:
  - Serialization adds linear point-array construction only when serializing `points`; no render-time behavior or command execution path was expanded beyond the converter output.
- Security:
  - No network, packaging, install, or execution-surface behavior was changed.
  - The verifier uses isolated temporary directories and confirms cleanup of verifier-owned temp output.
