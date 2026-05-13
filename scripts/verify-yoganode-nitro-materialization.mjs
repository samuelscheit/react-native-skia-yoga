#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import path from "node:path"
import {
	createVerifierTempDir,
	formatVerifierTempDiagnostics,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = createVerifierTempDir("rnskia-yoganode-nitro-materialization-")
const expectedSkiaArchiveBasenames = [
	"libskia.a",
	"libskottie.a",
	"libskparagraph.a",
	"libsksg.a",
	"libskshaper.a",
	"libskunicode_core.a",
	"libskunicode_libgrapheme.a",
	"libsvg.a",
]
const skiaArchiveLayouts = [
	{
		name: "optional react-native-skia-apple-macos xcframework archives",
		root: projectPath("node_modules/react-native-skia-apple-macos/libs"),
		archivePattern: "*.xcframework/macos*/*.a",
		matchesArchive: createMacosXcframeworkArchiveMatcher(
			projectPath("node_modules/react-native-skia-apple-macos/libs"),
		),
		followSymlinks: true,
	},
	{
		name: "current bundled RN Skia macOS xcframework archives",
		root: projectPath("node_modules/@shopify/react-native-skia/libs/apple/macos"),
		archivePattern: "*.xcframework/macos*/*.a",
		matchesArchive: createMacosXcframeworkArchiveMatcher(
			projectPath("node_modules/@shopify/react-native-skia/libs/apple/macos"),
		),
	},
	{
		name: "legacy bundled RN Skia macOS archives",
		root: projectPath("node_modules/@shopify/react-native-skia/libs/macos"),
		archivePattern: "**/*.a",
		matchesArchive: (entryPath) => entryPath.endsWith(".a"),
	},
]

try {
	assertCurrentGapAndRisk()
	createNitroModulesShim(tmpDir)

	const probePath = path.join(tmpDir, "yoganode-nitro-materialization.cpp")
	const binaryPath = path.join(tmpDir, "yoganode-nitro-materialization")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-DNDEBUG",
		"-ferror-limit=20",
		"-ffunction-sections",
		"-fdata-sections",
		"-Wl,-dead_strip",
		// YogaNode.cpp still contains draw/render paths this verifier does not enter.
		// dynamic_lookup keeps those unrelated paths lazy while this probe resolves
		// toObject(), prototype creation, generated wrapper calls, and selected native
		// side effects against real linked host dependencies below.
		"-Wl,-undefined,dynamic_lookup",
		"-include",
		projectPath("cpp/polyfill.h"),
		...includeFlags(tmpDir),
		probePath,
		...helperSourcePaths(),
		...yogaSourcePaths(),
		...skiaArchivePaths(),
		"-framework",
		"CoreFoundation",
		"-framework",
		"CoreGraphics",
		"-framework",
		"CoreText",
		"-framework",
		"Foundation",
		"-framework",
		"ImageIO",
		"-framework",
		"JavaScriptCore",
		"-framework",
		"Metal",
		"-framework",
		"QuartzCore",
		"-o",
		binaryPath,
	]

	const compileResult = spawnSync(compiler, compileArgs, {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (compileResult.error) {
		throw new Error(`Failed to run ${compiler}: ${compileResult.error.message}`)
	}

	if (compileResult.status !== 0) {
		throw new Error(
			formatFailure(
				`${compiler} YogaNode Nitro materialization compile/link failed with exit code ${compileResult.status}.`,
				compileResult,
				[
					{ label: "YogaNode Nitro materialization temp root", targetPath: tmpDir },
					{ label: "probe source", targetPath: probePath },
					{ label: "binary output", targetPath: binaryPath },
					{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
				],
			),
		)
	}

	assertLinkedBinary(binaryPath, [
		{ label: "YogaNode Nitro materialization temp root", targetPath: tmpDir },
		{ label: "binary output", targetPath: binaryPath },
		{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
	])

	const runResult = spawnSync(binaryPath, [], {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (runResult.error) {
		throw new Error(
			[
				`Failed to execute YogaNode Nitro materialization binary: ${runResult.error.message}`,
				`diagnostics:\n${formatVerifierTempDiagnostics([
					{ label: "YogaNode Nitro materialization temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				])}`,
			].join("\n\n"),
		)
	}

	if (runResult.status !== 0) {
		throw new Error(
			formatFailure(
				`YogaNode Nitro materialization execution failed with exit code ${runResult.status}.`,
				runResult,
				[
					{ label: "YogaNode Nitro materialization temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				],
			),
		)
	}

	console.log("YogaNode Nitro materialization verifier passed:")
	console.log("- Source gap confirmed: existing YogaNode raw-method and command/render checks do not call YogaNode::toObject(runtime) or invoke generated JS-facing YogaNode wrappers from a materialized object.")
	console.log("- Prior risk source-confirmed: HybridObject::toObject() enters HybridObjectPrototype/JSICache, JSICache calls getRuntimeId(runtime), and getRuntimeId(runtime) depends on platform ThreadUtils; this verifier links the real iOS ThreadUtils implementation for the host-JSC probe.")
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, generated HybridYogaNodeSpec.cpp, Nitro HybridObject/prototype/cache sources, platform ThreadUtils, React Native JSC, upstream Yoga sources, RN Skia macOS archives, RN Skia CSSColorParser, a host platform context, Worklets shared-item sources, ColorParser, PlatformContextAccessor, AnimatedDouble, and Nitro/JSI helper sources.")
	console.log("- The executable created a shared YogaNode, called YogaNode::toObject(runtime), asserted the returned value is a JS object with NativeState wrapping the original YogaNode, and asserted repeated toObject(runtime) returns the cached JS object.")
	console.log("- The executable asserted generated prototype members setCommand, setStyle, computeLayout, and layout exist on the materialized object, then invoked generated JS-facing wrappers for setCommand(group), setStyle(width/height/antiAlias/layer), setStyle(CSS-string backgroundColor validation), setStyle(SkPaint-backed backgroundColor plus paint fields), setStyle(global borderRadius), setStyle(style corner radii, overflow hidden/scroll, clip path/rect/rrect, 9- and 16-value matrix arrays, single-operation transform variants, non-empty transform precedence, empty transform matrix fallback, empty transform no-matrix reset, invertClip), computeLayout(width, height), computeLayout omitted/undefined optional args, and the layout getter.")
	console.log("- The executable materialized parent/child YogaNodes, inserted the child through the generated parent.insertChild(...) wrapper, called materialized parent.getChildren(), and asserted the returned child is the cached materialized child object with generated and raw YogaNode prototype methods.")
	console.log("- The executable called generated setStyle/computeLayout/insertChild and raw setInteractionConfig/hitTest/getChildren through the returned child object, then asserted recursive returned-grandchild identity through returnedChild.getChildren().")
	console.log("- The executable built materialized layout trees through YogaNode::toObject(runtime), generated setStyle(...), insertChild(...), computeLayout(...), and layout getter access; it covered compact flexDirection with justifyContent/alignItems, gap/rowGap/columnGap, padding aliases, margin aliases, flexGrow/flexShrink/flexBasis, absolute position with inset aliases, one stable width special value, and residual alignContent/alignSelf/flexWrap/direction/display/boxSizing/min-max/aspect/edge/percent/auto cases.")
	console.log("- The executable validates generated setStyle(...) layout unit strings through materialized YogaNodes: finite full-string percentages, allowed auto values, width-only fit-content/max-content/stretch, and deterministic rejection of unsupported strings, malformed percentages, partial numeric parses, and NaN/Infinity-like percentage text.")
	console.log("- The executable validates generated setStyle(...) selected finite numeric paint/border fields and selected materialized layout numeric fields through materialized YogaNodes: non-finite border-width family, strokeMiter, opacity, layout scalar, and layout variant numeric values reject before mutation and preserve prior _style/_paint/Yoga/clip/layer/matrix/computed-layout state.")
	console.log("- The executable validates generated setStyle(...) radius finite rejection through materialized YogaNodes: non-finite borderRadius plus all per-corner scalar and SkPoint x/y payload branches reject before mutation and preserve prior _style radius fields, _clipToBoundsRadii, explicit clip state, _paint, Yoga, layer, matrix, and computed-layout state.")
	console.log("- The executable validates generated setStyle(...) matrix/transform finite rejection through materialized YogaNodes: non-finite 9- and 16-value matrix array elements, including a MatrixArray16 slot outside RN Skia's 3x3 projection, non-finite SkMatrix host-object slots, and non-finite rotateX/rotateY/rotateZ/scale/scaleX/scaleY/translateX/translateY/skewX/skewY leaves reject before mutation and preserve prior _style/_matrix/_paint/Yoga/clip/radius/layer/computed-layout state.")
	console.log("- The executable reused the same materialized parent/child YogaNodes for generated setStyle initial, update, and cleanup passes; it asserted replacement of native NodeStyle optionals, selected Yoga getter updates/resets for width/height, constraints, flexBasis, gaps, flexGrow/flexShrink, alignContent/alignSelf/flexWrap/direction/display/boxSizing, position/edge/inset percent/auto values, layout invalidation, computeLayout(...), and generated layout getter values.")
	console.log("- The executable aligns that same-node sequential materialized proof with Worker 199's exact public/Reconciler dynamic layout field table by separately exercising start/end, marginLeft/marginRight, and inset replacement, cleanup, selected Yoga edge getters, invalidation, computeLayout(...), and generated layout getter values.")
	console.log("- The executable materialized parent/child YogaNodes, called generated setCommand(group/rect) and setStyle(overflow hidden/scroll, clip rect/rrect/path, plus invertClip rect/rrect/path) wrappers, inserted the child through the generated parent.insertChild(...) wrapper, rendered the native parent through YogaNode::renderToContext(), and asserted bounded in-clip/out-of-clip raster pixels.")
	console.log("- The executable used fresh materialized YogaNode objects to invoke generated JS-facing setCommand(line), setCommand(points), setCommand(path), setCommand(text), setCommand(paragraph), setCommand(circle), setCommand(rrect), setCommand(blurMaskFilter), setCommand(rect), setCommand(oval), and setCommand(image) wrappers, preserving the native no-command-kind-change invariant.")
	console.log("- The executable asserted generated materialized setCommand(...) rejects non-finite and native-float-overflow line.from.x/y, line.to.x/y, and indexed points.points[] x/y payloads before mutating the existing native LineCmd/PointsCmd state.")
	console.log("- The executable asserted generated materialized setCommand(...) rejects non-finite and native-float-overflow static AnimatedDouble payloads for rrect.cornerRadius, blurMaskFilter.blur, path.trimStart, path.trimEnd, and circle.radius before mutating the existing same-type native command state.")
	console.log("- The executable asserted generated materialized setCommand(path) rejects non-finite and native-float-overflow stroke.width, stroke.miter_limit, stroke.miterLimit alias fallback, and stroke.precision payloads before mutating the existing same-type native PathCmd stroke state.")
	console.log("- The executable asserted generated materialized setCommand(...) rejects numeric enum finite/integer/range violations for blurMaskFilter.blurStyle, points.pointMode, path.fillType, path.stroke.join, and path.stroke.cap before mutating existing same-type native command state.")
	console.log("- The executable asserted generated materialized computeLayout(...) rejects non-finite and native-float-overflow width/height constraints before mutating existing native layout state or computing a previously uncomputed layout.")
	console.log("- The executable asserted generated materialized setCommand(text/paragraph) rejects non-finite and native-range-overflow text/paragraph style numeric payloads before mutating existing same-type native TextCmd/ParagraphCmd state.")
	console.log("- The executable asserted native side effects from generated calls: GroupCmd installation/rasterize state, LineCmd nested from/to base points, PointsCmd array payload and point mode, PathCmd public stroke.miter_limit payload and path stroke numeric native-float rejection from a real JsiSkPath host object, TextCmd CSS string textStyle state plus generated text style numeric finite rejection, ParagraphCmd text/nested paragraphStyle.textStyle CSS color measure state plus generated paragraph style numeric finite rejection, CircleCmd radius state, RRectCmd corner-radius state, BlurMaskFilterCmd mask-filter state, RectCmd/OvalCmd layout rect state, ImageCmd synthetic JsiSkImage host-object fit/layout state, NodeStyle width/height/antiAlias/layer state, generated materialized JsiSkPaint layer delivery, generated materialized CSS-string backgroundColor delivery plus invalid-string rejection without previous _style.backgroundColor/_paint mutation, generated materialized selected finite numeric paint/border/layout rejection without previous _style/_paint/Yoga/clip/layer/matrix/computed-layout mutation, generated materialized radius finite rejection without previous _style radius/_clipToBoundsRadii/_paint/Yoga/clip/layer/matrix/computed-layout mutation, generated materialized matrix-array/SkMatrix/transform-leaf finite rejection without previous _style/_matrix/_paint/Yoga/clip/radius/layer/computed-layout mutation, generated materialized SkPaint-backed backgroundColor delivery, public paint-field override state for borderWidth/strokeCap/strokeJoin/strokeMiter/dither/opacity/blendMode, generated materialized global borderRadius delivery into _style.borderRadius, _clipsToBounds, and all four _clipToBoundsRadii slots without per-corner or explicit clip state, generated materialized overflow hidden/scroll delivery into _style.overflow, Yoga overflow state, and rectangular _clipsToBounds without radius or explicit clip state plus bounded renderToContext raster pixels, generated materialized clip path/rect/rrect delivery into _style.clip and _clipPath/_clipRect/_clipRRect plus bounded renderToContext raster pixels, generated materialized all-four style corner-radius delivery into _style SkPoint/scalar variants, _clipsToBounds, and _clipToBoundsRadii, generated materialized 9- and 16-value matrix array delivery into _style.matrix and _matrix, generated materialized single-operation transform delivery for rotateX/rotateY/rotateZ/scale/scaleX/scaleY/translateX/translateY/skewX/skewY into _style.transform and _matrix, generated materialized non-empty transform-array delivery into _style.transform and _matrix with transform-over-matrix precedence, generated materialized empty transform-array delivery that preserves empty _style.transform and falls back to _style.matrix for _matrix, generated materialized empty transform-array delivery with no matrix that clears _style.matrix and resets _matrix to nullptr, generated materialized invertClip delivery into _style.invertClip and the clipping predicate plus bounded rect/rrect/path renderToContext raster pixels, generated materialized layout style delivery into native _style optionals and selected Yoga style getters for flex, gap, padding, margin, position/inset, width stretch, alignContent, alignSelf, flexWrap, direction, display, boxSizing, min/max constraints, aspectRatio, edge-specific start/end/top/bottom, percentage values, and auto values, sequential generated materialized setStyle initial/update/cleanup delivery into the same parent/child Yoga nodes with stale optionals and Yoga setters reset, exact Worker 199 sequential edge-alias alignment for start/end, marginLeft/marginRight, and inset, Yoga border state from borderWidth, YogaNode::setStyle SkPaint antiAlias and _layerPaint state, ordinary _paint separation, Yoga layout computation, and generated layout getter values.")
	console.log("- For CircleCmd, RRectCmd, and BlurMaskFilterCmd, selected no-pixel draw calls are used only to expose render-time native state/mask-filter side effects after generated wrapper delivery; no command-rendering or render-fidelity claim is made.")
	console.log("- Proof boundary: host-JSC Nitro YogaNode toObject/prototype materialization, materialized getChildren returned-child identity/prototype behavior, generated materialized setCommand command-point native-float validation through generated JS-facing wrapper conversion before same-type LineCmd/PointsCmd state mutation, generated materialized static AnimatedDouble command native-float validation through generated JS-facing wrapper conversion before same-type CircleCmd/RRectCmd/BlurMaskFilterCmd/PathCmd state mutation, generated materialized command numeric enum finite/integer/range rejection through generated JS-facing wrapper conversion before same-type BlurMaskFilterCmd/PointsCmd/PathCmd state mutation, generated materialized path stroke numeric native-float rejection through generated JS-facing wrapper conversion before same-type PathCmd stroke state mutation, generated materialized computeLayout finite/native-float validation preserving native layout state, generated materialized text/paragraph style numeric finite and native-range-overflow rejection through generated JS-facing wrapper conversion before same-type TextCmd/ParagraphCmd state mutation, generated materialized setStyle(layer) delivery from a JsiSkPaint host object into native _layerPaint state, generated materialized setStyle(CSS-string backgroundColor) delivery and invalid CSS-string rejection preserving previous _style.backgroundColor/_paint state, generated materialized selected finite numeric paint/border rejection for border-width family, strokeMiter, and opacity preserving previous _style/_paint/Yoga/clip/layer/matrix state, generated materialized selected finite numeric layout rejection for the Worker 212 scalar and variant numeric inventory preserving previous selected _style/Yoga/computed-layout state, generated materialized borderRadius/per-corner scalar/per-corner SkPoint x/y finite rejection preserving previous selected _style radius fields, _clipToBoundsRadii, _paint, Yoga, clip, layer, matrix, and computed-layout state, generated materialized matrix-array/SkMatrix/transform-leaf finite rejection preserving previous selected _style/_matrix/_paint/Yoga/clip/radius/layer/computed-layout state, generated materialized setStyle(SkPaint-backed backgroundColor plus public paint fields) delivery into native NodeStyle/_paint/Yoga border state, generated materialized setStyle(global borderRadius/corner-radius/overflow hidden/scroll/clip/matrix-9/matrix-16/single-operation-transform/non-empty-transform/empty-transform fallback/empty-transform no-matrix reset/invertClip) delivery into native NodeStyle/_clipToBoundsRadii/_clipPath/_clipRect/_clipRRect/_matrix/invertClip predicate state, generated materialized setStyle flexbox/layout/edge/constraint delivery into selected native _style optionals, selected stable Yoga style getters, selected sequential same-node layout setter replacement/reset behavior including exact Worker 199 edge aliases, and selected computed native/generated layout getter values, generated materialized overflow hidden/scroll delivery followed by bounded host-raster renderToContext pixel assertions for rectangular parent bounds clipping, generated materialized clip/invertClip delivery followed by bounded host-raster renderToContext pixel assertions for rect/rrect/path clips and inverted rect/rrect/path clips, and selected generated/raw YogaNode method/getter execution only; this does not prove exact Yoga conformance beyond asserted values, actual React Native bridge delivery, Nitro module registry install in a React Native runtime, React Native runtime integration, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, real Reanimated SharedValue delivery, RNGH native delivery, gesture delivery, image assets/decoding/loading, exact saveLayer/GPU blend fidelity, exact typography, exact overflow or clip render fidelity beyond asserted pixels, exact hit-test behavior beyond asserted clipping predicates, exhaustive numeric style validation beyond covered inventories, or every command rendering path.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

function assertCurrentGapAndRisk() {
	const rawVerifier = readProjectFile("scripts/verify-yoganode-jsi-raw-methods.mjs")
	const commandVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const worker078Report = readProjectFile(
		"worker-progress/worker-078-yoganode-jsi-raw-methods.md",
	)
	const worker088Report = readProjectFile(
		"worker-progress/worker-088-nitro-yoganode-materialization.md",
	)
	const worker099Report = readProjectFile(
		"worker-progress/worker-099-post-098-root-cause-audit.md",
	)
	const styleSpec = readProjectFile("src/specs/style.ts")
	const commandSpec = readProjectFile("src/specs/commands.ts")
	const reconciler = readProjectFile("src/Reconciler.ts")
	const reconcilerAnimatedVerifier = readProjectFile(
		"scripts/verify-reconciler-animated-bindings.mjs",
	)
	const yogaNodeCpp = readProjectFile("cpp/YogaNode.cpp")
	const yogaNodeConverter = readProjectFile("cpp/JSIConverter+YogaNode.hpp")
	const nodeCommandConverter = readProjectFile("cpp/JSIConverter+NodeCommand.hpp")
	const strokeOptsConverter = readProjectFile("cpp/JSIConverter+StrokeOpts.hpp")
	const textStyleConverter = readProjectFile("cpp/JSIConverter+SkTextStyle.hpp")
	const paragraphStyleConverter = readProjectFile(
		"cpp/JSIConverter+SkParagraphStyle.hpp",
	)
	const materializationVerifier = readProjectFile(
		"scripts/verify-yoganode-nitro-materialization.mjs",
	)
	const skMatrixConverter = readProjectFile("cpp/JSIConverter+SkMatrix.hpp")
	const jsiSkMatrix = readProjectFile(
		"node_modules/@shopify/react-native-skia/cpp/api/JsiSkMatrix.h",
	)
	const generatedSpec = readProjectFile(
		"nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp",
	)
	const generatedNodeStyle = readProjectFile(
		"nitrogen/generated/shared/c++/NodeStyle.hpp",
	)
	const hybridObject = readProjectFile(
		"node_modules/react-native-nitro-modules/cpp/core/HybridObject.cpp",
	)
	const hybridObjectPrototype = readProjectFile(
		"node_modules/react-native-nitro-modules/cpp/prototype/HybridObjectPrototype.cpp",
	)
	const jsiCache = readProjectFile(
		"node_modules/react-native-nitro-modules/cpp/jsi/JSICache.cpp",
	)
	const jsiHelpers = readProjectFile(
		"node_modules/react-native-nitro-modules/cpp/jsi/JSIHelpers.hpp",
	)
	const threadUtils = readProjectFile(
		"node_modules/react-native-nitro-modules/ios/platform/ThreadUtils.cpp",
	)
	const rnSkiaStrokeOpts = readProjectFile(
		rnSkiaTypesPath("Path", "Path.ts"),
	)

	assert(
		rawVerifier.includes(
			"This harness does not claim Nitro toObject()/prototype materialization proof",
		),
		"Raw-method verifier must keep an explicit non-materialization proof boundary.",
	)
	assert(
		!rawVerifier.includes("node->toObject("),
		"Raw-method verifier must not already materialize YogaNode through toObject(runtime).",
	)
	assert(
		commandVerifier.includes("real YogaNode::setCommand()") &&
			commandVerifier.includes("Nitro toObject()/prototype materialization"),
		"Command/render verifier must still cover direct native command execution while excluding Nitro materialization.",
	)
	assert(
		worker078Report.includes("SIGSEGV") &&
			worker078Report.includes("getRuntimeId") &&
			worker078Report.includes("HybridObjectPrototype::createPrototype"),
		"Worker 078 report must retain the prior toObject/prototype crash evidence.",
	)
	assert(
		worker088Report.includes("setCommand({ type: \"group\"") &&
			worker099Report.includes("current `check:yoganode-nitro-materialization` invokes generated `setCommand(group)` only"),
		"Accepted reports must retain the pre-expansion generated setCommand(group)-only materialization gap.",
	)
	assert(
		reconciler.includes("for (const child of node.getChildren())") &&
			reconciler.includes("for (const child of container.node.getChildren())"),
		"Reconciler cleanup must still recursively depend on materialized YogaNode.getChildren().",
	)
	const lineCommandFields = extractInterfaceFields(commandSpec, "LineCommandPayload")
	const pointsCommandFields = extractInterfaceFields(commandSpec, "PointsCommandPayload")
	assert(
		JSON.stringify(lineCommandFields) === JSON.stringify(["from", "to"]) &&
			commandSpec.includes("from: SkPoint") &&
			commandSpec.includes("to: SkPoint"),
		"Public LineCommandPayload must keep from/to SkPoint inventory and order.",
	)
	assert(
		JSON.stringify(pointsCommandFields) === JSON.stringify(["pointMode", "points"]) &&
			commandSpec.includes("points: SkPoint[]"),
		"Public PointsCommandPayload must keep pointMode then points: SkPoint[] inventory and order.",
	)
	assert(
		reconciler.includes('line: ["from", "to"],') &&
			reconciler.includes('points: ["pointMode", "points"],') &&
			reconciler.includes('"from"') &&
			reconciler.includes('"to"') &&
			reconciler.includes('"points"'),
		"Reconciler command key inventories must retain public line and points point payload keys.",
	)
	const buildLineIndex = reconciler.indexOf('case "line":')
	const buildLineFromIndex = reconciler.indexOf(
		'from: requireProp<any>(type, props, "from")',
		buildLineIndex,
	)
	const buildLineToIndex = reconciler.indexOf(
		'to: requireProp<any>(type, props, "to")',
		buildLineIndex,
	)
	assert(
		buildLineIndex >= 0 &&
			buildLineFromIndex > buildLineIndex &&
			buildLineToIndex > buildLineFromIndex,
		"Reconciler line command builder must require from before to.",
	)
	const buildPointsIndex = reconciler.indexOf('case "points":')
	const buildPointModeIndex = reconciler.indexOf(
		"pointMode: normalizePointMode(props.pointMode)",
		buildPointsIndex,
	)
	const buildPointsPayloadIndex = reconciler.indexOf(
		'points: requireProp<any>(type, props, "points")',
		buildPointsIndex,
	)
	assert(
		buildPointsIndex >= 0 &&
			buildPointModeIndex > buildPointsIndex &&
			buildPointsPayloadIndex > buildPointModeIndex,
		"Reconciler points command builder must keep pointMode normalization before required points payload.",
	)
	const converterLineIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::LINE:",
	)
	const converterLineFromIndex = nodeCommandConverter.indexOf(
		'parsePoint(runtime, data.getProperty(runtime, "from"), "line.from")',
		converterLineIndex,
	)
	const converterLineToIndex = nodeCommandConverter.indexOf(
		'parsePoint(runtime, data.getProperty(runtime, "to"), "line.to")',
		converterLineIndex,
	)
	const converterPointsIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::POINTS:",
	)
	const converterParsePointsIndex = nodeCommandConverter.indexOf(
		'auto points = parsePoints(runtime, data.getProperty(runtime, "points"));',
		converterPointsIndex,
	)
	assert(
		nodeCommandConverter.includes("parseFiniteNativePointNumber") &&
			nodeCommandConverter.includes("isValidCommandPointNativeFloat") &&
			nodeCommandConverter.includes("std::numeric_limits<float>::max()") &&
			nodeCommandConverter.includes("expected a finite native float") &&
			nodeCommandConverter.includes("Invalid numeric command point value for ") &&
			nodeCommandConverter.includes('"points.points[" + std::to_string(index) + "]"') &&
			converterLineFromIndex > converterLineIndex &&
			converterLineToIndex > converterLineFromIndex &&
			converterParsePointsIndex > converterPointsIndex,
		"Native NodeCommand converter must native-float-check line and indexed points SkPoint payloads with stable path labels.",
	)
	assert(
		commandVerifier.includes("assertCommandPointNativeFloatRejections(*runtime);") &&
			commandVerifier.includes("line.from.x NaN") &&
			commandVerifier.includes("line.from.y Infinity") &&
			commandVerifier.includes("line.to.x -Infinity") &&
			commandVerifier.includes("line.from.x native-float overflow") &&
			commandVerifier.includes("line.to.y native-float overflow") &&
			commandVerifier.includes("points.points[1].y NaN") &&
			commandVerifier.includes("points.points[0].x native-float overflow") &&
			commandVerifier.includes("points.points[1].y native-float overflow"),
		"Command/render verifier must retain non-finite and native-float-overflow line and indexed points rejection coverage.",
	)
	assert(
		materializationVerifier.includes(
			"assertGeneratedCommandPointNativeFloatRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated line.from.x NaN") &&
			materializationVerifier.includes("generated line.to.y native-float overflow") &&
			materializationVerifier.includes("generated points.points[1].y NaN") &&
			materializationVerifier.includes(
				"generated points.points[1].y native-float overflow",
			),
		"Generated materialized setCommand verifier must retain non-finite and native-float-overflow command point rejection coverage.",
	)
	assert(
		JSON.stringify(extractInterfaceFields(commandSpec, "RoundedRectCommandPayload")) ===
			JSON.stringify(["cornerRadius"]) &&
			commandSpec.includes("cornerRadius?: number"),
		"Public RoundedRectCommandPayload must keep the cornerRadius numeric AnimatedDouble inventory.",
	)
	assert(
		JSON.stringify(extractInterfaceFields(commandSpec, "PathCommandPayload")) ===
			JSON.stringify(["fillType", "path", "stroke", "trimEnd", "trimStart"]) &&
			commandSpec.includes("trimEnd?: number") &&
			commandSpec.includes("trimStart?: number"),
		"Public PathCommandPayload must keep trimEnd before trimStart in the numeric AnimatedDouble inventory.",
	)
	assert(
		JSON.stringify(extractInterfaceFields(commandSpec, "BlurMaskFilterCommandPayload")) ===
			JSON.stringify(["blur", "blurStyle", "respectCTM"]) &&
			commandSpec.includes("blur?: number"),
		"Public BlurMaskFilterCommandPayload must keep the blur numeric AnimatedDouble inventory.",
	)
	assert(
		JSON.stringify(extractInterfaceFields(commandSpec, "CircleCommandPayload")) ===
			JSON.stringify(["radius"]) &&
			commandSpec.includes("radius?: number"),
		"Public CircleCommandPayload must keep the radius numeric AnimatedDouble inventory.",
	)
	assert(
		reconciler.includes('rrect: ["cornerRadius"],') &&
			reconciler.includes('path: ["fillType", "path", "stroke", "trimEnd", "trimStart"],') &&
			reconciler.includes('blurMaskFilter: ["blur", "blurStyle", "respectCTM"],') &&
			reconciler.includes('circle: ["radius"],'),
		"Reconciler command key inventories must retain static AnimatedDouble command fields and order.",
	)
	const buildRRectCommandIndex = reconciler.indexOf('case "rrect":')
	const buildRRectRadiusIndex = reconciler.indexOf(
		"cornerRadius: optionalCommandNumber(props.cornerRadius)",
		buildRRectCommandIndex,
	)
	const buildCircleCommandIndex = reconciler.indexOf('case "circle":')
	const buildCircleRadiusIndex = reconciler.indexOf(
		"radius: optionalCommandNumber(props.radius)",
		buildCircleCommandIndex,
	)
	const buildPathCommandIndex = reconciler.indexOf('case "path":')
	const buildPathTrimEndIndex = reconciler.indexOf(
		"trimEnd: optionalCommandNumber(props.trimEnd)",
		buildPathCommandIndex,
	)
	const buildPathTrimStartIndex = reconciler.indexOf(
		"trimStart: optionalCommandNumber(props.trimStart)",
		buildPathCommandIndex,
	)
	const buildBlurCommandIndex = reconciler.indexOf('case "blurMaskFilter":')
	const buildBlurFieldIndex = reconciler.indexOf(
		"blur: optionalCommandNumber(props.blur)",
		buildBlurCommandIndex,
	)
	assert(
		buildRRectRadiusIndex > buildRRectCommandIndex &&
			buildCircleRadiusIndex > buildCircleCommandIndex &&
			buildPathTrimEndIndex > buildPathCommandIndex &&
			buildPathTrimStartIndex > buildPathTrimEndIndex &&
			buildBlurFieldIndex > buildBlurCommandIndex,
		"Reconciler command builders must retain static AnimatedDouble payload extraction order.",
	)
	const converterRRectCommandIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::RRECT:",
	)
	const converterRRectRadiusIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "cornerRadius"), "rrect.cornerRadius")',
		converterRRectCommandIndex,
	)
	const converterBlurCommandIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::BLUR_MASK_FILTER:",
	)
	const converterBlurFieldIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "blur"), "blurMaskFilter.blur")',
		converterBlurCommandIndex,
	)
	const converterPathCommandIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::PATH:",
	)
	const converterPathTrimEndIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "trimEnd"), "path.trimEnd")',
		converterPathCommandIndex,
	)
	const converterPathTrimStartIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "trimStart"), "path.trimStart")',
		converterPathCommandIndex,
	)
	const converterCircleCommandIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::CIRCLE:",
	)
	const converterCircleRadiusIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "radius"), "circle.radius")',
		converterCircleCommandIndex,
	)
	assert(
		nodeCommandConverter.includes("parseStaticFiniteAnimatedDouble") &&
			nodeCommandConverter.includes("isValidStaticAnimatedDoubleNativeFloat") &&
			nodeCommandConverter.includes("std::isfinite(value)") &&
			nodeCommandConverter.includes("std::numeric_limits<float>::max()") &&
			nodeCommandConverter.includes("expected a finite native float") &&
			nodeCommandConverter.includes("Invalid numeric AnimatedDouble command value for ") &&
			converterRRectRadiusIndex > converterRRectCommandIndex &&
			converterBlurFieldIndex > converterBlurCommandIndex &&
			converterPathTrimEndIndex > converterPathCommandIndex &&
			converterPathTrimStartIndex > converterPathTrimEndIndex &&
			converterCircleRadiusIndex > converterCircleCommandIndex,
		"Native NodeCommand converter must native-float-check static numeric AnimatedDouble command payloads with stable field labels.",
	)
	assert(
		commandVerifier.includes("assertStaticAnimatedDoubleCommandFiniteRejections(*runtime);") &&
			commandVerifier.includes("circle.radius NaN") &&
			commandVerifier.includes("circle.radius native-float overflow") &&
			commandVerifier.includes("rrect.cornerRadius Infinity") &&
			commandVerifier.includes("rrect.cornerRadius native-float overflow") &&
			commandVerifier.includes("blurMaskFilter.blur -Infinity") &&
			commandVerifier.includes("blurMaskFilter.blur native-float overflow") &&
			commandVerifier.includes("path.trimStart NaN") &&
			commandVerifier.includes("path.trimStart native-float overflow") &&
			commandVerifier.includes("path.trimEnd Infinity") &&
			commandVerifier.includes("path.trimEnd native-float overflow"),
		"Command/render verifier must retain non-finite and native-float-overflow static AnimatedDouble rejection coverage.",
	)
	assert(
		materializationVerifier.includes(
			"assertGeneratedStaticAnimatedDoubleCommandFiniteRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated circle.radius NaN") &&
			materializationVerifier.includes("generated circle.radius native-float overflow") &&
			materializationVerifier.includes("generated rrect.cornerRadius Infinity") &&
			materializationVerifier.includes("generated rrect.cornerRadius native-float overflow") &&
			materializationVerifier.includes("generated blurMaskFilter.blur -Infinity") &&
			materializationVerifier.includes("generated blurMaskFilter.blur native-float overflow") &&
			materializationVerifier.includes("generated path.trimStart NaN") &&
			materializationVerifier.includes("generated path.trimStart native-float overflow") &&
			materializationVerifier.includes("generated path.trimEnd Infinity") &&
			materializationVerifier.includes("generated path.trimEnd native-float overflow"),
		"Generated materialized setCommand verifier must retain non-finite and native-float-overflow static AnimatedDouble rejection coverage.",
	)
	assert(
		JSON.stringify(extractInterfaceFields(commandSpec, "PathCommandPayload")) ===
			JSON.stringify(["fillType", "path", "stroke", "trimEnd", "trimStart"]) &&
			commandSpec.includes("stroke?: StrokeOptsNative") &&
			rnSkiaStrokeOpts.includes("width?: number") &&
			rnSkiaStrokeOpts.includes("miter_limit?: number") &&
			rnSkiaStrokeOpts.includes("precision?: number"),
		"Public path stroke numeric field inventory must retain width, miter_limit, and precision.",
	)
	assert(
		strokeOptsConverter.includes("Invalid numeric stroke value for ") &&
			strokeOptsConverter.includes("isValidNativeStrokeFloat") &&
			strokeOptsConverter.includes("std::isfinite(value)") &&
			strokeOptsConverter.includes("std::numeric_limits<float>::max()") &&
			strokeOptsConverter.includes("expected a finite native float") &&
			strokeOptsConverter.includes('"stroke.width"') &&
			strokeOptsConverter.includes('"stroke.miter_limit"') &&
			strokeOptsConverter.includes('"stroke.miterLimit"') &&
			strokeOptsConverter.includes('"stroke.precision"'),
		"Direct StrokeOpts converter must retain native-float validation for public numeric fields and miterLimit alias fallback.",
	)
	assert(
		strokeOptsConverter.includes("getOptionalNativeStrokeFloatProperty") &&
			nodeCommandConverter.includes("getOptionalNativeStrokeFloatProperty") &&
			nodeCommandConverter.includes('"path.stroke.width"') &&
			nodeCommandConverter.includes('"path.stroke.miter_limit"') &&
			nodeCommandConverter.includes('"path.stroke.miterLimit"') &&
			nodeCommandConverter.includes('"path.stroke.precision"'),
		"NodeCommand path stroke parser must retain native-float validation for public numeric fields and miterLimit alias fallback.",
	)
	assert(
		commandVerifier.includes("assertPathStrokeNumericFiniteRejections(*runtime);") &&
			commandVerifier.includes("assertStrokeOptsConverterFiniteRejections(*runtime);") &&
			commandVerifier.includes("path.stroke.width native-float overflow") &&
			commandVerifier.includes("path.stroke.miter_limit native-float overflow") &&
			commandVerifier.includes("path.stroke.miterLimit native-float overflow") &&
			commandVerifier.includes("path.stroke.precision native-float overflow") &&
			materializationVerifier.includes(
				"assertGeneratedPathStrokeNumericFiniteRejections(*runtime);",
			) &&
			materializationVerifier.includes("generated path.stroke.width NaN") &&
			materializationVerifier.includes("generated path.stroke.width native-float overflow") &&
			materializationVerifier.includes("generated path.stroke.miter_limit Infinity") &&
			materializationVerifier.includes("generated path.stroke.miter_limit native-float overflow") &&
			materializationVerifier.includes("generated path.stroke.miterLimit -Infinity") &&
			materializationVerifier.includes("generated path.stroke.miterLimit native-float overflow") &&
			materializationVerifier.includes("generated path.stroke.precision NaN") &&
			materializationVerifier.includes("generated path.stroke.precision native-float overflow"),
		"Native and generated materialized verifiers must retain path stroke numeric native-float rejection coverage.",
	)
	assert(
		nodeCommandConverter.includes("Invalid numeric enum value for ") &&
			nodeCommandConverter.includes("std::trunc(number)") &&
			nodeCommandConverter.includes('"blurMaskFilter.blurStyle"') &&
			nodeCommandConverter.includes('"points.pointMode"') &&
			nodeCommandConverter.includes('"path.fillType"') &&
			nodeCommandConverter.includes('"path.stroke.join"') &&
			nodeCommandConverter.includes('"path.stroke.cap"') &&
			strokeOptsConverter.includes('"stroke.join"') &&
			strokeOptsConverter.includes('"stroke.cap"') &&
			commandVerifier.includes("assertCommandNumericEnumRejections(*runtime);") &&
			commandVerifier.includes("assertStrokeOptsConverterNumericEnumRejections(*runtime);") &&
			materializationVerifier.includes(
				"assertGeneratedCommandNumericEnumRejections(*runtime);",
			) &&
			materializationVerifier.includes("generated blurMaskFilter.blurStyle NaN") &&
			materializationVerifier.includes("generated points.pointMode fractional") &&
			materializationVerifier.includes("generated path.fillType out-of-range") &&
			materializationVerifier.includes("generated path.stroke.join fractional") &&
			materializationVerifier.includes("generated path.stroke.cap out-of-range"),
		"Native and generated materialized verifiers must retain public command numeric enum finite/integer/range rejection coverage.",
	)
	assert(
		yogaNodeCpp.includes("toFiniteYogaNodeMethodFloat") &&
			yogaNodeCpp.includes('toFiniteYogaNodeMethodFloat(width.value(), "computeLayout.width")') &&
			yogaNodeCpp.includes('toFiniteYogaNodeMethodFloat(height.value(), "computeLayout.height")') &&
			yogaNodeCpp.includes('toFiniteYogaNodeMethodFloat(args[0].asNumber(), "hitTest.x")') &&
			yogaNodeCpp.includes('toFiniteYogaNodeMethodFloat(args[1].asNumber(), "hitTest.y")') &&
			rawVerifier.includes("expectInvalidHitTestPreservesState") &&
			rawVerifier.includes("hitTest.x NaN") &&
			rawVerifier.includes("hitTest.y native-float overflow") &&
			materializationVerifier.includes(
				"assertGeneratedComputeLayoutNumericValidation(*runtime);",
			) &&
			materializationVerifier.includes("generated computeLayout.width NaN") &&
			materializationVerifier.includes(
				"generated computeLayout.height native-float overflow",
			),
		"YogaNode method numeric arguments must retain finite/native-float validation and state-preservation verifier coverage.",
	)
	assert(
		textStyleConverter.includes("validateTextStyleNumericFields") &&
			textStyleConverter.includes("getRequiredFiniteStyleFloat") &&
			textStyleConverter.includes("isFiniteNativeStyleFloat") &&
			textStyleConverter.includes("getRequiredFiniteStyleInt") &&
			textStyleConverter.includes("parseFiniteTextStylePoint") &&
			textStyleConverter.includes("std::isfinite(number)") &&
			textStyleConverter.includes("std::numeric_limits<float>::max()") &&
			textStyleConverter.indexOf("std::numeric_limits<float>::max()") <
				textStyleConverter.indexOf("static_cast<float>(number)") &&
			!textStyleConverter.includes("std::isfinite(narrowed)") &&
			textStyleConverter.includes("std::numeric_limits<int>::max()") &&
			textStyleConverter.includes('stylePath + ".fontSize"') &&
			textStyleConverter.includes('stylePath + ".fontFeatures["') &&
			textStyleConverter.includes('stylePath + ".shadows["') &&
			textStyleConverter.includes("Invalid numeric text/paragraph style value for "),
		"TextStyle converter must pre-narrow native-float-check public numeric float leaves and range-check int, enum, and shadow point leaves.",
	)
	assert(
		paragraphStyleConverter.includes("validateParagraphStyleNumericFields") &&
			paragraphStyleConverter.includes("getRequiredFiniteParagraphStyleSize") &&
			paragraphStyleConverter.includes("validateParagraphStyleStrutStyleNumericFields") &&
			paragraphStyleConverter.includes("ParagraphStyle.maxLines") &&
			paragraphStyleConverter.includes("ParagraphStyle.strutStyle.leading") &&
			paragraphStyleConverter.includes("ParagraphStyle.textStyle") &&
			paragraphStyleConverter.indexOf("validateParagraphStyleNumericFields(runtime, arg);") <
				paragraphStyleConverter.indexOf("auto paragraphStyle = paragraphStyleBaseFromValue(runtime, arg);"),
		"ParagraphStyle converter must validate paragraph and strut numeric leaves before delegating to RN Skia raw parsing.",
	)
	assert(
		commandVerifier.includes("assertTextParagraphStyleNumericFiniteRejections(*runtime);") &&
			commandVerifier.includes("direct TextStyle letterSpacing native-float overflow") &&
			commandVerifier.includes("text.textStyle.fontSize NaN") &&
			commandVerifier.includes("paragraph.paragraphStyle.textStyle.fontSize NaN") &&
			commandVerifier.includes("paragraph.paragraphStyle.strutStyle.leading -Infinity") &&
			commandVerifier.includes("paragraph.paragraphStyle.strutStyle.leading float overflow") &&
			commandVerifier.includes("paragraph.paragraphStyle.maxLines fractional") &&
			commandVerifier.includes("paragraph.paragraphStyle.fontFeatures[0].value fractional") &&
			commandVerifier.includes("paragraph.paragraphStyle.fontFeatures[0].value int overflow") &&
			materializationVerifier.includes(
				"assertGeneratedTextParagraphStyleNumericFiniteRejections(*runtime);",
			) &&
			materializationVerifier.includes("generated text.textStyle.fontSize NaN") &&
			materializationVerifier.includes("generated paragraph.paragraphStyle.textStyle.fontSize NaN") &&
			materializationVerifier.includes("generated paragraph.paragraphStyle.strutStyle.leading -Infinity") &&
			materializationVerifier.includes(
				"generated paragraph.paragraphStyle.strutStyle.leading float overflow",
			) &&
			materializationVerifier.includes(
				"generated paragraph.paragraphStyle.maxLines fractional",
			) &&
			materializationVerifier.includes(
				"generated paragraph.paragraphStyle.fontFeatures[0].value fractional",
			) &&
			materializationVerifier.includes(
				"generated paragraph.paragraphStyle.fontFeatures[0].value int overflow",
			),
		"Native and generated materialized verifiers must retain text/paragraph style numeric finite/range state-preservation coverage.",
	)
	assert(
		yogaNodeCpp.includes("_children[i]->toObject(runtime)") &&
			!yogaNodeCpp.includes("JSIConverter<std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>>::toJSI(runtime, _children[i])"),
		"YogaNode::getChildren must materialize returned children with YogaNode::toObject(runtime), not a bare NativeState wrapper path.",
	)
	assert(
		yogaNodeConverter.includes("return arg->toObject(runtime);") &&
			!yogaNodeConverter.includes("jsi::Object obj(runtime);") &&
			!yogaNodeConverter.includes("obj.setNativeState("),
		"YogaNode shared_ptr converter must delegate to Nitro materialization instead of creating NativeState-only objects.",
	)
	assert(
		styleSpec.includes("export type MatrixArray16 = [") &&
			styleSpec.includes("matrix?: SkMatrixNative | MatrixArray"),
		"Public style spec must still expose matrix?: SkMatrixNative | MatrixArray with MatrixArray16.",
	)
	assert(
		skMatrixConverter.includes("validateFiniteMatrixArray") &&
			skMatrixConverter.includes("for (size_t i = 0; i < length; ++i)") &&
			skMatrixConverter.includes('"Invalid numeric style value for matrix[" + std::to_string(i)'),
		"SkMatrix converter must finite-check every public matrix array element before RN Skia narrows 16-value arrays to SkMatrix.",
	)
	assert(
		generatedNodeStyle.includes("std::optional<std::variant<std::shared_ptr<SkMatrix>") &&
			generatedNodeStyle.includes("double, double, double, double, double, double, double, double, double, double, double, double, double, double, double, double"),
		"Generated NodeStyle must still accept shared SkMatrix, tuple-9, and tuple-16 matrix variants.",
	)
	const expectedTransformInventory = [
		{ type: "TransformRotateX", key: "rotateX" },
		{ type: "TransformRotateY", key: "rotateY" },
		{ type: "TransformRotateZ", key: "rotateZ" },
		{ type: "TransformScale", key: "scale" },
		{ type: "TransformScaleX", key: "scaleX" },
		{ type: "TransformScaleY", key: "scaleY" },
		{ type: "TransformTranslateX", key: "translateX" },
		{ type: "TransformTranslateY", key: "translateY" },
		{ type: "TransformSkewX", key: "skewX" },
		{ type: "TransformSkewY", key: "skewY" },
	]
	const expectedTransformTypes = expectedTransformInventory.map(({ type }) => type)
	const publicTransformMatches = [
		...styleSpec.matchAll(/export type (Transform[A-Za-z0-9]+) = \{ ([A-Za-z0-9]+): number \}/g),
	]
	const publicTransformTypes = publicTransformMatches.map((match) => match[1])
	const publicTransformKeys = publicTransformMatches.map((match) => match[2])
	const expectedTransformKeys = expectedTransformInventory.map(({ key }) => key)
	assert(
		JSON.stringify(publicTransformTypes) === JSON.stringify(expectedTransformTypes) &&
			JSON.stringify(publicTransformKeys) === JSON.stringify(expectedTransformKeys),
		"Public transform type/key inventory must match the native finite-validation inventory exactly.",
	)
	const transformUnion = styleSpec.match(/export type Transform = \(([\s\S]*?)\)\[\]/)
	assert(transformUnion != null, "Public Transform union must be parseable.")
	const unionTransformTypes = [
		...new Set([...transformUnion[1].matchAll(/Transform[A-Za-z0-9]+/g)].map((match) => match[0])),
	]
	assert(
		JSON.stringify(unionTransformTypes) === JSON.stringify(expectedTransformTypes),
		"Public Transform union must not add, remove, or reorder operations without updating native validation.",
	)
	const generatedTransformVariant =
		"std::optional<std::vector<std::variant<" +
		expectedTransformTypes.join(", ") +
		">>> transform"
	assert(
		generatedNodeStyle.includes(generatedTransformVariant),
		"Generated NodeStyle transform variant inventory must match the public/native inventory exactly.",
	)
	for (const { type, key } of expectedTransformInventory) {
		const generatedTransformHeader = readProjectFile(
			`nitrogen/generated/shared/c++/${type}.hpp`,
		)
		assert(
			generatedTransformHeader.includes(`struct ${type}`) &&
				generatedTransformHeader.includes(`double ${key}`) &&
				generatedTransformHeader.includes(`obj.getProperty(runtime, "${key}")`),
			`Generated ${type} must retain the ${key} numeric payload.`,
		)
		assert(
			yogaNodeCpp.includes(`std::is_same_v<T, ${type}>`) &&
				yogaNodeCpp.includes(`"transform.${key}", op.${key}`) &&
				yogaNodeCpp.includes(`op.${key}`),
			`YogaNode.cpp must apply and finite-validate transform operation ${key}.`,
		)
	}
	assert(
		yogaNodeCpp.includes('static_assert(alwaysFalse<T>, "Unsupported transform operation")'),
		"YogaNode.cpp transform visitors must fail compilation when generated transform variants drift.",
	)
	const expectedRadiusCornerInventory = [
		"borderTopLeftRadius",
		"borderTopRightRadius",
		"borderBottomRightRadius",
		"borderBottomLeftRadius",
	]
	for (const cornerKey of expectedRadiusCornerInventory) {
		assert(
			styleSpec.includes(`${cornerKey}?: number | SkPoint`) &&
				generatedNodeStyle.includes(`std::optional<std::variant<double, SkPoint>> ${cornerKey}`) &&
				generatedNodeStyle.includes(`obj.getProperty(runtime, "${cornerKey}")`) &&
				yogaNodeCpp.includes(`validateFiniteCornerRadius("${cornerKey}", style.${cornerKey})`),
			`Public/generated/native style paths must still accept and finite-validate SkPoint-capable ${cornerKey}.`,
		)
	}
	assert(
		styleSpec.includes("borderRadius?: number") &&
			generatedNodeStyle.includes("std::optional<double> borderRadius") &&
			generatedNodeStyle.includes('obj.getProperty(runtime, "borderRadius")') &&
			yogaNodeCpp.includes('validateFiniteStyleNumber("borderRadius", style.borderRadius)') &&
			yogaNodeCpp.includes("style.borderRadius.has_value()") &&
			yogaNodeCpp.includes("radii[SkRRect::kUpperLeft_Corner] = SkVector::Make(radius, radius)") &&
			yogaNodeCpp.includes("radii[SkRRect::kUpperRight_Corner] = SkVector::Make(radius, radius)") &&
			yogaNodeCpp.includes("radii[SkRRect::kLowerRight_Corner] = SkVector::Make(radius, radius)") &&
			yogaNodeCpp.includes("radii[SkRRect::kLowerLeft_Corner] = SkVector::Make(radius, radius)"),
		"Public/generated/native style paths must retain scalar borderRadius delivery, finite validation, and all-corner seeding.",
	)
	assert(
		yogaNodeCpp.includes('throwInvalidNumericStyleValue(std::string(propertyName) + ".x")') &&
			yogaNodeCpp.includes('throwInvalidNumericStyleValue(std::string(propertyName) + ".y")'),
		"YogaNode.cpp radius validation must inspect both generated SkPoint axes.",
	)
	for (const field of [
		"alignContent",
		"alignSelf",
		"flexWrap",
		"direction",
		"display",
		"boxSizing",
		"minWidth",
		"minHeight",
		"maxWidth",
		"maxHeight",
		"aspectRatio",
		"start",
		"end",
		"top",
		"bottom",
	]) {
		assert(
			styleSpec.includes(`${field}?:`) &&
				generatedNodeStyle.includes(`obj.getProperty(runtime, "${field}")`),
			`Public/generated NodeStyle must retain residual layout field ${field}.`,
		)
	}
	for (const field of [
		"width",
		"height",
		"minWidth",
		"maxWidth",
		"minHeight",
		"maxHeight",
		"flexBasis",
		"gap",
		"rowGap",
		"columnGap",
		"flexGrow",
		"flexShrink",
		"alignContent",
		"alignSelf",
		"flexWrap",
		"direction",
		"display",
		"boxSizing",
		"position",
		"top",
		"right",
		"bottom",
		"left",
		"start",
		"end",
		"marginLeft",
		"marginRight",
		"inset",
		"insetHorizontal",
		"insetVertical",
	]) {
		assert(
			reconcilerAnimatedVerifier.includes(`key: "${field}"`) &&
				styleSpec.includes(`${field}?:`) &&
				generatedNodeStyle.includes(`obj.getProperty(runtime, "${field}")`),
			`Worker 199 dynamic layout field inventory must retain public/generated ${field}.`,
		)
	}
	for (const nativeNeedle of [
		"YGNodeStyleSetAlignContent",
		"YGNodeStyleSetAlignSelf",
		"YGNodeStyleSetFlexWrap",
		"YGNodeStyleSetDirection",
		"YGNodeStyleSetDisplay",
		"YGNodeStyleSetBoxSizing",
		"YGNodeStyleSetMinWidth",
		"YGNodeStyleSetMinHeight",
		"YGNodeStyleSetMaxWidth",
		"YGNodeStyleSetMaxHeight",
		"YGNodeStyleSetAspectRatio",
	]) {
		assert(
			yogaNodeCpp.includes(nativeNeedle),
			`YogaNode.cpp must retain native residual layout setter ${nativeNeedle}.`,
		)
	}
	for (const nativeNeedle of [
		"style.start",
		"style.end",
		"style.marginLeft",
		"style.marginRight",
		"style.inset",
	]) {
		assert(
			yogaNodeCpp.includes(nativeNeedle),
			`YogaNode.cpp must retain native exact dynamic layout alias setter path ${nativeNeedle}.`,
		)
	}
	const setStyleBodyIndex = yogaNodeCpp.indexOf("void YogaNode::setStyle")
	const finiteNumericValidationCallIndex = yogaNodeCpp.indexOf(
		"validateFiniteNumericStyleFields(style);",
		setStyleBodyIndex,
	)
	const matrixTransformValidationCallIndex = yogaNodeCpp.indexOf(
		"validateFiniteMatrixAndTransformStyleFields(style);",
		setStyleBodyIndex,
	)
	const radiusValidationCallIndex = yogaNodeCpp.indexOf(
		"validateFiniteRadiusStyleFields(style);",
		setStyleBodyIndex,
	)
	assert(
		yogaNodeCpp.includes("validateFiniteNumericStyleFields(style);") &&
			yogaNodeCpp.includes("Invalid numeric style value for ") &&
			setStyleBodyIndex >= 0 &&
			finiteNumericValidationCallIndex >= 0,
		"YogaNode::setStyle must retain selected finite numeric validation before native mutation.",
	)
	assert(
		yogaNodeCpp.includes("validateFiniteMatrixAndTransformStyleFields(style);") &&
			yogaNodeCpp.includes("validateFiniteMatrixStyleValue") &&
			yogaNodeCpp.includes("validateFiniteTransformOperation") &&
			matrixTransformValidationCallIndex >= 0,
		"YogaNode::setStyle must retain matrix/transform finite validation before native mutation.",
	)
	assert(
		yogaNodeCpp.includes("validateFiniteRadiusStyleFields(style);") &&
			yogaNodeCpp.includes("validateFiniteCornerRadius") &&
			radiusValidationCallIndex >= 0,
		"YogaNode::setStyle must retain radius finite validation before native mutation.",
	)
	for (const mutationNeedle of [
		"invalidateLayout();",
		"_style = style;",
		"resetYogaStyle(_node);",
		"_paint = SkPaint();",
		"_layerPaint.reset();",
		"_clipsToBounds = false;",
		"_clipToBoundsRadii.reset();",
		"_clipPath.reset();",
		"_clipRect.reset();",
		"_clipRRect.reset();",
		"_matrix.reset();",
	]) {
		const mutationIndex = yogaNodeCpp.indexOf(mutationNeedle, setStyleBodyIndex)
		assert(
			mutationIndex >= 0 && finiteNumericValidationCallIndex < mutationIndex,
			`YogaNode::setStyle finite numeric validation must run before ${mutationNeedle}`,
		)
		assert(
			mutationIndex >= 0 && matrixTransformValidationCallIndex < mutationIndex,
			`YogaNode::setStyle matrix/transform finite validation must run before ${mutationNeedle}`,
		)
		assert(
			mutationIndex >= 0 && radiusValidationCallIndex < mutationIndex,
			`YogaNode::setStyle radius finite validation must run before ${mutationNeedle}`,
		)
	}
	for (const field of [
		"borderBottomWidth",
		"borderEndWidth",
		"borderLeftWidth",
		"borderRightWidth",
		"borderStartWidth",
		"borderTopWidth",
		"borderWidth",
		"borderHorizontalWidth",
		"borderVerticalWidth",
		"strokeMiter",
		"opacity",
	]) {
		assert(
			styleSpec.includes(`${field}?: number`) &&
				generatedNodeStyle.includes(`std::optional<double> ${field}`) &&
				yogaNodeCpp.includes(`"${field}", style.${field}`),
			`Public/generated/native finite numeric validation target ${field} must remain wired.`,
		)
	}
	for (const field of [
		"aspectRatio",
		"flex",
		"flexGrow",
		"flexShrink",
		"gap",
		"rowGap",
		"columnGap",
	]) {
		assert(
			styleSpec.includes(`${field}?: number`) &&
				generatedNodeStyle.includes(`std::optional<double> ${field}`) &&
				generatedNodeStyle.includes(`obj.getProperty(runtime, "${field}")`) &&
				yogaNodeCpp.includes(`"${field}", style.${field}`),
			`Public/generated/native finite numeric layout scalar ${field} must remain wired.`,
		)
	}
	for (const field of [
		"flexBasis",
		"width",
		"height",
		"minWidth",
		"minHeight",
		"maxWidth",
		"maxHeight",
		"top",
		"right",
		"bottom",
		"left",
		"start",
		"end",
		"margin",
		"marginTop",
		"marginBottom",
		"marginLeft",
		"marginRight",
		"marginStart",
		"marginEnd",
		"marginHorizontal",
		"marginVertical",
		"padding",
		"paddingTop",
		"paddingBottom",
		"paddingLeft",
		"paddingRight",
		"paddingStart",
		"paddingEnd",
		"paddingHorizontal",
		"paddingVertical",
		"inset",
		"insetHorizontal",
		"insetVertical",
	]) {
		assert(
			styleSpec.includes(`${field}?:`) &&
				generatedNodeStyle.includes(`std::optional<std::variant<std::string, double>> ${field}`) &&
				generatedNodeStyle.includes(`obj.getProperty(runtime, "${field}")`) &&
				yogaNodeCpp.includes(`"${field}", style.${field}`),
			`Public/generated/native finite numeric layout variant ${field} must remain wired.`,
		)
	}
	assert(
		skMatrixConverter.includes("len == 9 || len == 16") &&
			jsiSkMatrix.includes("array.size(runtime) == 16"),
		"SkMatrix converter must still accept 9- and 16-value public matrix arrays.",
	)
	assert(
		yogaNodeCpp.includes("std::tuple_size_v<T> == 16") &&
			yogaNodeCpp.includes("SkM44::RowMajor(values.data()).asM33()"),
		"YogaNode native matrix materialization must retain the 16-value SkM44::RowMajor(...).asM33() conversion path.",
	)
	for (const member of ["setCommand", "setStyle", "computeLayout", "layout"]) {
		assert(
			generatedSpec.includes(`"${member}"`),
			`HybridYogaNodeSpec must register generated ${member}.`,
		)
	}
	assert(
		hybridObject.includes("object.setNativeState(runtime, shared())"),
		"HybridObject::toObject must attach NativeState from shared().",
	)
	assert(
		hybridObjectPrototype.includes("method.second.toJSFunction(runtime)") &&
			hybridObjectPrototype.includes("getter.toJSFunction(runtime)"),
		"HybridObjectPrototype must create JS functions for methods/getters.",
	)
	assert(
		jsiCache.includes("getRuntimeId(runtime)") &&
			jsiHelpers.includes("ThreadUtils::getThreadName()"),
		"Nitro JSICache runtime ID path must still depend on ThreadUtils.",
	)
	assert(
		threadUtils.includes("pthread_getname_np") &&
			threadUtils.includes("dispatch_queue_get_label"),
		"iOS ThreadUtils implementation must be available for the host materialization probe.",
	)
}

function formatFailure(prefix, result, diagnosticPaths = []) {
	const stdout = result.stdout.trim()
	const stderr = result.stderr.trim()
	const signal = result.signal == null ? "" : `\n\nsignal: ${result.signal}`
	return [
		prefix,
		diagnosticPaths.length > 0
			? `diagnostics:\n${formatVerifierTempDiagnostics(diagnosticPaths)}`
			: "",
		stdout ? `stdout:\n${stdout}` : "",
		stderr ? `stderr:\n${stderr}` : "",
		signal,
	]
		.filter(Boolean)
		.join("\n\n")
}

function assertLinkedBinary(binaryPath, diagnosticPaths) {
	if (existsSync(binaryPath) && statSync(binaryPath).isFile()) {
		return
	}

	throw new Error(
		[
			"Native linker reported success but the expected YogaNode Nitro materialization binary was not created.",
			`diagnostics:\n${formatVerifierTempDiagnostics(diagnosticPaths)}`,
		].join("\n\n"),
	)
}

function helperSourcePaths() {
	return [
		"cpp/AnimatedDouble.cpp",
		"cpp/ColorParser.cpp",
		"cpp/PlatformContextAccessor.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Serializable.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Synchronizable.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/SynchronizableAccess.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/Registries/WorkletRuntimeRegistry.cpp",
		"node_modules/react-native/ReactCommon/jsi/jsi/jsi.cpp",
		"node_modules/react-native/ReactCommon/jsi/jsi/jsilib-posix.cpp",
		"node_modules/react-native/ReactCommon/jsc/JSCRuntime.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/JsiHostObject.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/RuntimeAwareCache.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/RuntimeLifecycleMonitor.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/JsiPromises.cpp",
		"node_modules/@shopify/react-native-skia/cpp/api/JsiSkDispatcher.cpp",
		"node_modules/@shopify/react-native-skia/cpp/api/third_party/CSSColorParser.cpp",
		"node_modules/react-native-nitro-modules/cpp/core/HybridObject.cpp",
		"node_modules/react-native-nitro-modules/cpp/prototype/HybridObjectPrototype.cpp",
		"node_modules/react-native-nitro-modules/cpp/utils/CommonGlobals.cpp",
		"node_modules/react-native-nitro-modules/cpp/jsi/JSICache.cpp",
		"node_modules/react-native-nitro-modules/cpp/utils/NitroTypeInfo.cpp",
		"node_modules/react-native-nitro-modules/cpp/utils/PropNameIDCache.cpp",
		"node_modules/react-native-nitro-modules/ios/platform/ThreadUtils.cpp",
	].map(projectPathChecked)
}

function yogaSourcePaths() {
	const yogaDir = projectPath("node_modules/react-native/ReactCommon/yoga/yoga")
	return walkFiles(yogaDir, (entryPath) => entryPath.endsWith(".cpp")).sort()
}

function skiaArchivePaths() {
	const attempts = skiaArchiveLayouts.map((layout) => ({
		...layout,
		archivePaths: walkFiles(layout.root, layout.matchesArchive, {
			required: false,
			followSymlinks: layout.followSymlinks,
		}).sort(),
		resolvedRoot: resolveExistingPath(layout.root),
	}))

	for (const attempt of attempts) {
		attempt.archiveBasenames = attempt.archivePaths.map((archivePath) =>
			path.basename(archivePath),
		)
		attempt.missingExpectedArchives = expectedSkiaArchiveBasenames.filter(
			(archiveName) => !attempt.archiveBasenames.includes(archiveName),
		)
		attempt.isValid = attempt.missingExpectedArchives.length === 0
	}

	const selectedLayout = attempts.find((attempt) => attempt.isValid)
	if (selectedLayout) {
		return selectedLayout.archivePaths
	}

	throw new Error(
		[
			"Unable to locate RN Skia macOS archives required for YogaNode Nitro materialization verification.",
			`Expected archive basenames: ${expectedSkiaArchiveBasenames.join(", ")}`,
			"Checked archive layouts:",
			...attempts.map(formatArchiveLayoutAttempt),
		].join("\n"),
	)
}

function createNitroModulesShim(baseDir) {
	const shimDir = path.join(baseDir, "NitroModules")
	mkdirSync(shimDir, { recursive: true })

	const nitroCppDir = projectPathChecked("node_modules/react-native-nitro-modules/cpp")
	for (const headerPath of walkFiles(
		nitroCppDir,
		(entryPath) => entryPath.endsWith(".hpp") || entryPath.endsWith(".h"),
	)) {
		const targetPath = path.join(shimDir, path.basename(headerPath))
		if (existsSync(targetPath)) {
			unlinkSync(targetPath)
		}
		symlinkSync(headerPath, targetPath)
	}
}

function createMacosXcframeworkArchiveMatcher(root) {
	return (entryPath) => {
		if (!entryPath.endsWith(".a")) {
			return false
		}

		const relativePath = path.relative(root, entryPath)
		if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
			return false
		}

		const segments = relativePath.split(path.sep)
		return (
			segments.length === 3 &&
			segments[0].endsWith(".xcframework") &&
			segments[1].startsWith("macos")
		)
	}
}

function walkFiles(directory, predicate, options = {}) {
	const { required = true, followSymlinks = false } = options
	if (!existsSync(directory) || !statSync(directory).isDirectory()) {
		if (required) {
			throw new Error(`Missing required directory: ${path.relative(rootDir, directory)}`)
		}

		return []
	}

	const files = []
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name)
		if (
			entry.isDirectory() ||
			(followSymlinks && entry.isSymbolicLink() && statSync(entryPath).isDirectory())
		) {
			files.push(...walkFiles(entryPath, predicate, options))
		} else if (
			(entry.isFile() ||
				(followSymlinks && entry.isSymbolicLink() && statSync(entryPath).isFile())) &&
			predicate(entryPath)
		) {
			files.push(entryPath)
		}
	}

	return files
}

function resolveExistingPath(targetPath) {
	if (!existsSync(targetPath)) {
		return null
	}

	return realpathSync(targetPath)
}

function formatArchiveLayoutAttempt(attempt) {
	const details = [
		`- ${attempt.name}`,
		`  root: ${path.relative(rootDir, attempt.root)}`,
		`  expected archives: ${attempt.archivePattern}`,
	]

	if (attempt.resolvedRoot != null) {
		details.push(`  resolved root: ${path.relative(rootDir, attempt.resolvedRoot)}`)
	} else {
		details.push("  resolved root: missing")
	}

	details.push(`  archives found: ${attempt.archivePaths.length}`)
	details.push(
		`  matched basenames: ${attempt.archiveBasenames.length > 0 ? attempt.archiveBasenames.join(", ") : "none"}`,
	)
	details.push(
		`  missing expected archives: ${attempt.missingExpectedArchives.length > 0 ? attempt.missingExpectedArchives.join(", ") : "none"}`,
	)
	details.push("  matched archive paths:")
	if (attempt.archivePaths.length === 0) {
		details.push("    none")
	} else {
		for (const archivePath of attempt.archivePaths) {
			details.push(`    ${path.relative(rootDir, archivePath)}`)
		}
	}
	return details.join("\n")
}

function includeFlags(shimDir) {
	return [
		"cpp",
		"nitrogen/generated/shared/c++",
		shimDir,
		"node_modules/react-native-nitro-modules/cpp/core",
		"node_modules/react-native-nitro-modules/cpp/entrypoint",
		"node_modules/react-native-nitro-modules/cpp/jsi",
		"node_modules/react-native-nitro-modules/cpp/prototype",
		"node_modules/react-native-nitro-modules/cpp/templates",
		"node_modules/react-native-nitro-modules/cpp/utils",
		"node_modules/react-native-nitro-modules/cpp/platform",
		"node_modules/react-native-nitro-modules/cpp/threading",
		"node_modules/react-native-nitro-modules/cpp/views",
		"node_modules/react-native-nitro-modules/ios/platform",
		"node_modules/react-native-nitro-modules/ios/threading",
		"node_modules/react-native/ReactCommon",
		"node_modules/react-native/ReactCommon/jsc",
		"node_modules/react-native/ReactCommon/jsi",
		"node_modules/react-native/ReactCommon/yoga",
		"node_modules/react-native/ReactCommon/callinvoker",
		"node_modules/react-native-worklets/Common/cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets",
		"node_modules/react-native-worklets/apple",
		"node_modules/@shopify/react-native-skia/cpp",
		"node_modules/@shopify/react-native-skia/cpp/api",
		"node_modules/@shopify/react-native-skia/cpp/api/recorder",
		"node_modules/@shopify/react-native-skia/cpp/jsi",
		"node_modules/@shopify/react-native-skia/cpp/rnskia",
		"node_modules/@shopify/react-native-skia/cpp/skia",
		"node_modules/@shopify/react-native-skia/cpp/utils",
	].flatMap((includePath) => [
		"-I",
		path.isAbsolute(includePath) ? includePath : projectPath(includePath),
	])
}

function nativeProbeSource() {
	return String.raw`
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include <ReactCommon/CallInvoker.h>
#include <include/core/SkCanvas.h>
#include <include/core/SkColor.h>
#include <include/core/SkFontMgr.h>
#include <include/core/SkImage.h>
#include <include/core/SkImageInfo.h>
#include <include/core/SkPaint.h>
#include <include/core/SkPath.h>
#include <include/core/SkRect.h>
#include <include/core/SkStream.h>
#include <include/core/SkSurface.h>
#include <include/ports/SkFontMgr_mac_ct.h>
#if !defined(SK_GRAPHITE)
#include <include/gpu/ganesh/GrDirectContext.h>
#endif
#include <jsi/jsi.h>
#include <yoga/Yoga.h>

#include "JSCRuntime.h"
#include "RuntimeAwareCache.h"
#include "DrawingCtx.h"
#include "RNSkPlatformContext.h"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::BlurMaskFilterCmd;
using margelo::nitro::RNSkiaYoga::BlendMode;
using margelo::nitro::RNSkiaYoga::BoxSizing;
using margelo::nitro::RNSkiaYoga::CircleCmd;
using margelo::nitro::RNSkiaYoga::Align;
using margelo::nitro::RNSkiaYoga::Direction;
using margelo::nitro::RNSkiaYoga::Display;
using margelo::nitro::RNSkiaYoga::FlexDirection;
using margelo::nitro::RNSkiaYoga::FlexWrap;
using margelo::nitro::RNSkiaYoga::GroupCmd;
using margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec;
using margelo::nitro::RNSkiaYoga::ImageCmd;
using margelo::nitro::RNSkiaYoga::JustifyContent;
using margelo::nitro::RNSkiaYoga::LineCmd;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::OvalCmd;
using margelo::nitro::RNSkiaYoga::Overflow;
using margelo::nitro::RNSkiaYoga::ParagraphCmd;
using margelo::nitro::RNSkiaYoga::PathCmd;
using margelo::nitro::RNSkiaYoga::Position;
using margelo::nitro::RNSkiaYoga::PointsCmd;
using margelo::nitro::RNSkiaYoga::RectCmd;
using margelo::nitro::RNSkiaYoga::RRectCmd;
using margelo::nitro::RNSkiaYoga::StrokeCap;
using margelo::nitro::RNSkiaYoga::StrokeJoin;
using margelo::nitro::RNSkiaYoga::TextCmd;
using margelo::nitro::RNSkiaYoga::TransformRotateX;
using margelo::nitro::RNSkiaYoga::TransformRotateY;
using margelo::nitro::RNSkiaYoga::TransformRotateZ;
using margelo::nitro::RNSkiaYoga::TransformScale;
using margelo::nitro::RNSkiaYoga::TransformScaleX;
using margelo::nitro::RNSkiaYoga::TransformScaleY;
using margelo::nitro::RNSkiaYoga::TransformSkewX;
using margelo::nitro::RNSkiaYoga::TransformSkewY;
using margelo::nitro::RNSkiaYoga::TransformTranslateX;
using margelo::nitro::RNSkiaYoga::TransformTranslateY;
using margelo::nitro::RNSkiaYoga::YogaNode;
using margelo::nitro::RNSkiaYoga::YogaNodeCommandKind;
using margelo::nitro::RNSkiaYoga::YogaNodeLayout;

namespace {

using StyleCornerRadius = std::variant<double, margelo::nitro::RNSkiaYoga::SkPoint>;

void expect(bool condition, const char* message)
{
    if (!condition) {
        std::cerr << "FAIL: " << message << "\n";
        std::abort();
    }
}

void expect(bool condition, const std::string& message)
{
    expect(condition, message.c_str());
}

void expectNear(double actual, double expected, const char* message)
{
    if (std::fabs(actual - expected) > 0.001) {
        std::cerr << "FAIL: " << message << " expected=" << expected << " actual=" << actual << "\n";
        std::abort();
    }
}

void expectNear(double actual, double expected, const std::string& message)
{
    expectNear(actual, expected, message.c_str());
}

void expectOptionalFloatNear(const std::optional<float>& actual, double expected, const char* message)
{
    expect(actual.has_value(), message);
    expectNear(*actual, expected, message);
}

void expectOptionalDoubleNear(const std::optional<double>& actual, double expected, const char* message)
{
    expect(actual.has_value(), message);
    expectNear(*actual, expected, message);
}

void expectOptionalStyleNumber(
    const std::optional<std::variant<std::string, double>>& actual,
    double expected,
    const char* message)
{
    expect(actual.has_value(), message);
    expect(std::holds_alternative<double>(*actual), message);
    expectNear(std::get<double>(*actual), expected, message);
}

void expectOptionalStyleString(
    const std::optional<std::variant<std::string, double>>& actual,
    const char* expected,
    const char* message)
{
    expect(actual.has_value(), message);
    expect(std::holds_alternative<std::string>(*actual), message);
    expect(std::get<std::string>(*actual) == expected, message);
}

void expectYGValuePoint(const YGValue& actual, double expected, const char* message)
{
    expect(actual.unit == YGUnitPoint, message);
    expectNear(actual.value, expected, message);
}

void expectYGValuePercent(const YGValue& actual, double expected, const char* message)
{
    expect(actual.unit == YGUnitPercent, message);
    expectNear(actual.value, expected, message);
}

void expectYGValueAuto(const YGValue& actual, const char* message)
{
    expect(actual.unit == YGUnitAuto, message);
}

void expectYGValueUndefined(const YGValue& actual, const char* message)
{
    expect(actual.unit == YGUnitUndefined, message);
}

void expectYGValueSame(const YGValue& actual, const YGValue& expected, const char* message)
{
    expect(actual.unit == expected.unit, message);
    if (actual.unit == YGUnitPoint || actual.unit == YGUnitPercent) {
        expectNear(actual.value, expected.value, message);
    }
}

void expectStyleCornerPointRadius(
    const std::optional<StyleCornerRadius>& actual,
    double expectedX,
    double expectedY,
    const char* message)
{
    expect(actual.has_value(), message);
    expect(std::holds_alternative<margelo::nitro::RNSkiaYoga::SkPoint>(*actual), message);
    const auto& point = std::get<margelo::nitro::RNSkiaYoga::SkPoint>(*actual);
    expectNear(point.x, expectedX, message);
    expectNear(point.y, expectedY, message);
}

void expectStyleCornerScalarRadius(
    const std::optional<StyleCornerRadius>& actual,
    double expected,
    const char* message)
{
    expect(actual.has_value(), message);
    expect(std::holds_alternative<double>(*actual), message);
    expectNear(std::get<double>(*actual), expected, message);
}

void expectCornerRadiiNear(
    const margelo::nitro::RNSkiaYoga::detail::CornerRadii& radii,
    SkRRect::Corner corner,
    double expectedX,
    double expectedY,
    const char* message)
{
    expectNear(radii[corner].fX, expectedX, message);
    expectNear(radii[corner].fY, expectedY, message);
}

void expectColor(SkColor actual, SkColor expected, const char* message)
{
    if (actual != expected) {
        std::cerr << "FAIL: " << message
                  << " expected rgba("
                  << SkColorGetR(expected) << ", "
                  << SkColorGetG(expected) << ", "
                  << SkColorGetB(expected) << ", "
                  << SkColorGetA(expected) << ") actual rgba("
                  << SkColorGetR(actual) << ", "
                  << SkColorGetG(actual) << ", "
                  << SkColorGetB(actual) << ", "
                  << SkColorGetA(actual) << ")\n";
        std::abort();
    }
}

void expectColorRgb(SkColor actual, SkColor expected, const char* message)
{
    if (
        SkColorGetR(actual) != SkColorGetR(expected) ||
        SkColorGetG(actual) != SkColorGetG(expected) ||
        SkColorGetB(actual) != SkColorGetB(expected)) {
        std::cerr << "FAIL: " << message
                  << " expected rgb("
                  << SkColorGetR(expected) << ", "
                  << SkColorGetG(expected) << ", "
                  << SkColorGetB(expected) << ") actual rgb("
                  << SkColorGetR(actual) << ", "
                  << SkColorGetG(actual) << ", "
                  << SkColorGetB(actual) << ")\n";
        std::abort();
    }
}

void expectSkRectNear(
    const SkRect& actual,
    double expectedLeft,
    double expectedTop,
    double expectedWidth,
    double expectedHeight,
    const char* message)
{
    expectNear(actual.left(), expectedLeft, message);
    expectNear(actual.top(), expectedTop, message);
    expectNear(actual.width(), expectedWidth, message);
    expectNear(actual.height(), expectedHeight, message);
}

bool skMatrixNear(const SkMatrix& actual, const SkMatrix& expected)
{
    for (int i = 0; i < 9; ++i) {
        if (std::fabs(actual.get(i) - expected.get(i)) > 0.001) {
            return false;
        }
    }
    return true;
}

void expectSkMatrixNear(
    const SkMatrix& actual,
    const SkMatrix& expected,
    const char* message)
{
    for (int i = 0; i < 9; ++i) {
        if (std::fabs(actual.get(i) - expected.get(i)) > 0.001) {
            std::cerr << "FAIL: " << message
                      << " index=" << i
                      << " expected=" << expected.get(i)
                      << " actual=" << actual.get(i) << "\n";
            std::abort();
        }
    }
}

void expectSkRRectNear(
    const SkRRect& actual,
    double expectedLeft,
    double expectedTop,
    double expectedWidth,
    double expectedHeight,
    double expectedRadiusX,
    double expectedRadiusY,
    const char* message)
{
    expectSkRectNear(actual.getBounds(), expectedLeft, expectedTop, expectedWidth, expectedHeight, message);
    const auto radii = actual.getSimpleRadii();
    expectNear(radii.x(), expectedRadiusX, message);
    expectNear(radii.y(), expectedRadiusY, message);
}

class HostCallInvoker final : public facebook::react::CallInvoker {
public:
    void invokeAsync(facebook::react::CallFunc&& func) noexcept override
    {
        (void)func;
    }

    void invokeSync(facebook::react::CallFunc&& func) override
    {
        (void)func;
    }
};

class HostPlatformContext final : public RNSkia::RNSkPlatformContext {
public:
    explicit HostPlatformContext(std::shared_ptr<HostCallInvoker> callInvoker)
        : RNSkia::RNSkPlatformContext(std::move(callInvoker), 1.0f)
    {
    }

    void runOnMainThread(std::function<void()> func) override
    {
        func();
    }

    sk_sp<SkImage> takeScreenshotFromViewTag(size_t tag) override
    {
        (void)tag;
        return nullptr;
    }

    void performStreamOperation(
        const std::string& sourceUri,
        const std::function<void(std::unique_ptr<SkStreamAsset>)>& op) override
    {
        (void)sourceUri;
        op(nullptr);
    }

    void raiseError(const std::exception& err) override
    {
        throw std::runtime_error(err.what());
    }

    sk_sp<SkSurface> makeOffscreenSurface(int width, int height) override
    {
        return SkSurfaces::Raster(SkImageInfo::MakeN32Premul(std::max(1, width), std::max(1, height)));
    }

    std::shared_ptr<RNSkia::WindowContext> makeContextFromNativeSurface(
        void* surface,
        int width,
        int height) override
    {
        (void)surface;
        (void)width;
        (void)height;
        return nullptr;
    }

    sk_sp<SkImage> makeImageFromNativeBuffer(void* buffer) override
    {
        (void)buffer;
        return nullptr;
    }

#if !defined(SK_GRAPHITE)
    sk_sp<SkImage> makeImageFromNativeTexture(
        const RNSkia::TextureInfo& textureInfo,
        int width,
        int height,
        bool mipMapped) override
    {
        (void)textureInfo;
        (void)width;
        (void)height;
        (void)mipMapped;
        return nullptr;
    }

    const RNSkia::TextureInfo getTexture(sk_sp<SkSurface> image) override
    {
        (void)image;
        return {};
    }

    const RNSkia::TextureInfo getTexture(sk_sp<SkImage> image) override
    {
        (void)image;
        return {};
    }

    GrDirectContext* getDirectContext() override
    {
        return nullptr;
    }
#endif

    void releaseNativeBuffer(uint64_t pointer) override
    {
        (void)pointer;
    }

    uint64_t makeNativeBuffer(sk_sp<SkImage> image) override
    {
        (void)image;
        return 0;
    }

    std::shared_ptr<RNSkia::RNSkVideo> createVideo(const std::string& url) override
    {
        (void)url;
        return nullptr;
    }

    sk_sp<SkFontMgr> createFontMgr() override
    {
        return SkFontMgr_New_CoreText(nullptr);
    }
};

sk_sp<SkSurface> makeSurface(int width, int height)
{
    auto surface = SkSurfaces::Raster(SkImageInfo::MakeN32Premul(width, height));
    expect(surface != nullptr, "state probe raster SkSurface must be created");
    surface->getCanvas()->clear(SK_ColorTRANSPARENT);
    return surface;
}

SkColor pixelAt(const sk_sp<SkSurface>& surface, int x, int y)
{
    SkPixmap pixmap;
    expect(surface->peekPixels(&pixmap), "state probe raster surface pixels must be readable");
    return pixmap.getColor(x, y);
}

void renderNode(const std::shared_ptr<YogaNode>& node, const sk_sp<SkSurface>& surface)
{
    RNSkia::DrawingCtx ctx(surface->getCanvas());
    node->renderToContext(ctx);
}

void drawCommandToResolveRenderTimeState(YogaNode& node)
{
    auto surface = makeSurface(64, 64);
    RNSkia::DrawingCtx ctx(surface->getCanvas());
    expect(node._command != nullptr, "state probe requires a native command");
    node._command->draw(&ctx);
}

sk_sp<SkImage> makeSyntheticImage()
{
    auto surface = makeSurface(4, 2);
    auto* canvas = surface->getCanvas();
    SkPaint paint;
    paint.setStyle(SkPaint::kFill_Style);
    paint.setColor(SK_ColorRED);
    canvas->drawRect(SkRect::MakeXYWH(0.0f, 0.0f, 2.0f, 2.0f), paint);
    paint.setColor(SK_ColorGREEN);
    canvas->drawRect(SkRect::MakeXYWH(2.0f, 0.0f, 2.0f, 2.0f), paint);

    auto image = surface->makeImageSnapshot();
    expect(image != nullptr, "synthetic SkImage host-object payload must be created");
    expect(image->width() == 4, "synthetic SkImage width");
    expect(image->height() == 2, "synthetic SkImage height");
    return image;
}

jsi::Object makePaintHostObject(jsi::Runtime& runtime, const SkPaint& paint)
{
    return jsi::Object::createFromHostObject(
        runtime,
        std::make_shared<RNSkia::JsiSkPaint>(
            margelo::nitro::RNSkiaYoga::GetPlatformContext(),
            SkPaint(paint)));
}

jsi::Object makeMatrixHostObject(jsi::Runtime& runtime, const SkMatrix& matrix)
{
    return jsi::Object::createFromHostObject(
        runtime,
        std::make_shared<RNSkia::JsiSkMatrix>(
            margelo::nitro::RNSkiaYoga::GetPlatformContext(),
            matrix));
}

std::string errorMessage(const jsi::JSError& error)
{
    return error.getMessage();
}

template <typename Fn>
void expectThrows(Fn&& fn, const std::string& messageSubstring, const char* message)
{
    try {
        fn();
    } catch (const jsi::JSError& error) {
        const auto actual = errorMessage(error);
        if (actual.find(messageSubstring) != std::string::npos) {
            return;
        }
        std::cerr << "FAIL: " << message << " wrong error message: " << actual << "\n";
        std::abort();
    }

    std::cerr << "FAIL: " << message << " did not throw\n";
    std::abort();
}

template <typename Fn>
void expectThrows(Fn&& fn, const std::string& messageSubstring, const std::string& message)
{
    expectThrows(std::forward<Fn>(fn), messageSubstring, message.c_str());
}

jsi::Object makeGroupCommand(jsi::Runtime& runtime, bool rasterize = true)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "rasterize", rasterize);
    command.setProperty(runtime, "type", "group");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePointObject(jsi::Runtime& runtime, double x, double y)
{
    jsi::Object point(runtime);
    point.setProperty(runtime, "x", x);
    point.setProperty(runtime, "y", y);
    return point;
}

jsi::Object makeRectObject(jsi::Runtime& runtime, double x, double y, double width, double height)
{
    jsi::Object rect(runtime);
    rect.setProperty(runtime, "x", x);
    rect.setProperty(runtime, "y", y);
    rect.setProperty(runtime, "width", width);
    rect.setProperty(runtime, "height", height);
    return rect;
}

jsi::Object makeRRectObject(
    jsi::Runtime& runtime,
    double x,
    double y,
    double width,
    double height,
    double radiusX,
    double radiusY)
{
    jsi::Object rrect(runtime);
    rrect.setProperty(runtime, "rect", makeRectObject(runtime, x, y, width, height));
    rrect.setProperty(runtime, "rx", radiusX);
    rrect.setProperty(runtime, "ry", radiusY);
    return rrect;
}

jsi::Array makeMatrixArray9(jsi::Runtime& runtime, const std::array<double, 9>& values)
{
    jsi::Array matrix(runtime, values.size());
    for (size_t i = 0; i < values.size(); ++i) {
        matrix.setValueAtIndex(runtime, i, jsi::Value(values[i]));
    }
    return matrix;
}

jsi::Array makeMatrixArray16(jsi::Runtime& runtime, const std::array<double, 16>& values)
{
    jsi::Array matrix(runtime, values.size());
    for (size_t i = 0; i < values.size(); ++i) {
        matrix.setValueAtIndex(runtime, i, jsi::Value(values[i]));
    }
    return matrix;
}

SkMatrix makeSkMatrix9(const std::array<double, 9>& values)
{
    return SkMatrix::MakeAll(
        static_cast<SkScalar>(values[0]),
        static_cast<SkScalar>(values[1]),
        static_cast<SkScalar>(values[2]),
        static_cast<SkScalar>(values[3]),
        static_cast<SkScalar>(values[4]),
        static_cast<SkScalar>(values[5]),
        static_cast<SkScalar>(values[6]),
        static_cast<SkScalar>(values[7]),
        static_cast<SkScalar>(values[8]));
}

SkMatrix makeSkMatrix16(const std::array<double, 16>& values)
{
    std::array<SkScalar, 16> scalarValues;
    std::transform(
        values.begin(),
        values.end(),
        scalarValues.begin(),
        [](double value) {
            return static_cast<SkScalar>(value);
        });
    return SkM44::RowMajor(scalarValues.data()).asM33();
}

std::array<double, 16> matrixArray16Values()
{
    return std::array<double, 16> {
        1.25, 0.5, 99.0, 17.0,
        0.25, 2.5, 98.0, 19.0,
        97.0, 96.0, 1.0, 95.0,
        0.01, 0.02, 94.0, 1.0,
    };
}

std::array<double, 9> emptyTransformFallbackMatrixValues()
{
    return std::array<double, 9> {
        1.0, 0.25, 31.0,
        0.5, 1.5, 47.0,
        0.0, 0.0, 1.0,
    };
}

std::array<double, 9> finiteNumericValidationMatrixValues()
{
    return std::array<double, 9> {
        1.0, 0.0, 9.0,
        0.0, 1.0, 13.0,
        0.0, 0.0, 1.0,
    };
}

jsi::Object makeMatrixArray9StyleWithValue(jsi::Runtime& runtime, size_t index, double value)
{
    auto values = finiteNumericValidationMatrixValues();
    expect(index < values.size(), "invalid MatrixArray9 case index must be in range");
    values[index] = value;

    jsi::Object style(runtime);
    style.setProperty(runtime, "matrix", makeMatrixArray9(runtime, values));
    return style;
}

jsi::Object makeMatrixArray16StyleWithValue(jsi::Runtime& runtime, size_t index, double value)
{
    auto values = matrixArray16Values();
    expect(index < values.size(), "invalid MatrixArray16 case index must be in range");
    values[index] = value;

    jsi::Object style(runtime);
    style.setProperty(runtime, "matrix", makeMatrixArray16(runtime, values));
    return style;
}

jsi::Object makeMatrixHostStyleWithValue(jsi::Runtime& runtime, size_t index, double value)
{
    auto values = finiteNumericValidationMatrixValues();
    expect(index < values.size(), "invalid SkMatrix host-object case index must be in range");
    values[index] = value;

    jsi::Object style(runtime);
    style.setProperty(runtime, "matrix", makeMatrixHostObject(runtime, makeSkMatrix9(values)));
    return style;
}

jsi::Object makeSingleTransformOp(jsi::Runtime& runtime, const char* key, double value)
{
    jsi::Object op(runtime);
    op.setProperty(runtime, key, value);
    return op;
}

using MaterializedTransformOperation = std::variant<
    TransformRotateX,
    TransformRotateY,
    TransformRotateZ,
    TransformScale,
    TransformScaleX,
    TransformScaleY,
    TransformTranslateX,
    TransformTranslateY,
    TransformSkewX,
    TransformSkewY>;

double transformValue(const TransformRotateX& op)
{
    return op.rotateX;
}

double transformValue(const TransformRotateY& op)
{
    return op.rotateY;
}

double transformValue(const TransformRotateZ& op)
{
    return op.rotateZ;
}

double transformValue(const TransformScale& op)
{
    return op.scale;
}

double transformValue(const TransformScaleX& op)
{
    return op.scaleX;
}

double transformValue(const TransformScaleY& op)
{
    return op.scaleY;
}

double transformValue(const TransformTranslateX& op)
{
    return op.translateX;
}

double transformValue(const TransformTranslateY& op)
{
    return op.translateY;
}

double transformValue(const TransformSkewX& op)
{
    return op.skewX;
}

double transformValue(const TransformSkewY& op)
{
    return op.skewY;
}

void applyExpectedTransform(SkM44& matrix, const TransformRotateX& op)
{
    SkM44 rotate;
    rotate.setRotateUnit({ 1.0f, 0.0f, 0.0f }, static_cast<float>(op.rotateX));
    matrix.preConcat(rotate);
}

void applyExpectedTransform(SkM44& matrix, const TransformRotateY& op)
{
    SkM44 rotate;
    rotate.setRotateUnit({ 0.0f, 1.0f, 0.0f }, static_cast<float>(op.rotateY));
    matrix.preConcat(rotate);
}

void applyExpectedTransform(SkM44& matrix, const TransformRotateZ& op)
{
    SkM44 rotate;
    rotate.setRotateUnit({ 0.0f, 0.0f, 1.0f }, static_cast<float>(op.rotateZ));
    matrix.preConcat(rotate);
}

void applyExpectedTransform(SkM44& matrix, const TransformScale& op)
{
    const float scale = static_cast<float>(op.scale);
    matrix.preScale(scale, scale, 1.0f);
}

void applyExpectedTransform(SkM44& matrix, const TransformScaleX& op)
{
    matrix.preScale(static_cast<float>(op.scaleX), 1.0f, 1.0f);
}

void applyExpectedTransform(SkM44& matrix, const TransformScaleY& op)
{
    matrix.preScale(1.0f, static_cast<float>(op.scaleY), 1.0f);
}

void applyExpectedTransform(SkM44& matrix, const TransformTranslateX& op)
{
    matrix.preTranslate(static_cast<float>(op.translateX), 0.0f, 0.0f);
}

void applyExpectedTransform(SkM44& matrix, const TransformTranslateY& op)
{
    matrix.preTranslate(0.0f, static_cast<float>(op.translateY), 0.0f);
}

void applyExpectedTransform(SkM44& matrix, const TransformSkewX& op)
{
    const float tangent = static_cast<float>(std::tan(op.skewX));
    SkM44 skew(
        1.0f, 0.0f, 0.0f, 0.0f,
        tangent, 1.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 1.0f);
    matrix.preConcat(skew);
}

void applyExpectedTransform(SkM44& matrix, const TransformSkewY& op)
{
    const float tangent = static_cast<float>(std::tan(op.skewY));
    SkM44 skew(
        1.0f, tangent, 0.0f, 0.0f,
        0.0f, 1.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 1.0f, 0.0f,
        0.0f, 0.0f, 0.0f, 1.0f);
    matrix.preConcat(skew);
}

template <typename TransformType>
void expectGeneratedTransformVariant(
    const MaterializedTransformOperation& actual,
    double expectedValue,
    const char* label)
{
    expect(
        std::holds_alternative<TransformType>(actual),
        std::string("generated transform operation must materialize ") + label + " variant");
    const auto& op = std::get<TransformType>(actual);
    expectNear(
        transformValue(op),
        expectedValue,
        (std::string("generated transform operation ") + label + " value").c_str());
}

template <typename TransformType>
SkMatrix makeExpectedSingleTransformMatrix(double value)
{
    SkM44 matrix;
    matrix.setIdentity();
    TransformType op(value);
    applyExpectedTransform(matrix, op);
    return matrix.asM33();
}

struct GeneratedTransformCase {
    const char* key;
    double value;
    void (*expectVariant)(const MaterializedTransformOperation& actual, double expectedValue, const char* label);
    SkMatrix (*makeExpectedMatrix)(double value);
};

std::array<GeneratedTransformCase, 10> generatedTransformCases()
{
    return {{
        { "rotateX", 0.25, expectGeneratedTransformVariant<TransformRotateX>, makeExpectedSingleTransformMatrix<TransformRotateX> },
        { "rotateY", 0.35, expectGeneratedTransformVariant<TransformRotateY>, makeExpectedSingleTransformMatrix<TransformRotateY> },
        { "rotateZ", 0.45, expectGeneratedTransformVariant<TransformRotateZ>, makeExpectedSingleTransformMatrix<TransformRotateZ> },
        { "scale", 1.5, expectGeneratedTransformVariant<TransformScale>, makeExpectedSingleTransformMatrix<TransformScale> },
        { "scaleX", 2.0, expectGeneratedTransformVariant<TransformScaleX>, makeExpectedSingleTransformMatrix<TransformScaleX> },
        { "scaleY", 0.75, expectGeneratedTransformVariant<TransformScaleY>, makeExpectedSingleTransformMatrix<TransformScaleY> },
        { "translateX", 8.0, expectGeneratedTransformVariant<TransformTranslateX>, makeExpectedSingleTransformMatrix<TransformTranslateX> },
        { "translateY", 13.0, expectGeneratedTransformVariant<TransformTranslateY>, makeExpectedSingleTransformMatrix<TransformTranslateY> },
        { "skewX", 0.2, expectGeneratedTransformVariant<TransformSkewX>, makeExpectedSingleTransformMatrix<TransformSkewX> },
        { "skewY", -0.15, expectGeneratedTransformVariant<TransformSkewY>, makeExpectedSingleTransformMatrix<TransformSkewY> },
    }};
}

jsi::Object makeSingleTransformStyle(jsi::Runtime& runtime, const char* key, double value)
{
    jsi::Array transform(runtime, 1);
    transform.setValueAtIndex(runtime, 0, jsi::Value(runtime, makeSingleTransformOp(runtime, key, value)));

    jsi::Object style(runtime);
    style.setProperty(runtime, "transform", transform);
    return style;
}

jsi::Object makeLineCommand(
    jsi::Runtime& runtime,
    double fromX,
    double fromY,
    double toX,
    double toY)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "from", makePointObject(runtime, fromX, fromY));
    data.setProperty(runtime, "to", makePointObject(runtime, toX, toY));
    command.setProperty(runtime, "type", "line");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeLineCommand(jsi::Runtime& runtime)
{
    return makeLineCommand(runtime, 1.0, 2.0, 11.0, 22.0);
}

jsi::Object makePointsCommand(
    jsi::Runtime& runtime,
    double firstX,
    double firstY,
    double secondX,
    double secondY)
{
    jsi::Array points(runtime, 2);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, firstX, firstY)));
    points.setValueAtIndex(runtime, 1, jsi::Value(runtime, makePointObject(runtime, secondX, secondY)));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", "lines");
    data.setProperty(runtime, "points", points);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePointsCommandWithNumericPointMode(
    jsi::Runtime& runtime,
    double pointMode)
{
    jsi::Array points(runtime, 2);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, 3.0, 4.0)));
    points.setValueAtIndex(runtime, 1, jsi::Value(runtime, makePointObject(runtime, 13.0, 14.0)));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", pointMode);
    data.setProperty(runtime, "points", points);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePointsCommand(jsi::Runtime& runtime)
{
    return makePointsCommand(runtime, 3.0, 4.0, 13.0, 14.0);
}

jsi::Object makePublicPathStrokeCommand(jsi::Runtime& runtime)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object stroke(runtime);
    stroke.setProperty(runtime, "width", 4.0);
    stroke.setProperty(runtime, "miter_limit", 7.0);
    stroke.setProperty(runtime, "precision", 1.25);
    stroke.setProperty(
        runtime,
        "join",
        static_cast<double>(static_cast<int>(SkPaint::Join::kMiter_Join)));
    stroke.setProperty(
        runtime,
        "cap",
        static_cast<double>(static_cast<int>(SkPaint::Cap::kSquare_Cap)));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", stroke);
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePathStrokeCommand(
    jsi::Runtime& runtime,
    double width,
    const char* miterKey,
    double miterValue,
    double precision)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object stroke(runtime);
    stroke.setProperty(runtime, "width", width);
    stroke.setProperty(runtime, miterKey, miterValue);
    stroke.setProperty(runtime, "precision", precision);
    stroke.setProperty(
        runtime,
        "join",
        static_cast<double>(static_cast<int>(SkPaint::Join::kMiter_Join)));
    stroke.setProperty(
        runtime,
        "cap",
        static_cast<double>(static_cast<int>(SkPaint::Cap::kSquare_Cap)));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", stroke);
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePathStrokeCommandWithNumericEnums(
    jsi::Runtime& runtime,
    double join,
    double cap)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object stroke(runtime);
    stroke.setProperty(runtime, "width", 4.0);
    stroke.setProperty(runtime, "miter_limit", 7.0);
    stroke.setProperty(runtime, "precision", 1.25);
    stroke.setProperty(runtime, "join", join);
    stroke.setProperty(runtime, "cap", cap);

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", stroke);
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePathTrimCommand(
    jsi::Runtime& runtime,
    double trimStart,
    double trimEnd)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "trimStart", trimStart);
    data.setProperty(runtime, "trimEnd", trimEnd);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePathTrimCommandWithStringFillType(
    jsi::Runtime& runtime,
    const char* fillType,
    double trimStart,
    double trimEnd)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "fillType", fillType);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "trimStart", trimStart);
    data.setProperty(runtime, "trimEnd", trimEnd);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePathTrimCommandWithNumericFillType(
    jsi::Runtime& runtime,
    double fillType)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "fillType", fillType);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeEmptyCommand(jsi::Runtime& runtime, const char* type)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    command.setProperty(runtime, "type", type);
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeTextStyle(jsi::Runtime& runtime, double fontSize, const char* color)
{
    jsi::Object textStyle(runtime);
    textStyle.setProperty(runtime, "fontSize", fontSize);
    textStyle.setProperty(runtime, "color", color);
    return textStyle;
}

jsi::Object makeParagraphStyleWithNestedTextStyle(jsi::Runtime& runtime, double fontSize, const char* color)
{
    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "textStyle", makeTextStyle(runtime, fontSize, color));
    return paragraphStyle;
}

jsi::Object makeTextCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Materialized Text");
    data.setProperty(runtime, "textStyle", makeTextStyle(runtime, 19.0, "rgba(255,0,0,1)"));
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeTextCommandWithTextStyleFontSize(jsi::Runtime& runtime, double fontSize)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Invalid materialized text");
    data.setProperty(runtime, "textStyle", makeTextStyle(runtime, fontSize, "rgba(255,0,0,1)"));
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeParagraphCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Materialized paragraph text");
    data.setProperty(runtime, "paragraphStyle", makeParagraphStyleWithNestedTextStyle(runtime, 18.0, "#00ff00"));
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeParagraphStyleWithFlattenedFontSize(jsi::Runtime& runtime, double fontSize)
{
    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "fontSize", fontSize);
    paragraphStyle.setProperty(runtime, "color", "#00ff00");
    return paragraphStyle;
}

jsi::Object makeParagraphStyleWithNestedFontSize(jsi::Runtime& runtime, double fontSize)
{
    return makeParagraphStyleWithNestedTextStyle(runtime, fontSize, "#00ff00");
}

jsi::Object makeParagraphStyleWithMaxLines(jsi::Runtime& runtime, double maxLines)
{
    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "maxLines", maxLines);
    return paragraphStyle;
}

jsi::Object makeParagraphStyleWithStrutLeading(jsi::Runtime& runtime, double leading)
{
    jsi::Object paragraphStyle(runtime);
    jsi::Object strutStyle(runtime);
    strutStyle.setProperty(runtime, "fontSize", 16.0);
    strutStyle.setProperty(runtime, "heightMultiplier", 1.2);
    strutStyle.setProperty(runtime, "leading", leading);
    paragraphStyle.setProperty(runtime, "strutStyle", strutStyle);
    return paragraphStyle;
}

jsi::Object makeParagraphStyleWithFontFeatureValue(jsi::Runtime& runtime, double value)
{
    auto paragraphStyle = makeParagraphStyleWithFlattenedFontSize(runtime, 18.0);
    jsi::Array fontFeatures(runtime, 1);
    jsi::Object feature(runtime);
    feature.setProperty(runtime, "name", "kern");
    feature.setProperty(runtime, "value", value);
    fontFeatures.setValueAtIndex(runtime, 0, std::move(feature));
    paragraphStyle.setProperty(runtime, "fontFeatures", fontFeatures);
    return paragraphStyle;
}

jsi::Object makeParagraphCommandWithStyle(jsi::Runtime& runtime, jsi::Object paragraphStyle)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Invalid materialized paragraph text");
    data.setProperty(runtime, "paragraphStyle", std::move(paragraphStyle));
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeCircleCommand(jsi::Runtime& runtime, double radius)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "radius", radius);
    command.setProperty(runtime, "type", "circle");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeCircleCommand(jsi::Runtime& runtime)
{
    return makeCircleCommand(runtime, 5.5);
}

jsi::Object makeRRectCommand(jsi::Runtime& runtime, double cornerRadius)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "cornerRadius", cornerRadius);
    command.setProperty(runtime, "type", "rrect");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeRRectCommand(jsi::Runtime& runtime)
{
    return makeRRectCommand(runtime, 6.0);
}

jsi::Object makeBlurMaskFilterCommand(jsi::Runtime& runtime, double blur)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", blur);
    data.setProperty(runtime, "blurStyle", "outer");
    data.setProperty(runtime, "respectCTM", true);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeBlurMaskFilterCommandWithNumericBlurStyle(
    jsi::Runtime& runtime,
    double blurStyle)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", 3.0);
    data.setProperty(runtime, "blurStyle", blurStyle);
    data.setProperty(runtime, "respectCTM", true);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeBlurMaskFilterCommand(jsi::Runtime& runtime)
{
    return makeBlurMaskFilterCommand(runtime, 3.0);
}

jsi::Object makeImageCommand(jsi::Runtime& runtime)
{
    auto imageHostObject = jsi::Object::createFromHostObject(
        runtime,
        std::make_shared<RNSkia::JsiSkImage>(
            margelo::nitro::RNSkiaYoga::GetPlatformContext(),
            makeSyntheticImage()));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "fit", "cover");
    data.setProperty(runtime, "image", std::move(imageHostObject));
    command.setProperty(runtime, "type", "image");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeInvalidCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "rect");
    return command;
}

jsi::Object makeStyle(jsi::Runtime& runtime, double width, double height)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", width);
    style.setProperty(runtime, "height", height);
    style.setProperty(runtime, "antiAlias", false);
    return style;
}

jsi::Object makeAbsoluteRectChildStyle(jsi::Runtime& runtime, const char* color)
{
    auto style = makeStyle(runtime, 100.0, 100.0);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "left", 0.0);
    style.setProperty(runtime, "top", 0.0);
    style.setProperty(runtime, "backgroundColor", color);
    return style;
}

jsi::Object makeRenderOverflowStyle(jsi::Runtime& runtime, const char* overflow)
{
    auto style = makeStyle(runtime, 50.0, 50.0);
    style.setProperty(runtime, "overflow", overflow);
    return style;
}

jsi::Object makeRenderClipRectStyle(jsi::Runtime& runtime)
{
    auto style = makeStyle(runtime, 100.0, 100.0);
    style.setProperty(runtime, "clip", makeRectObject(runtime, 10.0, 10.0, 40.0, 40.0));
    return style;
}

jsi::Object makeRenderClipRRectStyle(jsi::Runtime& runtime)
{
    auto style = makeStyle(runtime, 100.0, 100.0);
    style.setProperty(runtime, "clip", makeRRectObject(runtime, 10.0, 10.0, 40.0, 40.0, 18.0, 18.0));
    return style;
}

jsi::Object makeRenderClipPathStyle(jsi::Runtime& runtime)
{
    SkPath path;
    path.addCircle(50.0f, 50.0f, 20.0f);

    auto style = makeStyle(runtime, 100.0, 100.0);
    style.setProperty(runtime, "clip", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    return style;
}

jsi::Object makeRenderInvertedClipRectStyle(jsi::Runtime& runtime)
{
    auto style = makeRenderClipRectStyle(runtime);
    style.setProperty(runtime, "invertClip", true);
    return style;
}

jsi::Object makeRenderInvertedClipRRectStyle(jsi::Runtime& runtime)
{
    auto style = makeRenderClipRRectStyle(runtime);
    style.setProperty(runtime, "invertClip", true);
    return style;
}

jsi::Object makeRenderInvertedClipPathStyle(jsi::Runtime& runtime)
{
    auto style = makeRenderClipPathStyle(runtime);
    style.setProperty(runtime, "invertClip", true);
    return style;
}

jsi::Object makeLayerStyle(jsi::Runtime& runtime, double width, double height)
{
    auto style = makeStyle(runtime, width, height);
    SkPaint layerPaint;
    layerPaint.setAlphaf(0.25f);
    layerPaint.setBlendMode(SkBlendMode::kMultiply);
    layerPaint.setAntiAlias(true);

    style.setProperty(runtime, "backgroundColor", "#0000ff");
    style.setProperty(runtime, "layer", makePaintHostObject(runtime, layerPaint));
    return style;
}

jsi::Object makeCssBackgroundColorStyle(jsi::Runtime& runtime, const char* color)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "backgroundColor", color);
    style.setProperty(runtime, "borderWidth", 3.5);
    style.setProperty(
        runtime,
        "strokeCap",
        static_cast<double>(static_cast<int>(StrokeCap::SQUARE)));
    style.setProperty(
        runtime,
        "strokeJoin",
        static_cast<double>(static_cast<int>(StrokeJoin::ROUND)));
    style.setProperty(runtime, "strokeMiter", 8.25);
    style.setProperty(runtime, "dither", true);
    style.setProperty(runtime, "antiAlias", true);
    style.setProperty(runtime, "opacity", 0.4);
    return style;
}

jsi::Object makeFiniteNumericValidationBaselineStyle(jsi::Runtime& runtime)
{
    auto style = makeCssBackgroundColorStyle(runtime, "#123456");

    SkPaint layerPaint;
    layerPaint.setAlphaf(0.25f);
    layerPaint.setBlendMode(SkBlendMode::kMultiply);
    layerPaint.setAntiAlias(true);

	style.setProperty(runtime, "layer", makePaintHostObject(runtime, layerPaint));
	style.setProperty(runtime, "clip", makeRectObject(runtime, 10.0, 12.0, 30.0, 18.0));
	style.setProperty(
		runtime,
		"matrix",
		makeMatrixArray9(runtime, finiteNumericValidationMatrixValues()));
	style.setProperty(runtime, "width", 64.0);
	style.setProperty(runtime, "height", 48.0);
	style.setProperty(runtime, "aspectRatio", 1.5);
	style.setProperty(runtime, "flex", 0.25);
	style.setProperty(runtime, "flexGrow", 1.25);
	style.setProperty(runtime, "flexShrink", 0.5);
	style.setProperty(runtime, "flexBasis", 20.0);
	style.setProperty(runtime, "gap", 7.0);
	style.setProperty(runtime, "rowGap", 8.0);
	style.setProperty(runtime, "columnGap", 9.0);
	style.setProperty(runtime, "marginLeft", 5.0);
	style.setProperty(runtime, "paddingTop", 6.0);
	style.setProperty(runtime, "insetHorizontal", 3.0);
	return style;
}

jsi::Object makeFiniteMatrixTransformValidationBaselineStyle(jsi::Runtime& runtime)
{
    auto style = makeFiniteNumericValidationBaselineStyle(runtime);
    style.setProperty(runtime, "borderRadius", 17.0);
    return style;
}

jsi::Object makeFiniteRadiusValidationBaselineStyle(jsi::Runtime& runtime)
{
    auto style = makeFiniteNumericValidationBaselineStyle(runtime);
    style.setProperty(runtime, "overflow", "hidden");
    style.setProperty(runtime, "borderRadius", 17.0);
    style.setProperty(runtime, "borderTopLeftRadius", makePointObject(runtime, 12.0, 8.0));
    style.setProperty(runtime, "borderTopRightRadius", 4.0);
    style.setProperty(runtime, "borderBottomRightRadius", makePointObject(runtime, 10.0, 14.0));
    style.setProperty(runtime, "borderBottomLeftRadius", 6.0);
    return style;
}

jsi::Object makeBackgroundColorOnlyStyle(jsi::Runtime& runtime, const char* color)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "backgroundColor", color);
    return style;
}

jsi::Object makeCornerRadiusStyle(jsi::Runtime& runtime)
{
    auto style = makeStyle(runtime, 64.0, 48.0);
    style.setProperty(runtime, "borderTopLeftRadius", makePointObject(runtime, 12.0, 8.0));
    style.setProperty(runtime, "borderTopRightRadius", 4.0);
    style.setProperty(runtime, "borderBottomRightRadius", makePointObject(runtime, 10.0, 14.0));
    style.setProperty(runtime, "borderBottomLeftRadius", 6.0);
    return style;
}

jsi::Object makeGlobalBorderRadiusStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "borderRadius", 17.0);
    return style;
}

jsi::Object makePaintBackedStyle(jsi::Runtime& runtime)
{
    SkPaint backgroundPaint;
    backgroundPaint.setAntiAlias(true);
    backgroundPaint.setColor(SkColorSetARGB(255, 18, 52, 86));
    backgroundPaint.setStrokeWidth(1.25f);
    backgroundPaint.setStrokeCap(SkPaint::Cap::kButt_Cap);
    backgroundPaint.setStrokeJoin(SkPaint::Join::kMiter_Join);
    backgroundPaint.setStrokeMiter(2.5f);
    backgroundPaint.setDither(false);
    backgroundPaint.setAlphaf(0.35f);
    backgroundPaint.setBlendMode(SkBlendMode::kMultiply);

    jsi::Object style(runtime);
    style.setProperty(runtime, "backgroundColor", makePaintHostObject(runtime, backgroundPaint));
    style.setProperty(runtime, "borderWidth", 7.25);
    style.setProperty(
        runtime,
        "strokeCap",
        static_cast<double>(static_cast<int>(StrokeCap::ROUND)));
    style.setProperty(
        runtime,
        "strokeJoin",
        static_cast<double>(static_cast<int>(StrokeJoin::BEVEL)));
    style.setProperty(runtime, "strokeMiter", 11.5);
    style.setProperty(runtime, "dither", true);
    style.setProperty(runtime, "opacity", 0.6);
    style.setProperty(
        runtime,
        "blendMode",
        static_cast<double>(static_cast<int>(BlendMode::SCREEN)));
    return style;
}

jsi::Object makeClipRectStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "clip", makeRectObject(runtime, 10.0, 12.0, 30.0, 18.0));
    return style;
}

jsi::Object makeClipRRectStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "clip", makeRRectObject(runtime, 6.0, 8.0, 34.0, 22.0, 5.0, 7.0));
    return style;
}

jsi::Object makeClipPathStyle(jsi::Runtime& runtime)
{
    SkPath path;
    path.addCircle(24.0f, 26.0f, 9.0f);

    jsi::Object style(runtime);
    style.setProperty(runtime, "clip", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    return style;
}

jsi::Object makeInvertedClipStyle(jsi::Runtime& runtime)
{
    auto style = makeClipRectStyle(runtime);
    style.setProperty(runtime, "invertClip", true);
    return style;
}

jsi::Object makeMatrixStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(
        runtime,
        "matrix",
        makeMatrixArray9(
            runtime,
            std::array<double, 9> {
                2.0, 0.0, 7.0,
                0.0, 3.0, 11.0,
                0.0, 0.0, 1.0,
            }));
    return style;
}

jsi::Object makeMatrix16Style(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(
        runtime,
        "matrix",
        makeMatrixArray16(runtime, matrixArray16Values()));
    return style;
}

jsi::Object makeTransformWithMatrixFallbackStyle(jsi::Runtime& runtime)
{
    jsi::Array transform(runtime, 3);
    transform.setValueAtIndex(runtime, 0, jsi::Value(runtime, makeSingleTransformOp(runtime, "translateX", 8.0)));
    transform.setValueAtIndex(runtime, 1, jsi::Value(runtime, makeSingleTransformOp(runtime, "translateY", 13.0)));
    transform.setValueAtIndex(runtime, 2, jsi::Value(runtime, makeSingleTransformOp(runtime, "scale", 1.5)));

    jsi::Object style(runtime);
    style.setProperty(runtime, "transform", transform);
    style.setProperty(
        runtime,
        "matrix",
        makeMatrixArray9(
            runtime,
            std::array<double, 9> {
                4.0, 0.0, 101.0,
                0.0, 5.0, 202.0,
                0.0, 0.0, 1.0,
            }));
    return style;
}

jsi::Object makeEmptyTransformWithMatrixFallbackStyle(jsi::Runtime& runtime)
{
    jsi::Array transform(runtime, 0);

    jsi::Object style(runtime);
    style.setProperty(runtime, "transform", transform);
    style.setProperty(
        runtime,
        "matrix",
        makeMatrixArray9(runtime, emptyTransformFallbackMatrixValues()));
    return style;
}

jsi::Object makeEmptyTransformStyle(jsi::Runtime& runtime)
{
    jsi::Array transform(runtime, 0);

    jsi::Object style(runtime);
    style.setProperty(runtime, "transform", transform);
    return style;
}

jsi::Object makeFlexLayoutParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 200.0);
    style.setProperty(runtime, "height", 100.0);
    style.setProperty(runtime, "flexDirection", "row");
    style.setProperty(runtime, "justifyContent", "center");
    style.setProperty(runtime, "alignItems", "center");
    style.setProperty(runtime, "gap", 2.0);
    style.setProperty(runtime, "rowGap", 4.0);
    style.setProperty(runtime, "columnGap", 6.0);
    style.setProperty(runtime, "paddingHorizontal", 10.0);
    style.setProperty(runtime, "paddingVertical", 5.0);
    return style;
}

jsi::Object makeFlexLayoutGrowingChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "flexBasis", 40.0);
    style.setProperty(runtime, "flexGrow", 1.0);
    style.setProperty(runtime, "flexShrink", 1.0);
    style.setProperty(runtime, "height", 20.0);
    style.setProperty(runtime, "marginHorizontal", 5.0);
    style.setProperty(runtime, "marginVertical", 3.0);
    return style;
}

jsi::Object makeFlexLayoutFixedChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 30.0);
    style.setProperty(runtime, "height", 10.0);
    return style;
}

jsi::Object makeFlexLayoutAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", 12.0);
    style.setProperty(runtime, "height", 14.0);
    style.setProperty(runtime, "insetHorizontal", 17.0);
    style.setProperty(runtime, "insetVertical", 19.0);
    return style;
}

jsi::Object makeWidthStretchStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", "stretch");
    style.setProperty(runtime, "height", 8.0);
    return style;
}

jsi::Object makeSingleStringStyle(jsi::Runtime& runtime, const char* propertyName, const char* value)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, propertyName, value);
    return style;
}

jsi::Object makeSingleNumberStyle(jsi::Runtime& runtime, const char* propertyName, double value)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, propertyName, value);
    return style;
}

jsi::Object makeSingleCornerPointRadiusStyle(jsi::Runtime& runtime, const char* propertyName, double x, double y)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, propertyName, makePointObject(runtime, x, y));
    return style;
}

jsi::Object makeValidatedLayoutUnitStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", "25%");
    style.setProperty(runtime, "height", "auto");
    style.setProperty(runtime, "minWidth", "12.5%");
    style.setProperty(runtime, "paddingLeft", "+1.25e1%");
    style.setProperty(runtime, "marginLeft", "auto");
    style.setProperty(runtime, "left", "-2.5%");
    style.setProperty(runtime, "flexBasis", "auto");
    return style;
}

jsi::Object makeResidualLayoutParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 180.0);
    style.setProperty(runtime, "height", 120.0);
    style.setProperty(runtime, "flexDirection", "row");
    style.setProperty(runtime, "flexWrap", "wrap");
    style.setProperty(runtime, "alignContent", "space-around");
    style.setProperty(runtime, "direction", "ltr");
    style.setProperty(runtime, "display", "flex");
    style.setProperty(runtime, "boxSizing", "content-box");
    return style;
}

jsi::Object makeResidualConstraintChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", "50%");
    style.setProperty(runtime, "height", "auto");
    style.setProperty(runtime, "minWidth", 100.0);
    style.setProperty(runtime, "minHeight", "10%");
    style.setProperty(runtime, "maxWidth", "75%");
    style.setProperty(runtime, "maxHeight", 20.0);
    style.setProperty(runtime, "flexBasis", "auto");
    return style;
}

jsi::Object makeResidualAspectChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "height", 24.0);
    style.setProperty(runtime, "aspectRatio", 2.0);
    style.setProperty(runtime, "alignSelf", "flex-end");
    return style;
}

jsi::Object makeResidualAbsoluteEdgeChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", 10.0);
    style.setProperty(runtime, "height", 8.0);
    style.setProperty(runtime, "start", "10%");
    style.setProperty(runtime, "end", "auto");
    style.setProperty(runtime, "top", "25%");
    style.setProperty(runtime, "bottom", 4.0);
    return style;
}

jsi::Object makeDisplayNoneParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 80.0);
    style.setProperty(runtime, "height", 40.0);
    return style;
}

jsi::Object makeDisplayNoneChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 30.0);
    style.setProperty(runtime, "height", 10.0);
    style.setProperty(runtime, "display", "none");
    return style;
}

jsi::Object makeSequentialInitialParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 160.0);
    style.setProperty(runtime, "height", 80.0);
    style.setProperty(runtime, "flexDirection", "row");
    style.setProperty(runtime, "flexWrap", "nowrap");
    style.setProperty(runtime, "alignItems", "flex-start");
    style.setProperty(runtime, "alignContent", "flex-start");
    style.setProperty(runtime, "direction", "ltr");
    style.setProperty(runtime, "display", "flex");
    style.setProperty(runtime, "boxSizing", "border-box");
    style.setProperty(runtime, "gap", 2.0);
    style.setProperty(runtime, "rowGap", 4.0);
    style.setProperty(runtime, "columnGap", 6.0);
    style.setProperty(runtime, "paddingHorizontal", 10.0);
    style.setProperty(runtime, "paddingVertical", 5.0);
    return style;
}

jsi::Object makeSequentialInitialFlowChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "height", 20.0);
    style.setProperty(runtime, "minWidth", 30.0);
    style.setProperty(runtime, "maxWidth", 60.0);
    style.setProperty(runtime, "flexBasis", 40.0);
    style.setProperty(runtime, "flexGrow", 0.0);
    style.setProperty(runtime, "flexShrink", 1.0);
    style.setProperty(runtime, "alignSelf", "flex-start");
    style.setProperty(runtime, "marginHorizontal", 5.0);
    style.setProperty(runtime, "marginVertical", 3.0);
    return style;
}

jsi::Object makeSequentialInitialAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", 12.0);
    style.setProperty(runtime, "height", 14.0);
    style.setProperty(runtime, "insetHorizontal", 17.0);
    style.setProperty(runtime, "insetVertical", 19.0);
    return style;
}

jsi::Object makeSequentialUpdatedParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 150.0);
    style.setProperty(runtime, "height", 90.0);
    style.setProperty(runtime, "flexDirection", "column");
    style.setProperty(runtime, "flexWrap", "wrap");
    style.setProperty(runtime, "alignItems", "stretch");
    style.setProperty(runtime, "alignContent", "space-around");
    style.setProperty(runtime, "direction", "rtl");
    style.setProperty(runtime, "display", "flex");
    style.setProperty(runtime, "boxSizing", "content-box");
    style.setProperty(runtime, "gap", 9.0);
    style.setProperty(runtime, "rowGap", 11.0);
    style.setProperty(runtime, "columnGap", 13.0);
    style.setProperty(runtime, "paddingLeft", "5%");
    style.setProperty(runtime, "paddingRight", 3.0);
    style.setProperty(runtime, "paddingTop", 4.0);
    return style;
}

jsi::Object makeSequentialUpdatedFlowChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", "50%");
    style.setProperty(runtime, "height", "auto");
    style.setProperty(runtime, "minWidth", 80.0);
    style.setProperty(runtime, "minHeight", "10%");
    style.setProperty(runtime, "maxWidth", "90%");
    style.setProperty(runtime, "maxHeight", 30.0);
    style.setProperty(runtime, "flexBasis", "auto");
    style.setProperty(runtime, "flexGrow", 0.0);
    style.setProperty(runtime, "flexShrink", 0.0);
    style.setProperty(runtime, "alignSelf", "flex-end");
    style.setProperty(runtime, "marginHorizontal", "5%");
    style.setProperty(runtime, "marginVertical", 2.0);
    return style;
}

jsi::Object makeSequentialUpdatedAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", "25%");
    style.setProperty(runtime, "height", 12.0);
    style.setProperty(runtime, "left", "10%");
    style.setProperty(runtime, "right", "auto");
    style.setProperty(runtime, "top", "25%");
    style.setProperty(runtime, "bottom", 4.0);
    return style;
}

jsi::Object makeSequentialCleanupParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 120.0);
    style.setProperty(runtime, "height", 60.0);
    return style;
}

jsi::Object makeSequentialCleanupFlowChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 30.0);
    style.setProperty(runtime, "height", 10.0);
    return style;
}

jsi::Object makeSequentialCleanupFormerAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 20.0);
    style.setProperty(runtime, "height", 8.0);
    return style;
}

jsi::Object makeSequentialFieldAlignmentParentStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 100.0);
    style.setProperty(runtime, "height", 50.0);
    style.setProperty(runtime, "flexDirection", "row");
    style.setProperty(runtime, "direction", "ltr");
    return style;
}

jsi::Object makeSequentialFieldAlignmentInitialFlowChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 20.0);
    style.setProperty(runtime, "height", 10.0);
    style.setProperty(runtime, "marginLeft", "auto");
    style.setProperty(runtime, "marginRight", "5%");
    return style;
}

jsi::Object makeSequentialFieldAlignmentUpdatedFlowChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 20.0);
    style.setProperty(runtime, "height", 10.0);
    style.setProperty(runtime, "marginLeft", "12%");
    style.setProperty(runtime, "marginRight", "auto");
    return style;
}

jsi::Object makeSequentialFieldAlignmentCleanupFlowChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 20.0);
    style.setProperty(runtime, "height", 10.0);
    return style;
}

jsi::Object makeSequentialFieldAlignmentInitialAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", 10.0);
    style.setProperty(runtime, "height", 8.0);
    style.setProperty(runtime, "start", "3%");
    style.setProperty(runtime, "end", 7.0);
    style.setProperty(runtime, "top", 4.0);
    return style;
}

jsi::Object makeSequentialFieldAlignmentUpdatedAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", 10.0);
    style.setProperty(runtime, "height", 8.0);
    style.setProperty(runtime, "start", 5.0);
    style.setProperty(runtime, "end", "9%");
    style.setProperty(runtime, "top", 4.0);
    return style;
}

jsi::Object makeSequentialFieldAlignmentInsetAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "position", "absolute");
    style.setProperty(runtime, "width", 10.0);
    style.setProperty(runtime, "height", 8.0);
    style.setProperty(runtime, "inset", 3.0);
    return style;
}

jsi::Object makeSequentialFieldAlignmentCleanupAbsoluteChildStyle(jsi::Runtime& runtime)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", 10.0);
    style.setProperty(runtime, "height", 8.0);
    return style;
}

void expectObjectFunction(jsi::Runtime& runtime, const jsi::Object& object, const char* name)
{
    expect(object.hasProperty(runtime, name), "materialized YogaNode object must expose expected function");
    const auto value = object.getProperty(runtime, name);
    expect(value.isObject(), "materialized YogaNode member must be an object");
    expect(value.asObject(runtime).isFunction(runtime), "materialized YogaNode member must be a function");
}

void expectYogaNodePrototypeSurface(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* message)
{
    (void)message;
    expectObjectFunction(runtime, object, "setCommand");
    expectObjectFunction(runtime, object, "setStyle");
    expectObjectFunction(runtime, object, "insertChild");
    expectObjectFunction(runtime, object, "removeChild");
    expectObjectFunction(runtime, object, "removeAllChildren");
    expectObjectFunction(runtime, object, "computeLayout");
    expect(object.hasProperty(runtime, "layout"), "materialized YogaNode object must expose generated layout getter");
    expectObjectFunction(runtime, object, "getChildren");
    expectObjectFunction(runtime, object, "hitTest");
    expectObjectFunction(runtime, object, "setInteractionConfig");
}

void expectNativeStateWrapsOriginal(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const std::shared_ptr<YogaNode>& node)
{
    expect(object.hasNativeState(runtime), "materialized YogaNode object must have NativeState");

    auto nativeState = object.getNativeState<jsi::NativeState>(runtime);
    auto materializedYogaNode = std::dynamic_pointer_cast<YogaNode>(nativeState);
    expect(materializedYogaNode != nullptr, "NativeState must dynamic_cast to YogaNode");
    expect(materializedYogaNode.get() == node.get(), "NativeState must wrap the original YogaNode");
    auto materializedSpec = std::dynamic_pointer_cast<HybridYogaNodeSpec>(nativeState);
    expect(materializedSpec != nullptr, "NativeState must dynamic_cast to generated HybridYogaNodeSpec");
}

struct MaterializedYogaNode {
    std::shared_ptr<YogaNode> node;
    jsi::Object object;
};

MaterializedYogaNode materializeYogaNode(jsi::Runtime& runtime)
{
    auto node = std::make_shared<YogaNode>();
    jsi::Value objectValue = node->toObject(runtime);
    expect(objectValue.isObject(), "YogaNode::toObject(runtime) must return a JS object");
    jsi::Object object = objectValue.asObject(runtime);
    expectNativeStateWrapsOriginal(runtime, object, node);
    return MaterializedYogaNode { std::move(node), std::move(object) };
}

void disposeMaterializedObject(jsi::Runtime& runtime, const jsi::Object& object)
{
    auto dispose = object.getPropertyAsFunction(runtime, "dispose");
    const jsi::Value* noArgs = nullptr;
    auto disposeResult = dispose.callWithThis(runtime, object, noArgs, static_cast<size_t>(0));
    expect(disposeResult.isUndefined(), "generated base dispose must return undefined");
}

void callFunctionWithOneObject(
    jsi::Runtime& runtime,
    const jsi::Object& thisObject,
    const jsi::Function& function,
    const jsi::Object& arg,
    const char* message)
{
    jsi::Value args[] = {jsi::Value(runtime, arg)};
    auto result = function.callWithThis(
        runtime,
        thisObject,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(1));
    expect(result.isUndefined(), message);
}

void callComputeLayoutWithArgs(
    jsi::Runtime& runtime,
    const jsi::Object& thisObject,
    const jsi::Function& computeLayout,
    const jsi::Value* args,
    size_t count,
    const char* message)
{
    auto result = computeLayout.callWithThis(
        runtime,
        thisObject,
        args,
        count);
    expect(result.isUndefined(), message);
}

void callComputeLayout(
    jsi::Runtime& runtime,
    const jsi::Object& thisObject,
    const jsi::Function& computeLayout)
{
    jsi::Value args[] = {jsi::Value(200.0), jsi::Value(100.0)};
    callComputeLayoutWithArgs(
        runtime,
        thisObject,
        computeLayout,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(2),
        "generated computeLayout must return undefined");
}

void callGeneratedSetCommand(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    jsi::Object command,
    const char* message)
{
    expectObjectFunction(runtime, materialized.object, "setCommand");
    auto setCommand = materialized.object.getPropertyAsFunction(runtime, "setCommand");
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setCommand,
        command,
        message);
}

void callGeneratedSetStyle(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    const jsi::Object& style,
    const char* message)
{
    expectObjectFunction(runtime, materialized.object, "setStyle");
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        message);
}

void callGeneratedSetStyle(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    const jsi::Object& style,
    const std::string& message)
{
    callGeneratedSetStyle(runtime, materialized, style, message.c_str());
}

void applyGeneratedStyleAndComputeLayout(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    jsi::Object style)
{
    expectObjectFunction(runtime, materialized.object, "setStyle");
    expectObjectFunction(runtime, materialized.object, "computeLayout");
    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    callGeneratedSetStyle(
        runtime,
        materialized,
        style,
        "generated setStyle for materialized setCommand case must return undefined");
    callComputeLayout(runtime, materialized.object, computeLayout);
}

void applyGeneratedSizeAndComputeLayout(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    double width,
    double height)
{
    applyGeneratedStyleAndComputeLayout(runtime, materialized, makeStyle(runtime, width, height));
}

struct LayoutStateSnapshot {
    bool hasLayoutBeenComputed;
    YogaNodeLayout layout;
};

LayoutStateSnapshot captureLayoutState(const YogaNode& node)
{
    return LayoutStateSnapshot {
        .hasLayoutBeenComputed = node._hasLayoutBeenComputed,
        .layout = node._layout,
    };
}

void expectLayoutStatePreserved(
    const YogaNode& node,
    const LayoutStateSnapshot& state,
    const char* message)
{
    expect(
        node._hasLayoutBeenComputed == state.hasLayoutBeenComputed,
        (std::string(message) + " preserves layout-computed flag").c_str());
    expectNear(node._layout.left, state.layout.left, std::string(message) + " preserves layout left");
    expectNear(node._layout.right, state.layout.right, std::string(message) + " preserves layout right");
    expectNear(node._layout.top, state.layout.top, std::string(message) + " preserves layout top");
    expectNear(node._layout.bottom, state.layout.bottom, std::string(message) + " preserves layout bottom");
    expectNear(node._layout.width, state.layout.width, std::string(message) + " preserves layout width");
    expectNear(node._layout.height, state.layout.height, std::string(message) + " preserves layout height");
}

void expectGeneratedComputeLayoutRejectsAndPreservesState(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    const jsi::Function& computeLayout,
    double width,
    double height,
    const std::string& messageSubstring,
    const char* message)
{
    const auto state = captureLayoutState(*materialized.node);
    expectThrows(
        [&]() {
            jsi::Value args[] = {jsi::Value(width), jsi::Value(height)};
            computeLayout.callWithThis(
                runtime,
                materialized.object,
                static_cast<const jsi::Value*>(args),
                static_cast<size_t>(2));
        },
        messageSubstring,
        message);
    expectLayoutStatePreserved(*materialized.node, state, message);
}

void assertGeneratedComputeLayoutNumericValidation(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetStyle(
        runtime,
        materialized,
        makeStyle(runtime, 64.0, 32.0),
        "generated computeLayout numeric validation baseline setStyle must return undefined");

    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    const jsi::Value* noArgs = nullptr;
    callComputeLayoutWithArgs(
        runtime,
        materialized.object,
        computeLayout,
        noArgs,
        static_cast<size_t>(0),
        "generated computeLayout omitted optional args must return undefined");
    expect(materialized.node->_hasLayoutBeenComputed, "generated computeLayout omitted optional args must compute layout");
    expectNear(materialized.node->_layout.width, 64.0, "generated computeLayout omitted optional args native width");
    expectNear(materialized.node->_layout.height, 32.0, "generated computeLayout omitted optional args native height");

    materialized.node->invalidateLayout();
    jsi::Value undefinedArgs[] = {jsi::Value::undefined(), jsi::Value::undefined()};
    callComputeLayoutWithArgs(
        runtime,
        materialized.object,
        computeLayout,
        static_cast<const jsi::Value*>(undefinedArgs),
        static_cast<size_t>(2),
        "generated computeLayout explicit undefined optional args must return undefined");
    expect(materialized.node->_hasLayoutBeenComputed, "generated computeLayout explicit undefined optional args must compute layout");
    expectNear(materialized.node->_layout.width, 64.0, "generated computeLayout explicit undefined optional args native width");
    expectNear(materialized.node->_layout.height, 32.0, "generated computeLayout explicit undefined optional args native height");

    const auto nan = std::numeric_limits<double>::quiet_NaN();
    const auto infinity = std::numeric_limits<double>::infinity();
    const auto nativeFloatOverflow = std::numeric_limits<double>::max();

    expectGeneratedComputeLayoutRejectsAndPreservesState(
        runtime,
        materialized,
        computeLayout,
        nan,
        100.0,
        "computeLayout.width",
        "generated computeLayout.width NaN must reject and preserve computed layout state");
    expectGeneratedComputeLayoutRejectsAndPreservesState(
        runtime,
        materialized,
        computeLayout,
        -infinity,
        100.0,
        "computeLayout.width",
        "generated computeLayout.width -Infinity must reject and preserve computed layout state");
    expectGeneratedComputeLayoutRejectsAndPreservesState(
        runtime,
        materialized,
        computeLayout,
        200.0,
        infinity,
        "computeLayout.height",
        "generated computeLayout.height Infinity must reject and preserve computed layout state");
    expectGeneratedComputeLayoutRejectsAndPreservesState(
        runtime,
        materialized,
        computeLayout,
        200.0,
        nativeFloatOverflow,
        "computeLayout.height",
        "generated computeLayout.height native-float overflow must reject and preserve computed layout state");

    auto fresh = materializeYogaNode(runtime);
    auto freshComputeLayout = fresh.object.getPropertyAsFunction(runtime, "computeLayout");
    fresh.node->_layout = YogaNodeLayout(1.0, 2.0, 3.0, 4.0, 5.0, 6.0);
    fresh.node->_hasLayoutBeenComputed = false;
    expectGeneratedComputeLayoutRejectsAndPreservesState(
        runtime,
        fresh,
        freshComputeLayout,
        nativeFloatOverflow,
        100.0,
        "computeLayout.width",
        "generated computeLayout.width native-float overflow must not compute fresh layout");
}

double getNumberProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* name)
{
    const auto value = object.getProperty(runtime, name);
    expect(value.isNumber(), "layout property must be numeric");
    return value.asNumber();
}

void expectGeneratedLayoutGetterNear(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    double expectedLeft,
    double expectedTop,
    double expectedWidth,
    double expectedHeight,
    const char* message)
{
    auto layout = materialized.object.getProperty(runtime, "layout");
    expect(layout.isObject(), std::string(message) + " layout getter must return an object");
    auto layoutObject = layout.asObject(runtime);
    expectNear(getNumberProperty(runtime, layoutObject, "left"), expectedLeft, std::string(message) + " layout getter left");
    expectNear(getNumberProperty(runtime, layoutObject, "top"), expectedTop, std::string(message) + " layout getter top");
    expectNear(getNumberProperty(runtime, layoutObject, "width"), expectedWidth, std::string(message) + " layout getter width");
    expectNear(getNumberProperty(runtime, layoutObject, "height"), expectedHeight, std::string(message) + " layout getter height");
}

jsi::Array callGetChildren(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    const char* message)
{
    expectObjectFunction(runtime, object, "getChildren");
    auto getChildren = object.getPropertyAsFunction(runtime, "getChildren");
    const jsi::Value* noArgs = nullptr;
    auto result = getChildren.callWithThis(runtime, object, noArgs, static_cast<size_t>(0));
    expect(result.isObject(), message);
    auto resultObject = result.asObject(runtime);
    expect(resultObject.isArray(runtime), message);
    return resultObject.asArray(runtime);
}

void callGeneratedInsertChild(
    jsi::Runtime& runtime,
    const jsi::Object& parentObject,
    const jsi::Object& childObject,
    const char* message)
{
    expectObjectFunction(runtime, parentObject, "insertChild");
    auto insertChild = parentObject.getPropertyAsFunction(runtime, "insertChild");
    jsi::Value args[] = {jsi::Value(runtime, childObject)};
    auto result = insertChild.callWithThis(
        runtime,
        parentObject,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(1));
    expect(result.isUndefined(), message);
}

void callGeneratedRemoveChild(
    jsi::Runtime& runtime,
    const jsi::Object& parentObject,
    const jsi::Object& childObject,
    const char* message)
{
    expectObjectFunction(runtime, parentObject, "removeChild");
    auto removeChild = parentObject.getPropertyAsFunction(runtime, "removeChild");
    jsi::Value args[] = {jsi::Value(runtime, childObject)};
    auto result = removeChild.callWithThis(
        runtime,
        parentObject,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(1));
    expect(result.isUndefined(), message);
}

jsi::Object makeInteractionConfig(jsi::Runtime& runtime, double eventTag)
{
    jsi::Object config(runtime);
    config.setProperty(runtime, "eventTag", eventTag);
    config.setProperty(runtime, "pointerEvents", "auto");
    config.setProperty(runtime, "preciseHit", false);
    config.setProperty(runtime, "hitSlop", 0.0);
    return config;
}

void callRawSetInteractionConfig(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    jsi::Object config,
    const char* message)
{
    expectObjectFunction(runtime, object, "setInteractionConfig");
    auto setInteractionConfig = object.getPropertyAsFunction(runtime, "setInteractionConfig");
    jsi::Value args[] = {jsi::Value(runtime, config)};
    auto result = setInteractionConfig.callWithThis(
        runtime,
        object,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(1));
    expect(result.isUndefined(), message);
}

double callRawHitTest(
    jsi::Runtime& runtime,
    const jsi::Object& object,
    double x,
    double y)
{
    expectObjectFunction(runtime, object, "hitTest");
    auto hitTest = object.getPropertyAsFunction(runtime, "hitTest");
    jsi::Value args[] = {jsi::Value(x), jsi::Value(y)};
    auto result = hitTest.callWithThis(
        runtime,
        object,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(2));
    expect(result.isNumber(), "raw hitTest through materialized YogaNode object must return a number");
    return result.asNumber();
}

void assertMaterializedGetChildren(jsi::Runtime& runtime)
{
    auto parent = materializeYogaNode(runtime);
    auto child = materializeYogaNode(runtime);
    auto grandchild = materializeYogaNode(runtime);

    expectYogaNodePrototypeSurface(runtime, parent.object, "direct parent materialized object");
    expectYogaNodePrototypeSurface(runtime, child.object, "direct child materialized object");

    callGeneratedInsertChild(
        runtime,
        parent.object,
        child.object,
        "generated parent.insertChild(child) must return undefined");
    expect(parent.node->_children.size() == 1, "generated parent.insertChild(child) must attach one native child");
    expect(parent.node->_children[0].get() == child.node.get(), "generated parent.insertChild(child) must attach the expected native child");

    auto children = callGetChildren(
        runtime,
        parent.object,
        "materialized parent.getChildren() must return an array");
    expect(children.size(runtime) == 1, "materialized parent.getChildren() must return one child");

    auto returnedChildValue = children.getValueAtIndex(runtime, 0);
    expect(returnedChildValue.isObject(), "materialized parent.getChildren()[0] must be an object");
    jsi::Value childObjectValue(runtime, child.object);
    expect(
        jsi::Value::strictEquals(runtime, childObjectValue, returnedChildValue),
        "materialized parent.getChildren()[0] must be the cached materialized child object");
    auto returnedChildObject = returnedChildValue.asObject(runtime);
    expectNativeStateWrapsOriginal(runtime, returnedChildObject, child.node);
    expectYogaNodePrototypeSurface(runtime, returnedChildObject, "returned child materialized object");

    auto returnedChildSetStyle = returnedChildObject.getPropertyAsFunction(runtime, "setStyle");
    callFunctionWithOneObject(
        runtime,
        returnedChildObject,
        returnedChildSetStyle,
        makeStyle(runtime, 32.0, 16.0),
        "generated setStyle through returned child must return undefined");
    auto returnedChildComputeLayout = returnedChildObject.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, returnedChildObject, returnedChildComputeLayout);
    expect(child.node->_hasLayoutBeenComputed, "generated computeLayout through returned child must compute native layout");
    expectNear(child.node->_layout.width, 32.0, "returned child generated computeLayout width");
    expectNear(child.node->_layout.height, 16.0, "returned child generated computeLayout height");

    auto returnedChildLayout = returnedChildObject.getProperty(runtime, "layout");
    expect(returnedChildLayout.isObject(), "returned child generated layout getter must return an object");
    auto returnedChildLayoutObject = returnedChildLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, returnedChildLayoutObject, "width"), 32.0, "returned child generated layout getter width");
    expectNear(getNumberProperty(runtime, returnedChildLayoutObject, "height"), 16.0, "returned child generated layout getter height");

    callRawSetInteractionConfig(
        runtime,
        returnedChildObject,
        makeInteractionConfig(runtime, 115.0),
        "raw setInteractionConfig through returned child must return undefined");
    expectNear(child.node->_eventTag, 115.0, "raw setInteractionConfig through returned child must set eventTag");
    expectNear(
        callRawHitTest(runtime, returnedChildObject, 4.0, 4.0),
        115.0,
        "raw hitTest through returned child must use returned-child native state");

    callGeneratedInsertChild(
        runtime,
        returnedChildObject,
        grandchild.object,
        "generated insertChild through returned child must return undefined");
    expect(child.node->_children.size() == 1, "generated insertChild through returned child must attach native grandchild");
    expect(child.node->_children[0].get() == grandchild.node.get(), "generated insertChild through returned child must attach expected grandchild");

    auto grandchildren = callGetChildren(
        runtime,
        returnedChildObject,
        "returned child.getChildren() must return an array");
    expect(grandchildren.size(runtime) == 1, "returned child.getChildren() must return one grandchild");
    auto returnedGrandchildValue = grandchildren.getValueAtIndex(runtime, 0);
    expect(returnedGrandchildValue.isObject(), "returned child.getChildren()[0] must be an object");
    jsi::Value grandchildObjectValue(runtime, grandchild.object);
    expect(
        jsi::Value::strictEquals(runtime, grandchildObjectValue, returnedGrandchildValue),
        "returned child.getChildren()[0] must be the cached materialized grandchild object");
    auto returnedGrandchildObject = returnedGrandchildValue.asObject(runtime);
    expectNativeStateWrapsOriginal(runtime, returnedGrandchildObject, grandchild.node);
    expectYogaNodePrototypeSurface(runtime, returnedGrandchildObject, "returned grandchild materialized object");

    callGeneratedRemoveChild(
        runtime,
        returnedChildObject,
        grandchild.object,
        "generated removeChild through returned child must return undefined");
    expect(child.node->_children.empty(), "generated removeChild through returned child must detach native grandchild");

    disposeMaterializedObject(runtime, grandchild.object);
    disposeMaterializedObject(runtime, child.object);
    disposeMaterializedObject(runtime, parent.object);
}

void assertGeneratedMaterializedFlexLayoutBreadth(jsi::Runtime& runtime)
{
    auto parent = materializeYogaNode(runtime);
    auto growingChild = materializeYogaNode(runtime);
    auto fixedChild = materializeYogaNode(runtime);
    auto absoluteChild = materializeYogaNode(runtime);

    callGeneratedSetStyle(
        runtime,
        parent,
        makeFlexLayoutParentStyle(runtime),
        "generated materialized flex parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        growingChild,
        makeFlexLayoutGrowingChildStyle(runtime),
        "generated materialized flex growing child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        fixedChild,
        makeFlexLayoutFixedChildStyle(runtime),
        "generated materialized flex fixed child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeFlexLayoutAbsoluteChildStyle(runtime),
        "generated materialized flex absolute child setStyle must return undefined");

    callGeneratedInsertChild(
        runtime,
        parent.object,
        growingChild.object,
        "generated materialized flex parent.insertChild(growingChild) must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        fixedChild.object,
        "generated materialized flex parent.insertChild(fixedChild) must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        absoluteChild.object,
        "generated materialized flex parent.insertChild(absoluteChild) must return undefined");
    expect(parent.node->_children.size() == 3, "generated materialized flex tree must attach three native children");

    expect(parent.node->_style.flexDirection.has_value(), "generated flex parent style must populate flexDirection optional");
    expect(*parent.node->_style.flexDirection == FlexDirection::ROW, "generated flex parent style must store row flexDirection");
    expect(parent.node->_style.justifyContent.has_value(), "generated flex parent style must populate justifyContent optional");
    expect(*parent.node->_style.justifyContent == JustifyContent::CENTER, "generated flex parent style must store center justifyContent");
    expect(parent.node->_style.alignItems.has_value(), "generated flex parent style must populate alignItems optional");
    expect(*parent.node->_style.alignItems == Align::CENTER, "generated flex parent style must store center alignItems");
    expectOptionalDoubleNear(parent.node->_style.gap, 2.0, "generated flex parent style must store gap optional");
    expectOptionalDoubleNear(parent.node->_style.rowGap, 4.0, "generated flex parent style must store rowGap optional");
    expectOptionalDoubleNear(parent.node->_style.columnGap, 6.0, "generated flex parent style must store columnGap optional");
    expectOptionalStyleNumber(parent.node->_style.paddingHorizontal, 10.0, "generated flex parent style must store paddingHorizontal optional");
    expectOptionalStyleNumber(parent.node->_style.paddingVertical, 5.0, "generated flex parent style must store paddingVertical optional");

    expectOptionalDoubleNear(growingChild.node->_style.flexGrow, 1.0, "generated flex child style must store flexGrow optional");
    expectOptionalDoubleNear(growingChild.node->_style.flexShrink, 1.0, "generated flex child style must store flexShrink optional");
    expectOptionalStyleNumber(growingChild.node->_style.flexBasis, 40.0, "generated flex child style must store flexBasis optional");
    expectOptionalStyleNumber(growingChild.node->_style.marginHorizontal, 5.0, "generated flex child style must store marginHorizontal optional");
    expectOptionalStyleNumber(growingChild.node->_style.marginVertical, 3.0, "generated flex child style must store marginVertical optional");

    expect(absoluteChild.node->_style.position.has_value(), "generated absolute child style must populate position optional");
    expect(*absoluteChild.node->_style.position == Position::ABSOLUTE, "generated absolute child style must store absolute position");
    expectOptionalStyleNumber(absoluteChild.node->_style.insetHorizontal, 17.0, "generated absolute child style must store insetHorizontal optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.insetVertical, 19.0, "generated absolute child style must store insetVertical optional");

    expect(
        YGNodeStyleGetFlexDirection(parent.node->_node) == YGFlexDirectionRow,
        "generated flex parent must update Yoga flexDirection getter");
    expect(
        YGNodeStyleGetJustifyContent(parent.node->_node) == YGJustifyCenter,
        "generated flex parent must update Yoga justifyContent getter");
    expect(
        YGNodeStyleGetAlignItems(parent.node->_node) == YGAlignCenter,
        "generated flex parent must update Yoga alignItems getter");
    expectYGValuePoint(
        YGNodeStyleGetGap(parent.node->_node, YGGutterAll),
        2.0,
        "generated flex parent Yoga gap getter");
    expectYGValuePoint(
        YGNodeStyleGetGap(parent.node->_node, YGGutterRow),
        4.0,
        "generated flex parent Yoga rowGap getter");
    expectYGValuePoint(
        YGNodeStyleGetGap(parent.node->_node, YGGutterColumn),
        6.0,
        "generated flex parent Yoga columnGap getter");
    expectYGValuePoint(
        YGNodeStyleGetPadding(parent.node->_node, YGEdgeHorizontal),
        10.0,
        "generated flex parent Yoga paddingHorizontal getter");
    expectYGValuePoint(
        YGNodeStyleGetPadding(parent.node->_node, YGEdgeVertical),
        5.0,
        "generated flex parent Yoga paddingVertical getter");
    expectNear(
        YGNodeStyleGetFlexGrow(growingChild.node->_node),
        1.0,
        "generated flex child Yoga flexGrow getter");
    expectNear(
        YGNodeStyleGetFlexShrink(growingChild.node->_node),
        1.0,
        "generated flex child Yoga flexShrink getter");
    expectYGValuePoint(
        YGNodeStyleGetFlexBasis(growingChild.node->_node),
        40.0,
        "generated flex child Yoga flexBasis getter");
    expectYGValuePoint(
        YGNodeStyleGetMargin(growingChild.node->_node, YGEdgeHorizontal),
        5.0,
        "generated flex child Yoga marginHorizontal getter");
    expectYGValuePoint(
        YGNodeStyleGetMargin(growingChild.node->_node, YGEdgeVertical),
        3.0,
        "generated flex child Yoga marginVertical getter");
    expect(
        YGNodeStyleGetPositionType(absoluteChild.node->_node) == YGPositionTypeAbsolute,
        "generated absolute child must update Yoga position getter");
    expectYGValuePoint(
        YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeHorizontal),
        17.0,
        "generated absolute child Yoga insetHorizontal getter");
    expectYGValuePoint(
        YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeVertical),
        19.0,
        "generated absolute child Yoga insetVertical getter");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);
    expect(parent.node->_hasLayoutBeenComputed, "generated materialized flex parent computeLayout must compute native layout");
    expect(growingChild.node->_hasLayoutBeenComputed, "generated materialized flex growing child computeLayout must compute native layout");
    expect(fixedChild.node->_hasLayoutBeenComputed, "generated materialized flex fixed child computeLayout must compute native layout");
    expect(absoluteChild.node->_hasLayoutBeenComputed, "generated materialized flex absolute child computeLayout must compute native layout");

    expectNear(parent.node->_layout.left, 0.0, "generated materialized flex parent native layout left");
    expectNear(parent.node->_layout.top, 0.0, "generated materialized flex parent native layout top");
    expectNear(parent.node->_layout.width, 200.0, "generated materialized flex parent native layout width");
    expectNear(parent.node->_layout.height, 100.0, "generated materialized flex parent native layout height");
    expectNear(growingChild.node->_layout.left, 15.0, "generated materialized growing child native layout left");
    expectNear(growingChild.node->_layout.top, 40.0, "generated materialized growing child native layout top");
    expectNear(growingChild.node->_layout.width, 134.0, "generated materialized growing child native layout width");
    expectNear(growingChild.node->_layout.height, 20.0, "generated materialized growing child native layout height");
    expectNear(fixedChild.node->_layout.left, 160.0, "generated materialized fixed child native layout left");
    expectNear(fixedChild.node->_layout.top, 45.0, "generated materialized fixed child native layout top");
    expectNear(fixedChild.node->_layout.width, 30.0, "generated materialized fixed child native layout width");
    expectNear(fixedChild.node->_layout.height, 10.0, "generated materialized fixed child native layout height");
    expectNear(absoluteChild.node->_layout.left, 17.0, "generated materialized absolute child native layout left");
    expectNear(absoluteChild.node->_layout.top, 19.0, "generated materialized absolute child native layout top");
    expectNear(absoluteChild.node->_layout.width, 12.0, "generated materialized absolute child native layout width");
    expectNear(absoluteChild.node->_layout.height, 14.0, "generated materialized absolute child native layout height");

    auto parentLayout = parent.object.getProperty(runtime, "layout");
    expect(parentLayout.isObject(), "generated flex parent layout getter must return an object");
    auto parentLayoutObject = parentLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, parentLayoutObject, "width"), 200.0, "generated flex parent layout getter width");
    expectNear(getNumberProperty(runtime, parentLayoutObject, "height"), 100.0, "generated flex parent layout getter height");

    auto growingChildLayout = growingChild.object.getProperty(runtime, "layout");
    expect(growingChildLayout.isObject(), "generated flex growing child layout getter must return an object");
    auto growingChildLayoutObject = growingChildLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, growingChildLayoutObject, "left"), 15.0, "generated flex growing child layout getter left");
    expectNear(getNumberProperty(runtime, growingChildLayoutObject, "top"), 40.0, "generated flex growing child layout getter top");
    expectNear(getNumberProperty(runtime, growingChildLayoutObject, "width"), 134.0, "generated flex growing child layout getter width");
    expectNear(getNumberProperty(runtime, growingChildLayoutObject, "height"), 20.0, "generated flex growing child layout getter height");

    auto fixedChildLayout = fixedChild.object.getProperty(runtime, "layout");
    expect(fixedChildLayout.isObject(), "generated flex fixed child layout getter must return an object");
    auto fixedChildLayoutObject = fixedChildLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, fixedChildLayoutObject, "left"), 160.0, "generated flex fixed child layout getter left");
    expectNear(getNumberProperty(runtime, fixedChildLayoutObject, "top"), 45.0, "generated flex fixed child layout getter top");
    expectNear(getNumberProperty(runtime, fixedChildLayoutObject, "width"), 30.0, "generated flex fixed child layout getter width");
    expectNear(getNumberProperty(runtime, fixedChildLayoutObject, "height"), 10.0, "generated flex fixed child layout getter height");

    auto absoluteChildLayout = absoluteChild.object.getProperty(runtime, "layout");
    expect(absoluteChildLayout.isObject(), "generated flex absolute child layout getter must return an object");
    auto absoluteChildLayoutObject = absoluteChildLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, absoluteChildLayoutObject, "left"), 17.0, "generated flex absolute child layout getter left");
    expectNear(getNumberProperty(runtime, absoluteChildLayoutObject, "top"), 19.0, "generated flex absolute child layout getter top");
    expectNear(getNumberProperty(runtime, absoluteChildLayoutObject, "width"), 12.0, "generated flex absolute child layout getter width");
    expectNear(getNumberProperty(runtime, absoluteChildLayoutObject, "height"), 14.0, "generated flex absolute child layout getter height");

    disposeMaterializedObject(runtime, absoluteChild.object);
    disposeMaterializedObject(runtime, fixedChild.object);
    disposeMaterializedObject(runtime, growingChild.object);
    disposeMaterializedObject(runtime, parent.object);
}

void assertGeneratedWidthStretchStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetStyle(
        runtime,
        materialized,
        makeWidthStretchStyle(runtime),
        "generated materialized width stretch setStyle must return undefined");

    expectOptionalStyleString(
        materialized.node->_style.width,
        "stretch",
        "generated width stretch style must store width string optional");
    expectOptionalStyleNumber(
        materialized.node->_style.height,
        8.0,
        "generated width stretch style must still store ordinary height optional");
    const auto width = YGNodeStyleGetWidth(materialized.node->_node);
    expect(width.unit == YGUnitStretch, "generated width stretch style must update stable Yoga width getter");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedLayoutUnitValidation(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetStyle(
        runtime,
        materialized,
        makeValidatedLayoutUnitStyle(runtime),
        "generated materialized layout unit validation positive setStyle must return undefined");

    expectOptionalStyleString(
        materialized.node->_style.width,
        "25%",
        "generated layout unit validation must store width percent string optional");
    expectOptionalStyleString(
        materialized.node->_style.height,
        "auto",
        "generated layout unit validation must store height auto string optional");
    expectOptionalStyleString(
        materialized.node->_style.minWidth,
        "12.5%",
        "generated layout unit validation must store minWidth percent string optional");
    expectOptionalStyleString(
        materialized.node->_style.paddingLeft,
        "+1.25e1%",
        "generated layout unit validation must store paddingLeft exponent percent string optional");
    expectOptionalStyleString(
        materialized.node->_style.marginLeft,
        "auto",
        "generated layout unit validation must store marginLeft auto string optional");
    expectOptionalStyleString(
        materialized.node->_style.left,
        "-2.5%",
        "generated layout unit validation must store left percent string optional");
    expectOptionalStyleString(
        materialized.node->_style.flexBasis,
        "auto",
        "generated layout unit validation must store flexBasis auto string optional");

    expectYGValuePercent(
        YGNodeStyleGetWidth(materialized.node->_node),
        25.0,
        "generated layout unit validation Yoga width percent getter");
    expectYGValueAuto(
        YGNodeStyleGetHeight(materialized.node->_node),
        "generated layout unit validation Yoga height auto getter");
    expectYGValuePercent(
        YGNodeStyleGetMinWidth(materialized.node->_node),
        12.5,
        "generated layout unit validation Yoga minWidth percent getter");
    expectYGValuePercent(
        YGNodeStyleGetPadding(materialized.node->_node, YGEdgeLeft),
        12.5,
        "generated layout unit validation Yoga paddingLeft exponent percent getter");
    expectYGValueAuto(
        YGNodeStyleGetMargin(materialized.node->_node, YGEdgeLeft),
        "generated layout unit validation Yoga marginLeft auto getter");
    expectYGValuePercent(
        YGNodeStyleGetPosition(materialized.node->_node, YGEdgeLeft),
        -2.5,
        "generated layout unit validation Yoga left percent getter");
    expectYGValueAuto(
        YGNodeStyleGetFlexBasis(materialized.node->_node),
        "generated layout unit validation Yoga flexBasis auto getter");

    struct WidthSpecialCase {
        const char* value;
        YGUnit unit;
    };

    const WidthSpecialCase widthSpecialCases[] = {
        { "fit-content", YGUnitFitContent },
        { "max-content", YGUnitMaxContent },
        { "stretch", YGUnitStretch },
    };

    for (const auto& widthCase : widthSpecialCases) {
        auto widthSpecial = materializeYogaNode(runtime);
        callGeneratedSetStyle(
            runtime,
            widthSpecial,
            makeSingleStringStyle(runtime, "width", widthCase.value),
            std::string("generated materialized width special setStyle must accept ") + widthCase.value);
        expectOptionalStyleString(
            widthSpecial.node->_style.width,
            widthCase.value,
            "generated width special style must store width string optional");
        expect(
            YGNodeStyleGetWidth(widthSpecial.node->_node).unit == widthCase.unit,
            std::string("generated width special must update Yoga width unit for ") + widthCase.value);
        disposeMaterializedObject(runtime, widthSpecial.object);
    }

    const auto invalidCases = std::array {
        std::tuple { "left", "10px", "Invalid Yoga layout value for left: \"10px\"" },
        std::tuple { "padding", "auto", "Invalid Yoga layout value for padding: \"auto\"" },
        std::tuple { "minWidth", "auto", "Invalid Yoga layout value for minWidth: \"auto\"" },
        std::tuple { "width", "bogus", "Invalid Yoga layout value for width: \"bogus\"" },
        std::tuple { "height", "fit-content", "Invalid Yoga layout value for height: \"fit-content\"" },
        std::tuple { "width", "10abc%", "Invalid Yoga layout value for width: \"10abc%\"" },
        std::tuple { "width", "10%%", "Invalid Yoga layout value for width: \"10%%\"" },
        std::tuple { "width", "NaN%", "Invalid Yoga layout value for width: \"NaN%\"" },
        std::tuple { "width", "Infinity%", "Invalid Yoga layout value for width: \"Infinity%\"" },
        std::tuple { "width", "1e309%", "Invalid Yoga layout value for width: \"1e309%\"" },
    };

    for (const auto& invalidCase : invalidCases) {
        const auto& [propertyName, value, messageSubstring] = invalidCase;
        expectThrows(
            [&]() {
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    makeSingleStringStyle(runtime, propertyName, value),
                    "generated materialized invalid layout unit setStyle must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject invalid layout unit ") + propertyName + "=" + value);
    }

    expectYGValuePercent(
        YGNodeStyleGetWidth(materialized.node->_node),
        25.0,
        "generated invalid layout unit rejection must preserve previous Yoga width");
    expectYGValueAuto(
        YGNodeStyleGetHeight(materialized.node->_node),
        "generated invalid layout unit rejection must preserve previous Yoga height");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedMaterializedResidualLayoutBreadth(jsi::Runtime& runtime)
{
    auto parent = materializeYogaNode(runtime);
    auto constrainedChild = materializeYogaNode(runtime);
    auto aspectChild = materializeYogaNode(runtime);
    auto absoluteChild = materializeYogaNode(runtime);

    callGeneratedSetStyle(
        runtime,
        parent,
        makeResidualLayoutParentStyle(runtime),
        "generated residual layout parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        constrainedChild,
        makeResidualConstraintChildStyle(runtime),
        "generated residual constraint child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        aspectChild,
        makeResidualAspectChildStyle(runtime),
        "generated residual aspect child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeResidualAbsoluteEdgeChildStyle(runtime),
        "generated residual absolute edge child setStyle must return undefined");

    callGeneratedInsertChild(
        runtime,
        parent.object,
        constrainedChild.object,
        "generated residual parent.insertChild(constrainedChild) must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        aspectChild.object,
        "generated residual parent.insertChild(aspectChild) must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        absoluteChild.object,
        "generated residual parent.insertChild(absoluteChild) must return undefined");
    expect(parent.node->_children.size() == 3, "generated residual layout tree must attach three native children");

    expect(parent.node->_style.flexWrap.has_value(), "generated residual parent style must populate flexWrap optional");
    expect(*parent.node->_style.flexWrap == FlexWrap::WRAP, "generated residual parent style must store wrap flexWrap");
    expect(parent.node->_style.alignContent.has_value(), "generated residual parent style must populate alignContent optional");
    expect(*parent.node->_style.alignContent == Align::SPACE_AROUND, "generated residual parent style must store space-around alignContent");
    expect(parent.node->_style.direction.has_value(), "generated residual parent style must populate direction optional");
    expect(*parent.node->_style.direction == Direction::LTR, "generated residual parent style must store ltr direction");
    expect(parent.node->_style.display.has_value(), "generated residual parent style must populate display optional");
    expect(*parent.node->_style.display == Display::FLEX, "generated residual parent style must store flex display");
    expect(parent.node->_style.boxSizing.has_value(), "generated residual parent style must populate boxSizing optional");
    expect(*parent.node->_style.boxSizing == BoxSizing::CONTENT_BOX, "generated residual parent style must store content-box boxSizing");

    expectOptionalStyleString(constrainedChild.node->_style.width, "50%", "generated residual child style must store percent width optional");
    expectOptionalStyleString(constrainedChild.node->_style.height, "auto", "generated residual child style must store auto height optional");
    expectOptionalStyleNumber(constrainedChild.node->_style.minWidth, 100.0, "generated residual child style must store minWidth optional");
    expectOptionalStyleString(constrainedChild.node->_style.minHeight, "10%", "generated residual child style must store percent minHeight optional");
    expectOptionalStyleString(constrainedChild.node->_style.maxWidth, "75%", "generated residual child style must store percent maxWidth optional");
    expectOptionalStyleNumber(constrainedChild.node->_style.maxHeight, 20.0, "generated residual child style must store maxHeight optional");
    expectOptionalStyleString(constrainedChild.node->_style.flexBasis, "auto", "generated residual child style must store auto flexBasis optional");

    expect(aspectChild.node->_style.alignSelf.has_value(), "generated residual aspect child style must populate alignSelf optional");
    expect(*aspectChild.node->_style.alignSelf == Align::FLEX_END, "generated residual aspect child style must store flex-end alignSelf");
    expectOptionalDoubleNear(aspectChild.node->_style.aspectRatio, 2.0, "generated residual aspect child style must store aspectRatio optional");

    expect(absoluteChild.node->_style.position.has_value(), "generated residual absolute child style must populate position optional");
    expect(*absoluteChild.node->_style.position == Position::ABSOLUTE, "generated residual absolute child style must store absolute position");
    expectOptionalStyleString(absoluteChild.node->_style.start, "10%", "generated residual absolute child style must store percent start optional");
    expectOptionalStyleString(absoluteChild.node->_style.end, "auto", "generated residual absolute child style must store auto end optional");
    expectOptionalStyleString(absoluteChild.node->_style.top, "25%", "generated residual absolute child style must store percent top optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.bottom, 4.0, "generated residual absolute child style must store bottom optional");

    expect(
        YGNodeStyleGetFlexWrap(parent.node->_node) == YGWrapWrap,
        "generated residual parent must update Yoga flexWrap getter");
    expect(
        YGNodeStyleGetAlignContent(parent.node->_node) == YGAlignSpaceAround,
        "generated residual parent must update Yoga alignContent getter");
    expect(
        YGNodeStyleGetDirection(parent.node->_node) == YGDirectionLTR,
        "generated residual parent must update Yoga direction getter");
    expect(
        YGNodeStyleGetDisplay(parent.node->_node) == YGDisplayFlex,
        "generated residual parent must update Yoga display getter");
    expect(
        YGNodeStyleGetBoxSizing(parent.node->_node) == YGBoxSizingContentBox,
        "generated residual parent must update Yoga boxSizing getter");
    expectYGValuePercent(
        YGNodeStyleGetWidth(constrainedChild.node->_node),
        50.0,
        "generated residual child Yoga percent width getter");
    expectYGValueAuto(
        YGNodeStyleGetHeight(constrainedChild.node->_node),
        "generated residual child Yoga auto height getter");
    expectYGValuePoint(
        YGNodeStyleGetMinWidth(constrainedChild.node->_node),
        100.0,
        "generated residual child Yoga minWidth getter");
    expectYGValuePercent(
        YGNodeStyleGetMinHeight(constrainedChild.node->_node),
        10.0,
        "generated residual child Yoga percent minHeight getter");
    expectYGValuePercent(
        YGNodeStyleGetMaxWidth(constrainedChild.node->_node),
        75.0,
        "generated residual child Yoga percent maxWidth getter");
    expectYGValuePoint(
        YGNodeStyleGetMaxHeight(constrainedChild.node->_node),
        20.0,
        "generated residual child Yoga maxHeight getter");
    expectYGValueAuto(
        YGNodeStyleGetFlexBasis(constrainedChild.node->_node),
        "generated residual child Yoga auto flexBasis getter");
    expect(
        YGNodeStyleGetAlignSelf(aspectChild.node->_node) == YGAlignFlexEnd,
        "generated residual aspect child must update Yoga alignSelf getter");
    expectNear(
        YGNodeStyleGetAspectRatio(aspectChild.node->_node),
        2.0,
        "generated residual aspect child Yoga aspectRatio getter");
    expectYGValuePercent(
        YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeStart),
        10.0,
        "generated residual absolute child Yoga percent start getter");
    expectYGValueAuto(
        YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeEnd),
        "generated residual absolute child Yoga auto end getter");
    expectYGValuePercent(
        YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeTop),
        25.0,
        "generated residual absolute child Yoga percent top getter");
    expectYGValuePoint(
        YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeBottom),
        4.0,
        "generated residual absolute child Yoga bottom getter");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);
    expect(parent.node->_hasLayoutBeenComputed, "generated residual parent computeLayout must compute native layout");
    expect(constrainedChild.node->_hasLayoutBeenComputed, "generated residual constrained child computeLayout must compute native layout");
    expect(aspectChild.node->_hasLayoutBeenComputed, "generated residual aspect child computeLayout must compute native layout");
    expect(absoluteChild.node->_hasLayoutBeenComputed, "generated residual absolute child computeLayout must compute native layout");

    expectNear(parent.node->_layout.width, 180.0, "generated residual parent native layout width");
    expectNear(parent.node->_layout.height, 120.0, "generated residual parent native layout height");
    expectNear(constrainedChild.node->_layout.width, 100.0, "generated residual constrained child native min-constrained width");
    expectNear(constrainedChild.node->_layout.height, 20.0, "generated residual constrained child native maxHeight-capped auto height");
    expectNear(aspectChild.node->_layout.width, 48.0, "generated residual aspect child native aspect width");
    expectNear(aspectChild.node->_layout.height, 24.0, "generated residual aspect child native height");
    expectNear(absoluteChild.node->_layout.left, 18.0, "generated residual absolute child native percent start");
    expectNear(absoluteChild.node->_layout.top, 30.0, "generated residual absolute child native percent top");
    expectNear(absoluteChild.node->_layout.width, 10.0, "generated residual absolute child native width");
    expectNear(absoluteChild.node->_layout.height, 8.0, "generated residual absolute child native height");

    auto constrainedLayout = constrainedChild.object.getProperty(runtime, "layout");
    expect(constrainedLayout.isObject(), "generated residual constrained child layout getter must return an object");
    auto constrainedLayoutObject = constrainedLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, constrainedLayoutObject, "width"), 100.0, "generated residual constrained child layout getter width");
    expectNear(getNumberProperty(runtime, constrainedLayoutObject, "height"), 20.0, "generated residual constrained child layout getter height");

    auto aspectLayout = aspectChild.object.getProperty(runtime, "layout");
    expect(aspectLayout.isObject(), "generated residual aspect child layout getter must return an object");
    auto aspectLayoutObject = aspectLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, aspectLayoutObject, "width"), 48.0, "generated residual aspect child layout getter width");
    expectNear(getNumberProperty(runtime, aspectLayoutObject, "height"), 24.0, "generated residual aspect child layout getter height");

    auto absoluteLayout = absoluteChild.object.getProperty(runtime, "layout");
    expect(absoluteLayout.isObject(), "generated residual absolute child layout getter must return an object");
    auto absoluteLayoutObject = absoluteLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, absoluteLayoutObject, "left"), 18.0, "generated residual absolute child layout getter left");
    expectNear(getNumberProperty(runtime, absoluteLayoutObject, "top"), 30.0, "generated residual absolute child layout getter top");
    expectNear(getNumberProperty(runtime, absoluteLayoutObject, "width"), 10.0, "generated residual absolute child layout getter width");
    expectNear(getNumberProperty(runtime, absoluteLayoutObject, "height"), 8.0, "generated residual absolute child layout getter height");

    disposeMaterializedObject(runtime, absoluteChild.object);
    disposeMaterializedObject(runtime, aspectChild.object);
    disposeMaterializedObject(runtime, constrainedChild.object);
    disposeMaterializedObject(runtime, parent.object);
}

void assertGeneratedMaterializedDisplayNoneLayout(jsi::Runtime& runtime)
{
    auto parent = materializeYogaNode(runtime);
    auto hiddenChild = materializeYogaNode(runtime);

    callGeneratedSetStyle(
        runtime,
        parent,
        makeDisplayNoneParentStyle(runtime),
        "generated display-none parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        hiddenChild,
        makeDisplayNoneChildStyle(runtime),
        "generated display-none child setStyle must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        hiddenChild.object,
        "generated display-none parent.insertChild(hiddenChild) must return undefined");

    expect(hiddenChild.node->_style.display.has_value(), "generated display-none child style must populate display optional");
    expect(*hiddenChild.node->_style.display == Display::NONE, "generated display-none child style must store none display");
    expect(
        YGNodeStyleGetDisplay(hiddenChild.node->_node) == YGDisplayNone,
        "generated display-none child must update Yoga display getter");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);
    expectNear(parent.node->_layout.width, 80.0, "generated display-none parent native layout width");
    expectNear(parent.node->_layout.height, 40.0, "generated display-none parent native layout height");
    expectNear(hiddenChild.node->_layout.width, 0.0, "generated display-none child native layout width");
    expectNear(hiddenChild.node->_layout.height, 0.0, "generated display-none child native layout height");

    auto hiddenLayout = hiddenChild.object.getProperty(runtime, "layout");
    expect(hiddenLayout.isObject(), "generated display-none child layout getter must return an object");
    auto hiddenLayoutObject = hiddenLayout.asObject(runtime);
    expectNear(getNumberProperty(runtime, hiddenLayoutObject, "width"), 0.0, "generated display-none child layout getter width");
    expectNear(getNumberProperty(runtime, hiddenLayoutObject, "height"), 0.0, "generated display-none child layout getter height");

    disposeMaterializedObject(runtime, hiddenChild.object);
    disposeMaterializedObject(runtime, parent.object);
}

void assertGeneratedMaterializedSequentialLayoutUpdates(jsi::Runtime& runtime)
{
    auto parent = materializeYogaNode(runtime);
    auto flowChild = materializeYogaNode(runtime);
    auto absoluteChild = materializeYogaNode(runtime);

    callGeneratedInsertChild(
        runtime,
        parent.object,
        flowChild.object,
        "generated sequential parent.insertChild(flowChild) must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        absoluteChild.object,
        "generated sequential parent.insertChild(absoluteChild) must return undefined");
    expect(parent.node->_children.size() == 2, "generated sequential layout tree must attach two native children");

    callGeneratedSetStyle(
        runtime,
        parent,
        makeSequentialInitialParentStyle(runtime),
        "generated sequential initial parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        flowChild,
        makeSequentialInitialFlowChildStyle(runtime),
        "generated sequential initial flow child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialInitialAbsoluteChildStyle(runtime),
        "generated sequential initial absolute child setStyle must return undefined");

    expectOptionalStyleNumber(parent.node->_style.width, 160.0, "generated sequential initial parent width optional");
    expectOptionalStyleNumber(parent.node->_style.height, 80.0, "generated sequential initial parent height optional");
    expect(*parent.node->_style.flexDirection == FlexDirection::ROW, "generated sequential initial parent stores row flexDirection");
    expect(*parent.node->_style.flexWrap == FlexWrap::NOWRAP, "generated sequential initial parent stores nowrap flexWrap");
    expect(*parent.node->_style.alignContent == Align::FLEX_START, "generated sequential initial parent stores flex-start alignContent");
    expect(*parent.node->_style.direction == Direction::LTR, "generated sequential initial parent stores ltr direction");
    expect(*parent.node->_style.display == Display::FLEX, "generated sequential initial parent stores flex display");
    expect(*parent.node->_style.boxSizing == BoxSizing::BORDER_BOX, "generated sequential initial parent stores border-box boxSizing");
    expectOptionalDoubleNear(parent.node->_style.gap, 2.0, "generated sequential initial parent gap optional");
    expectOptionalDoubleNear(parent.node->_style.rowGap, 4.0, "generated sequential initial parent rowGap optional");
    expectOptionalDoubleNear(parent.node->_style.columnGap, 6.0, "generated sequential initial parent columnGap optional");
    expectOptionalStyleNumber(parent.node->_style.paddingHorizontal, 10.0, "generated sequential initial parent paddingHorizontal optional");
    expectOptionalStyleNumber(parent.node->_style.paddingVertical, 5.0, "generated sequential initial parent paddingVertical optional");

    expectOptionalStyleNumber(flowChild.node->_style.flexBasis, 40.0, "generated sequential initial child flexBasis optional");
    expectOptionalDoubleNear(flowChild.node->_style.flexGrow, 0.0, "generated sequential initial child flexGrow optional");
    expectOptionalDoubleNear(flowChild.node->_style.flexShrink, 1.0, "generated sequential initial child flexShrink optional");
    expectOptionalStyleNumber(flowChild.node->_style.minWidth, 30.0, "generated sequential initial child minWidth optional");
    expectOptionalStyleNumber(flowChild.node->_style.maxWidth, 60.0, "generated sequential initial child maxWidth optional");
    expect(*flowChild.node->_style.alignSelf == Align::FLEX_START, "generated sequential initial child stores flex-start alignSelf");
    expectOptionalStyleNumber(flowChild.node->_style.marginHorizontal, 5.0, "generated sequential initial child marginHorizontal optional");
    expectOptionalStyleNumber(flowChild.node->_style.marginVertical, 3.0, "generated sequential initial child marginVertical optional");

    expect(*absoluteChild.node->_style.position == Position::ABSOLUTE, "generated sequential initial absolute child stores absolute position");
    expectOptionalStyleNumber(absoluteChild.node->_style.width, 12.0, "generated sequential initial absolute child width optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.height, 14.0, "generated sequential initial absolute child height optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.insetHorizontal, 17.0, "generated sequential initial absolute child insetHorizontal optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.insetVertical, 19.0, "generated sequential initial absolute child insetVertical optional");

    expect(YGNodeStyleGetFlexDirection(parent.node->_node) == YGFlexDirectionRow, "generated sequential initial parent Yoga flexDirection getter");
    expect(YGNodeStyleGetFlexWrap(parent.node->_node) == YGWrapNoWrap, "generated sequential initial parent Yoga flexWrap getter");
    expect(YGNodeStyleGetAlignContent(parent.node->_node) == YGAlignFlexStart, "generated sequential initial parent Yoga alignContent getter");
    expect(YGNodeStyleGetDirection(parent.node->_node) == YGDirectionLTR, "generated sequential initial parent Yoga direction getter");
    expect(YGNodeStyleGetDisplay(parent.node->_node) == YGDisplayFlex, "generated sequential initial parent Yoga display getter");
    expect(YGNodeStyleGetBoxSizing(parent.node->_node) == YGBoxSizingBorderBox, "generated sequential initial parent Yoga boxSizing getter");
    expectYGValuePoint(YGNodeStyleGetGap(parent.node->_node, YGGutterAll), 2.0, "generated sequential initial parent Yoga gap getter");
    expectYGValuePoint(YGNodeStyleGetGap(parent.node->_node, YGGutterRow), 4.0, "generated sequential initial parent Yoga rowGap getter");
    expectYGValuePoint(YGNodeStyleGetGap(parent.node->_node, YGGutterColumn), 6.0, "generated sequential initial parent Yoga columnGap getter");
    expectYGValuePoint(YGNodeStyleGetPadding(parent.node->_node, YGEdgeHorizontal), 10.0, "generated sequential initial parent Yoga paddingHorizontal getter");
    expectYGValuePoint(YGNodeStyleGetPadding(parent.node->_node, YGEdgeVertical), 5.0, "generated sequential initial parent Yoga paddingVertical getter");
    expectYGValuePoint(YGNodeStyleGetFlexBasis(flowChild.node->_node), 40.0, "generated sequential initial child Yoga flexBasis getter");
    expectNear(YGNodeStyleGetFlexGrow(flowChild.node->_node), 0.0, "generated sequential initial child Yoga flexGrow getter");
    expectNear(YGNodeStyleGetFlexShrink(flowChild.node->_node), 1.0, "generated sequential initial child Yoga flexShrink getter");
    expectYGValuePoint(YGNodeStyleGetMinWidth(flowChild.node->_node), 30.0, "generated sequential initial child Yoga minWidth getter");
    expectYGValuePoint(YGNodeStyleGetMaxWidth(flowChild.node->_node), 60.0, "generated sequential initial child Yoga maxWidth getter");
    expect(YGNodeStyleGetAlignSelf(flowChild.node->_node) == YGAlignFlexStart, "generated sequential initial child Yoga alignSelf getter");
    expectYGValuePoint(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeHorizontal), 5.0, "generated sequential initial child Yoga marginHorizontal getter");
    expectYGValuePoint(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeVertical), 3.0, "generated sequential initial child Yoga marginVertical getter");
    expect(YGNodeStyleGetPositionType(absoluteChild.node->_node) == YGPositionTypeAbsolute, "generated sequential initial absolute child Yoga position getter");
    expectYGValuePoint(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeHorizontal), 17.0, "generated sequential initial absolute child Yoga insetHorizontal getter");
    expectYGValuePoint(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeVertical), 19.0, "generated sequential initial absolute child Yoga insetVertical getter");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, parent, 0.0, 0.0, 160.0, 80.0, "generated sequential initial parent");
    expectGeneratedLayoutGetterNear(runtime, flowChild, 15.0, 8.0, 40.0, 20.0, "generated sequential initial flow child");
    expectGeneratedLayoutGetterNear(runtime, absoluteChild, 17.0, 19.0, 12.0, 14.0, "generated sequential initial absolute child");

    callGeneratedSetStyle(
        runtime,
        parent,
        makeSequentialUpdatedParentStyle(runtime),
        "generated sequential updated parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        flowChild,
        makeSequentialUpdatedFlowChildStyle(runtime),
        "generated sequential updated flow child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialUpdatedAbsoluteChildStyle(runtime),
        "generated sequential updated absolute child setStyle must return undefined");
    expect(!parent.node->_hasLayoutBeenComputed, "generated sequential update must invalidate previously computed parent layout");

    expectOptionalStyleNumber(parent.node->_style.width, 150.0, "generated sequential updated parent width optional");
    expectOptionalStyleNumber(parent.node->_style.height, 90.0, "generated sequential updated parent height optional");
    expect(*parent.node->_style.flexDirection == FlexDirection::COLUMN, "generated sequential updated parent stores column flexDirection");
    expect(*parent.node->_style.flexWrap == FlexWrap::WRAP, "generated sequential updated parent stores wrap flexWrap");
    expect(*parent.node->_style.alignContent == Align::SPACE_AROUND, "generated sequential updated parent stores space-around alignContent");
    expect(*parent.node->_style.direction == Direction::RTL, "generated sequential updated parent stores rtl direction");
    expect(*parent.node->_style.display == Display::FLEX, "generated sequential updated parent stores flex display");
    expect(*parent.node->_style.boxSizing == BoxSizing::CONTENT_BOX, "generated sequential updated parent stores content-box boxSizing");
    expectOptionalDoubleNear(parent.node->_style.gap, 9.0, "generated sequential updated parent gap optional");
    expectOptionalDoubleNear(parent.node->_style.rowGap, 11.0, "generated sequential updated parent rowGap optional");
    expectOptionalDoubleNear(parent.node->_style.columnGap, 13.0, "generated sequential updated parent columnGap optional");
    expect(!parent.node->_style.paddingHorizontal.has_value(), "generated sequential updated parent clears old paddingHorizontal optional");
    expect(!parent.node->_style.paddingVertical.has_value(), "generated sequential updated parent clears old paddingVertical optional");
    expectOptionalStyleString(parent.node->_style.paddingLeft, "5%", "generated sequential updated parent paddingLeft percent optional");
    expectOptionalStyleNumber(parent.node->_style.paddingRight, 3.0, "generated sequential updated parent paddingRight optional");
    expectOptionalStyleNumber(parent.node->_style.paddingTop, 4.0, "generated sequential updated parent paddingTop optional");

    expectOptionalStyleString(flowChild.node->_style.width, "50%", "generated sequential updated child width percent optional");
    expectOptionalStyleString(flowChild.node->_style.height, "auto", "generated sequential updated child height auto optional");
    expectOptionalStyleNumber(flowChild.node->_style.minWidth, 80.0, "generated sequential updated child minWidth optional");
    expectOptionalStyleString(flowChild.node->_style.minHeight, "10%", "generated sequential updated child minHeight percent optional");
    expectOptionalStyleString(flowChild.node->_style.maxWidth, "90%", "generated sequential updated child maxWidth percent optional");
    expectOptionalStyleNumber(flowChild.node->_style.maxHeight, 30.0, "generated sequential updated child maxHeight optional");
    expectOptionalStyleString(flowChild.node->_style.flexBasis, "auto", "generated sequential updated child flexBasis auto optional");
    expectOptionalDoubleNear(flowChild.node->_style.flexGrow, 0.0, "generated sequential updated child flexGrow optional");
    expectOptionalDoubleNear(flowChild.node->_style.flexShrink, 0.0, "generated sequential updated child flexShrink optional");
    expect(*flowChild.node->_style.alignSelf == Align::FLEX_END, "generated sequential updated child stores flex-end alignSelf");
    expectOptionalStyleString(flowChild.node->_style.marginHorizontal, "5%", "generated sequential updated child marginHorizontal percent optional");
    expectOptionalStyleNumber(flowChild.node->_style.marginVertical, 2.0, "generated sequential updated child marginVertical optional");

    expect(*absoluteChild.node->_style.position == Position::ABSOLUTE, "generated sequential updated absolute child stores absolute position");
    expectOptionalStyleString(absoluteChild.node->_style.width, "25%", "generated sequential updated absolute child width percent optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.height, 12.0, "generated sequential updated absolute child height optional");
    expectOptionalStyleString(absoluteChild.node->_style.left, "10%", "generated sequential updated absolute child left percent optional");
    expectOptionalStyleString(absoluteChild.node->_style.right, "auto", "generated sequential updated absolute child right auto optional");
    expectOptionalStyleString(absoluteChild.node->_style.top, "25%", "generated sequential updated absolute child top percent optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.bottom, 4.0, "generated sequential updated absolute child bottom optional");
    expect(!absoluteChild.node->_style.insetHorizontal.has_value(), "generated sequential updated absolute child clears old insetHorizontal optional");
    expect(!absoluteChild.node->_style.insetVertical.has_value(), "generated sequential updated absolute child clears old insetVertical optional");

    expect(YGNodeStyleGetFlexDirection(parent.node->_node) == YGFlexDirectionColumn, "generated sequential updated parent Yoga flexDirection getter");
    expect(YGNodeStyleGetFlexWrap(parent.node->_node) == YGWrapWrap, "generated sequential updated parent Yoga flexWrap getter");
    expect(YGNodeStyleGetAlignContent(parent.node->_node) == YGAlignSpaceAround, "generated sequential updated parent Yoga alignContent getter");
    expect(YGNodeStyleGetDirection(parent.node->_node) == YGDirectionRTL, "generated sequential updated parent Yoga direction getter");
    expect(YGNodeStyleGetDisplay(parent.node->_node) == YGDisplayFlex, "generated sequential updated parent Yoga display getter");
    expect(YGNodeStyleGetBoxSizing(parent.node->_node) == YGBoxSizingContentBox, "generated sequential updated parent Yoga boxSizing getter");
    expectYGValuePoint(YGNodeStyleGetGap(parent.node->_node, YGGutterAll), 9.0, "generated sequential updated parent Yoga gap getter");
    expectYGValuePoint(YGNodeStyleGetGap(parent.node->_node, YGGutterRow), 11.0, "generated sequential updated parent Yoga rowGap getter");
    expectYGValuePoint(YGNodeStyleGetGap(parent.node->_node, YGGutterColumn), 13.0, "generated sequential updated parent Yoga columnGap getter");
    expectYGValueUndefined(YGNodeStyleGetPadding(parent.node->_node, YGEdgeHorizontal), "generated sequential updated parent Yoga clears paddingHorizontal getter");
    expectYGValueUndefined(YGNodeStyleGetPadding(parent.node->_node, YGEdgeVertical), "generated sequential updated parent Yoga clears paddingVertical getter");
    expectYGValuePercent(YGNodeStyleGetPadding(parent.node->_node, YGEdgeLeft), 5.0, "generated sequential updated parent Yoga paddingLeft percent getter");
    expectYGValuePoint(YGNodeStyleGetPadding(parent.node->_node, YGEdgeRight), 3.0, "generated sequential updated parent Yoga paddingRight getter");
    expectYGValuePoint(YGNodeStyleGetPadding(parent.node->_node, YGEdgeTop), 4.0, "generated sequential updated parent Yoga paddingTop getter");
    expectYGValuePercent(YGNodeStyleGetWidth(flowChild.node->_node), 50.0, "generated sequential updated child Yoga width percent getter");
    expectYGValueAuto(YGNodeStyleGetHeight(flowChild.node->_node), "generated sequential updated child Yoga height auto getter");
    expectYGValuePoint(YGNodeStyleGetMinWidth(flowChild.node->_node), 80.0, "generated sequential updated child Yoga minWidth getter");
    expectYGValuePercent(YGNodeStyleGetMinHeight(flowChild.node->_node), 10.0, "generated sequential updated child Yoga minHeight percent getter");
    expectYGValuePercent(YGNodeStyleGetMaxWidth(flowChild.node->_node), 90.0, "generated sequential updated child Yoga maxWidth percent getter");
    expectYGValuePoint(YGNodeStyleGetMaxHeight(flowChild.node->_node), 30.0, "generated sequential updated child Yoga maxHeight getter");
    expectYGValueAuto(YGNodeStyleGetFlexBasis(flowChild.node->_node), "generated sequential updated child Yoga flexBasis auto getter");
    expectNear(YGNodeStyleGetFlexGrow(flowChild.node->_node), 0.0, "generated sequential updated child Yoga flexGrow getter");
    expectNear(YGNodeStyleGetFlexShrink(flowChild.node->_node), 0.0, "generated sequential updated child Yoga flexShrink getter");
    expect(YGNodeStyleGetAlignSelf(flowChild.node->_node) == YGAlignFlexEnd, "generated sequential updated child Yoga alignSelf getter");
    expectYGValuePercent(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeHorizontal), 5.0, "generated sequential updated child Yoga marginHorizontal getter");
    expectYGValuePoint(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeVertical), 2.0, "generated sequential updated child Yoga marginVertical getter");
    expect(YGNodeStyleGetPositionType(absoluteChild.node->_node) == YGPositionTypeAbsolute, "generated sequential updated absolute child Yoga position getter");
    expectYGValuePercent(YGNodeStyleGetWidth(absoluteChild.node->_node), 25.0, "generated sequential updated absolute child Yoga width percent getter");
    expectYGValuePercent(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeLeft), 10.0, "generated sequential updated absolute child Yoga left percent getter");
    expectYGValueAuto(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeRight), "generated sequential updated absolute child Yoga right auto getter");
    expectYGValuePercent(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeTop), 25.0, "generated sequential updated absolute child Yoga top percent getter");
    expectYGValuePoint(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeBottom), 4.0, "generated sequential updated absolute child Yoga bottom getter");

    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, parent, 0.0, 0.0, 163.0, 94.0, "generated sequential updated parent");
    expectGeneratedLayoutGetterNear(runtime, absoluteChild, 16.0, 24.0, 41.0, 12.0, "generated sequential updated absolute child");

    callGeneratedSetStyle(
        runtime,
        parent,
        makeSequentialCleanupParentStyle(runtime),
        "generated sequential cleanup parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        flowChild,
        makeSequentialCleanupFlowChildStyle(runtime),
        "generated sequential cleanup flow child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialCleanupFormerAbsoluteChildStyle(runtime),
        "generated sequential cleanup former absolute child setStyle must return undefined");

    expectOptionalStyleNumber(parent.node->_style.width, 120.0, "generated sequential cleanup parent width optional");
    expectOptionalStyleNumber(parent.node->_style.height, 60.0, "generated sequential cleanup parent height optional");
    expect(!parent.node->_style.flexDirection.has_value(), "generated sequential cleanup parent clears flexDirection optional");
    expect(!parent.node->_style.flexWrap.has_value(), "generated sequential cleanup parent clears flexWrap optional");
    expect(!parent.node->_style.alignContent.has_value(), "generated sequential cleanup parent clears alignContent optional");
    expect(!parent.node->_style.direction.has_value(), "generated sequential cleanup parent clears direction optional");
    expect(!parent.node->_style.display.has_value(), "generated sequential cleanup parent clears display optional");
    expect(!parent.node->_style.boxSizing.has_value(), "generated sequential cleanup parent clears boxSizing optional");
    expect(!parent.node->_style.gap.has_value(), "generated sequential cleanup parent clears gap optional");
    expect(!parent.node->_style.rowGap.has_value(), "generated sequential cleanup parent clears rowGap optional");
    expect(!parent.node->_style.columnGap.has_value(), "generated sequential cleanup parent clears columnGap optional");
    expect(!parent.node->_style.paddingLeft.has_value(), "generated sequential cleanup parent clears paddingLeft optional");
    expect(!parent.node->_style.paddingRight.has_value(), "generated sequential cleanup parent clears paddingRight optional");
    expect(!parent.node->_style.paddingTop.has_value(), "generated sequential cleanup parent clears paddingTop optional");

    expectOptionalStyleNumber(flowChild.node->_style.width, 30.0, "generated sequential cleanup child width optional");
    expectOptionalStyleNumber(flowChild.node->_style.height, 10.0, "generated sequential cleanup child height optional");
    expect(!flowChild.node->_style.minWidth.has_value(), "generated sequential cleanup child clears minWidth optional");
    expect(!flowChild.node->_style.minHeight.has_value(), "generated sequential cleanup child clears minHeight optional");
    expect(!flowChild.node->_style.maxWidth.has_value(), "generated sequential cleanup child clears maxWidth optional");
    expect(!flowChild.node->_style.maxHeight.has_value(), "generated sequential cleanup child clears maxHeight optional");
    expect(!flowChild.node->_style.flexBasis.has_value(), "generated sequential cleanup child clears flexBasis optional");
    expect(!flowChild.node->_style.flexGrow.has_value(), "generated sequential cleanup child clears flexGrow optional");
    expect(!flowChild.node->_style.flexShrink.has_value(), "generated sequential cleanup child clears flexShrink optional");
    expect(!flowChild.node->_style.alignSelf.has_value(), "generated sequential cleanup child clears alignSelf optional");
    expect(!flowChild.node->_style.marginHorizontal.has_value(), "generated sequential cleanup child clears marginHorizontal optional");
    expect(!flowChild.node->_style.marginVertical.has_value(), "generated sequential cleanup child clears marginVertical optional");

    expectOptionalStyleNumber(absoluteChild.node->_style.width, 20.0, "generated sequential cleanup former absolute child width optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.height, 8.0, "generated sequential cleanup former absolute child height optional");
    expect(!absoluteChild.node->_style.position.has_value(), "generated sequential cleanup former absolute child clears position optional");
    expect(!absoluteChild.node->_style.left.has_value(), "generated sequential cleanup former absolute child clears left optional");
    expect(!absoluteChild.node->_style.right.has_value(), "generated sequential cleanup former absolute child clears right optional");
    expect(!absoluteChild.node->_style.top.has_value(), "generated sequential cleanup former absolute child clears top optional");
    expect(!absoluteChild.node->_style.bottom.has_value(), "generated sequential cleanup former absolute child clears bottom optional");

    auto defaultNode = YGNodeNew();
    expect(YGNodeStyleGetFlexDirection(parent.node->_node) == YGNodeStyleGetFlexDirection(defaultNode), "generated sequential cleanup parent Yoga flexDirection resets to default");
    expect(YGNodeStyleGetFlexWrap(parent.node->_node) == YGNodeStyleGetFlexWrap(defaultNode), "generated sequential cleanup parent Yoga flexWrap resets to default");
    expect(YGNodeStyleGetAlignContent(parent.node->_node) == YGNodeStyleGetAlignContent(defaultNode), "generated sequential cleanup parent Yoga alignContent resets to default");
    expect(YGNodeStyleGetDirection(parent.node->_node) == YGNodeStyleGetDirection(defaultNode), "generated sequential cleanup parent Yoga direction resets to default");
    expect(YGNodeStyleGetDisplay(parent.node->_node) == YGNodeStyleGetDisplay(defaultNode), "generated sequential cleanup parent Yoga display resets to default");
    expect(YGNodeStyleGetBoxSizing(parent.node->_node) == YGNodeStyleGetBoxSizing(defaultNode), "generated sequential cleanup parent Yoga boxSizing resets to default");
    expectYGValueSame(YGNodeStyleGetGap(parent.node->_node, YGGutterAll), YGNodeStyleGetGap(defaultNode, YGGutterAll), "generated sequential cleanup parent Yoga gap resets to default");
    expectYGValueSame(YGNodeStyleGetGap(parent.node->_node, YGGutterRow), YGNodeStyleGetGap(defaultNode, YGGutterRow), "generated sequential cleanup parent Yoga rowGap resets to default");
    expectYGValueSame(YGNodeStyleGetGap(parent.node->_node, YGGutterColumn), YGNodeStyleGetGap(defaultNode, YGGutterColumn), "generated sequential cleanup parent Yoga columnGap resets to default");
    expectYGValueSame(YGNodeStyleGetPadding(parent.node->_node, YGEdgeLeft), YGNodeStyleGetPadding(defaultNode, YGEdgeLeft), "generated sequential cleanup parent Yoga paddingLeft resets to default");
    expectYGValueSame(YGNodeStyleGetPadding(parent.node->_node, YGEdgeRight), YGNodeStyleGetPadding(defaultNode, YGEdgeRight), "generated sequential cleanup parent Yoga paddingRight resets to default");
    expectYGValueSame(YGNodeStyleGetPadding(parent.node->_node, YGEdgeTop), YGNodeStyleGetPadding(defaultNode, YGEdgeTop), "generated sequential cleanup parent Yoga paddingTop resets to default");
    expectYGValueSame(YGNodeStyleGetFlexBasis(flowChild.node->_node), YGNodeStyleGetFlexBasis(defaultNode), "generated sequential cleanup child Yoga flexBasis resets to default");
    expectNear(YGNodeStyleGetFlexGrow(flowChild.node->_node), YGNodeStyleGetFlexGrow(defaultNode), "generated sequential cleanup child Yoga flexGrow resets to default");
    expectNear(YGNodeStyleGetFlexShrink(flowChild.node->_node), YGNodeStyleGetFlexShrink(defaultNode), "generated sequential cleanup child Yoga flexShrink resets to default");
    expectYGValueSame(YGNodeStyleGetMinWidth(flowChild.node->_node), YGNodeStyleGetMinWidth(defaultNode), "generated sequential cleanup child Yoga minWidth resets to default");
    expectYGValueSame(YGNodeStyleGetMinHeight(flowChild.node->_node), YGNodeStyleGetMinHeight(defaultNode), "generated sequential cleanup child Yoga minHeight resets to default");
    expectYGValueSame(YGNodeStyleGetMaxWidth(flowChild.node->_node), YGNodeStyleGetMaxWidth(defaultNode), "generated sequential cleanup child Yoga maxWidth resets to default");
    expectYGValueSame(YGNodeStyleGetMaxHeight(flowChild.node->_node), YGNodeStyleGetMaxHeight(defaultNode), "generated sequential cleanup child Yoga maxHeight resets to default");
    expect(YGNodeStyleGetAlignSelf(flowChild.node->_node) == YGNodeStyleGetAlignSelf(defaultNode), "generated sequential cleanup child Yoga alignSelf resets to default");
    expectYGValueSame(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeHorizontal), YGNodeStyleGetMargin(defaultNode, YGEdgeHorizontal), "generated sequential cleanup child Yoga marginHorizontal resets to default");
    expectYGValueSame(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeVertical), YGNodeStyleGetMargin(defaultNode, YGEdgeVertical), "generated sequential cleanup child Yoga marginVertical resets to default");
    expect(YGNodeStyleGetPositionType(absoluteChild.node->_node) == YGNodeStyleGetPositionType(defaultNode), "generated sequential cleanup former absolute child Yoga position resets to default");
    expectYGValueSame(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeLeft), YGNodeStyleGetPosition(defaultNode, YGEdgeLeft), "generated sequential cleanup former absolute child Yoga left resets to default");
    expectYGValueSame(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeRight), YGNodeStyleGetPosition(defaultNode, YGEdgeRight), "generated sequential cleanup former absolute child Yoga right resets to default");
    expectYGValueSame(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeTop), YGNodeStyleGetPosition(defaultNode, YGEdgeTop), "generated sequential cleanup former absolute child Yoga top resets to default");
    expectYGValueSame(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeBottom), YGNodeStyleGetPosition(defaultNode, YGEdgeBottom), "generated sequential cleanup former absolute child Yoga bottom resets to default");
    YGNodeFree(defaultNode);

    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, parent, 0.0, 0.0, 120.0, 60.0, "generated sequential cleanup parent");
    expectGeneratedLayoutGetterNear(runtime, flowChild, 0.0, 0.0, 30.0, 10.0, "generated sequential cleanup flow child");
    expectGeneratedLayoutGetterNear(runtime, absoluteChild, 0.0, 10.0, 20.0, 8.0, "generated sequential cleanup former absolute child");

    disposeMaterializedObject(runtime, absoluteChild.object);
    disposeMaterializedObject(runtime, flowChild.object);
    disposeMaterializedObject(runtime, parent.object);
}

void assertGeneratedMaterializedSequentialLayoutFieldAlignment(jsi::Runtime& runtime)
{
    auto parent = materializeYogaNode(runtime);
    auto flowChild = materializeYogaNode(runtime);
    auto absoluteChild = materializeYogaNode(runtime);

    callGeneratedInsertChild(
        runtime,
        parent.object,
        flowChild.object,
        "generated field-alignment parent.insertChild(flowChild) must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        absoluteChild.object,
        "generated field-alignment parent.insertChild(absoluteChild) must return undefined");
    expect(parent.node->_children.size() == 2, "generated field-alignment layout tree must attach two native children");

    callGeneratedSetStyle(
        runtime,
        parent,
        makeSequentialFieldAlignmentParentStyle(runtime),
        "generated field-alignment parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        flowChild,
        makeSequentialFieldAlignmentInitialFlowChildStyle(runtime),
        "generated field-alignment initial flow child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialFieldAlignmentInitialAbsoluteChildStyle(runtime),
        "generated field-alignment initial absolute child setStyle must return undefined");

    expectOptionalStyleString(flowChild.node->_style.marginLeft, "auto", "generated field-alignment initial flow child marginLeft auto optional");
    expectOptionalStyleString(flowChild.node->_style.marginRight, "5%", "generated field-alignment initial flow child marginRight percent optional");
    expectOptionalStyleString(absoluteChild.node->_style.start, "3%", "generated field-alignment initial absolute child start percent optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.end, 7.0, "generated field-alignment initial absolute child end optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.top, 4.0, "generated field-alignment initial absolute child top optional");
    expect(!absoluteChild.node->_style.inset.has_value(), "generated field-alignment initial absolute child starts without inset optional");

    expectYGValueAuto(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeLeft), "generated field-alignment initial flow child Yoga marginLeft auto getter");
    expectYGValuePercent(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeRight), 5.0, "generated field-alignment initial flow child Yoga marginRight percent getter");
    expectYGValuePercent(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeStart), 3.0, "generated field-alignment initial absolute child Yoga start percent getter");
    expectYGValuePoint(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeEnd), 7.0, "generated field-alignment initial absolute child Yoga end getter");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, parent, 0.0, 0.0, 100.0, 50.0, "generated field-alignment initial parent");

    callGeneratedSetStyle(
        runtime,
        flowChild,
        makeSequentialFieldAlignmentUpdatedFlowChildStyle(runtime),
        "generated field-alignment updated flow child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialFieldAlignmentUpdatedAbsoluteChildStyle(runtime),
        "generated field-alignment updated absolute child setStyle must return undefined");
    expect(!parent.node->_hasLayoutBeenComputed, "generated field-alignment update must invalidate previously computed parent layout");

    expectOptionalStyleString(flowChild.node->_style.marginLeft, "12%", "generated field-alignment updated flow child marginLeft percent optional");
    expectOptionalStyleString(flowChild.node->_style.marginRight, "auto", "generated field-alignment updated flow child marginRight auto optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.start, 5.0, "generated field-alignment updated absolute child start optional");
    expectOptionalStyleString(absoluteChild.node->_style.end, "9%", "generated field-alignment updated absolute child end percent optional");
    expect(!absoluteChild.node->_style.inset.has_value(), "generated field-alignment updated absolute child still has no inset optional");

    expectYGValuePercent(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeLeft), 12.0, "generated field-alignment updated flow child Yoga marginLeft percent getter");
    expectYGValueAuto(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeRight), "generated field-alignment updated flow child Yoga marginRight auto getter");
    expectYGValuePoint(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeStart), 5.0, "generated field-alignment updated absolute child Yoga start getter");
    expectYGValuePercent(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeEnd), 9.0, "generated field-alignment updated absolute child Yoga end percent getter");

    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, parent, 0.0, 0.0, 100.0, 50.0, "generated field-alignment updated parent");

    callGeneratedSetStyle(
        runtime,
        flowChild,
        makeSequentialFieldAlignmentCleanupFlowChildStyle(runtime),
        "generated field-alignment cleanup flow child setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialFieldAlignmentInsetAbsoluteChildStyle(runtime),
        "generated field-alignment inset absolute child setStyle must return undefined");
    expect(!parent.node->_hasLayoutBeenComputed, "generated field-alignment inset update must invalidate previously computed parent layout");

    expect(!flowChild.node->_style.marginLeft.has_value(), "generated field-alignment cleanup flow child clears marginLeft optional");
    expect(!flowChild.node->_style.marginRight.has_value(), "generated field-alignment cleanup flow child clears marginRight optional");
    expect(!absoluteChild.node->_style.start.has_value(), "generated field-alignment inset absolute child clears start optional");
    expect(!absoluteChild.node->_style.end.has_value(), "generated field-alignment inset absolute child clears end optional");
    expectOptionalStyleNumber(absoluteChild.node->_style.inset, 3.0, "generated field-alignment inset absolute child inset optional");

    auto defaultNode = YGNodeNew();
    expectYGValueSame(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeLeft), YGNodeStyleGetMargin(defaultNode, YGEdgeLeft), "generated field-alignment cleanup flow child Yoga marginLeft resets to default");
    expectYGValueSame(YGNodeStyleGetMargin(flowChild.node->_node, YGEdgeRight), YGNodeStyleGetMargin(defaultNode, YGEdgeRight), "generated field-alignment cleanup flow child Yoga marginRight resets to default");
    expectYGValuePoint(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeAll), 3.0, "generated field-alignment inset absolute child Yoga inset getter");

    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, absoluteChild, 3.0, 3.0, 10.0, 8.0, "generated field-alignment inset absolute child");

    callGeneratedSetStyle(
        runtime,
        absoluteChild,
        makeSequentialFieldAlignmentCleanupAbsoluteChildStyle(runtime),
        "generated field-alignment cleanup absolute child setStyle must return undefined");
    expect(!absoluteChild.node->_style.position.has_value(), "generated field-alignment cleanup absolute child clears position optional");
    expect(!absoluteChild.node->_style.inset.has_value(), "generated field-alignment cleanup absolute child clears inset optional");
    expectYGValueSame(YGNodeStyleGetPosition(absoluteChild.node->_node, YGEdgeAll), YGNodeStyleGetPosition(defaultNode, YGEdgeAll), "generated field-alignment cleanup absolute child Yoga inset resets to default");
    YGNodeFree(defaultNode);

    callComputeLayout(runtime, parent.object, computeLayout);
    expectGeneratedLayoutGetterNear(runtime, parent, 0.0, 0.0, 100.0, 50.0, "generated field-alignment cleanup parent");

    disposeMaterializedObject(runtime, absoluteChild.object);
    disposeMaterializedObject(runtime, flowChild.object);
    disposeMaterializedObject(runtime, parent.object);
}

void assertGeneratedLineSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    expectObjectFunction(runtime, materialized.object, "setCommand");
    auto setCommand = materialized.object.getPropertyAsFunction(runtime, "setCommand");
    auto command = makeLineCommand(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setCommand,
        command,
        "generated setCommand(line) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::LINE, "generated setCommand(line) must install LineCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(line) must install native command");
    auto* lineCmd = dynamic_cast<LineCmd*>(materialized.node->_command.get());
    expect(lineCmd != nullptr, "generated setCommand(line) must install a real LineCmd");
    expectNear(lineCmd->basePoint1().x(), 1.0, "generated setCommand(line) must keep nested from.x");
    expectNear(lineCmd->basePoint1().y(), 2.0, "generated setCommand(line) must keep nested from.y");
    expectNear(lineCmd->basePoint2().x(), 11.0, "generated setCommand(line) must keep nested to.x");
    expectNear(lineCmd->basePoint2().y(), 22.0, "generated setCommand(line) must keep nested to.y");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedPointsSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    expectObjectFunction(runtime, materialized.object, "setCommand");
    auto setCommand = materialized.object.getPropertyAsFunction(runtime, "setCommand");
    auto command = makePointsCommand(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setCommand,
        command,
        "generated setCommand(points) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::POINTS, "generated setCommand(points) must install PointsCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(points) must install native command");
    auto* pointsCmd = dynamic_cast<PointsCmd*>(materialized.node->_command.get());
    expect(pointsCmd != nullptr, "generated setCommand(points) must install a real PointsCmd");
    expect(pointsCmd->props.mode == SkCanvas::PointMode::kLines_PointMode, "generated setCommand(points) must keep pointMode");
    const auto& basePoints = pointsCmd->basePoints();
    expect(basePoints.size() == 2, "generated setCommand(points) must keep array payload size");
    expectNear(basePoints[0].x(), 3.0, "generated setCommand(points) must keep points[0].x");
    expectNear(basePoints[0].y(), 4.0, "generated setCommand(points) must keep points[0].y");
    expectNear(basePoints[1].x(), 13.0, "generated setCommand(points) must keep points[1].x");
    expectNear(basePoints[1].y(), 14.0, "generated setCommand(points) must keep points[1].y");
    disposeMaterializedObject(runtime, materialized.object);
}

void expectGeneratedSetCommandRejects(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    jsi::Object command,
    const std::string& expectedMessage,
    const char* message)
{
    expectObjectFunction(runtime, materialized.object, "setCommand");
    auto setCommand = materialized.object.getPropertyAsFunction(runtime, "setCommand");
    expectThrows(
        [&]() {
            jsi::Value args[] = {jsi::Value(runtime, command)};
            setCommand.callWithThis(
                runtime,
                materialized.object,
                static_cast<const jsi::Value*>(args),
                static_cast<size_t>(1));
        },
        expectedMessage,
        message);
}

void expectGeneratedLineCommandState(
    const MaterializedYogaNode& materialized,
    double fromX,
    double fromY,
    double toX,
    double toY,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::LINE, std::string(label) + " preserves LineCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* lineCmd = dynamic_cast<LineCmd*>(materialized.node->_command.get());
    expect(lineCmd != nullptr, std::string(label) + " preserves LineCmd type");
    expectNear(lineCmd->basePoint1().x(), fromX, std::string(label) + " from.x");
    expectNear(lineCmd->basePoint1().y(), fromY, std::string(label) + " from.y");
    expectNear(lineCmd->basePoint2().x(), toX, std::string(label) + " to.x");
    expectNear(lineCmd->basePoint2().y(), toY, std::string(label) + " to.y");
}

void expectGeneratedPointsCommandState(
    const MaterializedYogaNode& materialized,
    const std::vector<::SkPoint>& expectedPoints,
    SkCanvas::PointMode expectedMode,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::POINTS, std::string(label) + " preserves PointsCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* pointsCmd = dynamic_cast<PointsCmd*>(materialized.node->_command.get());
    expect(pointsCmd != nullptr, std::string(label) + " preserves PointsCmd type");
    expect(pointsCmd->props.mode == expectedMode, std::string(label) + " pointMode");
    const auto& basePoints = pointsCmd->basePoints();
    expect(basePoints.size() == expectedPoints.size(), std::string(label) + " points size");
    for (size_t index = 0; index < expectedPoints.size(); ++index) {
        expectNear(basePoints[index].x(), expectedPoints[index].x(), std::string(label) + " points[" + std::to_string(index) + "].x");
        expectNear(basePoints[index].y(), expectedPoints[index].y(), std::string(label) + " points[" + std::to_string(index) + "].y");
    }
}

void assertGeneratedCommandPointNativeFloatRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();
    const double nativeFloatOverflow = std::numeric_limits<double>::max();

    auto lineMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        lineMaterialized,
        makeLineCommand(runtime),
        "generated command point native-float baseline line setCommand must return undefined");
    const auto* initialLineCommand = lineMaterialized.node->_command.get();
    expectGeneratedLineCommandState(lineMaterialized, 1.0, 2.0, 11.0, 22.0, "generated line native-float rejection baseline");

    struct LineInvalidCase {
        const char* label;
        double fromX;
        double fromY;
        double toX;
        double toY;
        const char* propertyPath;
    };

    const std::array<LineInvalidCase, 8> lineInvalidCases {{
        { "generated line.from.x NaN", nan, 5.0, 21.0, 6.0, "line.from.x" },
        { "generated line.from.y Infinity", 2.0, positiveInfValue, 21.0, 6.0, "line.from.y" },
        { "generated line.to.x -Infinity", 2.0, 5.0, negativeInfValue, 6.0, "line.to.x" },
        { "generated line.to.y NaN", 2.0, 5.0, 21.0, nan, "line.to.y" },
        { "generated line.from.x native-float overflow", nativeFloatOverflow, 5.0, 21.0, 6.0, "line.from.x" },
        { "generated line.from.y native-float overflow", 2.0, -nativeFloatOverflow, 21.0, 6.0, "line.from.y" },
        { "generated line.to.x native-float overflow", 2.0, 5.0, nativeFloatOverflow, 6.0, "line.to.x" },
        { "generated line.to.y native-float overflow", 2.0, 5.0, 21.0, -nativeFloatOverflow, "line.to.y" },
    }};

    for (const auto& invalidCase : lineInvalidCases) {
        expectGeneratedSetCommandRejects(
            runtime,
            lineMaterialized,
            makeLineCommand(
                runtime,
                invalidCase.fromX,
                invalidCase.fromY,
                invalidCase.toX,
                invalidCase.toY),
            std::string("Invalid numeric command point value for ") + invalidCase.propertyPath + ": expected a finite native float.",
            invalidCase.label);
        expect(lineMaterialized.node->_command.get() == initialLineCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectGeneratedLineCommandState(lineMaterialized, 1.0, 2.0, 11.0, 22.0, invalidCase.label);
    }
    disposeMaterializedObject(runtime, lineMaterialized.object);

    auto pointsMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        pointsMaterialized,
        makePointsCommand(runtime),
        "generated command point native-float baseline points setCommand must return undefined");
    const auto* initialPointsCommand = pointsMaterialized.node->_command.get();
    const std::vector<::SkPoint> baselinePoints {
        ::SkPoint::Make(3.0f, 4.0f),
        ::SkPoint::Make(13.0f, 14.0f),
    };
    expectGeneratedPointsCommandState(pointsMaterialized, baselinePoints, SkCanvas::PointMode::kLines_PointMode, "generated points native-float rejection baseline");

    struct PointsInvalidCase {
        const char* label;
        double firstX;
        double firstY;
        double secondX;
        double secondY;
        const char* propertyPath;
    };

    const std::array<PointsInvalidCase, 8> pointsInvalidCases {{
        { "generated points.points[0].x NaN", nan, 4.0, 13.0, 14.0, "points.points[0].x" },
        { "generated points.points[0].y Infinity", 3.0, positiveInfValue, 13.0, 14.0, "points.points[0].y" },
        { "generated points.points[1].x -Infinity", 3.0, 4.0, negativeInfValue, 14.0, "points.points[1].x" },
        { "generated points.points[1].y NaN", 3.0, 4.0, 13.0, nan, "points.points[1].y" },
        { "generated points.points[0].x native-float overflow", nativeFloatOverflow, 4.0, 13.0, 14.0, "points.points[0].x" },
        { "generated points.points[0].y native-float overflow", 3.0, -nativeFloatOverflow, 13.0, 14.0, "points.points[0].y" },
        { "generated points.points[1].x native-float overflow", 3.0, 4.0, nativeFloatOverflow, 14.0, "points.points[1].x" },
        { "generated points.points[1].y native-float overflow", 3.0, 4.0, 13.0, -nativeFloatOverflow, "points.points[1].y" },
    }};

    for (const auto& invalidCase : pointsInvalidCases) {
        expectGeneratedSetCommandRejects(
            runtime,
            pointsMaterialized,
            makePointsCommand(
                runtime,
                invalidCase.firstX,
                invalidCase.firstY,
                invalidCase.secondX,
                invalidCase.secondY),
            std::string("Invalid numeric command point value for ") + invalidCase.propertyPath + ": expected a finite native float.",
            invalidCase.label);
        expect(pointsMaterialized.node->_command.get() == initialPointsCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectGeneratedPointsCommandState(pointsMaterialized, baselinePoints, SkCanvas::PointMode::kLines_PointMode, invalidCase.label);
    }
    disposeMaterializedObject(runtime, pointsMaterialized.object);
}

std::string invalidStaticAnimatedDoubleCommandMessage(const char* propertyPath)
{
    return std::string("Invalid numeric AnimatedDouble command value for ") + propertyPath + ": expected a finite native float.";
}

void expectGeneratedCircleCommandState(
    const MaterializedYogaNode& materialized,
    double expectedRadius,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::CIRCLE, std::string(label) + " preserves CircleCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* circleCmd = dynamic_cast<CircleCmd*>(materialized.node->_command.get());
    expect(circleCmd != nullptr, std::string(label) + " preserves CircleCmd type");
    expect(!circleCmd->isDynamic(), std::string(label) + " preserves static CircleCmd behavior");
    drawCommandToResolveRenderTimeState(*materialized.node);
    expect(circleCmd->hasExplicitRadius(), std::string(label) + " preserves explicit radius flag");
    expectNear(circleCmd->props.r, expectedRadius, std::string(label) + " radius");
}

void expectGeneratedRRectCommandState(
    const MaterializedYogaNode& materialized,
    double expectedRadius,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::RRECT, std::string(label) + " preserves RRectCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* rrectCmd = dynamic_cast<RRectCmd*>(materialized.node->_command.get());
    expect(rrectCmd != nullptr, std::string(label) + " preserves RRectCmd type");
    expect(!rrectCmd->isDynamic(), std::string(label) + " preserves static RRectCmd behavior");
    drawCommandToResolveRenderTimeState(*materialized.node);
    expect(rrectCmd->props.r.has_value(), std::string(label) + " preserves radius optional");
    expectNear(rrectCmd->props.r->rX, expectedRadius, std::string(label) + " radius x");
    expectNear(rrectCmd->props.r->rY, expectedRadius, std::string(label) + " radius y");
}

void expectGeneratedBlurMaskFilterCommandState(
    const MaterializedYogaNode& materialized,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::BLUR_MASK_FILTER, std::string(label) + " preserves BlurMaskFilterCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* blurCmd = dynamic_cast<BlurMaskFilterCmd*>(materialized.node->_command.get());
    expect(blurCmd != nullptr, std::string(label) + " preserves BlurMaskFilterCmd type");
    expect(!blurCmd->isDynamic(), std::string(label) + " preserves static BlurMaskFilterCmd behavior");

    auto surface = makeSurface(16, 16);
    RNSkia::DrawingCtx ctx(surface->getCanvas());
    blurCmd->draw(&ctx);
    expect(ctx.getPaint().refMaskFilter() != nullptr, std::string(label) + " preserves mask-filter draw side effect");
}

void expectGeneratedPathTrimCommandState(
    const MaterializedYogaNode& materialized,
    double expectedTrimStart,
    double expectedTrimEnd,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::PATH, std::string(label) + " preserves PathCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* pathCmd = dynamic_cast<PathCmd*>(materialized.node->_command.get());
    expect(pathCmd != nullptr, std::string(label) + " preserves PathCmd type");
    expect(!pathCmd->isDynamic(), std::string(label) + " preserves static PathCmd behavior");
    drawCommandToResolveRenderTimeState(*materialized.node);
    expectNear(pathCmd->props.start, expectedTrimStart, std::string(label) + " trimStart");
    expectNear(pathCmd->props.end, expectedTrimEnd, std::string(label) + " trimEnd");
}

std::string invalidStrokeCommandMessage(const char* propertyPath)
{
    return std::string("Invalid numeric stroke value for ") + propertyPath + ": expected a finite native float.";
}

std::string invalidNumericEnumMessage(const char* propertyPath, const char* validValues)
{
    return std::string("Invalid numeric enum value for ") + propertyPath +
        ": expected a finite integer in " + validValues + ".";
}

void expectGeneratedPathFillTypeCommandState(
    const MaterializedYogaNode& materialized,
    SkPathFillType expectedFillType,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::PATH, std::string(label) + " preserves PathCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* pathCmd = dynamic_cast<PathCmd*>(materialized.node->_command.get());
    expect(pathCmd != nullptr, std::string(label) + " preserves PathCmd type");
    expect(!pathCmd->isDynamic(), std::string(label) + " preserves static PathCmd behavior");
    expect(pathCmd->props.fillType.has_value(), std::string(label) + " preserves fillType optional");
    expect(pathCmd->props.fillType.value() == expectedFillType, std::string(label) + " fillType");
}

void expectGeneratedPathStrokeCommandState(
    const MaterializedYogaNode& materialized,
    double expectedWidth,
    double expectedMiterLimit,
    double expectedPrecision,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::PATH, std::string(label) + " preserves PathCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* pathCmd = dynamic_cast<PathCmd*>(materialized.node->_command.get());
    expect(pathCmd != nullptr, std::string(label) + " preserves PathCmd type");
    expect(!pathCmd->isDynamic(), std::string(label) + " preserves static PathCmd behavior");
    expect(pathCmd->props.stroke.has_value(), std::string(label) + " preserves stroke optional");
    const auto& stroke = pathCmd->props.stroke.value();
    const auto widthLabel = std::string(label) + " stroke.width";
    const auto miterLabel = std::string(label) + " stroke.miter_limit";
    const auto precisionLabel = std::string(label) + " stroke.precision";
    expectOptionalFloatNear(stroke.width, expectedWidth, widthLabel.c_str());
    expectOptionalFloatNear(stroke.miter_limit, expectedMiterLimit, miterLabel.c_str());
    expectOptionalFloatNear(stroke.precision, expectedPrecision, precisionLabel.c_str());
    expect(
        stroke.join.has_value() && stroke.join.value() == SkPaint::Join::kMiter_Join,
        std::string(label) + " stroke.join");
    expect(
        stroke.cap.has_value() && stroke.cap.value() == SkPaint::Cap::kSquare_Cap,
        std::string(label) + " stroke.cap");
}

void assertGeneratedStaticAnimatedDoubleCommandFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();
    const double nativeFloatOverflow = std::numeric_limits<double>::max();

    auto circleMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        circleMaterialized,
        makeCircleCommand(runtime),
        "generated circle finite rejection baseline setCommand must return undefined");
    applyGeneratedSizeAndComputeLayout(runtime, circleMaterialized, 24.0, 20.0);
    const auto* initialCircleCommand = circleMaterialized.node->_command.get();
    expectGeneratedCircleCommandState(circleMaterialized, 5.5, "generated circle.radius finite rejection baseline");
    expectGeneratedSetCommandRejects(
        runtime,
        circleMaterialized,
        makeCircleCommand(runtime, nan),
        invalidStaticAnimatedDoubleCommandMessage("circle.radius"),
        "generated circle.radius NaN");
    expect(circleMaterialized.node->_command.get() == initialCircleCommand, "generated circle.radius NaN preserves command pointer");
    expectGeneratedCircleCommandState(circleMaterialized, 5.5, "generated circle.radius NaN");
    expectGeneratedSetCommandRejects(
        runtime,
        circleMaterialized,
        makeCircleCommand(runtime, nativeFloatOverflow),
        invalidStaticAnimatedDoubleCommandMessage("circle.radius"),
        "generated circle.radius native-float overflow");
    expect(circleMaterialized.node->_command.get() == initialCircleCommand, "generated circle.radius native-float overflow preserves command pointer");
    expectGeneratedCircleCommandState(circleMaterialized, 5.5, "generated circle.radius native-float overflow");
    disposeMaterializedObject(runtime, circleMaterialized.object);

    auto rrectMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        rrectMaterialized,
        makeRRectCommand(runtime),
        "generated rrect finite rejection baseline setCommand must return undefined");
    applyGeneratedSizeAndComputeLayout(runtime, rrectMaterialized, 30.0, 18.0);
    const auto* initialRRectCommand = rrectMaterialized.node->_command.get();
    expectGeneratedRRectCommandState(rrectMaterialized, 6.0, "generated rrect.cornerRadius finite rejection baseline");
    expectGeneratedSetCommandRejects(
        runtime,
        rrectMaterialized,
        makeRRectCommand(runtime, positiveInfValue),
        invalidStaticAnimatedDoubleCommandMessage("rrect.cornerRadius"),
        "generated rrect.cornerRadius Infinity");
    expect(rrectMaterialized.node->_command.get() == initialRRectCommand, "generated rrect.cornerRadius Infinity preserves command pointer");
    expectGeneratedRRectCommandState(rrectMaterialized, 6.0, "generated rrect.cornerRadius Infinity");
    expectGeneratedSetCommandRejects(
        runtime,
        rrectMaterialized,
        makeRRectCommand(runtime, nativeFloatOverflow),
        invalidStaticAnimatedDoubleCommandMessage("rrect.cornerRadius"),
        "generated rrect.cornerRadius native-float overflow");
    expect(rrectMaterialized.node->_command.get() == initialRRectCommand, "generated rrect.cornerRadius native-float overflow preserves command pointer");
    expectGeneratedRRectCommandState(rrectMaterialized, 6.0, "generated rrect.cornerRadius native-float overflow");
    disposeMaterializedObject(runtime, rrectMaterialized.object);

    auto blurMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        blurMaterialized,
        makeBlurMaskFilterCommand(runtime),
        "generated blurMaskFilter finite rejection baseline setCommand must return undefined");
    const auto* initialBlurCommand = blurMaterialized.node->_command.get();
    expectGeneratedBlurMaskFilterCommandState(blurMaterialized, "generated blurMaskFilter.blur finite rejection baseline");
    expectGeneratedSetCommandRejects(
        runtime,
        blurMaterialized,
        makeBlurMaskFilterCommand(runtime, negativeInfValue),
        invalidStaticAnimatedDoubleCommandMessage("blurMaskFilter.blur"),
        "generated blurMaskFilter.blur -Infinity");
    expect(blurMaterialized.node->_command.get() == initialBlurCommand, "generated blurMaskFilter.blur -Infinity preserves command pointer");
    expectGeneratedBlurMaskFilterCommandState(blurMaterialized, "generated blurMaskFilter.blur -Infinity");
    expectGeneratedSetCommandRejects(
        runtime,
        blurMaterialized,
        makeBlurMaskFilterCommand(runtime, nativeFloatOverflow),
        invalidStaticAnimatedDoubleCommandMessage("blurMaskFilter.blur"),
        "generated blurMaskFilter.blur native-float overflow");
    expect(blurMaterialized.node->_command.get() == initialBlurCommand, "generated blurMaskFilter.blur native-float overflow preserves command pointer");
    expectGeneratedBlurMaskFilterCommandState(blurMaterialized, "generated blurMaskFilter.blur native-float overflow");
    disposeMaterializedObject(runtime, blurMaterialized.object);

    auto pathMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        pathMaterialized,
        makePathTrimCommand(runtime, 0.25, 0.75),
        "generated path finite rejection baseline setCommand must return undefined");
    applyGeneratedSizeAndComputeLayout(runtime, pathMaterialized, 20.0, 12.0);
    const auto* initialPathCommand = pathMaterialized.node->_command.get();
    expectGeneratedPathTrimCommandState(pathMaterialized, 0.25, 0.75, "generated path trim finite rejection baseline");
    expectGeneratedSetCommandRejects(
        runtime,
        pathMaterialized,
        makePathTrimCommand(runtime, nan, 0.75),
        invalidStaticAnimatedDoubleCommandMessage("path.trimStart"),
        "generated path.trimStart NaN");
    expect(pathMaterialized.node->_command.get() == initialPathCommand, "generated path.trimStart NaN preserves command pointer");
    expectGeneratedPathTrimCommandState(pathMaterialized, 0.25, 0.75, "generated path.trimStart NaN");
    expectGeneratedSetCommandRejects(
        runtime,
        pathMaterialized,
        makePathTrimCommand(runtime, nativeFloatOverflow, 0.75),
        invalidStaticAnimatedDoubleCommandMessage("path.trimStart"),
        "generated path.trimStart native-float overflow");
    expect(pathMaterialized.node->_command.get() == initialPathCommand, "generated path.trimStart native-float overflow preserves command pointer");
    expectGeneratedPathTrimCommandState(pathMaterialized, 0.25, 0.75, "generated path.trimStart native-float overflow");
    expectGeneratedSetCommandRejects(
        runtime,
        pathMaterialized,
        makePathTrimCommand(runtime, 0.25, positiveInfValue),
        invalidStaticAnimatedDoubleCommandMessage("path.trimEnd"),
        "generated path.trimEnd Infinity");
    expect(pathMaterialized.node->_command.get() == initialPathCommand, "generated path.trimEnd Infinity preserves command pointer");
    expectGeneratedPathTrimCommandState(pathMaterialized, 0.25, 0.75, "generated path.trimEnd Infinity");
    expectGeneratedSetCommandRejects(
        runtime,
        pathMaterialized,
        makePathTrimCommand(runtime, 0.25, nativeFloatOverflow),
        invalidStaticAnimatedDoubleCommandMessage("path.trimEnd"),
        "generated path.trimEnd native-float overflow");
    expect(pathMaterialized.node->_command.get() == initialPathCommand, "generated path.trimEnd native-float overflow preserves command pointer");
    expectGeneratedPathTrimCommandState(pathMaterialized, 0.25, 0.75, "generated path.trimEnd native-float overflow");
    disposeMaterializedObject(runtime, pathMaterialized.object);
}

void assertGeneratedPathStrokeNumericFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();
    const double nativeFloatOverflow = std::numeric_limits<double>::max();

    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makePublicPathStrokeCommand(runtime),
        "generated path stroke finite rejection baseline setCommand must return undefined");
    const auto* initialCommand = materialized.node->_command.get();
    expectGeneratedPathStrokeCommandState(materialized, 4.0, 7.0, 1.25, "generated path stroke finite rejection baseline");

    struct InvalidCase {
        const char* label;
        double width;
        const char* miterKey;
        double miterValue;
        double precision;
        const char* propertyPath;
    };

    const std::array<InvalidCase, 16> invalidCases {{
        { "generated path.stroke.width NaN", nan, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "generated path.stroke.width Infinity", positiveInfValue, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "generated path.stroke.width -Infinity", negativeInfValue, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "generated path.stroke.width native-float overflow", nativeFloatOverflow, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "generated path.stroke.miter_limit NaN", 4.0, "miter_limit", nan, 1.25, "path.stroke.miter_limit" },
        { "generated path.stroke.miter_limit Infinity", 4.0, "miter_limit", positiveInfValue, 1.25, "path.stroke.miter_limit" },
        { "generated path.stroke.miter_limit -Infinity", 4.0, "miter_limit", negativeInfValue, 1.25, "path.stroke.miter_limit" },
        { "generated path.stroke.miter_limit native-float overflow", 4.0, "miter_limit", -nativeFloatOverflow, 1.25, "path.stroke.miter_limit" },
        { "generated path.stroke.miterLimit NaN", 4.0, "miterLimit", nan, 1.25, "path.stroke.miterLimit" },
        { "generated path.stroke.miterLimit Infinity", 4.0, "miterLimit", positiveInfValue, 1.25, "path.stroke.miterLimit" },
        { "generated path.stroke.miterLimit -Infinity", 4.0, "miterLimit", negativeInfValue, 1.25, "path.stroke.miterLimit" },
        { "generated path.stroke.miterLimit native-float overflow", 4.0, "miterLimit", nativeFloatOverflow, 1.25, "path.stroke.miterLimit" },
        { "generated path.stroke.precision NaN", 4.0, "miter_limit", 7.0, nan, "path.stroke.precision" },
        { "generated path.stroke.precision Infinity", 4.0, "miter_limit", 7.0, positiveInfValue, "path.stroke.precision" },
        { "generated path.stroke.precision -Infinity", 4.0, "miter_limit", 7.0, negativeInfValue, "path.stroke.precision" },
        { "generated path.stroke.precision native-float overflow", 4.0, "miter_limit", 7.0, -nativeFloatOverflow, "path.stroke.precision" },
    }};

    for (const auto& invalidCase : invalidCases) {
        expectGeneratedSetCommandRejects(
            runtime,
            materialized,
            makePathStrokeCommand(
                runtime,
                invalidCase.width,
                invalidCase.miterKey,
                invalidCase.miterValue,
                invalidCase.precision),
            invalidStrokeCommandMessage(invalidCase.propertyPath),
            invalidCase.label);
        expect(materialized.node->_command.get() == initialCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectGeneratedPathStrokeCommandState(materialized, 4.0, 7.0, 1.25, invalidCase.label);
    }

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedCommandNumericEnumRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();

    struct InvalidNumericEnumCase {
        const char* labelSuffix;
        double value;
    };

    const std::array<InvalidNumericEnumCase, 3> invalidCases {{
        { "NaN", nan },
        { "fractional", 1.5 },
        { "out-of-range", 99.0 },
    }};

    {
        auto materialized = materializeYogaNode(runtime);
        callGeneratedSetCommand(
            runtime,
            materialized,
            makeBlurMaskFilterCommand(runtime),
            "generated blurMaskFilter numeric enum baseline setCommand must return undefined");
        const auto* initialCommand = materialized.node->_command.get();
        expectGeneratedBlurMaskFilterCommandState(materialized, "generated blurMaskFilter.blurStyle numeric enum rejection baseline");

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("generated blurMaskFilter.blurStyle ") + invalidCase.labelSuffix;
            expectGeneratedSetCommandRejects(
                runtime,
                materialized,
                makeBlurMaskFilterCommandWithNumericBlurStyle(runtime, invalidCase.value),
                invalidNumericEnumMessage("blurMaskFilter.blurStyle", "[0, 1, 2, 3]"),
                label.c_str());
            expect(materialized.node->_command.get() == initialCommand, label + " preserves command pointer");
            expectGeneratedBlurMaskFilterCommandState(materialized, label.c_str());
        }

        disposeMaterializedObject(runtime, materialized.object);
    }

    {
        auto materialized = materializeYogaNode(runtime);
        callGeneratedSetCommand(
            runtime,
            materialized,
            makePointsCommand(runtime),
            "generated points numeric enum baseline setCommand must return undefined");
        const auto* initialCommand = materialized.node->_command.get();
        const std::vector<::SkPoint> baselinePoints {
            ::SkPoint::Make(3.0f, 4.0f),
            ::SkPoint::Make(13.0f, 14.0f),
        };
        expectGeneratedPointsCommandState(materialized, baselinePoints, SkCanvas::PointMode::kLines_PointMode, "generated points.pointMode numeric enum rejection baseline");

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("generated points.pointMode ") + invalidCase.labelSuffix;
            expectGeneratedSetCommandRejects(
                runtime,
                materialized,
                makePointsCommandWithNumericPointMode(runtime, invalidCase.value),
                invalidNumericEnumMessage("points.pointMode", "[0, 1, 2]"),
                label.c_str());
            expect(materialized.node->_command.get() == initialCommand, label + " preserves command pointer");
            expectGeneratedPointsCommandState(materialized, baselinePoints, SkCanvas::PointMode::kLines_PointMode, label.c_str());
        }

        disposeMaterializedObject(runtime, materialized.object);
    }

    {
        auto materialized = materializeYogaNode(runtime);
        callGeneratedSetCommand(
            runtime,
            materialized,
            makePathTrimCommandWithStringFillType(runtime, "winding", 0.25, 0.75),
            "generated path fillType numeric enum baseline setCommand must return undefined");
        const auto* initialCommand = materialized.node->_command.get();
        expectGeneratedPathFillTypeCommandState(materialized, SkPathFillType::kWinding, "generated path.fillType numeric enum rejection baseline");

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("generated path.fillType ") + invalidCase.labelSuffix;
            expectGeneratedSetCommandRejects(
                runtime,
                materialized,
                makePathTrimCommandWithNumericFillType(runtime, invalidCase.value),
                invalidNumericEnumMessage("path.fillType", "[0, 1, 2, 3]"),
                label.c_str());
            expect(materialized.node->_command.get() == initialCommand, label + " preserves command pointer");
            expectGeneratedPathFillTypeCommandState(materialized, SkPathFillType::kWinding, label.c_str());
        }

        disposeMaterializedObject(runtime, materialized.object);
    }

    {
        auto materialized = materializeYogaNode(runtime);
        callGeneratedSetCommand(
            runtime,
            materialized,
            makePublicPathStrokeCommand(runtime),
            "generated path stroke numeric enum baseline setCommand must return undefined");
        const auto* initialCommand = materialized.node->_command.get();
        expectGeneratedPathStrokeCommandState(materialized, 4.0, 7.0, 1.25, "generated path.stroke numeric enum rejection baseline");
        const auto validJoin = static_cast<double>(static_cast<int>(SkPaint::Join::kMiter_Join));
        const auto validCap = static_cast<double>(static_cast<int>(SkPaint::Cap::kSquare_Cap));

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("generated path.stroke.join ") + invalidCase.labelSuffix;
            expectGeneratedSetCommandRejects(
                runtime,
                materialized,
                makePathStrokeCommandWithNumericEnums(runtime, invalidCase.value, validCap),
                invalidNumericEnumMessage("path.stroke.join", "[0, 1, 2]"),
                label.c_str());
            expect(materialized.node->_command.get() == initialCommand, label + " preserves command pointer");
            expectGeneratedPathStrokeCommandState(materialized, 4.0, 7.0, 1.25, label.c_str());
        }

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("generated path.stroke.cap ") + invalidCase.labelSuffix;
            expectGeneratedSetCommandRejects(
                runtime,
                materialized,
                makePathStrokeCommandWithNumericEnums(runtime, validJoin, invalidCase.value),
                invalidNumericEnumMessage("path.stroke.cap", "[0, 1, 2]"),
                label.c_str());
            expect(materialized.node->_command.get() == initialCommand, label + " preserves command pointer");
            expectGeneratedPathStrokeCommandState(materialized, 4.0, 7.0, 1.25, label.c_str());
        }

        disposeMaterializedObject(runtime, materialized.object);
    }
}

void assertGeneratedPublicPathStrokeSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    expectObjectFunction(runtime, materialized.object, "setCommand");
    auto setCommand = materialized.object.getPropertyAsFunction(runtime, "setCommand");
    auto command = makePublicPathStrokeCommand(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setCommand,
        command,
        "generated setCommand(path public stroke) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::PATH, "generated setCommand(path) must install PathCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(path) must install native command");
    auto* pathCmd = dynamic_cast<PathCmd*>(materialized.node->_command.get());
    expect(pathCmd != nullptr, "generated setCommand(path) must install a real PathCmd");
    expect(pathCmd->props.stroke.has_value(), "generated setCommand(path) must keep public stroke payload");
    const auto& stroke = pathCmd->props.stroke.value();
    expectOptionalFloatNear(stroke.width, 4.0, "generated setCommand(path) must keep stroke.width");
    expectOptionalFloatNear(stroke.miter_limit, 7.0, "generated setCommand(path) must keep stroke.miter_limit");
    expectOptionalFloatNear(stroke.precision, 1.25, "generated setCommand(path) must keep stroke.precision");
    expect(
        stroke.join.has_value() && stroke.join.value() == SkPaint::Join::kMiter_Join,
        "generated setCommand(path) must keep stroke.join");
    expect(
        stroke.cap.has_value() && stroke.cap.value() == SkPaint::Cap::kSquare_Cap,
        "generated setCommand(path) must keep stroke.cap");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedTextSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeTextCommand(runtime),
        "generated setCommand(text) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::TEXT, "generated setCommand(text) must install TextCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(text) must install native command");
    auto* textCmd = dynamic_cast<TextCmd*>(materialized.node->_command.get());
    expect(textCmd != nullptr, "generated setCommand(text) must install a real TextCmd");
    expect(textCmd->props.text == "Materialized Text", "generated setCommand(text) must keep text payload");
    expect(textCmd->props.font.has_value(), "generated setCommand(text) must install a font");
    expectNear(textCmd->props.font->getSize(), 19.0, "generated setCommand(text) must apply textStyle fontSize");
    expect(textCmd->fallbackPaintColor().has_value(), "generated setCommand(text) must expose textStyle fallback paint color");
    expectColor(*textCmd->fallbackPaintColor(), SK_ColorRED, "generated setCommand(text) must parse rgba CSS color string");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedParagraphSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeParagraphCommand(runtime),
        "generated setCommand(paragraph) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::PARAGRAPH, "generated setCommand(paragraph) must install ParagraphCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(paragraph) must install native command");
    auto* paragraphCmd = dynamic_cast<ParagraphCmd*>(materialized.node->_command.get());
    expect(paragraphCmd != nullptr, "generated setCommand(paragraph) must install a real ParagraphCmd");
    expect(YGNodeHasMeasureFunc(materialized.node->_node), "generated setCommand(paragraph) must install a Yoga measure function");
    expect(paragraphCmd->props.paragraph != nullptr, "generated setCommand(paragraph) must build a paragraph from text and nested paragraphStyle.textStyle CSS color");

    auto measured = ParagraphCmd::measureFunc(
        materialized.node->_node,
        96.0f,
        YGMeasureModeAtMost,
        YGUndefined,
        YGMeasureModeUndefined);
    expect(measured.width > 0.0f, "generated setCommand(paragraph) measure width must be positive");
    expect(measured.width <= 96.0f, "generated setCommand(paragraph) measure width must be bounded by the available width");
    expect(measured.height > 0.0f, "generated setCommand(paragraph) measure height must be positive");
    expect(measured.height < 160.0f, "generated setCommand(paragraph) measure height must remain bounded");
    disposeMaterializedObject(runtime, materialized.object);
}

std::string invalidTextParagraphStyleNumericMessage(const char* propertyPath)
{
    return std::string("Invalid numeric text/paragraph style value for ") + propertyPath + ": expected a finite number within native range.";
}

void expectGeneratedTextCommandState(
    const MaterializedYogaNode& materialized,
    const std::string& expectedText,
    double expectedFontSize,
    SkColor expectedColor,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::TEXT, std::string(label) + " preserves TextCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* textCmd = dynamic_cast<TextCmd*>(materialized.node->_command.get());
    expect(textCmd != nullptr, std::string(label) + " preserves TextCmd type");
    expect(textCmd->props.text == expectedText, std::string(label) + " text payload");
    expect(textCmd->props.font.has_value(), std::string(label) + " font optional");
    expectNear(textCmd->props.font->getSize(), expectedFontSize, std::string(label) + " font size");
    expect(textCmd->fallbackPaintColor().has_value(), std::string(label) + " fallback color optional");
    expectColor(*textCmd->fallbackPaintColor(), expectedColor, (std::string(label) + " fallback color").c_str());
}

void expectGeneratedParagraphCommandState(
    const MaterializedYogaNode& materialized,
    const std::shared_ptr<RNSkia::JsiSkParagraph>& expectedParagraph,
    const char* label)
{
    expect(materialized.node->_commandKind == YogaNodeCommandKind::PARAGRAPH, std::string(label) + " preserves ParagraphCmd kind");
    expect(materialized.node->_command != nullptr, std::string(label) + " preserves native command");
    auto* paragraphCmd = dynamic_cast<ParagraphCmd*>(materialized.node->_command.get());
    expect(paragraphCmd != nullptr, std::string(label) + " preserves ParagraphCmd type");
    expect(YGNodeHasMeasureFunc(materialized.node->_node), std::string(label) + " preserves ParagraphCmd measure function");
    expect(paragraphCmd->props.paragraph == expectedParagraph, std::string(label) + " paragraph object");
    auto measured = ParagraphCmd::measureFunc(
        materialized.node->_node,
        96.0f,
        YGMeasureModeAtMost,
        YGUndefined,
        YGMeasureModeUndefined);
    expect(measured.width > 0.0f, std::string(label) + " measure width stays positive");
    expect(measured.height > 0.0f, std::string(label) + " measure height stays positive");
}

void assertGeneratedTextParagraphStyleNumericFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();
    const double floatOverflow = std::numeric_limits<double>::max();
    const double intOverflow = static_cast<double>(std::numeric_limits<int>::max()) * 2.0;

    auto textMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        textMaterialized,
        makeTextCommand(runtime),
        "generated text style finite rejection baseline setCommand must return undefined");
    const auto* initialTextCommand = textMaterialized.node->_command.get();
    expectGeneratedTextCommandState(textMaterialized, "Materialized Text", 19.0, SK_ColorRED, "generated text style finite rejection baseline");

    struct TextInvalidCase {
        const char* label;
        double fontSize;
    };

    const std::array<TextInvalidCase, 4> textInvalidCases {{
        { "generated text.textStyle.fontSize NaN", nan },
        { "generated text.textStyle.fontSize Infinity", positiveInfValue },
        { "generated text.textStyle.fontSize -Infinity", negativeInfValue },
        { "generated text.textStyle.fontSize float overflow", floatOverflow },
    }};

    for (const auto& invalidCase : textInvalidCases) {
        expectGeneratedSetCommandRejects(
            runtime,
            textMaterialized,
            makeTextCommandWithTextStyleFontSize(runtime, invalidCase.fontSize),
            invalidTextParagraphStyleNumericMessage("TextStyle.fontSize"),
            invalidCase.label);
        expect(textMaterialized.node->_command.get() == initialTextCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectGeneratedTextCommandState(textMaterialized, "Materialized Text", 19.0, SK_ColorRED, invalidCase.label);
    }
    disposeMaterializedObject(runtime, textMaterialized.object);

    auto paragraphMaterialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        paragraphMaterialized,
        makeParagraphCommand(runtime),
        "generated paragraph style finite rejection baseline setCommand must return undefined");
    const auto* initialParagraphCommand = paragraphMaterialized.node->_command.get();
    auto* paragraphCmd = dynamic_cast<ParagraphCmd*>(paragraphMaterialized.node->_command.get());
    expect(paragraphCmd != nullptr, "generated paragraph style finite rejection baseline command type");
    auto initialParagraph = paragraphCmd->props.paragraph;
    expect(initialParagraph != nullptr, "generated paragraph style finite rejection baseline paragraph object");
    expectGeneratedParagraphCommandState(paragraphMaterialized, initialParagraph, "generated paragraph style finite rejection baseline");

    struct ParagraphInvalidCase {
        const char* label;
        jsi::Object (*makeStyle)(jsi::Runtime&, double);
        double value;
        const char* propertyPath;
    };

    const std::array<ParagraphInvalidCase, 11> paragraphInvalidCases {{
        { "generated paragraph.paragraphStyle.fontSize Infinity", makeParagraphStyleWithFlattenedFontSize, positiveInfValue, "ParagraphStyle.fontSize" },
        { "generated paragraph.paragraphStyle.fontSize float overflow", makeParagraphStyleWithFlattenedFontSize, floatOverflow, "ParagraphStyle.fontSize" },
        { "generated paragraph.paragraphStyle.textStyle.fontSize NaN", makeParagraphStyleWithNestedFontSize, nan, "ParagraphStyle.textStyle.fontSize" },
        { "generated paragraph.paragraphStyle.textStyle.fontSize -Infinity", makeParagraphStyleWithNestedFontSize, negativeInfValue, "ParagraphStyle.textStyle.fontSize" },
        { "generated paragraph.paragraphStyle.maxLines NaN", makeParagraphStyleWithMaxLines, nan, "ParagraphStyle.maxLines" },
        { "generated paragraph.paragraphStyle.maxLines -Infinity", makeParagraphStyleWithMaxLines, negativeInfValue, "ParagraphStyle.maxLines" },
        { "generated paragraph.paragraphStyle.maxLines fractional", makeParagraphStyleWithMaxLines, 1.5, "ParagraphStyle.maxLines" },
        { "generated paragraph.paragraphStyle.strutStyle.leading -Infinity", makeParagraphStyleWithStrutLeading, negativeInfValue, "ParagraphStyle.strutStyle.leading" },
        { "generated paragraph.paragraphStyle.strutStyle.leading float overflow", makeParagraphStyleWithStrutLeading, floatOverflow, "ParagraphStyle.strutStyle.leading" },
        { "generated paragraph.paragraphStyle.fontFeatures[0].value fractional", makeParagraphStyleWithFontFeatureValue, 1.5, "ParagraphStyle.fontFeatures[0].value" },
        { "generated paragraph.paragraphStyle.fontFeatures[0].value int overflow", makeParagraphStyleWithFontFeatureValue, intOverflow, "ParagraphStyle.fontFeatures[0].value" },
    }};

    for (const auto& invalidCase : paragraphInvalidCases) {
        expectGeneratedSetCommandRejects(
            runtime,
            paragraphMaterialized,
            makeParagraphCommandWithStyle(runtime, invalidCase.makeStyle(runtime, invalidCase.value)),
            invalidTextParagraphStyleNumericMessage(invalidCase.propertyPath),
            invalidCase.label);
        expect(paragraphMaterialized.node->_command.get() == initialParagraphCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectGeneratedParagraphCommandState(paragraphMaterialized, initialParagraph, invalidCase.label);
    }
    disposeMaterializedObject(runtime, paragraphMaterialized.object);
}

void assertGeneratedCircleSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeCircleCommand(runtime),
        "generated setCommand(circle) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::CIRCLE, "generated setCommand(circle) must install CircleCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(circle) must install native command");
    auto* circleCmd = dynamic_cast<CircleCmd*>(materialized.node->_command.get());
    expect(circleCmd != nullptr, "generated setCommand(circle) must install a real CircleCmd");
    expect(!circleCmd->isDynamic(), "generated setCommand(circle) static radius must not mark the command dynamic");

    applyGeneratedSizeAndComputeLayout(runtime, materialized, 24.0, 20.0);
    drawCommandToResolveRenderTimeState(*materialized.node);
    expect(circleCmd->props.c.has_value(), "generated setCommand(circle) layout must set center");
    expectNear(circleCmd->props.c->x(), 12.0, "generated setCommand(circle) center x");
    expectNear(circleCmd->props.c->y(), 10.0, "generated setCommand(circle) center y");
    expectNear(circleCmd->props.r, 5.5, "generated setCommand(circle) must apply radius payload");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedRRectSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeRRectCommand(runtime),
        "generated setCommand(rrect) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::RRECT, "generated setCommand(rrect) must install RRectCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(rrect) must install native command");
    auto* rrectCmd = dynamic_cast<RRectCmd*>(materialized.node->_command.get());
    expect(rrectCmd != nullptr, "generated setCommand(rrect) must install a real RRectCmd");
    expect(!rrectCmd->isDynamic(), "generated setCommand(rrect) static cornerRadius must not mark the command dynamic");

    applyGeneratedSizeAndComputeLayout(runtime, materialized, 30.0, 18.0);
    drawCommandToResolveRenderTimeState(*materialized.node);
    expect(rrectCmd->props.r.has_value(), "generated setCommand(rrect) must apply cornerRadius payload");
    expectNear(rrectCmd->props.r->rX, 6.0, "generated setCommand(rrect) radius x");
    expectNear(rrectCmd->props.r->rY, 6.0, "generated setCommand(rrect) radius y");
    expect(rrectCmd->props.rect.has_value(), "generated setCommand(rrect) must resolve layout rect");
    expectSkRectNear(rrectCmd->props.rect->rect(), 0.0, 0.0, 30.0, 18.0, "generated setCommand(rrect) layout rect");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedBlurMaskFilterSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeBlurMaskFilterCommand(runtime),
        "generated setCommand(blurMaskFilter) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::BLUR_MASK_FILTER, "generated setCommand(blurMaskFilter) must install BlurMaskFilterCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(blurMaskFilter) must install native command");
    auto* blurCmd = dynamic_cast<BlurMaskFilterCmd*>(materialized.node->_command.get());
    expect(blurCmd != nullptr, "generated setCommand(blurMaskFilter) must install a real BlurMaskFilterCmd");
    expect(!blurCmd->isDynamic(), "generated setCommand(blurMaskFilter) static blur must not mark the command dynamic");

    auto surface = makeSurface(16, 16);
    RNSkia::DrawingCtx ctx(surface->getCanvas());
    blurCmd->draw(&ctx);
    expect(ctx.getPaint().refMaskFilter() != nullptr, "generated setCommand(blurMaskFilter) must apply a mask filter from blur payload");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedRectSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeEmptyCommand(runtime, "rect"),
        "generated setCommand(rect) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::RECT, "generated setCommand(rect) must install RectCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(rect) must install native command");
    auto* rectCmd = dynamic_cast<RectCmd*>(materialized.node->_command.get());
    expect(rectCmd != nullptr, "generated setCommand(rect) must install a real RectCmd");

    applyGeneratedSizeAndComputeLayout(runtime, materialized, 21.0, 13.0);
    expect(rectCmd->props.rect.has_value(), "generated setCommand(rect) must resolve layout rect");
    expectSkRectNear(*rectCmd->props.rect, 0.0, 0.0, 21.0, 13.0, "generated setCommand(rect) layout rect");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedOvalSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeEmptyCommand(runtime, "oval"),
        "generated setCommand(oval) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::OVAL, "generated setCommand(oval) must install OvalCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(oval) must install native command");
    auto* ovalCmd = dynamic_cast<OvalCmd*>(materialized.node->_command.get());
    expect(ovalCmd != nullptr, "generated setCommand(oval) must install a real OvalCmd");

    applyGeneratedSizeAndComputeLayout(runtime, materialized, 22.0, 12.0);
    expect(ovalCmd->props.rect.has_value(), "generated setCommand(oval) must resolve layout rect");
    expectSkRectNear(*ovalCmd->props.rect, 0.0, 0.0, 22.0, 12.0, "generated setCommand(oval) layout rect");
    expect(ovalCmd->containsLocalPoint(::SkPoint::Make(11.0f, 6.0f)), "generated setCommand(oval) precise hit state must include center");
    expect(!ovalCmd->containsLocalPoint(::SkPoint::Make(0.0f, 0.0f)), "generated setCommand(oval) precise hit state must exclude corner");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedImageSetCommand(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetCommand(
        runtime,
        materialized,
        makeImageCommand(runtime),
        "generated setCommand(image) must return undefined");

    expect(materialized.node->_commandKind == YogaNodeCommandKind::IMAGE, "generated setCommand(image) must install ImageCmd kind");
    expect(materialized.node->_command != nullptr, "generated setCommand(image) must install native command");
    auto* imageCmd = dynamic_cast<ImageCmd*>(materialized.node->_command.get());
    expect(imageCmd != nullptr, "generated setCommand(image) must install a real ImageCmd");
    expect(imageCmd->props.image.has_value(), "generated setCommand(image) must keep synthetic JsiSkImage host-object payload");
    expect(imageCmd->props.image.value() != nullptr, "generated setCommand(image) synthetic image must be non-null");
    expect(imageCmd->props.image.value()->width() == 4, "generated setCommand(image) synthetic image width");
    expect(imageCmd->props.image.value()->height() == 2, "generated setCommand(image) synthetic image height");
    expect(imageCmd->props.fit == "cover", "generated setCommand(image) must keep image fit payload");

    applyGeneratedSizeAndComputeLayout(runtime, materialized, 32.0, 20.0);
    expect(imageCmd->props.rect.has_value(), "generated setCommand(image) must resolve layout draw rect");
    expectSkRectNear(*imageCmd->props.rect, 0.0, 0.0, 32.0, 20.0, "generated setCommand(image) layout rect");
    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedCssBackgroundColorStringValidation(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto validStyle = makeCssBackgroundColorStyle(runtime, "#123456");
    callGeneratedSetStyle(
        runtime,
        materialized,
        validStyle,
        "generated setStyle(CSS-string backgroundColor plus paint fields) must return undefined");

    expect(materialized.node->_style.backgroundColor.has_value(), "generated CSS backgroundColor style must populate backgroundColor optional");
    const auto& backgroundColor = materialized.node->_style.backgroundColor.value();
    expect(std::holds_alternative<std::string>(backgroundColor), "generated CSS backgroundColor style must materialize as a string");
    expect(
        std::get<std::string>(backgroundColor) == "#123456",
        "generated CSS backgroundColor style must preserve source string in native style");
    expectColorRgb(materialized.node->_paint.getColor(), SkColorSetARGB(255, 18, 52, 86), "generated CSS backgroundColor style must parse CSS string rgb into _paint");
    expectNear(materialized.node->_paint.getStrokeWidth(), 3.5, "generated CSS backgroundColor style paint stroke width before invalid rejection");
    expect(materialized.node->_paint.getStrokeCap() == SkPaint::Cap::kSquare_Cap, "generated CSS backgroundColor style paint cap before invalid rejection");
    expect(materialized.node->_paint.getStrokeJoin() == SkPaint::Join::kRound_Join, "generated CSS backgroundColor style paint join before invalid rejection");
    expectNear(materialized.node->_paint.getStrokeMiter(), 8.25, "generated CSS backgroundColor style paint miter before invalid rejection");
    expect(materialized.node->_paint.isDither(), "generated CSS backgroundColor style paint dither before invalid rejection");
    expect(materialized.node->_paint.isAntiAlias(), "generated CSS backgroundColor style paint antiAlias before invalid rejection");
    expectNear(materialized.node->_paint.getAlphaf(), 0.4, "generated CSS backgroundColor style paint alpha before invalid rejection");

    auto invalidStyle = makeBackgroundColorOnlyStyle(runtime, "not-a-css-color");
    expectThrows(
        [&]() {
            callGeneratedSetStyle(
                runtime,
                materialized,
                invalidStyle,
                "generated setStyle(invalid CSS-string backgroundColor) must throw before returning");
        },
        "Invalid CSS color string for backgroundColor: \"not-a-css-color\"",
        "generated setStyle(invalid CSS-string backgroundColor) must reject deterministically");

    expect(materialized.node->_style.backgroundColor.has_value(), "invalid CSS backgroundColor rejection must preserve previous backgroundColor optional");
    const auto& preservedBackgroundColor = materialized.node->_style.backgroundColor.value();
    expect(std::holds_alternative<std::string>(preservedBackgroundColor), "invalid CSS backgroundColor rejection must preserve previous string variant");
    expect(
        std::get<std::string>(preservedBackgroundColor) == "#123456",
        "invalid CSS backgroundColor rejection must preserve previous backgroundColor string");
    expectColorRgb(materialized.node->_paint.getColor(), SkColorSetARGB(255, 18, 52, 86), "invalid CSS backgroundColor rejection must preserve _paint rgb");
    expectNear(materialized.node->_paint.getStrokeWidth(), 3.5, "invalid CSS backgroundColor rejection must preserve _paint stroke width");
    expect(materialized.node->_paint.getStrokeCap() == SkPaint::Cap::kSquare_Cap, "invalid CSS backgroundColor rejection must preserve _paint cap");
    expect(materialized.node->_paint.getStrokeJoin() == SkPaint::Join::kRound_Join, "invalid CSS backgroundColor rejection must preserve _paint join");
    expectNear(materialized.node->_paint.getStrokeMiter(), 8.25, "invalid CSS backgroundColor rejection must preserve _paint miter");
    expect(materialized.node->_paint.isDither(), "invalid CSS backgroundColor rejection must preserve _paint dither");
    expect(materialized.node->_paint.isAntiAlias(), "invalid CSS backgroundColor rejection must preserve _paint antiAlias");
    expectNear(materialized.node->_paint.getAlphaf(), 0.4, "invalid CSS backgroundColor rejection must preserve _paint alpha");

    disposeMaterializedObject(runtime, materialized.object);
}

void expectFiniteNumericValidationBaselinePreserved(const MaterializedYogaNode& materialized)
{
    const auto& node = *materialized.node;
    expect(node._style.backgroundColor.has_value(), "non-finite numeric rejection must preserve previous backgroundColor optional");
    const auto& backgroundColor = node._style.backgroundColor.value();
    expect(std::holds_alternative<std::string>(backgroundColor), "non-finite numeric rejection must preserve previous backgroundColor string variant");
    expect(
        std::get<std::string>(backgroundColor) == "#123456",
        "non-finite numeric rejection must preserve previous backgroundColor string");
    expectOptionalDoubleNear(node._style.borderWidth, 3.5, "non-finite numeric rejection must preserve previous borderWidth optional");
    expectOptionalDoubleNear(node._style.strokeMiter, 8.25, "non-finite numeric rejection must preserve previous strokeMiter optional");
    expectOptionalDoubleNear(node._style.opacity, 0.4, "non-finite numeric rejection must preserve previous opacity optional");
    expect(node._style.dither.has_value() && node._style.dither.value(), "non-finite numeric rejection must preserve previous dither optional");
    expect(node._style.antiAlias.has_value() && node._style.antiAlias.value(), "non-finite numeric rejection must preserve previous antiAlias optional");

    expectColorRgb(node._paint.getColor(), SkColorSetARGB(255, 18, 52, 86), "non-finite numeric rejection must preserve _paint rgb");
    expectNear(node._paint.getStrokeWidth(), 3.5, "non-finite numeric rejection must preserve _paint stroke width");
    expect(node._paint.getStrokeCap() == SkPaint::Cap::kSquare_Cap, "non-finite numeric rejection must preserve _paint cap");
    expect(node._paint.getStrokeJoin() == SkPaint::Join::kRound_Join, "non-finite numeric rejection must preserve _paint join");
    expectNear(node._paint.getStrokeMiter(), 8.25, "non-finite numeric rejection must preserve _paint miter");
    expect(node._paint.isDither(), "non-finite numeric rejection must preserve _paint dither");
    expect(node._paint.isAntiAlias(), "non-finite numeric rejection must preserve _paint antiAlias");
	expectNear(node._paint.getAlphaf(), 0.4, "non-finite numeric rejection must preserve _paint alpha");
	expectNear(YGNodeStyleGetBorder(node._node, YGEdgeAll), 3.5, "non-finite numeric rejection must preserve Yoga border state");

	expect(node._hasLayoutBeenComputed, "non-finite numeric rejection must preserve computed layout flag");
	expectNear(node._layout.width, 64.0, "non-finite numeric rejection must preserve native layout width");
	expectNear(node._layout.height, 48.0, "non-finite numeric rejection must preserve native layout height");
	expectOptionalStyleNumber(node._style.width, 64.0, "non-finite numeric rejection must preserve previous width optional");
	expectOptionalStyleNumber(node._style.height, 48.0, "non-finite numeric rejection must preserve previous height optional");
	expectOptionalDoubleNear(node._style.aspectRatio, 1.5, "non-finite numeric rejection must preserve previous aspectRatio optional");
	expectOptionalDoubleNear(node._style.flex, 0.25, "non-finite numeric rejection must preserve previous flex optional");
	expectOptionalDoubleNear(node._style.flexGrow, 1.25, "non-finite numeric rejection must preserve previous flexGrow optional");
	expectOptionalDoubleNear(node._style.flexShrink, 0.5, "non-finite numeric rejection must preserve previous flexShrink optional");
	expectOptionalStyleNumber(node._style.flexBasis, 20.0, "non-finite numeric rejection must preserve previous flexBasis optional");
	expectOptionalDoubleNear(node._style.gap, 7.0, "non-finite numeric rejection must preserve previous gap optional");
	expectOptionalDoubleNear(node._style.rowGap, 8.0, "non-finite numeric rejection must preserve previous rowGap optional");
	expectOptionalDoubleNear(node._style.columnGap, 9.0, "non-finite numeric rejection must preserve previous columnGap optional");
	expectOptionalStyleNumber(node._style.marginLeft, 5.0, "non-finite numeric rejection must preserve previous marginLeft optional");
	expectOptionalStyleNumber(node._style.paddingTop, 6.0, "non-finite numeric rejection must preserve previous paddingTop optional");
	expectOptionalStyleNumber(node._style.insetHorizontal, 3.0, "non-finite numeric rejection must preserve previous insetHorizontal optional");
	expectYGValuePoint(YGNodeStyleGetWidth(node._node), 64.0, "non-finite numeric rejection must preserve Yoga width state");
	expectYGValuePoint(YGNodeStyleGetHeight(node._node), 48.0, "non-finite numeric rejection must preserve Yoga height state");
	expectNear(YGNodeStyleGetAspectRatio(node._node), 1.5, "non-finite numeric rejection must preserve Yoga aspectRatio state");
	expectNear(YGNodeStyleGetFlex(node._node), 0.25, "non-finite numeric rejection must preserve Yoga flex state");
	expectNear(YGNodeStyleGetFlexGrow(node._node), 1.25, "non-finite numeric rejection must preserve Yoga flexGrow state");
	expectNear(YGNodeStyleGetFlexShrink(node._node), 0.5, "non-finite numeric rejection must preserve Yoga flexShrink state");
	expectYGValuePoint(YGNodeStyleGetFlexBasis(node._node), 20.0, "non-finite numeric rejection must preserve Yoga flexBasis state");
	expectYGValuePoint(YGNodeStyleGetGap(node._node, YGGutterAll), 7.0, "non-finite numeric rejection must preserve Yoga gap state");
	expectYGValuePoint(YGNodeStyleGetGap(node._node, YGGutterRow), 8.0, "non-finite numeric rejection must preserve Yoga rowGap state");
	expectYGValuePoint(YGNodeStyleGetGap(node._node, YGGutterColumn), 9.0, "non-finite numeric rejection must preserve Yoga columnGap state");
	expectYGValuePoint(YGNodeStyleGetMargin(node._node, YGEdgeLeft), 5.0, "non-finite numeric rejection must preserve Yoga marginLeft state");
	expectYGValuePoint(YGNodeStyleGetPadding(node._node, YGEdgeTop), 6.0, "non-finite numeric rejection must preserve Yoga paddingTop state");
	expectYGValuePoint(YGNodeStyleGetPosition(node._node, YGEdgeHorizontal), 3.0, "non-finite numeric rejection must preserve Yoga insetHorizontal state");

	expect(node._style.layer.has_value(), "non-finite numeric rejection must preserve previous layer optional");
	expect(node._layerPaint.has_value(), "non-finite numeric rejection must preserve YogaNode::_layerPaint");
	expectNear(node._style.layer->getAlphaf(), 0.25, "non-finite numeric rejection must preserve style layer alpha");
    expectNear(node._layerPaint->getAlphaf(), 0.25, "non-finite numeric rejection must preserve native layer alpha");
    expect(node._layerPaint->isAntiAlias(), "non-finite numeric rejection must preserve native layer antiAlias");
    auto layerBlendMode = node._layerPaint->asBlendMode();
    expect(layerBlendMode.has_value(), "non-finite numeric rejection must preserve native layer blend mode optional");
    expect(layerBlendMode.value() == SkBlendMode::kMultiply, "non-finite numeric rejection must preserve native layer blend mode");

    expect(node._style.clip.has_value(), "non-finite numeric rejection must preserve previous clip optional");
    expect(std::holds_alternative<SkRect>(*node._style.clip), "non-finite numeric rejection must preserve previous clip rect variant");
    expectSkRectNear(std::get<SkRect>(*node._style.clip), 10.0, 12.0, 30.0, 18.0, "non-finite numeric rejection must preserve style clip rect");
    expect(node._clipRect.has_value(), "non-finite numeric rejection must preserve native clip rect");
    expectSkRectNear(*node._clipRect, 10.0, 12.0, 30.0, 18.0, "non-finite numeric rejection must preserve YogaNode::_clipRect");
    expect(!node._clipPath.has_value(), "non-finite numeric rejection must preserve absent native clip path");
    expect(!node._clipRRect.has_value(), "non-finite numeric rejection must preserve absent native clip rrect");

    const auto expectedMatrix = makeSkMatrix9(finiteNumericValidationMatrixValues());
    expect(node._style.matrix.has_value(), "non-finite numeric rejection must preserve previous matrix optional");
    expect(
        std::holds_alternative<std::shared_ptr<SkMatrix>>(*node._style.matrix),
        "non-finite numeric rejection must preserve generated matrix shared pointer variant");
    const auto& styleMatrix = std::get<std::shared_ptr<SkMatrix>>(*node._style.matrix);
    expect(styleMatrix != nullptr, "non-finite numeric rejection must preserve style matrix pointer");
    expectSkMatrixNear(*styleMatrix, expectedMatrix, "non-finite numeric rejection must preserve style matrix");
    expect(node._matrix != nullptr, "non-finite numeric rejection must preserve YogaNode::_matrix");
    expectSkMatrixNear(*node._matrix, expectedMatrix, "non-finite numeric rejection must preserve native matrix");
}

void assertGeneratedFiniteNumericStyleValidation(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetStyle(
        runtime,
        materialized,
        makeFiniteNumericValidationBaselineStyle(runtime),
        "generated finite numeric validation baseline setStyle must return undefined");
    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, materialized.object, computeLayout);
    expectFiniteNumericValidationBaselinePreserved(materialized);

    struct FiniteNumericStyleCase {
        const char* propertyName;
        double value;
    };

    const double finitePositiveInf = std::numeric_limits<double>::infinity();
    const double finiteNegativeInf = -std::numeric_limits<double>::infinity();
    const double quietNaN = std::numeric_limits<double>::quiet_NaN();
    const FiniteNumericStyleCase invalidCases[] = {
        { "borderWidth", quietNaN },
        { "borderTopWidth", finitePositiveInf },
        { "borderBottomWidth", finiteNegativeInf },
        { "borderLeftWidth", finitePositiveInf },
        { "borderRightWidth", finiteNegativeInf },
        { "borderStartWidth", finitePositiveInf },
        { "borderEndWidth", finiteNegativeInf },
        { "borderHorizontalWidth", finitePositiveInf },
        { "borderVerticalWidth", finiteNegativeInf },
        { "strokeMiter", finitePositiveInf },
        { "opacity", finiteNegativeInf },

        { "aspectRatio", quietNaN },
        { "flex", finitePositiveInf },
        { "flexGrow", finiteNegativeInf },
        { "flexShrink", quietNaN },
        { "gap", finitePositiveInf },
        { "rowGap", finiteNegativeInf },
        { "columnGap", quietNaN },

        { "flexBasis", finitePositiveInf },
        { "width", finiteNegativeInf },
        { "height", quietNaN },
        { "minWidth", finitePositiveInf },
        { "minHeight", finiteNegativeInf },
        { "maxWidth", quietNaN },
        { "maxHeight", finitePositiveInf },
        { "top", finiteNegativeInf },
        { "right", quietNaN },
        { "bottom", finitePositiveInf },
        { "left", finiteNegativeInf },
        { "start", quietNaN },
        { "end", finitePositiveInf },
        { "margin", finiteNegativeInf },
        { "marginTop", quietNaN },
        { "marginBottom", finitePositiveInf },
        { "marginLeft", finiteNegativeInf },
        { "marginRight", quietNaN },
        { "marginStart", finitePositiveInf },
        { "marginEnd", finiteNegativeInf },
        { "marginHorizontal", quietNaN },
        { "marginVertical", finitePositiveInf },
        { "padding", finiteNegativeInf },
        { "paddingTop", quietNaN },
        { "paddingBottom", finitePositiveInf },
        { "paddingLeft", finiteNegativeInf },
        { "paddingRight", quietNaN },
        { "paddingStart", finitePositiveInf },
        { "paddingEnd", finiteNegativeInf },
        { "paddingHorizontal", quietNaN },
        { "paddingVertical", finitePositiveInf },
        { "inset", finiteNegativeInf },
        { "insetHorizontal", quietNaN },
        { "insetVertical", finitePositiveInf },
    };

    for (const auto& invalidCase : invalidCases) {
        const auto messageSubstring =
            std::string("Invalid numeric style value for ") +
            invalidCase.propertyName +
            ": expected a finite number.";
        expectThrows(
            [&]() {
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    makeSingleNumberStyle(runtime, invalidCase.propertyName, invalidCase.value),
                    std::string("generated setStyle(non-finite numeric ") + invalidCase.propertyName + ") must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject non-finite numeric ") + invalidCase.propertyName);
        expectFiniteNumericValidationBaselinePreserved(materialized);
    }

    disposeMaterializedObject(runtime, materialized.object);
}

void expectFiniteMatrixTransformValidationBaselinePreserved(const MaterializedYogaNode& materialized)
{
    expectFiniteNumericValidationBaselinePreserved(materialized);

    const auto& node = *materialized.node;
    expectOptionalDoubleNear(
        node._style.borderRadius,
        17.0,
        "non-finite matrix/transform rejection must preserve previous borderRadius optional");
    expect(node._clipsToBounds, "non-finite matrix/transform rejection must preserve clips-to-bounds radius state");
    expect(
        node._clipToBoundsRadii.has_value(),
        "non-finite matrix/transform rejection must preserve native clip-to-bounds radii");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kUpperLeft_Corner,
        17.0,
        17.0,
        "non-finite matrix/transform rejection must preserve upper-left radius");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kUpperRight_Corner,
        17.0,
        17.0,
        "non-finite matrix/transform rejection must preserve upper-right radius");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kLowerRight_Corner,
        17.0,
        17.0,
        "non-finite matrix/transform rejection must preserve lower-right radius");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kLowerLeft_Corner,
        17.0,
        17.0,
        "non-finite matrix/transform rejection must preserve lower-left radius");
    expect(!node._style.transform.has_value(), "non-finite matrix/transform rejection must preserve absent previous transform optional");
}

void assertGeneratedFiniteMatrixTransformStyleValidation(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetStyle(
        runtime,
        materialized,
        makeFiniteMatrixTransformValidationBaselineStyle(runtime),
        "generated matrix/transform finite validation baseline setStyle must return undefined");
    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, materialized.object, computeLayout);
    expectFiniteMatrixTransformValidationBaselinePreserved(materialized);

    const double finitePositiveInf = std::numeric_limits<double>::infinity();
    const double finiteNegativeInf = -std::numeric_limits<double>::infinity();
    const double quietNaN = std::numeric_limits<double>::quiet_NaN();

    struct MatrixArrayCase {
        const char* label;
        bool isMatrix16;
        size_t index;
        double value;
    };

    const MatrixArrayCase matrixArrayCases[] = {
        { "MatrixArray9 NaN", false, 0, quietNaN },
        { "MatrixArray9 Infinity", false, 4, finitePositiveInf },
        { "MatrixArray9 -Infinity", false, 8, finiteNegativeInf },
        { "MatrixArray16 NaN", true, 0, quietNaN },
        { "MatrixArray16 unused-entry Infinity", true, 2, finitePositiveInf },
        { "MatrixArray16 -Infinity", true, 15, finiteNegativeInf },
    };

    for (const auto& invalidCase : matrixArrayCases) {
        const auto messageSubstring =
            std::string("Invalid numeric style value for matrix[") +
            std::to_string(invalidCase.index) +
            "]: expected a finite number.";
        expectThrows(
            [&]() {
                const auto style = invalidCase.isMatrix16
                    ? makeMatrixArray16StyleWithValue(runtime, invalidCase.index, invalidCase.value)
                    : makeMatrixArray9StyleWithValue(runtime, invalidCase.index, invalidCase.value);
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    style,
                    std::string("generated setStyle(non-finite ") + invalidCase.label + ") must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject non-finite ") + invalidCase.label);
        expectFiniteMatrixTransformValidationBaselinePreserved(materialized);
    }

    const MatrixArrayCase matrixHostCases[] = {
        { "SkMatrix host NaN", false, 0, quietNaN },
        { "SkMatrix host Infinity", false, 4, finitePositiveInf },
        { "SkMatrix host -Infinity", false, 8, finiteNegativeInf },
    };

    for (const auto& invalidCase : matrixHostCases) {
        const auto messageSubstring =
            std::string("Invalid numeric style value for matrix[") +
            std::to_string(invalidCase.index) +
            "]: expected a finite number.";
        expectThrows(
            [&]() {
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    makeMatrixHostStyleWithValue(runtime, invalidCase.index, invalidCase.value),
                    std::string("generated setStyle(non-finite ") + invalidCase.label + ") must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject non-finite ") + invalidCase.label);
        expectFiniteMatrixTransformValidationBaselinePreserved(materialized);
    }

    const double invalidTransformValues[] = {
        quietNaN,
        finitePositiveInf,
        finiteNegativeInf,
    };
    size_t invalidTransformValueIndex = 0;
    for (const auto& transformCase : generatedTransformCases()) {
        const auto invalidValue =
            invalidTransformValues[
                invalidTransformValueIndex %
                (sizeof(invalidTransformValues) / sizeof(invalidTransformValues[0]))];
        ++invalidTransformValueIndex;
        const auto messageSubstring =
            std::string("Invalid numeric style value for transform.") +
            transformCase.key +
            ": expected a finite number.";
        expectThrows(
            [&]() {
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    makeSingleTransformStyle(runtime, transformCase.key, invalidValue),
                    std::string("generated setStyle(non-finite transform ") + transformCase.key + ") must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject non-finite transform ") + transformCase.key);
        expectFiniteMatrixTransformValidationBaselinePreserved(materialized);
    }

    disposeMaterializedObject(runtime, materialized.object);
}

void expectFiniteRadiusValidationBaselinePreserved(const MaterializedYogaNode& materialized)
{
    expectFiniteNumericValidationBaselinePreserved(materialized);

    const auto& node = *materialized.node;
    expect(node._style.overflow.has_value(), "non-finite radius rejection must preserve previous overflow optional");
    expect(node._style.overflow.value() == Overflow::HIDDEN, "non-finite radius rejection must preserve previous overflow enum");
    expect(YGNodeStyleGetOverflow(node._node) == YGOverflowHidden, "non-finite radius rejection must preserve Yoga overflow state");

    expectOptionalDoubleNear(
        node._style.borderRadius,
        17.0,
        "non-finite radius rejection must preserve previous borderRadius optional");
    expectStyleCornerPointRadius(
        node._style.borderTopLeftRadius,
        12.0,
        8.0,
        "non-finite radius rejection must preserve previous borderTopLeftRadius point");
    expectStyleCornerScalarRadius(
        node._style.borderTopRightRadius,
        4.0,
        "non-finite radius rejection must preserve previous borderTopRightRadius scalar");
    expectStyleCornerPointRadius(
        node._style.borderBottomRightRadius,
        10.0,
        14.0,
        "non-finite radius rejection must preserve previous borderBottomRightRadius point");
    expectStyleCornerScalarRadius(
        node._style.borderBottomLeftRadius,
        6.0,
        "non-finite radius rejection must preserve previous borderBottomLeftRadius scalar");

    expect(node._clipsToBounds, "non-finite radius rejection must preserve clips-to-bounds radius state");
    expect(
        node._clipToBoundsRadii.has_value(),
        "non-finite radius rejection must preserve native clip-to-bounds radii");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kUpperLeft_Corner,
        12.0,
        8.0,
        "non-finite radius rejection must preserve upper-left radius");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kUpperRight_Corner,
        4.0,
        4.0,
        "non-finite radius rejection must preserve upper-right radius");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kLowerRight_Corner,
        10.0,
        14.0,
        "non-finite radius rejection must preserve lower-right radius");
    expectCornerRadiiNear(
        *node._clipToBoundsRadii,
        SkRRect::kLowerLeft_Corner,
        6.0,
        6.0,
        "non-finite radius rejection must preserve lower-left radius");

    expect(
        node.pointPassesClipping(::SkPoint::Make(12.0f, 14.0f)),
        "non-finite radius rejection must preserve combined radius and explicit clip allow-state");
    expect(
        !node.pointPassesClipping(::SkPoint::Make(1.0f, 1.0f)),
        "non-finite radius rejection must preserve rounded-corner clipping");
    expect(
        !node.pointPassesClipping(::SkPoint::Make(5.0f, 5.0f)),
        "non-finite radius rejection must preserve explicit clip separation from radius clipping");
}

void assertGeneratedFiniteRadiusStyleValidation(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    callGeneratedSetStyle(
        runtime,
        materialized,
        makeFiniteRadiusValidationBaselineStyle(runtime),
        "generated radius finite validation baseline setStyle must return undefined");
    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, materialized.object, computeLayout);
    expectFiniteRadiusValidationBaselinePreserved(materialized);

    const double finitePositiveInf = std::numeric_limits<double>::infinity();
    const double finiteNegativeInf = -std::numeric_limits<double>::infinity();
    const double quietNaN = std::numeric_limits<double>::quiet_NaN();

    expectThrows(
        [&]() {
            callGeneratedSetStyle(
                runtime,
                materialized,
                makeSingleNumberStyle(runtime, "borderRadius", quietNaN),
                "generated setStyle(non-finite borderRadius) must not return");
        },
        "Invalid numeric style value for borderRadius: expected a finite number.",
        "generated setStyle must reject non-finite borderRadius");
    expectFiniteRadiusValidationBaselinePreserved(materialized);

    struct CornerScalarRadiusCase {
        const char* propertyName;
        double value;
    };

    const CornerScalarRadiusCase scalarCases[] = {
        { "borderTopLeftRadius", finitePositiveInf },
        { "borderTopRightRadius", finiteNegativeInf },
        { "borderBottomRightRadius", quietNaN },
        { "borderBottomLeftRadius", finitePositiveInf },
    };

    for (const auto& invalidCase : scalarCases) {
        const auto messageSubstring =
            std::string("Invalid numeric style value for ") +
            invalidCase.propertyName +
            ": expected a finite number.";
        expectThrows(
            [&]() {
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    makeSingleNumberStyle(runtime, invalidCase.propertyName, invalidCase.value),
                    std::string("generated setStyle(non-finite scalar ") + invalidCase.propertyName + ") must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject non-finite scalar ") + invalidCase.propertyName);
        expectFiniteRadiusValidationBaselinePreserved(materialized);
    }

    struct CornerPointRadiusCase {
        const char* propertyName;
        const char* axisName;
        double x;
        double y;
    };

    const CornerPointRadiusCase pointCases[] = {
        { "borderTopLeftRadius", "x", quietNaN, 8.0 },
        { "borderTopLeftRadius", "y", 12.0, finitePositiveInf },
        { "borderTopRightRadius", "x", finiteNegativeInf, 4.0 },
        { "borderTopRightRadius", "y", 4.0, quietNaN },
        { "borderBottomRightRadius", "x", finitePositiveInf, 14.0 },
        { "borderBottomRightRadius", "y", 10.0, finiteNegativeInf },
        { "borderBottomLeftRadius", "x", quietNaN, 6.0 },
        { "borderBottomLeftRadius", "y", 6.0, finitePositiveInf },
    };

    for (const auto& invalidCase : pointCases) {
        const auto invalidPropertyName =
            std::string(invalidCase.propertyName) + "." + invalidCase.axisName;
        const auto messageSubstring =
            std::string("Invalid numeric style value for ") +
            invalidPropertyName +
            ": expected a finite number.";
        expectThrows(
            [&]() {
                callGeneratedSetStyle(
                    runtime,
                    materialized,
                    makeSingleCornerPointRadiusStyle(runtime, invalidCase.propertyName, invalidCase.x, invalidCase.y),
                    std::string("generated setStyle(non-finite point ") + invalidPropertyName + ") must not return");
            },
            messageSubstring,
            std::string("generated setStyle must reject non-finite point ") + invalidPropertyName);
        expectFiniteRadiusValidationBaselinePreserved(materialized);
    }

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedPaintBackedStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makePaintBackedStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(SkPaint-backed backgroundColor plus paint fields) must return undefined");

    expect(materialized.node->_style.backgroundColor.has_value(), "generated paint style must populate backgroundColor optional");
    expect(materialized.node->_style.borderWidth.has_value(), "generated paint style must populate borderWidth optional");
    expect(materialized.node->_style.strokeCap.has_value(), "generated paint style must populate strokeCap optional");
    expect(materialized.node->_style.strokeJoin.has_value(), "generated paint style must populate strokeJoin optional");
    expect(materialized.node->_style.strokeMiter.has_value(), "generated paint style must populate strokeMiter optional");
    expect(materialized.node->_style.dither.has_value(), "generated paint style must populate dither optional");
    expect(materialized.node->_style.opacity.has_value(), "generated paint style must populate opacity optional");
    expect(materialized.node->_style.blendMode.has_value(), "generated paint style must populate blendMode optional");

    const auto& backgroundColor = materialized.node->_style.backgroundColor.value();
    expect(std::holds_alternative<SkPaint>(backgroundColor), "generated paint style backgroundColor must materialize as SkPaint");
    const auto& backgroundPaint = std::get<SkPaint>(backgroundColor);
    expect(backgroundPaint.isAntiAlias(), "generated paint style background SkPaint must keep base antiAlias");
    expectColorRgb(backgroundPaint.getColor(), SkColorSetARGB(255, 18, 52, 86), "generated paint style background SkPaint must keep base color");
    expectNear(backgroundPaint.getStrokeWidth(), 1.25, "generated paint style background SkPaint must keep base stroke width");
    expect(backgroundPaint.getStrokeCap() == SkPaint::Cap::kButt_Cap, "generated paint style background SkPaint must keep base stroke cap");
    expect(backgroundPaint.getStrokeJoin() == SkPaint::Join::kMiter_Join, "generated paint style background SkPaint must keep base stroke join");
    expectNear(backgroundPaint.getStrokeMiter(), 2.5, "generated paint style background SkPaint must keep base stroke miter");
    expect(!backgroundPaint.isDither(), "generated paint style background SkPaint must keep base dither");
    expectNear(backgroundPaint.getAlphaf(), 0.35, "generated paint style background SkPaint must keep base alpha");
    auto backgroundBlendMode = backgroundPaint.asBlendMode();
    expect(backgroundBlendMode.has_value(), "generated paint style background SkPaint must keep inspectable blend mode");
    expect(backgroundBlendMode.value() == SkBlendMode::kMultiply, "generated paint style background SkPaint must keep base blend mode");

    expectOptionalDoubleNear(materialized.node->_style.borderWidth, 7.25, "generated paint style borderWidth optional");
    expect(
        materialized.node->_style.strokeCap.value() == StrokeCap::ROUND,
        "generated paint style strokeCap optional");
    expect(
        materialized.node->_style.strokeJoin.value() == StrokeJoin::BEVEL,
        "generated paint style strokeJoin optional");
    expectOptionalDoubleNear(materialized.node->_style.strokeMiter, 11.5, "generated paint style strokeMiter optional");
    expect(materialized.node->_style.dither.value(), "generated paint style dither optional");
    expectOptionalDoubleNear(materialized.node->_style.opacity, 0.6, "generated paint style opacity optional");
    expect(
        materialized.node->_style.blendMode.value() == BlendMode::SCREEN,
        "generated paint style blendMode optional");

    expect(materialized.node->_paint.isAntiAlias(), "generated paint style _paint must start from SkPaint-backed backgroundColor base");
    expectColorRgb(materialized.node->_paint.getColor(), SkColorSetARGB(255, 18, 52, 86), "generated paint style _paint must keep backgroundColor base rgb");
    expectNear(materialized.node->_paint.getStrokeWidth(), 7.25, "generated paint style borderWidth must override _paint stroke width");
    expect(materialized.node->_paint.getStrokeCap() == SkPaint::Cap::kRound_Cap, "generated paint style strokeCap must override _paint cap");
    expect(materialized.node->_paint.getStrokeJoin() == SkPaint::Join::kBevel_Join, "generated paint style strokeJoin must override _paint join");
    expectNear(materialized.node->_paint.getStrokeMiter(), 11.5, "generated paint style strokeMiter must override _paint miter");
    expect(materialized.node->_paint.isDither(), "generated paint style dither must override _paint dither");
    expectNear(materialized.node->_paint.getAlphaf(), 0.6, "generated paint style opacity must override _paint alpha");
    auto paintBlendMode = materialized.node->_paint.asBlendMode();
    expect(paintBlendMode.has_value(), "generated paint style _paint must keep inspectable blend mode");
    expect(paintBlendMode.value() == SkBlendMode::kScreen, "generated paint style blendMode must override _paint blend mode");
    expectNear(YGNodeStyleGetBorder(materialized.node->_node, YGEdgeAll), 7.25, "generated paint style borderWidth must write Yoga border state");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedCornerRadiusStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    auto style = makeCornerRadiusStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(style corner radii) must return undefined");

    expectStyleCornerPointRadius(
        materialized.node->_style.borderTopLeftRadius,
        12.0,
        8.0,
        "generated style borderTopLeftRadius must materialize as SkPoint");
    expectStyleCornerScalarRadius(
        materialized.node->_style.borderTopRightRadius,
        4.0,
        "generated style borderTopRightRadius must materialize as scalar");
    expectStyleCornerPointRadius(
        materialized.node->_style.borderBottomRightRadius,
        10.0,
        14.0,
        "generated style borderBottomRightRadius must materialize as SkPoint");
    expectStyleCornerScalarRadius(
        materialized.node->_style.borderBottomLeftRadius,
        6.0,
        "generated style borderBottomLeftRadius must materialize as scalar");

    expect(materialized.node->_clipsToBounds, "generated style corner radii must enable YogaNode bounds clipping");
    expect(materialized.node->_clipToBoundsRadii.has_value(), "generated style corner radii must populate _clipToBoundsRadii");
    const auto& radii = *materialized.node->_clipToBoundsRadii;
    expectCornerRadiiNear(radii, SkRRect::kUpperLeft_Corner, 12.0, 8.0, "generated style upper-left clip radius");
    expectCornerRadiiNear(radii, SkRRect::kUpperRight_Corner, 4.0, 4.0, "generated style upper-right clip radius");
    expectCornerRadiiNear(radii, SkRRect::kLowerRight_Corner, 10.0, 14.0, "generated style lower-right clip radius");
    expectCornerRadiiNear(radii, SkRRect::kLowerLeft_Corner, 6.0, 6.0, "generated style lower-left clip radius");
    expect(!materialized.node->_style.clip.has_value(), "generated style corner radii must stay distinct from explicit style.clip");
    expect(!materialized.node->_clipPath.has_value(), "generated style corner radii must not populate _clipPath");
    expect(!materialized.node->_clipRect.has_value(), "generated style corner radii must not populate _clipRect");
    expect(!materialized.node->_clipRRect.has_value(), "generated style corner radii must not populate _clipRRect");

    callComputeLayout(runtime, materialized.object, computeLayout);
    expect(materialized.node->pointPassesClipping(::SkPoint::Make(12.0f, 8.0f)), "generated style corner radii must allow upper-left ellipse center");
    expect(!materialized.node->pointPassesClipping(::SkPoint::Make(1.0f, 1.0f)), "generated style corner radii must reject clipped upper-left corner");
    expect(materialized.node->pointPassesClipping(::SkPoint::Make(54.0f, 34.0f)), "generated style corner radii must allow lower-right ellipse center");
    expect(!materialized.node->pointPassesClipping(::SkPoint::Make(63.0f, 47.0f)), "generated style corner radii must reject clipped lower-right corner");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedGlobalBorderRadiusStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeGlobalBorderRadiusStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(global borderRadius) must return undefined");

    expectNativeStateWrapsOriginal(runtime, materialized.object, materialized.node);
    jsi::Value objectValue(runtime, materialized.object);
    auto cachedObjectValue = materialized.node->toObject(runtime);
    expect(
        jsi::Value::strictEquals(runtime, objectValue, cachedObjectValue),
        "generated setStyle(global borderRadius) must preserve cached materialized object identity");

    expectOptionalDoubleNear(
        materialized.node->_style.borderRadius,
        17.0,
        "generated global borderRadius style must populate scalar borderRadius optional");
    expect(!materialized.node->_style.borderTopLeftRadius.has_value(), "generated global borderRadius must not populate borderTopLeftRadius");
    expect(!materialized.node->_style.borderTopRightRadius.has_value(), "generated global borderRadius must not populate borderTopRightRadius");
    expect(!materialized.node->_style.borderBottomRightRadius.has_value(), "generated global borderRadius must not populate borderBottomRightRadius");
    expect(!materialized.node->_style.borderBottomLeftRadius.has_value(), "generated global borderRadius must not populate borderBottomLeftRadius");
    expect(materialized.node->_clipsToBounds, "generated global borderRadius must enable YogaNode bounds clipping");
    expect(materialized.node->_clipToBoundsRadii.has_value(), "generated global borderRadius must populate _clipToBoundsRadii");

    const auto& radii = *materialized.node->_clipToBoundsRadii;
    expectCornerRadiiNear(radii, SkRRect::kUpperLeft_Corner, 17.0, 17.0, "generated global borderRadius upper-left clip radius");
    expectCornerRadiiNear(radii, SkRRect::kUpperRight_Corner, 17.0, 17.0, "generated global borderRadius upper-right clip radius");
    expectCornerRadiiNear(radii, SkRRect::kLowerRight_Corner, 17.0, 17.0, "generated global borderRadius lower-right clip radius");
    expectCornerRadiiNear(radii, SkRRect::kLowerLeft_Corner, 17.0, 17.0, "generated global borderRadius lower-left clip radius");

    expect(!materialized.node->_style.clip.has_value(), "generated global borderRadius must leave explicit style.clip absent");
    expect(!materialized.node->_clipPath.has_value(), "generated global borderRadius must not populate _clipPath");
    expect(!materialized.node->_clipRect.has_value(), "generated global borderRadius must not populate _clipRect");
    expect(!materialized.node->_clipRRect.has_value(), "generated global borderRadius must not populate _clipRRect");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedClipRectStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeClipRectStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(clip rect) must return undefined");

    expect(materialized.node->_style.clip.has_value(), "generated clip rect style must populate clip optional");
    expect(std::holds_alternative<SkRect>(*materialized.node->_style.clip), "generated clip rect style must materialize NodeStyle clip as SkRect");
    expectSkRectNear(std::get<SkRect>(*materialized.node->_style.clip), 10.0, 12.0, 30.0, 18.0, "generated clip rect style optional");
    expect(materialized.node->_clipRect.has_value(), "generated clip rect style must update YogaNode::_clipRect");
    expectSkRectNear(*materialized.node->_clipRect, 10.0, 12.0, 30.0, 18.0, "generated clip rect native state");
    expect(!materialized.node->_clipPath.has_value(), "generated clip rect style must leave _clipPath empty");
    expect(!materialized.node->_clipRRect.has_value(), "generated clip rect style must leave _clipRRect empty");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedClipRRectStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeClipRRectStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(clip rrect) must return undefined");

    expect(materialized.node->_style.clip.has_value(), "generated clip rrect style must populate clip optional");
    expect(std::holds_alternative<SkRRect>(*materialized.node->_style.clip), "generated clip rrect style must materialize NodeStyle clip as SkRRect");
    expectSkRRectNear(std::get<SkRRect>(*materialized.node->_style.clip), 6.0, 8.0, 34.0, 22.0, 5.0, 7.0, "generated clip rrect style optional");
    expect(materialized.node->_clipRRect.has_value(), "generated clip rrect style must update YogaNode::_clipRRect");
    expectSkRRectNear(*materialized.node->_clipRRect, 6.0, 8.0, 34.0, 22.0, 5.0, 7.0, "generated clip rrect native state");
    expect(!materialized.node->_clipPath.has_value(), "generated clip rrect style must leave _clipPath empty");
    expect(!materialized.node->_clipRect.has_value(), "generated clip rrect style must leave _clipRect empty");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedClipPathStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeClipPathStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(clip path) must return undefined");

    expect(materialized.node->_style.clip.has_value(), "generated clip path style must populate clip optional");
    expect(std::holds_alternative<SkPath>(*materialized.node->_style.clip), "generated clip path style must materialize NodeStyle clip as SkPath");
    expect(std::get<SkPath>(*materialized.node->_style.clip).contains(24.0f, 26.0f), "generated clip path style optional must keep host-object circle path");
    expect(materialized.node->_clipPath.has_value(), "generated clip path style must update YogaNode::_clipPath");
    expect(materialized.node->_clipPath->contains(24.0f, 26.0f), "generated clip path native state must keep host-object circle path");
    expect(!materialized.node->_clipPath->contains(4.0f, 4.0f), "generated clip path native state must reject outside point");
    expect(!materialized.node->_clipRect.has_value(), "generated clip path style must leave _clipRect empty");
    expect(!materialized.node->_clipRRect.has_value(), "generated clip path style must leave _clipRRect empty");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedInvertClipStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeInvertedClipStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(invertClip) must return undefined");

    expect(materialized.node->_style.clip.has_value(), "generated invertClip style must populate clip optional");
    expect(materialized.node->_style.invertClip.has_value(), "generated invertClip style must populate invertClip optional");
    expect(materialized.node->_style.invertClip.value(), "generated invertClip style must keep true");
    expect(materialized.node->_clipRect.has_value(), "generated invertClip style must update YogaNode::_clipRect");
    expect(!materialized.node->pointPassesClipping(::SkPoint::Make(12.0f, 14.0f)), "generated invertClip style must invert inside explicit clip");
    expect(materialized.node->pointPassesClipping(::SkPoint::Make(2.0f, 2.0f)), "generated invertClip style must allow outside explicit clip");

    disposeMaterializedObject(runtime, materialized.object);
}

struct MaterializedClipRenderTree {
    MaterializedYogaNode parent;
    MaterializedYogaNode child;
};

MaterializedClipRenderTree makeMaterializedClipRenderTree(
    jsi::Runtime& runtime,
    jsi::Object parentStyle,
    const char* childColor)
{
    auto parent = materializeYogaNode(runtime);
    auto child = materializeYogaNode(runtime);

    callGeneratedSetCommand(
        runtime,
        parent,
        makeGroupCommand(runtime, false),
        "generated clip raster bridge parent setCommand(group) must return undefined");
    callGeneratedSetCommand(
        runtime,
        child,
        makeEmptyCommand(runtime, "rect"),
        "generated clip raster bridge child setCommand(rect) must return undefined");
    callGeneratedSetStyle(
        runtime,
        parent,
        parentStyle,
        "generated clip raster bridge parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        child,
        makeAbsoluteRectChildStyle(runtime, childColor),
        "generated clip raster bridge child setStyle must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        child.object,
        "generated clip raster bridge parent.insertChild(child) must return undefined");

    expect(parent.node->_children.size() == 1, "generated clip raster bridge must attach one native child");
    expect(parent.node->_children[0].get() == child.node.get(), "generated clip raster bridge must attach the expected native child");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);

    expectNear(parent.node->_layout.width, 100.0, "generated clip raster bridge parent layout width");
    expectNear(parent.node->_layout.height, 100.0, "generated clip raster bridge parent layout height");
    expectNear(child.node->_layout.width, 100.0, "generated clip raster bridge child layout width");
    expectNear(child.node->_layout.height, 100.0, "generated clip raster bridge child layout height");

    expect(parent.node->_commandKind == YogaNodeCommandKind::GROUP, "generated clip raster bridge uses a GroupCmd parent");
    expect(dynamic_cast<GroupCmd*>(parent.node->_command.get()) != nullptr, "generated clip raster bridge parent has GroupCmd type");
    expect(!parent.node->_command->rasterizesSubtree(), "generated clip raster bridge disables group raster cache to isolate clip rendering");
    expect(child.node->_commandKind == YogaNodeCommandKind::RECT, "generated clip raster bridge uses a full-size RectCmd child");
    expect(dynamic_cast<RectCmd*>(child.node->_command.get()) != nullptr, "generated clip raster bridge child has RectCmd type");
    expect(!parent.node->_clipsToBounds, "generated clip raster bridge does not use implicit bounds clipping");
    expect(!parent.node->_clipToBoundsRadii.has_value(), "generated clip raster bridge does not use style corner-radius clipping");

    return MaterializedClipRenderTree { std::move(parent), std::move(child) };
}

void disposeMaterializedClipRenderTree(jsi::Runtime& runtime, const MaterializedClipRenderTree& tree)
{
    disposeMaterializedObject(runtime, tree.child.object);
    disposeMaterializedObject(runtime, tree.parent.object);
}

struct MaterializedOverflowRenderTree {
    MaterializedYogaNode parent;
    MaterializedYogaNode child;
};

MaterializedOverflowRenderTree makeMaterializedOverflowRenderTree(
    jsi::Runtime& runtime,
    const char* overflow,
    const char* childColor)
{
    auto parent = materializeYogaNode(runtime);
    auto child = materializeYogaNode(runtime);

    callGeneratedSetCommand(
        runtime,
        parent,
        makeGroupCommand(runtime, false),
        "generated overflow raster bridge parent setCommand(group) must return undefined");
    callGeneratedSetCommand(
        runtime,
        child,
        makeEmptyCommand(runtime, "rect"),
        "generated overflow raster bridge child setCommand(rect) must return undefined");
    callGeneratedSetStyle(
        runtime,
        parent,
        makeRenderOverflowStyle(runtime, overflow),
        "generated overflow raster bridge parent setStyle must return undefined");
    callGeneratedSetStyle(
        runtime,
        child,
        makeAbsoluteRectChildStyle(runtime, childColor),
        "generated overflow raster bridge child setStyle must return undefined");
    callGeneratedInsertChild(
        runtime,
        parent.object,
        child.object,
        "generated overflow raster bridge parent.insertChild(child) must return undefined");

    expect(parent.node->_children.size() == 1, "generated overflow raster bridge must attach one native child");
    expect(parent.node->_children[0].get() == child.node.get(), "generated overflow raster bridge must attach the expected native child");

    auto computeLayout = parent.object.getPropertyAsFunction(runtime, "computeLayout");
    callComputeLayout(runtime, parent.object, computeLayout);

    expectNear(parent.node->_layout.width, 50.0, "generated overflow raster bridge parent layout width");
    expectNear(parent.node->_layout.height, 50.0, "generated overflow raster bridge parent layout height");
    expectNear(child.node->_layout.width, 100.0, "generated overflow raster bridge child layout width");
    expectNear(child.node->_layout.height, 100.0, "generated overflow raster bridge child layout height");

    expect(parent.node->_commandKind == YogaNodeCommandKind::GROUP, "generated overflow raster bridge uses a GroupCmd parent");
    expect(dynamic_cast<GroupCmd*>(parent.node->_command.get()) != nullptr, "generated overflow raster bridge parent has GroupCmd type");
    expect(!parent.node->_command->rasterizesSubtree(), "generated overflow raster bridge disables group raster cache to isolate overflow clipping");
    expect(child.node->_commandKind == YogaNodeCommandKind::RECT, "generated overflow raster bridge uses an oversized RectCmd child");
    expect(dynamic_cast<RectCmd*>(child.node->_command.get()) != nullptr, "generated overflow raster bridge child has RectCmd type");

    return MaterializedOverflowRenderTree { std::move(parent), std::move(child) };
}

void disposeMaterializedOverflowRenderTree(jsi::Runtime& runtime, const MaterializedOverflowRenderTree& tree)
{
    disposeMaterializedObject(runtime, tree.child.object);
    disposeMaterializedObject(runtime, tree.parent.object);
}

void assertGeneratedOverflowRenderCase(
    jsi::Runtime& runtime,
    const char* overflow,
    Overflow expectedOverflow,
    YGOverflow expectedYogaOverflow,
    const char* childColor,
    SkColor expectedColor,
    const char* label)
{
    auto tree = makeMaterializedOverflowRenderTree(runtime, overflow, childColor);

    expect(tree.parent.node->_style.overflow.has_value(), std::string(label) + " keeps overflow in NodeStyle");
    expect(tree.parent.node->_style.overflow.value() == expectedOverflow, std::string(label) + " keeps native overflow enum");
    expect(
        YGNodeStyleGetOverflow(tree.parent.node->_node) == expectedYogaOverflow,
        std::string(label) + " generated setStyle writes Yoga overflow state");
    expect(tree.parent.node->_clipsToBounds, std::string(label) + " enables rectangular YogaNode bounds clipping");
    expect(!tree.parent.node->_clipToBoundsRadii.has_value(), std::string(label) + " does not use style corner-radius clipping");
    expect(!tree.parent.node->_style.borderRadius.has_value(), std::string(label) + " does not set global borderRadius");
    expect(!tree.parent.node->_style.borderTopLeftRadius.has_value(), std::string(label) + " does not set per-corner radius");
    expect(!tree.parent.node->_style.clip.has_value(), std::string(label) + " remains distinct from explicit style.clip");
    expect(!tree.parent.node->_clipPath.has_value(), std::string(label) + " does not populate explicit path clip");
    expect(!tree.parent.node->_clipRect.has_value(), std::string(label) + " does not populate explicit rect clip");
    expect(!tree.parent.node->_clipRRect.has_value(), std::string(label) + " does not populate explicit rrect clip");

    auto surface = makeSurface(72, 72);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 25, 25), expectedColor, "generated overflow render keeps child pixels inside parent bounds");
    expectColor(pixelAt(surface, 49, 49), expectedColor, "generated overflow render keeps child pixels at the rectangular lower edge");
    expectColor(pixelAt(surface, 50, 25), SK_ColorTRANSPARENT, "generated overflow render clips child pixels past parent width");
    expectColor(pixelAt(surface, 25, 50), SK_ColorTRANSPARENT, "generated overflow render clips child pixels past parent height");
    expectColor(pixelAt(surface, 60, 60), SK_ColorTRANSPARENT, "generated overflow render remains bounded outside the parent layout");

    disposeMaterializedOverflowRenderTree(runtime, tree);
}

void assertGeneratedOverflowRender(jsi::Runtime& runtime)
{
    assertGeneratedOverflowRenderCase(
        runtime,
        "hidden",
        Overflow::HIDDEN,
        YGOverflowHidden,
        "#00ff00",
        SK_ColorGREEN,
        "generated overflow hidden render");
    assertGeneratedOverflowRenderCase(
        runtime,
        "scroll",
        Overflow::SCROLL,
        YGOverflowScroll,
        "#0000ff",
        SK_ColorBLUE,
        "generated overflow scroll render");
}

void assertGeneratedClipRectRender(jsi::Runtime& runtime)
{
    auto tree = makeMaterializedClipRenderTree(
        runtime,
        makeRenderClipRectStyle(runtime),
        "#00ff00");

    expect(tree.parent.node->_style.clip.has_value(), "generated clip rect render keeps explicit clip in NodeStyle");
    expect(std::holds_alternative<SkRect>(*tree.parent.node->_style.clip), "generated clip rect render materializes a SkRect clip");
    expectSkRectNear(std::get<SkRect>(*tree.parent.node->_style.clip), 10.0, 10.0, 40.0, 40.0, "generated clip rect render style optional");
    expect(tree.parent.node->_clipRect.has_value(), "generated clip rect render populates _clipRect");
    expectSkRectNear(*tree.parent.node->_clipRect, 10.0, 10.0, 40.0, 40.0, "generated clip rect render native state");
    expect(!tree.parent.node->_clipPath.has_value(), "generated clip rect render leaves _clipPath empty");
    expect(!tree.parent.node->_clipRRect.has_value(), "generated clip rect render leaves _clipRRect empty");
    expect(!tree.parent.node->_style.invertClip.value_or(false), "generated clip rect render uses intersect clipping by default");

    auto surface = makeSurface(108, 108);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 20, 20), SK_ColorGREEN, "generated clip rect render keeps child pixels inside style.clip");
    expectColor(pixelAt(surface, 5, 5), SK_ColorTRANSPARENT, "generated clip rect render clears child pixels before style.clip");
    expectColor(pixelAt(surface, 70, 70), SK_ColorTRANSPARENT, "generated clip rect render clears child pixels after style.clip");
    expectColor(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, "generated clip rect render remains bounded outside the parent layout");

    disposeMaterializedClipRenderTree(runtime, tree);
}

void assertGeneratedClipRRectRender(jsi::Runtime& runtime)
{
    auto tree = makeMaterializedClipRenderTree(
        runtime,
        makeRenderClipRRectStyle(runtime),
        "#0000ff");

    expect(tree.parent.node->_style.clip.has_value(), "generated clip rrect render keeps explicit clip in NodeStyle");
    expect(std::holds_alternative<SkRRect>(*tree.parent.node->_style.clip), "generated clip rrect render materializes a SkRRect clip");
    expectSkRRectNear(std::get<SkRRect>(*tree.parent.node->_style.clip), 10.0, 10.0, 40.0, 40.0, 18.0, 18.0, "generated clip rrect render style optional");
    expect(tree.parent.node->_clipRRect.has_value(), "generated clip rrect render populates _clipRRect");
    expectSkRRectNear(*tree.parent.node->_clipRRect, 10.0, 10.0, 40.0, 40.0, 18.0, 18.0, "generated clip rrect render native state");
    expect(!tree.parent.node->_clipPath.has_value(), "generated clip rrect render leaves _clipPath empty");
    expect(!tree.parent.node->_clipRect.has_value(), "generated clip rrect render leaves _clipRect empty");
    expect(!tree.parent.node->_style.invertClip.value_or(false), "generated clip rrect render uses intersect clipping by default");

    auto surface = makeSurface(108, 108);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 30, 30), SK_ColorBLUE, "generated clip rrect render keeps child pixels inside rounded style.clip");
    expectColor(pixelAt(surface, 11, 11), SK_ColorTRANSPARENT, "generated clip rrect render clears child pixels in the rounded corner");
    expectColor(pixelAt(surface, 70, 70), SK_ColorTRANSPARENT, "generated clip rrect render clears child pixels outside the rounded rect");
    expectColor(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, "generated clip rrect render remains bounded outside the parent layout");

    disposeMaterializedClipRenderTree(runtime, tree);
}

void assertGeneratedClipPathRender(jsi::Runtime& runtime)
{
    auto tree = makeMaterializedClipRenderTree(
        runtime,
        makeRenderClipPathStyle(runtime),
        "#00ffff");

    expect(tree.parent.node->_style.clip.has_value(), "generated clip path render keeps explicit clip in NodeStyle");
    expect(std::holds_alternative<SkPath>(*tree.parent.node->_style.clip), "generated clip path render materializes a SkPath clip");
    expect(std::get<SkPath>(*tree.parent.node->_style.clip).contains(50.0f, 50.0f), "generated clip path render style optional keeps host-object circle path");
    expect(tree.parent.node->_clipPath.has_value(), "generated clip path render populates _clipPath");
    expect(tree.parent.node->_clipPath->contains(50.0f, 50.0f), "generated clip path render native state keeps host-object circle path");
    expect(!tree.parent.node->_clipPath->contains(10.0f, 10.0f), "generated clip path render native state rejects outside point");
    expect(!tree.parent.node->_clipRect.has_value(), "generated clip path render leaves _clipRect empty");
    expect(!tree.parent.node->_clipRRect.has_value(), "generated clip path render leaves _clipRRect empty");
    expect(!tree.parent.node->_style.invertClip.value_or(false), "generated clip path render uses intersect clipping by default");

    auto surface = makeSurface(108, 108);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 50, 50), SK_ColorCYAN, "generated clip path render keeps child pixels inside style.clip path");
    expectColor(pixelAt(surface, 10, 10), SK_ColorTRANSPARENT, "generated clip path render clears child pixels outside the path");
    expectColor(pixelAt(surface, 80, 50), SK_ColorTRANSPARENT, "generated clip path render clears child pixels past the path radius");
    expectColor(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, "generated clip path render remains bounded outside the parent layout");

    disposeMaterializedClipRenderTree(runtime, tree);
}

void assertGeneratedInvertClipRectRender(jsi::Runtime& runtime)
{
    auto tree = makeMaterializedClipRenderTree(
        runtime,
        makeRenderInvertedClipRectStyle(runtime),
        "#ff00ff");

    expect(tree.parent.node->_style.clip.has_value(), "generated invertClip rect render keeps explicit clip in NodeStyle");
    expect(std::holds_alternative<SkRect>(*tree.parent.node->_style.clip), "generated invertClip rect render materializes a SkRect clip");
    expectSkRectNear(std::get<SkRect>(*tree.parent.node->_style.clip), 10.0, 10.0, 40.0, 40.0, "generated invertClip rect render style optional");
    expect(tree.parent.node->_style.invertClip.has_value(), "generated invertClip rect render stores invertClip optional");
    expect(tree.parent.node->_style.invertClip.value(), "generated invertClip rect render stores invertClip=true");
    expect(tree.parent.node->_clipRect.has_value(), "generated invertClip rect render populates _clipRect");
    expectSkRectNear(*tree.parent.node->_clipRect, 10.0, 10.0, 40.0, 40.0, "generated invertClip rect render native state");
    expect(!tree.parent.node->_clipPath.has_value(), "generated invertClip rect render leaves _clipPath empty");
    expect(!tree.parent.node->_clipRRect.has_value(), "generated invertClip rect render leaves _clipRRect empty");

    auto surface = makeSurface(108, 108);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 20, 20), SK_ColorTRANSPARENT, "generated invertClip rect render clears child pixels inside style.clip");
    expectColor(pixelAt(surface, 5, 5), SK_ColorMAGENTA, "generated invertClip rect render keeps child pixels before style.clip");
    expectColor(pixelAt(surface, 70, 70), SK_ColorMAGENTA, "generated invertClip rect render keeps child pixels after style.clip");
    expectColor(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, "generated invertClip rect render remains bounded outside the parent layout");

    disposeMaterializedClipRenderTree(runtime, tree);
}

void assertGeneratedInvertClipRRectRender(jsi::Runtime& runtime)
{
    auto tree = makeMaterializedClipRenderTree(
        runtime,
        makeRenderInvertedClipRRectStyle(runtime),
        "#ffff00");

    expect(tree.parent.node->_style.clip.has_value(), "generated invertClip rrect render keeps explicit clip in NodeStyle");
    expect(std::holds_alternative<SkRRect>(*tree.parent.node->_style.clip), "generated invertClip rrect render materializes a SkRRect clip");
    expectSkRRectNear(std::get<SkRRect>(*tree.parent.node->_style.clip), 10.0, 10.0, 40.0, 40.0, 18.0, 18.0, "generated invertClip rrect render style optional");
    expect(tree.parent.node->_style.invertClip.has_value(), "generated invertClip rrect render stores invertClip optional");
    expect(tree.parent.node->_style.invertClip.value(), "generated invertClip rrect render stores invertClip=true");
    expect(tree.parent.node->_clipRRect.has_value(), "generated invertClip rrect render populates _clipRRect");
    expectSkRRectNear(*tree.parent.node->_clipRRect, 10.0, 10.0, 40.0, 40.0, 18.0, 18.0, "generated invertClip rrect render native state");
    expect(!tree.parent.node->_clipPath.has_value(), "generated invertClip rrect render leaves _clipPath empty");
    expect(!tree.parent.node->_clipRect.has_value(), "generated invertClip rrect render leaves _clipRect empty");

    auto surface = makeSurface(108, 108);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 30, 30), SK_ColorTRANSPARENT, "generated invertClip rrect render clears child pixels inside rounded style.clip");
    expectColor(pixelAt(surface, 5, 5), SK_ColorYELLOW, "generated invertClip rrect render keeps child pixels before rounded style.clip");
    expectColor(pixelAt(surface, 70, 70), SK_ColorYELLOW, "generated invertClip rrect render keeps child pixels after rounded style.clip");
    expectColor(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, "generated invertClip rrect render remains bounded outside the parent layout");

    disposeMaterializedClipRenderTree(runtime, tree);
}

void assertGeneratedInvertClipPathRender(jsi::Runtime& runtime)
{
    auto tree = makeMaterializedClipRenderTree(
        runtime,
        makeRenderInvertedClipPathStyle(runtime),
        "#ff0000");

    expect(tree.parent.node->_style.clip.has_value(), "generated invertClip path render keeps explicit clip in NodeStyle");
    expect(std::holds_alternative<SkPath>(*tree.parent.node->_style.clip), "generated invertClip path render materializes a SkPath clip");
    expect(std::get<SkPath>(*tree.parent.node->_style.clip).contains(50.0f, 50.0f), "generated invertClip path render style optional keeps host-object circle path");
    expect(tree.parent.node->_style.invertClip.has_value(), "generated invertClip path render stores invertClip optional");
    expect(tree.parent.node->_style.invertClip.value(), "generated invertClip path render stores invertClip=true");
    expect(tree.parent.node->_clipPath.has_value(), "generated invertClip path render populates _clipPath");
    expect(tree.parent.node->_clipPath->contains(50.0f, 50.0f), "generated invertClip path render native state keeps host-object circle path");
    expect(!tree.parent.node->_clipPath->contains(10.0f, 10.0f), "generated invertClip path render native state rejects outside point");
    expect(!tree.parent.node->_clipRect.has_value(), "generated invertClip path render leaves _clipRect empty");
    expect(!tree.parent.node->_clipRRect.has_value(), "generated invertClip path render leaves _clipRRect empty");

    auto surface = makeSurface(108, 108);
    renderNode(tree.parent.node, surface);

    expectColor(pixelAt(surface, 50, 50), SK_ColorTRANSPARENT, "generated invertClip path render clears child pixels inside style.clip path");
    expectColor(pixelAt(surface, 10, 10), SK_ColorRED, "generated invertClip path render keeps child pixels outside the path");
    expectColor(pixelAt(surface, 80, 50), SK_ColorRED, "generated invertClip path render keeps child pixels past the path radius");
    expectColor(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, "generated invertClip path render remains bounded outside the parent layout");

    disposeMaterializedClipRenderTree(runtime, tree);
}

void assertGeneratedMatrixStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeMatrixStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(matrix array) must return undefined");

    const auto expected = makeSkMatrix9(std::array<double, 9> {
        2.0, 0.0, 7.0,
        0.0, 3.0, 11.0,
        0.0, 0.0, 1.0,
    });
    expect(materialized.node->_style.matrix.has_value(), "generated matrix style must populate matrix optional");
    expect(
        std::holds_alternative<std::shared_ptr<SkMatrix>>(*materialized.node->_style.matrix),
        "generated matrix style must materialize array through SkMatrix custom converter");
    const auto& styleMatrix = std::get<std::shared_ptr<SkMatrix>>(*materialized.node->_style.matrix);
    expect(styleMatrix != nullptr, "generated matrix style optional must hold a non-null SkMatrix");
    expectSkMatrixNear(*styleMatrix, expected, "generated matrix style optional");
    expect(materialized.node->_matrix != nullptr, "generated matrix style must update YogaNode::_matrix");
    expectSkMatrixNear(*materialized.node->_matrix, expected, "generated matrix style native state");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedMatrix16Style(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeMatrix16Style(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(MatrixArray16 matrix array) must return undefined");

    const auto values = matrixArray16Values();
    const auto expected = makeSkMatrix16(values);
    expect(materialized.node->_style.matrix.has_value(), "generated MatrixArray16 style must populate matrix optional");
    expect(
        std::holds_alternative<std::shared_ptr<SkMatrix>>(*materialized.node->_style.matrix),
        "generated MatrixArray16 style must materialize array through SkMatrix custom converter");
    const auto& styleMatrix = std::get<std::shared_ptr<SkMatrix>>(*materialized.node->_style.matrix);
    expect(styleMatrix != nullptr, "generated MatrixArray16 style optional must hold a non-null SkMatrix");
    expectSkMatrixNear(*styleMatrix, expected, "generated MatrixArray16 style optional");
    expect(materialized.node->_matrix != nullptr, "generated MatrixArray16 style must update YogaNode::_matrix");
    expectSkMatrixNear(*materialized.node->_matrix, expected, "generated MatrixArray16 style native state");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedSingleTransformOperationStyles(jsi::Runtime& runtime)
{
    for (const auto& transformCase : generatedTransformCases()) {
        auto materialized = materializeYogaNode(runtime);
        auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
        auto style = makeSingleTransformStyle(runtime, transformCase.key, transformCase.value);
        callFunctionWithOneObject(
            runtime,
            materialized.object,
            setStyle,
            style,
            "generated setStyle(single transform operation) must return undefined");

        expect(
            materialized.node->_style.transform.has_value(),
            std::string("generated transform operation ") + transformCase.key + " must populate transform optional");
        expect(
            !materialized.node->_style.matrix.has_value(),
            std::string("generated transform operation ") + transformCase.key + " must leave matrix optional absent");
        const auto& transforms = *materialized.node->_style.transform;
        expect(
            transforms.size() == 1,
            std::string("generated transform operation ") + transformCase.key + " must keep exactly one transform");
        transformCase.expectVariant(transforms[0], transformCase.value, transformCase.key);

        const auto expectedMatrix = transformCase.makeExpectedMatrix(transformCase.value);
        expect(
            materialized.node->_matrix != nullptr,
            std::string("generated transform operation ") + transformCase.key + " must update YogaNode::_matrix");
        expectSkMatrixNear(
            *materialized.node->_matrix,
            expectedMatrix,
            (std::string("generated transform operation ") + transformCase.key + " native matrix").c_str());

        disposeMaterializedObject(runtime, materialized.object);
    }
}

void assertGeneratedTransformStylePrecedence(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeTransformWithMatrixFallbackStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(transform with matrix fallback) must return undefined");

    expect(materialized.node->_style.transform.has_value(), "generated transform style must populate transform optional");
    expect(materialized.node->_style.matrix.has_value(), "generated transform style must also populate matrix optional");
    const auto& transforms = *materialized.node->_style.transform;
    expect(transforms.size() == 3, "generated transform style must keep transform array size");
    expect(std::holds_alternative<TransformTranslateX>(transforms[0]), "generated transform style must keep translateX op");
    expectNear(std::get<TransformTranslateX>(transforms[0]).translateX, 8.0, "generated transform style translateX value");
    expect(std::holds_alternative<TransformTranslateY>(transforms[1]), "generated transform style must keep translateY op");
    expectNear(std::get<TransformTranslateY>(transforms[1]).translateY, 13.0, "generated transform style translateY value");
    expect(std::holds_alternative<TransformScale>(transforms[2]), "generated transform style must keep scale op");
    expectNear(std::get<TransformScale>(transforms[2]).scale, 1.5, "generated transform style scale value");

    SkM44 expectedTransform;
    expectedTransform.setIdentity();
    expectedTransform.preTranslate(8.0f, 0.0f, 0.0f);
    expectedTransform.preTranslate(0.0f, 13.0f, 0.0f);
    expectedTransform.preScale(1.5f, 1.5f, 1.0f);
    const SkMatrix expectedTransformMatrix = expectedTransform.asM33();
    const auto fallbackMatrix = makeSkMatrix9(std::array<double, 9> {
        4.0, 0.0, 101.0,
        0.0, 5.0, 202.0,
        0.0, 0.0, 1.0,
    });

    expect(materialized.node->_matrix != nullptr, "generated transform style must update YogaNode::_matrix");
    expectSkMatrixNear(*materialized.node->_matrix, expectedTransformMatrix, "generated transform style native transform matrix");
    expect(
        !skMatrixNear(*materialized.node->_matrix, fallbackMatrix),
        "generated transform style must prefer transform over matrix fallback");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedEmptyTransformMatrixFallbackStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto style = makeEmptyTransformWithMatrixFallbackStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        style,
        "generated setStyle(empty transform with matrix fallback) must return undefined");

    expect(materialized.node->_style.transform.has_value(), "generated empty transform style must populate transform optional");
    expect(materialized.node->_style.transform->empty(), "generated empty transform style must keep transform array empty");
    expect(materialized.node->_style.matrix.has_value(), "generated empty transform style must also populate matrix optional");
    expect(
        std::holds_alternative<std::shared_ptr<SkMatrix>>(*materialized.node->_style.matrix),
        "generated empty transform style must materialize matrix array through SkMatrix custom converter");
    const auto& styleMatrix = std::get<std::shared_ptr<SkMatrix>>(*materialized.node->_style.matrix);
    expect(styleMatrix != nullptr, "generated empty transform style matrix optional must hold a non-null SkMatrix");
    const auto expectedFallbackMatrix = makeSkMatrix9(emptyTransformFallbackMatrixValues());
    expectSkMatrixNear(*styleMatrix, expectedFallbackMatrix, "generated empty transform style matrix optional");
    expect(materialized.node->_matrix != nullptr, "generated empty transform style must fall back to YogaNode::_matrix");
    expectSkMatrixNear(*materialized.node->_matrix, expectedFallbackMatrix, "generated empty transform style native matrix fallback");

    disposeMaterializedObject(runtime, materialized.object);
}

void assertGeneratedEmptyTransformWithoutMatrixStyle(jsi::Runtime& runtime)
{
    auto materialized = materializeYogaNode(runtime);
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");

    auto matrixStyle = makeMatrixStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        matrixStyle,
        "generated setStyle(matrix before empty transform reset) must return undefined");
    expect(materialized.node->_matrix != nullptr, "generated empty transform reset precondition must install an initial matrix");

    auto emptyTransformStyle = makeEmptyTransformStyle(runtime);
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
        emptyTransformStyle,
        "generated setStyle(empty transform without matrix) must return undefined");

    expect(materialized.node->_style.transform.has_value(), "generated empty transform no-matrix style must populate transform optional");
    expect(materialized.node->_style.transform->empty(), "generated empty transform no-matrix style must keep transform array empty");
    expect(!materialized.node->_style.matrix.has_value(), "generated empty transform no-matrix style must leave matrix optional absent");
    expect(materialized.node->_matrix == nullptr, "generated empty transform no-matrix style must reset YogaNode::_matrix");

    disposeMaterializedObject(runtime, materialized.object);
}

} // namespace

int main()
{
    std::cerr << "probe: create JSC runtime" << std::endl;
    auto runtime = facebook::jsc::makeJSCRuntime();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(runtime.get());
    auto callInvoker = std::make_shared<HostCallInvoker>();
    auto platformContext = std::make_shared<HostPlatformContext>(callInvoker);
    margelo::nitro::RNSkiaYoga::SetPlatformContext(platformContext);

    std::cerr << "probe: create shared YogaNode" << std::endl;
    auto node = std::make_shared<YogaNode>();

    std::cerr << "probe: materialize YogaNode JS object" << std::endl;
    jsi::Value objectValue = node->toObject(*runtime);
    expect(objectValue.isObject(), "YogaNode::toObject(runtime) must return a JS object");
    jsi::Object object = objectValue.asObject(*runtime);
    expect(object.hasNativeState(*runtime), "materialized YogaNode object must have NativeState");

    auto nativeState = object.getNativeState<jsi::NativeState>(*runtime);
    auto materializedYogaNode = std::dynamic_pointer_cast<YogaNode>(nativeState);
    expect(materializedYogaNode != nullptr, "NativeState must dynamic_cast to YogaNode");
    expect(materializedYogaNode.get() == node.get(), "NativeState must wrap the original YogaNode");
    auto materializedSpec = std::dynamic_pointer_cast<HybridYogaNodeSpec>(nativeState);
    expect(materializedSpec != nullptr, "NativeState must dynamic_cast to generated HybridYogaNodeSpec");

    jsi::Value cachedObjectValue = node->toObject(*runtime);
    expect(
        jsi::Value::strictEquals(*runtime, objectValue, cachedObjectValue),
        "repeated YogaNode::toObject(runtime) must return the cached JS object while it is alive");

    std::cerr << "probe: assert generated members" << std::endl;
    expectObjectFunction(*runtime, object, "setCommand");
    expectObjectFunction(*runtime, object, "setStyle");
    expectObjectFunction(*runtime, object, "computeLayout");
    expect(object.hasProperty(*runtime, "layout"), "materialized object must expose generated layout property");

    auto setCommand = object.getPropertyAsFunction(*runtime, "setCommand");
    auto setStyle = object.getPropertyAsFunction(*runtime, "setStyle");
    auto computeLayout = object.getPropertyAsFunction(*runtime, "computeLayout");

    std::cerr << "probe: call generated setCommand" << std::endl;
    auto command = makeGroupCommand(*runtime);
    callFunctionWithOneObject(
        *runtime,
        object,
        setCommand,
        command,
        "generated setCommand(group) must return undefined");
    expect(node->_commandKind == YogaNodeCommandKind::GROUP, "generated setCommand must install GroupCmd kind");
    expect(node->_command != nullptr, "generated setCommand must install native command");
    expect(dynamic_cast<GroupCmd*>(node->_command.get()) != nullptr, "generated setCommand must install a real GroupCmd");
    expect(node->_command->rasterizesSubtree(), "generated setCommand must apply GroupCmd rasterize payload");

    std::cerr << "probe: call generated setStyle" << std::endl;
    node->_paint.setAntiAlias(true);
    auto style = makeLayerStyle(*runtime, 64.0, 32.0);
    callFunctionWithOneObject(
        *runtime,
        object,
        setStyle,
        style,
        "generated setStyle(width/height/layer) must return undefined");
    expect(node->_style.width.has_value(), "generated setStyle must populate native width");
    expect(node->_style.height.has_value(), "generated setStyle must populate native height");
    expect(node->_style.antiAlias.has_value(), "generated setStyle must populate native antiAlias");
    expect(node->_style.layer.has_value(), "generated setStyle must populate native layer");
    expect(!node->_style.antiAlias.value(), "generated setStyle native antiAlias must keep false");
    expect(!node->_style.antiaAlias.has_value(), "generated setStyle canonical antiAlias must not populate legacy antiaAlias");
    expect(!node->_paint.isAntiAlias(), "generated setStyle canonical antiAlias must update SkPaint antiAlias state");
    expect(node->_layerPaint.has_value(), "generated setStyle must update YogaNode::_layerPaint state");
    expectNear(node->_layerPaint->getAlphaf(), 0.25, "generated setStyle layer paint alpha");
    expect(node->_layerPaint->isAntiAlias(), "generated setStyle layer paint antiAlias");
    auto layerBlendMode = node->_layerPaint->asBlendMode();
    expect(layerBlendMode.has_value(), "generated setStyle layer paint keeps inspectable blend mode");
    expect(layerBlendMode.value() == SkBlendMode::kMultiply, "generated setStyle layer paint blend mode");
    expectColor(node->_paint.getColor(), SK_ColorBLUE, "generated setStyle backgroundColor keeps ordinary _paint separate from _layerPaint");
    expectNear(node->_paint.getAlphaf(), 1.0, "generated setStyle ordinary _paint alpha stays separate from layer alpha");
    expectNear(std::get<double>(*node->_style.width), 64.0, "generated setStyle native width");
    expectNear(std::get<double>(*node->_style.height), 32.0, "generated setStyle native height");

    std::cerr << "probe: call generated CSS-string backgroundColor validation" << std::endl;
    assertGeneratedCssBackgroundColorStringValidation(*runtime);

    std::cerr << "probe: call generated finite numeric style validation" << std::endl;
    assertGeneratedFiniteNumericStyleValidation(*runtime);

    std::cerr << "probe: call generated matrix/transform finite style validation" << std::endl;
    assertGeneratedFiniteMatrixTransformStyleValidation(*runtime);

    std::cerr << "probe: call generated radius finite style validation" << std::endl;
    assertGeneratedFiniteRadiusStyleValidation(*runtime);

    std::cerr << "probe: call generated paint-backed setStyle" << std::endl;
    assertGeneratedPaintBackedStyle(*runtime);

    std::cerr << "probe: call generated corner-radius setStyle" << std::endl;
    assertGeneratedGlobalBorderRadiusStyle(*runtime);
    assertGeneratedCornerRadiusStyle(*runtime);

    std::cerr << "probe: call generated clip/matrix/transform setStyle" << std::endl;
    assertGeneratedClipRectStyle(*runtime);
    assertGeneratedClipRRectStyle(*runtime);
    assertGeneratedClipPathStyle(*runtime);
    assertGeneratedInvertClipStyle(*runtime);
    assertGeneratedOverflowRender(*runtime);
    assertGeneratedClipRectRender(*runtime);
    assertGeneratedClipRRectRender(*runtime);
    assertGeneratedClipPathRender(*runtime);
    assertGeneratedInvertClipRectRender(*runtime);
    assertGeneratedInvertClipRRectRender(*runtime);
    assertGeneratedInvertClipPathRender(*runtime);
    assertGeneratedMatrixStyle(*runtime);
    assertGeneratedMatrix16Style(*runtime);
    assertGeneratedSingleTransformOperationStyles(*runtime);
    assertGeneratedTransformStylePrecedence(*runtime);
    assertGeneratedEmptyTransformMatrixFallbackStyle(*runtime);
    assertGeneratedEmptyTransformWithoutMatrixStyle(*runtime);

    std::cerr << "probe: call generated computeLayout" << std::endl;
    callComputeLayout(*runtime, object, computeLayout);
    expect(node->_hasLayoutBeenComputed, "generated computeLayout must mark native layout computed");
    expectNear(node->_layout.width, 64.0, "generated computeLayout native width");
    expectNear(node->_layout.height, 32.0, "generated computeLayout native height");
    assertGeneratedComputeLayoutNumericValidation(*runtime);

    std::cerr << "probe: read generated layout getter" << std::endl;
    auto layoutValue = object.getProperty(*runtime, "layout");
    expect(layoutValue.isObject(), "generated layout getter must return an object");
    auto layoutObject = layoutValue.asObject(*runtime);
    expectNear(getNumberProperty(*runtime, layoutObject, "left"), 0.0, "generated layout getter left");
    expectNear(getNumberProperty(*runtime, layoutObject, "top"), 0.0, "generated layout getter top");
    expectNear(getNumberProperty(*runtime, layoutObject, "width"), 64.0, "generated layout getter width");
    expectNear(getNumberProperty(*runtime, layoutObject, "height"), 32.0, "generated layout getter height");

    std::cerr << "probe: call generated materialized flex layout breadth" << std::endl;
    assertGeneratedMaterializedFlexLayoutBreadth(*runtime);
    assertGeneratedWidthStretchStyle(*runtime);
    std::cerr << "probe: call generated layout unit validation" << std::endl;
    assertGeneratedLayoutUnitValidation(*runtime);
    assertGeneratedMaterializedResidualLayoutBreadth(*runtime);
    assertGeneratedMaterializedDisplayNoneLayout(*runtime);
    assertGeneratedMaterializedSequentialLayoutUpdates(*runtime);
    std::cerr << "probe: call generated materialized sequential field alignment" << std::endl;
    assertGeneratedMaterializedSequentialLayoutFieldAlignment(*runtime);

    std::cerr << "probe: exercise stable generated negatives" << std::endl;
    expectThrows(
        [&]() {
            const jsi::Value* noArgs = nullptr;
            setStyle.callWithThis(*runtime, object, noArgs, static_cast<size_t>(0));
        },
        "expected 1 arguments, but received 0",
        "generated setStyle must reject missing required style argument");
    expectThrows(
        [&]() {
            auto invalidCommand = makeInvalidCommand(*runtime);
            jsi::Value args[] = {jsi::Value(*runtime, invalidCommand)};
            setCommand.callWithThis(
                *runtime,
                object,
                static_cast<const jsi::Value*>(args),
                static_cast<size_t>(1));
        },
        "NodeCommand.data must be an object",
        "generated setCommand must reject invalid command payload");

    std::cerr << "probe: call materialized getChildren" << std::endl;
    assertMaterializedGetChildren(*runtime);

    std::cerr << "probe: call generated setCommand breadth cases" << std::endl;
    assertGeneratedLineSetCommand(*runtime);
    assertGeneratedPointsSetCommand(*runtime);
    assertGeneratedCommandPointNativeFloatRejections(*runtime);
    assertGeneratedStaticAnimatedDoubleCommandFiniteRejections(*runtime);
    assertGeneratedPathStrokeNumericFiniteRejections(*runtime);
    assertGeneratedCommandNumericEnumRejections(*runtime);
    assertGeneratedPublicPathStrokeSetCommand(*runtime);
    assertGeneratedTextSetCommand(*runtime);
    assertGeneratedParagraphSetCommand(*runtime);
    assertGeneratedTextParagraphStyleNumericFiniteRejections(*runtime);
    assertGeneratedCircleSetCommand(*runtime);
    assertGeneratedRRectSetCommand(*runtime);
    assertGeneratedBlurMaskFilterSetCommand(*runtime);
    assertGeneratedRectSetCommand(*runtime);
    assertGeneratedOvalSetCommand(*runtime);
    assertGeneratedImageSetCommand(*runtime);

    std::cerr << "probe: dispose materialized object before runtime teardown" << std::endl;
    disposeMaterializedObject(*runtime, object);
    node.reset();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    margelo::nitro::RNSkiaYoga::ClearPlatformContext();

    std::cout << "YogaNode Nitro materialization host probe passed\n";
    std::cerr << "probe: finished" << std::endl;
    return 0;
}
`
}

function readProjectFile(relativePath) {
	return readFileSync(projectPathChecked(relativePath), "utf8")
}

function rnSkiaTypesPath(...segments) {
	return path.join(
		"node_modules",
		"@shopify",
		"react-native-skia",
		"src",
		"skia",
		"types",
		...segments,
	)
}

function projectPath(relativePath) {
	return path.join(rootDir, relativePath)
}

function projectPathChecked(relativePath) {
	const resolved = projectPath(relativePath)
	if (!existsSync(resolved)) {
		throw new Error(`Missing required path: ${relativePath}`)
	}
	return resolved
}

function extractInterfaceFields(source, interfaceName) {
	const interfaceMatch = source.match(
		new RegExp(
			`export\\s+interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`,
		),
	)
	if (!interfaceMatch) {
		throw new Error(`Unable to find public interface ${interfaceName}.`)
	}

	const body = interfaceMatch[1]
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "")
	return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\??\s*:/gm)].map(
		(match) => match[1],
	)
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message)
	}
}
