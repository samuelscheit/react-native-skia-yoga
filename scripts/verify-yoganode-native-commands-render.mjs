#!/usr/bin/env node

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
import { spawnSync } from "node:child_process"
import path from "node:path"
import {
	createVerifierTempDir,
	formatVerifierTempDiagnostics,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = createVerifierTempDir("rnskia-yoganode-commands-render-")
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
const styleSerializerFieldInventory = [
	{
		surface: "SkTextStyle",
		sourcePath: rnSkiaTypesPath("Paragraph", "TextStyle.ts"),
		interfaceName: "SkTextStyle",
		buckets: {
			supportedParseSerialized: [
				"decoration",
				"decorationThickness",
				"decorationStyle",
				"fontFamilies",
				"fontFeatures",
				"fontSize",
				"fontStyle",
				"heightMultiplier",
				"halfLeading",
				"letterSpacing",
				"locale",
				"shadows",
				"textBaseline",
				"wordSpacing",
			],
			supportedWithNativeNormalization: [
				"backgroundColor",
				"color",
				"decorationColor",
				"foregroundColor",
			],
			intentionallyUnsupported: ["fontVariations"],
			outsideLocalFidelityProof: [],
		},
	},
	{
		surface: "SkParagraphStyle",
		sourcePath: rnSkiaTypesPath("Paragraph", "ParagraphStyle.ts"),
		interfaceName: "SkParagraphStyle",
		buckets: {
			supportedParseSerialized: [
				"disableHinting",
				"ellipsis",
				"heightMultiplier",
				"maxLines",
				"replaceTabCharacters",
				"strutStyle",
				"textAlign",
				"textDirection",
				"textHeightBehavior",
				"textStyle",
			],
			supportedWithNativeNormalization: [],
			intentionallyUnsupported: [],
			outsideLocalFidelityProof: [],
		},
	},
	{
		surface: "SkStrutStyle",
		sourcePath: rnSkiaTypesPath("Paragraph", "ParagraphStyle.ts"),
		interfaceName: "SkStrutStyle",
		buckets: {
			supportedParseSerialized: [
				"forceStrutHeight",
				"fontFamilies",
				"fontSize",
				"fontStyle",
				"halfLeading",
				"heightMultiplier",
				"leading",
				"strutEnabled",
			],
			supportedWithNativeNormalization: [],
			intentionallyUnsupported: [],
			outsideLocalFidelityProof: [],
		},
	},
	{
		surface: "SamplingOptions.CubicResampler",
		sourcePath: rnSkiaTypesPath("Image", "Image.ts"),
		interfaceName: "CubicResampler",
		buckets: {
			supportedParseSerialized: ["B", "C"],
			supportedWithNativeNormalization: [],
			intentionallyUnsupported: [],
			outsideLocalFidelityProof: [],
		},
	},
	{
		surface: "SamplingOptions.FilterOptions",
		sourcePath: rnSkiaTypesPath("Image", "Image.ts"),
		interfaceName: "FilterOptions",
		buckets: {
			supportedParseSerialized: ["filter", "mipmap"],
			supportedWithNativeNormalization: [],
			intentionallyUnsupported: [],
			outsideLocalFidelityProof: [],
		},
	},
]
const samplingOptionsUnionInventory = {
	sourcePath: rnSkiaTypesPath("Image", "Image.ts"),
	typeName: "SamplingOptions",
	members: ["CubicResampler", "FilterOptions"],
}

try {
	assertInstalledStyleSerializerFieldInventory()
	assertCommandPointFiniteValidationInventory()
	assertCommandAnimatedDoubleFiniteValidationInventory()
	assertPathStrokeNumericFiniteValidationInventory()
	assertCommandNumericEnumValidationInventory()
	assertTextParagraphStyleNumericFiniteValidationInventory()
	createNitroModulesShim(tmpDir)

	const probePath = path.join(tmpDir, "yoganode-native-commands-render.cpp")
	const binaryPath = path.join(tmpDir, "yoganode-native-commands-render")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-DNDEBUG",
		"-ferror-limit=20",
		"-ffunction-sections",
		"-fdata-sections",
		"-Wl,-dead_strip",
		// YogaNode.cpp shares generated/platform entry points that this host probe does not enter.
		// dynamic_lookup keeps those paths lazy while the exercised command conversion,
		// setCommand(), Yoga layout, renderToContext(), RN Skia draw commands, and raster cache
		// behavior resolve against real linked host dependencies below.
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
				`${compiler} YogaNode native command/render compile/link failed with exit code ${compileResult.status}.`,
				compileResult,
				[
					{ label: "YogaNode command/render temp root", targetPath: tmpDir },
					{ label: "probe source", targetPath: probePath },
					{ label: "binary output", targetPath: binaryPath },
					{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
				],
			),
		)
	}

	assertLinkedBinary(binaryPath, [
		{ label: "YogaNode command/render temp root", targetPath: tmpDir },
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
				`Failed to execute YogaNode native command/render binary: ${runResult.error.message}`,
				`diagnostics:\n${formatVerifierTempDiagnostics([
					{ label: "YogaNode command/render temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				])}`,
			].join("\n\n"),
		)
	}

	if (runResult.status !== 0) {
		throw new Error(
			formatFailure(
				`YogaNode native command/render execution failed with exit code ${runResult.status}.`,
				runResult,
				[
					{ label: "YogaNode command/render temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				],
			),
		)
	}

	console.log("YogaNode native command/render verifier passed:")
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, AnimatedDouble.cpp, generated Nitro specs, React Native JSC, upstream Yoga sources, RN Skia macOS archives, RN Skia CSSColorParser, Worklets shared-item sources, ColorParser, PlatformContextAccessor, and Nitro/JSI helper sources.")
	console.log("- The executable created a JSC runtime, converted numeric, CSS color-string, and Worklets Synchronizable NodeCommand payloads through JSIConverter<NodeCommand>::fromJSI(...), serialized representative payloads through JSIConverter<NodeCommand>::toJSI(...), and executed real YogaNode::setCommand().")
	console.log("- The executable rendered real RectCmd, GroupCmd, PointsCmd, LineCmd, OvalCmd, CircleCmd, RRectCmd, BlurMaskFilterCmd, PathCmd, ImageCmd, TextCmd, and ParagraphCmd paths through YogaNode::renderToContext() onto raster SkSurfaces.")
	console.log("- The executable asserted NodeCommand toJSI payload shape and representative toJSI/fromJSI round-trip coverage for blurMaskFilter, image, path, text, paragraph, line, and points, including numeric enum output for blurStyle, fillType, and pointMode, resolved-number AnimatedDouble output, public path.stroke.miter_limit output, SkPath/JsiSkPath and SkImage/JsiSkImage host-object fields, simple text.textStyle fontSize/color fields, inventory-backed paragraphStyle fields including nested textStyle output, distinct paragraph/text-style heightMultiplier preservation, fontFeatures and strutStyle, line from/to points, and points arrays.")
	console.log("- The executable asserted non-finite command point rejection for line.from.x/y, line.to.x/y, and indexed points.points[] x/y payloads with NaN, Infinity, and -Infinity, preserving the previously installed native LineCmd/PointsCmd state.")
	console.log("- The executable asserted non-finite static AnimatedDouble command rejection for rrect.cornerRadius, blurMaskFilter.blur, path.trimStart, path.trimEnd, and circle.radius payloads before same-type setCommand mutation, while retaining dynamic Worklets-backed AnimatedDouble command behavior.")
	console.log("- The executable asserted dynamic AnimatedDouble render-time native-float validation fails closed for NaN, Infinity, and native-float-overflow Synchronizable mutations without installing invalid float props.")
	console.log("- The executable asserted non-finite path stroke numeric rejection for stroke.width, stroke.miter_limit, stroke.miterLimit alias fallback, and stroke.precision before same-type PathCmd state mutation, while preserving direct StrokeOpts converter behavior.")
	console.log("- The executable asserted numeric enum rejection for blurMaskFilter.blurStyle, points.pointMode, path.fillType, path.stroke.join, and path.stroke.cap finite/integer/range violations before same-type command mutation.")
	console.log("- The executable asserted non-finite and native-range-overflow text/paragraph style numeric rejection for TextStyle.fontSize plus flattened/nested ParagraphStyle textStyle, maxLines, strutStyle.leading, and fontFeatures[].value before same-type TextCmd/ParagraphCmd state mutation.")
	console.log(`- The verifier checked the installed RN Skia public style field inventory before native compilation: ${formatStyleInventorySummary()}`)
	console.log("- The executable asserted inventory-backed value-bearing toJSI/fromJSI serialization for installed public SkSamplingOptions filter/mipmap and cubic B/C, installed public SkTextStyle supported fields including fontSize/fontFamilies/fontFeatures/decoration/fontStyle/heightMultiplier/halfLeading/letterSpacing/wordSpacing/locale/shadows/textBaseline, normalized text color fields color/backgroundColor/foregroundColor/decorationColor, installed public SkParagraphStyle scalar/textStyle/strutStyle fields, installed public SkStrutStyle fields, dual flattened/nested default text style fields including nested textStyle heightMultiplier output, flattened fontSize/color precedence over nested values, and explicit unsupported fontVariations rejection.")
	console.log("- The executable asserted generated NodeStyle transport and host-native SkPaint/Yoga state for canonical style.antiAlias, legacy style.antiaAlias fallback, canonical precedence when both keys are present, overflow hidden/scroll public strings, generated style.layer JsiSkPaint host-object transport, YogaNode::_layerPaint storage/reset behavior, ordinary _paint separation, and explicit style paint fields overriding SkPaint-backed backgroundColor base paint values.")
	console.log("- The executable asserted pixels/regions for opacity blending, Yoga-derived child coordinates, composed public transform-array rendering, style.layer saveLayer alpha modulation of a child subtree, plain overflow hidden/scroll rectangular clip-to-bounds raster clipping of oversized children, style corner-radius and global style.borderRadius clip-to-bounds raster clipping of full-size children, explicit style.clip rect/rrect/path raster clipping of full-size children, invertClip rect/rrect/path raster clipping, group raster-cache reuse/invalidation, circle/path-trim dynamic raster-cache bypass, point drawing, line stroke drawing, oval/circle/rrect fills, public-shaped path.stroke conversion/rendering, bounded blur-mask-filter inheritance, real JsiSkPath host-object conversion/rendering, expanded synthetic JsiSkImage fit/default rendering, numeric and CSS color-string TextCmd raster evidence, ParagraphCmd measure/raster evidence, and Worklets-backed dynamic circle/rrect/blur/path-trim render-time fallback, resolution, and mutation.")
	console.log("- The executable asserted synthetic ImageCmd fit helper geometry, command state, draw bounds, and bounded raster evidence for fill, omitted/default contain, cover, none, scaleDown, fitWidth, and fitHeight, plus invalid fit rejection in JSIConverter<NodeCommand>::fromJSI(...).")
	console.log("- The executable asserted TextCmd/ParagraphCmd CSS color-string conversion, installed command state, bounded raster evidence for TextCmd rgba(...) plus flattened and nested ParagraphCmd hex colors, named-color conversion, invalid text/paragraph color-string rejection including nested paragraphStyle.textStyle.color, unsupported paragraph fontVariations rejection, and text.textStyle rich-key rejection in JSIConverter<NodeCommand>::fromJSI(...).")
	console.log("- The executable asserted direct StrokeOpts converter canConvert/fromJSI consistency for object, null, undefined, number, boolean, and string payloads; finite rejection for direct width, miter_limit, miterLimit alias fallback, and precision payloads; numeric enum rejection for direct join/cap finite/integer/range violations; public path.stroke width, miter_limit, precision, numeric/string join, and numeric/string cap parsing; miterLimit alias fallback with public-key precedence; StrokeOpts toJSI public miter_limit output; non-object stroke rejection; and invalid join/cap rejection.")
	console.log("- The executable asserted selected dynamic Worklets-backed AnimatedDouble NodeCommand props for circle.radius, rrect.cornerRadius, blurMaskFilter.blur, path.trimStart, and path.trimEnd, including render-time fallback behavior while RN Skia's main runtime is unset, main-runtime numeric resolution, later Synchronizable::setBlocking(...) mutation observation, and invalid dynamic mutation fail-closed behavior through render/object-state evidence.")
	console.log("- Proof boundary: host-native macOS C++ command construction, generated NodeStyle JSIConverter transport for antiAlias/antiaAlias, overflow hidden/scroll, and style.layer JsiSkPaint payloads, YogaNode::setStyle SkPaint antiAlias/Yoga overflow/_clipsToBounds state, _layerPaint storage/reset behavior, ordinary _paint separation from _layerPaint, explicit paint field precedence over SkPaint-backed backgroundColor for borderWidth/stroke width, strokeCap, strokeJoin, strokeMiter, dither, opacity, and blendMode, bounded raster evidence that a composed public transform array reaches render through YogaNode::_matrix/canvas concat, bounded raster evidence that a layer paint alpha modulates a rendered child subtree through saveLayer, bounded plain overflow hidden/scroll rectangular raster clipping through YogaNode::renderToContext() using a GroupCmd parent and oversized RectCmd child, bounded style corner-radius raster clipping through YogaNode::renderToContext() using parent style radii and a full-size child, bounded global style.borderRadius scalar raster clipping through YogaNode::renderToContext() using a GroupCmd parent and full-size RectCmd child, bounded explicit style.clip rect/rrect/path and invertClip rect/rrect/path raster clipping through YogaNode::renderToContext() using a GroupCmd parent and full-size RectCmd child, NodeCommand toJSI converter serialization shape and representative host-JSC/native toJSI/fromJSI round trips, command point finite rejection through JSIConverter<NodeCommand>::fromJSI before a same-type YogaNode::setCommand update can mutate LineCmd/PointsCmd state, static numeric AnimatedDouble command finite rejection through JSIConverter<NodeCommand>::fromJSI before a same-type YogaNode::setCommand update can mutate CircleCmd/RRectCmd/BlurMaskFilterCmd/PathCmd state, dynamic AnimatedDouble native-float validation through AnimatedDouble::resolveNativeFloat before selected render paths narrow or mutate command props, command numeric enum finite/integer/range rejection through JSIConverter<NodeCommand>::fromJSI before a same-type YogaNode::setCommand update can mutate BlurMaskFilterCmd/PointsCmd/PathCmd state, path stroke numeric finite rejection through direct JSIConverter<StrokeOpts>::fromJSI and JSIConverter<NodeCommand>::fromJSI before a same-type YogaNode::setCommand update can mutate PathCmd stroke state, direct StrokeOpts numeric enum finite/integer/range rejection through JSIConverter<StrokeOpts>::fromJSI for join/cap, text/paragraph style numeric finite and native-range-overflow rejection through JSIConverter<NodeCommand>::fromJSI before same-type TextCmd/ParagraphCmd mutation, source-level installed RN Skia field-inventory drift check for SkSamplingOptions, SkTextStyle, SkParagraphStyle, and SkStrutStyle, value-bearing converter coverage for the currently inventoried supported fields, normalized CSS-string-to-SkColor handling for text color fields, unsupported fontVariations rejection, simple TextCmd textStyle fontSize/color plus rich-key rejection, paragraphStyle serialization including disableHinting/replaceTabCharacters/textDirection/textHeightBehavior/strutStyle/textStyle, dual flattened/nested paragraph textStyle output including distinct paragraph/text-style heightMultiplier preservation, flattened/nested unsupported fontVariations rejection, nested paragraphStyle.textStyle CSS string color conversion, and flattened fontSize/color precedence over nested values, selected TextCmd/ParagraphCmd CSS color-string payload conversion/rendering, paragraph measurement, public-shaped path.stroke payload conversion and bounded PathCmd stroke raster evidence, direct StrokeOpts converter top-level value consistency, synthetic in-memory JsiSkImage fit/default/invalid command-render coverage, selected dynamic Worklets-backed AnimatedDouble NodeCommand conversion/resolution for circle.radius, rrect.cornerRadius, blurMaskFilter.blur, path.trimStart, and path.trimEnd, and bounded raster behavior for selected commands. This does not prove future RN Skia public style fields absent from the installed source inventory, nested SharedValue leaves inside opaque SamplingOptions, fontVariations native support or preservation, rich simple TextCmd textStyle rendering, CSS color string preservation, exact transform geometry fidelity beyond the asserted raster points, exact plain overflow clipping beyond the asserted host-raster pixels, exact style corner-radius, global style.borderRadius, or explicit style.clip render fidelity beyond the asserted host-raster pixels, exact path/stroke geometry fidelity, exact typography, font fallback correctness, paragraph shaping fidelity, Nitro toObject()/prototype materialization, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, Reanimated SharedValue delivery, JS listener scheduling, RNGH native delivery, image decoding/assets/loading, local/remote asset resolution, texture-backed images, exact image render fidelity, exact saveLayer/GPU blend fidelity, or every AnimatedDouble command prop.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
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
			"Native linker reported success but the expected YogaNode command/render binary was not created.",
			`diagnostics:\n${formatVerifierTempDiagnostics(diagnosticPaths)}`,
		].join("\n\n"),
	)
}

function assertInstalledStyleSerializerFieldInventory() {
	const errors = []
	for (const spec of styleSerializerFieldInventory) {
		const actualFields = extractExportedInterfaceFields(
			spec.sourcePath,
			spec.interfaceName,
		)
		const inventoriedFields = inventoryFields(spec)
		const duplicateFields = duplicateValues(inventoriedFields)
		const missingFields = actualFields.filter(
			(field) => !inventoriedFields.includes(field),
		)
		const staleFields = inventoriedFields.filter(
			(field) => !actualFields.includes(field),
		)

		if (duplicateFields.length > 0) {
			errors.push(
				`${spec.surface} inventory assigns field(s) to multiple buckets: ${duplicateFields.join(", ")}`,
			)
		}
		if (missingFields.length > 0) {
			errors.push(
				`${spec.surface} has installed public field(s) missing from the inventory: ${missingFields.join(", ")}`,
			)
		}
		if (staleFields.length > 0) {
			errors.push(
				`${spec.surface} inventory contains field(s) no longer present in the installed type: ${staleFields.join(", ")}`,
			)
		}
	}

	const actualSamplingMembers = extractExportedTypeUnionMembers(
		samplingOptionsUnionInventory.sourcePath,
		samplingOptionsUnionInventory.typeName,
	)
	const missingSamplingMembers = actualSamplingMembers.filter(
		(member) => !samplingOptionsUnionInventory.members.includes(member),
	)
	const staleSamplingMembers = samplingOptionsUnionInventory.members.filter(
		(member) => !actualSamplingMembers.includes(member),
	)
	if (missingSamplingMembers.length > 0) {
		errors.push(
			`${samplingOptionsUnionInventory.typeName} has installed union member(s) missing from the inventory: ${missingSamplingMembers.join(", ")}`,
		)
	}
	if (staleSamplingMembers.length > 0) {
		errors.push(
			`${samplingOptionsUnionInventory.typeName} inventory contains union member(s) no longer present in the installed type: ${staleSamplingMembers.join(", ")}`,
		)
	}

	if (errors.length > 0) {
		throw new Error(
			[
				"RN Skia public style serializer field inventory drift detected.",
				"Update the inventory in scripts/verify-yoganode-native-commands-render.mjs after classifying each installed public field as supported, normalized, intentionally unsupported, or outside the local proof boundary.",
				...errors.map((error) => `- ${error}`),
			].join("\n"),
		)
	}
}

function assertCommandPointFiniteValidationInventory() {
	const commandSpecPath = "src/specs/commands.ts"
	const commandSpec = readProjectFile(commandSpecPath)
	const reconciler = readProjectFile("src/Reconciler.ts")
	const nodeCommandConverter = readProjectFile("cpp/JSIConverter+NodeCommand.hpp")
	const nativeVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const materializationVerifier = readProjectFile(
		"scripts/verify-yoganode-nitro-materialization.mjs",
	)

	const lineFields = extractExportedInterfaceFields(
		commandSpecPath,
		"LineCommandPayload",
	)
	const pointsFields = extractExportedInterfaceFields(
		commandSpecPath,
		"PointsCommandPayload",
	)
	assertSource(
		JSON.stringify(lineFields) === JSON.stringify(["from", "to"]) &&
			commandSpec.includes("from: SkPoint") &&
			commandSpec.includes("to: SkPoint"),
		"Public LineCommandPayload must keep the from/to SkPoint inventory and order.",
	)
	assertSource(
		JSON.stringify(pointsFields) === JSON.stringify(["pointMode", "points"]) &&
			commandSpec.includes("points: SkPoint[]"),
		"Public PointsCommandPayload must keep pointMode then points: SkPoint[] inventory and order.",
	)

	assertSource(
		reconciler.includes('line: ["from", "to"],') &&
			reconciler.includes('points: ["pointMode", "points"],') &&
			reconciler.includes('"from"') &&
			reconciler.includes('"to"') &&
			reconciler.includes('"points"'),
		"Reconciler command prop/nested inventories must retain public line and points point payload keys.",
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
	assertSource(
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
	assertSource(
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
	assertSource(
		nodeCommandConverter.includes("parseFinitePointNumber") &&
			nodeCommandConverter.includes("std::isfinite(value)") &&
			nodeCommandConverter.includes("Invalid numeric command point value for ") &&
			nodeCommandConverter.includes('"points.points[" + std::to_string(index) + "]"') &&
			converterLineFromIndex > converterLineIndex &&
			converterLineToIndex > converterLineFromIndex &&
			converterParsePointsIndex > converterPointsIndex,
		"Native NodeCommand converter must finite-check line and indexed points SkPoint payloads with stable path labels.",
	)

	assertSource(
		nativeVerifier.includes("assertCommandPointFiniteRejections(*runtime);") &&
			nativeVerifier.includes("line.from.x NaN") &&
			nativeVerifier.includes("line.from.y Infinity") &&
			nativeVerifier.includes("line.to.x -Infinity") &&
			nativeVerifier.includes("points.points[1].y NaN"),
		"Native command/render verifier must retain non-finite line and indexed points rejection coverage.",
	)
	assertSource(
		materializationVerifier.includes(
			"assertGeneratedCommandPointFiniteRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated line.from.x NaN") &&
			materializationVerifier.includes("generated points.points[1].y NaN"),
		"Generated materialized setCommand verifier must retain non-finite command point rejection coverage.",
	)
}

function assertCommandAnimatedDoubleFiniteValidationInventory() {
	const commandSpecPath = "src/specs/commands.ts"
	const commandSpec = readProjectFile(commandSpecPath)
	const reconciler = readProjectFile("src/Reconciler.ts")
	const animatedDoubleHeader = readProjectFile("cpp/JSIConverter+AnimatedDouble.hpp")
	const animatedDoubleCpp = readProjectFile("cpp/AnimatedDouble.cpp")
	const nodeCommandConverter = readProjectFile("cpp/JSIConverter+NodeCommand.hpp")
	const yogaNodeHeader = readProjectFile("cpp/YogaNode.hpp")
	const nativeVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const materializationVerifier = readProjectFile(
		"scripts/verify-yoganode-nitro-materialization.mjs",
	)

	assertSource(
		JSON.stringify(
			extractExportedInterfaceFields(
				commandSpecPath,
				"RoundedRectCommandPayload",
			),
		) === JSON.stringify(["cornerRadius"]) &&
			commandSpec.includes("cornerRadius?: number"),
		"Public RoundedRectCommandPayload must keep the cornerRadius numeric AnimatedDouble inventory.",
	)
	assertSource(
		JSON.stringify(extractExportedInterfaceFields(commandSpecPath, "PathCommandPayload")) ===
			JSON.stringify(["fillType", "path", "stroke", "trimEnd", "trimStart"]) &&
			commandSpec.includes("trimEnd?: number") &&
			commandSpec.includes("trimStart?: number"),
		"Public PathCommandPayload must keep trimEnd before trimStart in the numeric AnimatedDouble inventory.",
	)
	assertSource(
		JSON.stringify(
			extractExportedInterfaceFields(
				commandSpecPath,
				"BlurMaskFilterCommandPayload",
			),
		) === JSON.stringify(["blur", "blurStyle", "respectCTM"]) &&
			commandSpec.includes("blur?: number"),
		"Public BlurMaskFilterCommandPayload must keep the blur numeric AnimatedDouble inventory.",
	)
	assertSource(
		JSON.stringify(extractExportedInterfaceFields(commandSpecPath, "CircleCommandPayload")) ===
			JSON.stringify(["radius"]) &&
			commandSpec.includes("radius?: number"),
		"Public CircleCommandPayload must keep the radius numeric AnimatedDouble inventory.",
	)

	assertSource(
		reconciler.includes('rrect: ["cornerRadius"],') &&
			reconciler.includes('path: ["fillType", "path", "stroke", "trimEnd", "trimStart"],') &&
			reconciler.includes('blurMaskFilter: ["blur", "blurStyle", "respectCTM"],') &&
			reconciler.includes('circle: ["radius"],'),
		"Reconciler command key inventories must retain static AnimatedDouble command fields and order.",
	)
	const buildRRectIndex = reconciler.indexOf('case "rrect":')
	const buildRRectRadiusIndex = reconciler.indexOf(
		"cornerRadius: optionalCommandNumber(props.cornerRadius)",
		buildRRectIndex,
	)
	const buildCircleIndex = reconciler.indexOf('case "circle":')
	const buildCircleRadiusIndex = reconciler.indexOf(
		"radius: optionalCommandNumber(props.radius)",
		buildCircleIndex,
	)
	const buildPathIndex = reconciler.indexOf('case "path":')
	const buildPathTrimEndIndex = reconciler.indexOf(
		"trimEnd: optionalCommandNumber(props.trimEnd)",
		buildPathIndex,
	)
	const buildPathTrimStartIndex = reconciler.indexOf(
		"trimStart: optionalCommandNumber(props.trimStart)",
		buildPathIndex,
	)
	const buildBlurIndex = reconciler.indexOf('case "blurMaskFilter":')
	const buildBlurIndexField = reconciler.indexOf(
		"blur: optionalCommandNumber(props.blur)",
		buildBlurIndex,
	)
	assertSource(
		buildRRectRadiusIndex > buildRRectIndex &&
			buildCircleRadiusIndex > buildCircleIndex &&
			buildPathTrimEndIndex > buildPathIndex &&
			buildPathTrimStartIndex > buildPathTrimEndIndex &&
			buildBlurIndexField > buildBlurIndex,
		"Reconciler command builders must retain static AnimatedDouble payload extraction order.",
	)

	const converterRRectIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::RRECT:",
	)
	const converterRRectRadiusIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "cornerRadius"), "rrect.cornerRadius")',
		converterRRectIndex,
	)
	const converterBlurIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::BLUR_MASK_FILTER:",
	)
	const converterBlurFieldIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "blur"), "blurMaskFilter.blur")',
		converterBlurIndex,
	)
	const converterPathIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::PATH:",
	)
	const converterPathTrimEndIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "trimEnd"), "path.trimEnd")',
		converterPathIndex,
	)
	const converterPathTrimStartIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "trimStart"), "path.trimStart")',
		converterPathIndex,
	)
	const converterCircleIndex = nodeCommandConverter.indexOf(
		"case NodeCommandKind::CIRCLE:",
	)
	const converterCircleRadiusIndex = nodeCommandConverter.indexOf(
		'parseStaticFiniteAnimatedDouble(runtime, data.getProperty(runtime, "radius"), "circle.radius")',
		converterCircleIndex,
	)
	assertSource(
		nodeCommandConverter.includes("parseStaticFiniteAnimatedDouble") &&
			nodeCommandConverter.includes("std::isfinite(animated.value.value())") &&
			nodeCommandConverter.includes("Invalid numeric AnimatedDouble command value for ") &&
			converterRRectRadiusIndex > converterRRectIndex &&
			converterBlurFieldIndex > converterBlurIndex &&
			converterPathTrimEndIndex > converterPathIndex &&
			converterPathTrimStartIndex > converterPathTrimEndIndex &&
			converterCircleRadiusIndex > converterCircleIndex,
		"Native NodeCommand converter must finite-check static numeric AnimatedDouble command payloads with stable field labels.",
	)

	assertSource(
		animatedDoubleHeader.includes("AnimatedDoubleNativeFloatResolutionState") &&
			animatedDoubleHeader.includes("resolveNativeFloat") &&
			animatedDoubleCpp.includes("std::numeric_limits<float>::max()") &&
			animatedDoubleCpp.includes("AnimatedDoubleNativeFloatResolutionState::Invalid") &&
			yogaNodeHeader.includes("_blur.resolveNativeFloat()") &&
			yogaNodeHeader.includes("_cornerRadius.resolveNativeFloat()") &&
			yogaNodeHeader.includes("_radius.resolveNativeFloat()") &&
			yogaNodeHeader.includes("_trimStart.resolveNativeFloat()") &&
			yogaNodeHeader.includes("_trimEnd.resolveNativeFloat()"),
		"AnimatedDouble render paths must classify native-float validity before selected command prop mutation.",
	)

	assertSource(
		nativeVerifier.includes("assertStaticAnimatedDoubleCommandFiniteRejections(*runtime);") &&
			nativeVerifier.includes("circle.radius NaN") &&
			nativeVerifier.includes("rrect.cornerRadius Infinity") &&
			nativeVerifier.includes("blurMaskFilter.blur -Infinity") &&
			nativeVerifier.includes("path.trimStart NaN") &&
			nativeVerifier.includes("path.trimEnd Infinity"),
		"Native command/render verifier must retain non-finite static AnimatedDouble rejection coverage.",
	)
	assertSource(
		nativeVerifier.includes("dynamic CircleCmd render preserves last valid radius after NaN mutation") &&
			nativeVerifier.includes("dynamic rrect preserves last valid corner radius after native-float-overflow mutation") &&
			nativeVerifier.includes("dynamic blur preserves last valid blur after Infinity mutation") &&
			nativeVerifier.includes("dynamic path trimStart preserves last valid value after NaN mutation") &&
			nativeVerifier.includes("dynamic path trimEnd preserves last valid value after native-float-overflow mutation"),
		"Native command/render verifier must retain dynamic AnimatedDouble fail-closed mutation coverage.",
	)
	assertSource(
		materializationVerifier.includes(
			"assertGeneratedStaticAnimatedDoubleCommandFiniteRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated circle.radius NaN") &&
			materializationVerifier.includes("generated rrect.cornerRadius Infinity") &&
			materializationVerifier.includes("generated blurMaskFilter.blur -Infinity") &&
			materializationVerifier.includes("generated path.trimStart NaN") &&
			materializationVerifier.includes("generated path.trimEnd Infinity"),
		"Generated materialized setCommand verifier must retain non-finite static AnimatedDouble rejection coverage.",
	)
}

function assertPathStrokeNumericFiniteValidationInventory() {
	const commandSpecPath = "src/specs/commands.ts"
	const commandSpec = readProjectFile(commandSpecPath)
	const rnSkiaStrokeOpts = readProjectFile(
		rnSkiaTypesPath("Path", "Path.ts"),
	)
	const reconciler = readProjectFile("src/Reconciler.ts")
	const strokeOptsConverter = readProjectFile("cpp/JSIConverter+StrokeOpts.hpp")
	const nodeCommandConverter = readProjectFile("cpp/JSIConverter+NodeCommand.hpp")
	const nativeVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const materializationVerifier = readProjectFile(
		"scripts/verify-yoganode-nitro-materialization.mjs",
	)

	assertSource(
		JSON.stringify(extractExportedInterfaceFields(commandSpecPath, "PathCommandPayload")) ===
			JSON.stringify(["fillType", "path", "stroke", "trimEnd", "trimStart"]) &&
			commandSpec.includes("stroke?: StrokeOptsNative"),
		"Public PathCommandPayload must keep stroke in the path command inventory.",
	)
	assertSource(
		rnSkiaStrokeOpts.includes("width?: number") &&
			rnSkiaStrokeOpts.includes("miter_limit?: number") &&
			rnSkiaStrokeOpts.includes("precision?: number") &&
			rnSkiaStrokeOpts.includes("join?: StrokeJoin") &&
			rnSkiaStrokeOpts.includes("cap?: StrokeCap"),
		"Installed RN Skia StrokeOpts inventory must retain width, miter_limit, precision, join, and cap fields.",
	)
	assertSource(
		reconciler.includes('path: ["fillType", "path", "stroke", "trimEnd", "trimStart"],') &&
			reconciler.includes("stroke: props.stroke as any"),
		"Reconciler path command inventory must keep forwarding the public stroke payload.",
	)

	const directWidthIndex = strokeOptsConverter.indexOf('"stroke.width"')
	const directMiterIndex = strokeOptsConverter.indexOf('"stroke.miter_limit"')
	const directAliasIndex = strokeOptsConverter.indexOf('"stroke.miterLimit"')
	const directPrecisionIndex = strokeOptsConverter.indexOf('"stroke.precision"')
	assertSource(
		strokeOptsConverter.includes("Invalid numeric stroke value for ") &&
			strokeOptsConverter.includes("std::isfinite(number)") &&
			strokeOptsConverter.includes("std::isfinite(narrowed)") &&
			directWidthIndex >= 0 &&
			directMiterIndex > directWidthIndex &&
			directAliasIndex > directMiterIndex &&
			directPrecisionIndex > directAliasIndex,
		"Direct StrokeOpts converter must finite-check width, miter_limit, miterLimit alias fallback, and precision with stable labels.",
	)

	const parseStrokeIndex = nodeCommandConverter.indexOf("parseStrokeOpts(")
	const pathWidthIndex = nodeCommandConverter.indexOf('"path.stroke.width"', parseStrokeIndex)
	const pathMiterIndex = nodeCommandConverter.indexOf('"path.stroke.miter_limit"', parseStrokeIndex)
	const pathAliasIndex = nodeCommandConverter.indexOf('"path.stroke.miterLimit"', parseStrokeIndex)
	const pathPrecisionIndex = nodeCommandConverter.indexOf('"path.stroke.precision"', parseStrokeIndex)
	assertSource(
		nodeCommandConverter.includes("getOptionalFiniteStrokeProperty") &&
			nodeCommandConverter.includes("Invalid numeric stroke value for ") &&
			nodeCommandConverter.includes("std::isfinite(*parsed)") &&
			pathWidthIndex > parseStrokeIndex &&
			pathMiterIndex > pathWidthIndex &&
			pathAliasIndex > pathMiterIndex &&
			pathPrecisionIndex > pathAliasIndex,
		"Native NodeCommand path stroke parser must finite-check width, miter_limit, miterLimit alias fallback, and precision with stable path labels.",
	)

	assertSource(
		nativeVerifier.includes("assertPathStrokeNumericFiniteRejections(*runtime);") &&
			nativeVerifier.includes("path.stroke.width NaN") &&
			nativeVerifier.includes("path.stroke.miter_limit Infinity") &&
			nativeVerifier.includes("path.stroke.miterLimit -Infinity") &&
			nativeVerifier.includes("path.stroke.precision NaN") &&
			nativeVerifier.includes("assertStrokeOptsConverterFiniteRejections(*runtime);"),
		"Native command/render verifier must retain path stroke numeric finite rejection and direct StrokeOpts finite rejection coverage.",
	)
	assertSource(
		materializationVerifier.includes(
			"assertGeneratedPathStrokeNumericFiniteRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated path.stroke.width NaN") &&
			materializationVerifier.includes("generated path.stroke.miter_limit Infinity") &&
			materializationVerifier.includes("generated path.stroke.miterLimit -Infinity") &&
			materializationVerifier.includes("generated path.stroke.precision NaN"),
		"Generated materialized setCommand verifier must retain path stroke numeric finite rejection coverage.",
	)
}

function assertCommandNumericEnumValidationInventory() {
	const nodeCommandConverter = readProjectFile("cpp/JSIConverter+NodeCommand.hpp")
	const strokeOptsConverter = readProjectFile("cpp/JSIConverter+StrokeOpts.hpp")
	const nativeVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const materializationVerifier = readProjectFile(
		"scripts/verify-yoganode-nitro-materialization.mjs",
	)

	assertSource(
		nodeCommandConverter.includes("Invalid numeric enum value for ") &&
			nodeCommandConverter.includes("std::trunc(number)") &&
			nodeCommandConverter.includes('"blurMaskFilter.blurStyle"') &&
			nodeCommandConverter.includes('"points.pointMode"') &&
			nodeCommandConverter.includes('"path.fillType"') &&
			nodeCommandConverter.includes('"path.stroke.join"') &&
			nodeCommandConverter.includes('"path.stroke.cap"') &&
			nodeCommandConverter.includes("SkBlurStyle::kInner_SkBlurStyle") &&
			nodeCommandConverter.includes("SkCanvas::PointMode::kPolygon_PointMode") &&
			nodeCommandConverter.includes("SkPathFillType::kInverseEvenOdd") &&
			nodeCommandConverter.includes("SkPaint::Join::kBevel_Join") &&
			nodeCommandConverter.includes("SkPaint::Cap::kSquare_Cap"),
		"NodeCommand converter must finite/integer/range-check public numeric enum command payloads with stable paths.",
	)
	assertSource(
		strokeOptsConverter.includes("Invalid numeric enum value for ") &&
			strokeOptsConverter.includes("std::trunc(number)") &&
			strokeOptsConverter.includes('"stroke.join"') &&
			strokeOptsConverter.includes('"stroke.cap"') &&
			strokeOptsConverter.includes("SkPaint::Join::kBevel_Join") &&
			strokeOptsConverter.includes("SkPaint::Cap::kSquare_Cap"),
		"Direct StrokeOpts converter must finite/integer/range-check public numeric join/cap payloads with stable paths.",
	)
	assertSource(
		nativeVerifier.includes("assertCommandNumericEnumRejections(*runtime);") &&
			nativeVerifier.includes("blurMaskFilter.blurStyle NaN") &&
			nativeVerifier.includes("points.pointMode fractional") &&
			nativeVerifier.includes("path.fillType out-of-range") &&
			nativeVerifier.includes("path.stroke.join fractional") &&
			nativeVerifier.includes("path.stroke.cap out-of-range") &&
			nativeVerifier.includes("assertStrokeOptsConverterNumericEnumRejections(*runtime);") &&
			nativeVerifier.includes("stroke.join NaN") &&
			nativeVerifier.includes("stroke.cap fractional"),
		"Native command/render verifier must retain command and direct StrokeOpts numeric enum rejection coverage.",
	)
	assertSource(
		materializationVerifier.includes(
			"assertGeneratedCommandNumericEnumRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated blurMaskFilter.blurStyle NaN") &&
			materializationVerifier.includes("generated points.pointMode fractional") &&
			materializationVerifier.includes("generated path.fillType out-of-range") &&
			materializationVerifier.includes("generated path.stroke.join fractional") &&
			materializationVerifier.includes("generated path.stroke.cap out-of-range"),
		"Generated materialized setCommand verifier must retain command numeric enum rejection coverage.",
	)
}

function assertTextParagraphStyleNumericFiniteValidationInventory() {
	const textStyleConverter = readProjectFile("cpp/JSIConverter+SkTextStyle.hpp")
	const paragraphStyleConverter = readProjectFile(
		"cpp/JSIConverter+SkParagraphStyle.hpp",
	)
	const nativeVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const materializationVerifier = readProjectFile(
		"scripts/verify-yoganode-nitro-materialization.mjs",
	)

	const textLabels = [
		'stylePath + ".fontSize"',
		'stylePath + ".decorationThickness"',
		'stylePath + ".fontFeatures["',
		'stylePath + ".fontStyle.weight"',
		'stylePath + ".heightMultiplier"',
		'stylePath + ".letterSpacing"',
		'stylePath + ".wordSpacing"',
		'stylePath + ".shadows["',
		'stylePath + ".textBaseline"',
	]
	for (const label of textLabels) {
		assertSource(
			textStyleConverter.includes(label),
			`TextStyle numeric finite validation must retain path label ${label}.`,
		)
	}

	const paragraphLabels = [
		"ParagraphStyle.heightMultiplier",
		"ParagraphStyle.maxLines",
		"ParagraphStyle.textAlign",
		"ParagraphStyle.textDirection",
		"ParagraphStyle.textHeightBehavior",
		"ParagraphStyle.strutStyle.fontSize",
		"ParagraphStyle.strutStyle.heightMultiplier",
		"ParagraphStyle.strutStyle.leading",
		"ParagraphStyle.textStyle",
	]
	for (const label of paragraphLabels) {
		assertSource(
			paragraphStyleConverter.includes(label) ||
				textStyleConverter.includes(label),
			`ParagraphStyle numeric finite validation must retain path label ${label}.`,
		)
	}

	assertSource(
		textStyleConverter.includes("validateTextStyleNumericFields") &&
			textStyleConverter.includes("getRequiredFiniteStyleFloat") &&
			textStyleConverter.includes("getRequiredFiniteStyleInt") &&
			textStyleConverter.includes("parseFiniteTextStylePoint") &&
			textStyleConverter.includes("std::isfinite(number)") &&
			textStyleConverter.includes("std::isfinite(narrowed)") &&
			textStyleConverter.includes("std::numeric_limits<int>::max()") &&
			textStyleConverter.includes("Invalid numeric text/paragraph style value for "),
		"TextStyle converter must finite/range-check public numeric float, int, enum, and shadow point leaves.",
	)
	assertSource(
		paragraphStyleConverter.includes("validateParagraphStyleNumericFields") &&
			paragraphStyleConverter.includes("getRequiredFiniteParagraphStyleSize") &&
			paragraphStyleConverter.includes("validateParagraphStyleStrutStyleNumericFields") &&
			paragraphStyleConverter.indexOf("validateParagraphStyleNumericFields(runtime, arg);") <
				paragraphStyleConverter.indexOf("auto paragraphStyle = paragraphStyleBaseFromValue(runtime, arg);"),
		"ParagraphStyle converter must validate paragraph and strut numeric leaves before delegating to RN Skia raw parsing.",
	)
	assertSource(
		nativeVerifier.includes("assertTextParagraphStyleNumericFiniteRejections(*runtime);") &&
			nativeVerifier.includes("text.textStyle.fontSize NaN") &&
			nativeVerifier.includes("text.textStyle.fontSize float overflow") &&
			nativeVerifier.includes("paragraph.paragraphStyle.textStyle.fontSize NaN") &&
			nativeVerifier.includes("paragraph.paragraphStyle.strutStyle.leading -Infinity") &&
			nativeVerifier.includes("paragraph.paragraphStyle.maxLines fractional") &&
			nativeVerifier.includes("paragraph.paragraphStyle.fontFeatures[0].value fractional") &&
			nativeVerifier.includes("paragraph.paragraphStyle.fontFeatures[0].value int overflow"),
		"Native command/render verifier must retain text and paragraph style numeric finite/range state-preservation coverage.",
	)
	assertSource(
		materializationVerifier.includes(
			"assertGeneratedTextParagraphStyleNumericFiniteRejections(*runtime);",
		) &&
			materializationVerifier.includes("generated text.textStyle.fontSize NaN") &&
			materializationVerifier.includes("generated text.textStyle.fontSize float overflow") &&
			materializationVerifier.includes("generated paragraph.paragraphStyle.textStyle.fontSize NaN") &&
			materializationVerifier.includes("generated paragraph.paragraphStyle.strutStyle.leading -Infinity") &&
			materializationVerifier.includes(
				"generated paragraph.paragraphStyle.fontFeatures[0].value int overflow",
			),
		"Generated materialized setCommand verifier must retain text and paragraph style numeric finite/range state-preservation coverage.",
	)
}

function formatStyleInventorySummary() {
	return [
		`${samplingOptionsUnionInventory.typeName} union=${samplingOptionsUnionInventory.members.join("|")}`,
		...styleSerializerFieldInventory.map((spec) => {
			const buckets = spec.buckets
			return [
				`${spec.surface} supported=[${buckets.supportedParseSerialized.join(",")}]`,
				`normalized=[${buckets.supportedWithNativeNormalization.join(",") || "none"}]`,
				`unsupported=[${buckets.intentionallyUnsupported.join(",") || "none"}]`,
				`outside-field-proof=[${buckets.outsideLocalFidelityProof.join(",") || "none"}]`,
			].join(" ")
		}),
	].join("; ")
}

function inventoryFields(spec) {
	return Object.values(spec.buckets).flat()
}

function duplicateValues(values) {
	const seen = new Set()
	const duplicates = new Set()
	for (const value of values) {
		if (seen.has(value)) {
			duplicates.add(value)
		}
		seen.add(value)
	}
	return [...duplicates]
}

function assertSource(condition, message) {
	if (!condition) {
		throw new Error(message)
	}
}

function extractExportedInterfaceFields(sourcePath, interfaceName) {
	const source = readProjectFile(sourcePath)
	const interfaceMatch = source.match(
		new RegExp(
			`export\\s+interface\\s+${escapeRegExp(interfaceName)}\\s*\\{([\\s\\S]*?)\\n\\}`,
		),
	)
	if (!interfaceMatch) {
		throw new Error(
			`Unable to find installed RN Skia interface ${interfaceName} in ${sourcePath}.`,
		)
	}

	const body = interfaceMatch[1]
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/\/\/.*$/gm, "")
	return [...body.matchAll(/^\s*([A-Za-z_$][\w$]*)\??\s*:/gm)].map(
		(match) => match[1],
	)
}

function extractExportedTypeUnionMembers(sourcePath, typeName) {
	const source = readProjectFile(sourcePath)
	const typeMatch = source.match(
		new RegExp(`export\\s+type\\s+${escapeRegExp(typeName)}\\s*=\\s*([^;]+);`),
	)
	if (!typeMatch) {
		throw new Error(
			`Unable to find installed RN Skia type alias ${typeName} in ${sourcePath}.`,
		)
	}

	return typeMatch[1]
		.split("|")
		.map((member) => member.trim())
		.filter(Boolean)
}

function readProjectFile(sourcePath) {
	return readFileSync(projectPathChecked(sourcePath), "utf8")
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

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function helperSourcePaths() {
	return [
		"cpp/ColorParser.cpp",
		"cpp/AnimatedDouble.cpp",
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
			"Unable to locate RN Skia macOS archives required for YogaNode native command/render verification.",
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
#include <cstdint>
#include <cstdlib>
#include <exception>
#include <functional>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <sstream>
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
#include <include/core/SkPixmap.h>
#include <include/core/SkRect.h>
#include <include/core/SkSamplingOptions.h>
#include <include/core/SkStream.h>
#include <include/ports/SkFontMgr_mac_ct.h>
#if !defined(SK_GRAPHITE)
#include <include/gpu/ganesh/GrDirectContext.h>
#endif
#include <include/core/SkSurface.h>
#include <jsi/jsi.h>
#include <SharedItems/Serializable.h>
#include <SharedItems/Synchronizable.h>
#include <yoga/Yoga.h>

#include "JSCRuntime.h"
#include "RuntimeAwareCache.h"
#include "DrawingCtx.h"
#include "RNSkPlatformContext.h"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::AnimatedDouble;
using margelo::nitro::RNSkiaYoga::BlendMode;
using margelo::nitro::RNSkiaYoga::BlurMaskFilterCommandData;
using margelo::nitro::RNSkiaYoga::GroupCommandData;
using margelo::nitro::RNSkiaYoga::NodeCommand;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::CircleCommandData;
using margelo::nitro::RNSkiaYoga::ImageCommandData;
using margelo::nitro::RNSkiaYoga::LineCmd;
using margelo::nitro::RNSkiaYoga::LineCommandData;
using margelo::nitro::RNSkiaYoga::NodeCommandKind;
using margelo::nitro::RNSkiaYoga::Overflow;
using margelo::nitro::RNSkiaYoga::ParagraphCommandData;
using margelo::nitro::RNSkiaYoga::PathCommandData;
using margelo::nitro::RNSkiaYoga::PointsCmd;
using margelo::nitro::RNSkiaYoga::PointsCommandData;
using margelo::nitro::RNSkiaYoga::Position;
using margelo::nitro::RNSkiaYoga::RoundedRectCommandData;
using margelo::nitro::RNSkiaYoga::StrokeCap;
using margelo::nitro::RNSkiaYoga::StrokeJoin;
using margelo::nitro::RNSkiaYoga::TextCommandData;
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

using NodeTransformOperation = std::variant<
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

namespace {

void fail(const std::string& message)
{
    std::cerr << "FAIL: " << message << "\n";
    std::abort();
}

void expect(bool condition, const std::string& message)
{
    if (!condition) {
        fail(message);
    }
}

void expectNear(double actual, double expected, const std::string& message, double tolerance = 0.001)
{
    if (std::fabs(actual - expected) > tolerance) {
        std::ostringstream out;
        out << message << " expected " << expected << " but got " << actual;
        fail(out.str());
    }
}

void expectOptionalNear(const std::optional<double>& actual, double expected, const std::string& message)
{
    expect(actual.has_value(), message + " must have a value");
    expectNear(*actual, expected, message);
}

void expectOptionalFloatNear(const std::optional<float>& actual, double expected, const std::string& message)
{
    expect(actual.has_value(), message + " must have a value");
    expectNear(*actual, expected, message);
}

void expectFiniteNativeFloat(float actual, double expected, const std::string& message)
{
    expect(std::isfinite(actual), message + " must be finite");
    expect(
        std::abs(static_cast<double>(actual)) <= static_cast<double>(std::numeric_limits<float>::max()),
        message + " must be within native float range");
    expectNear(actual, expected, message);
}

void expectNoOptionalValue(const std::optional<double>& actual, const std::string& message)
{
    expect(!actual.has_value(), message + " must not have a value");
}

void expectColorNear(SkColor actual, SkColor expected, int tolerance, const std::string& message)
{
    const auto close = [&](int actualChannel, int expectedChannel) {
        return std::abs(actualChannel - expectedChannel) <= tolerance;
    };

    if (!close(SkColorGetA(actual), SkColorGetA(expected)) ||
        !close(SkColorGetR(actual), SkColorGetR(expected)) ||
        !close(SkColorGetG(actual), SkColorGetG(expected)) ||
        !close(SkColorGetB(actual), SkColorGetB(expected))) {
        std::ostringstream out;
        out << message
            << " expected rgba("
            << SkColorGetR(expected) << ", "
            << SkColorGetG(expected) << ", "
            << SkColorGetB(expected) << ", "
            << SkColorGetA(expected) << ") but got rgba("
            << SkColorGetR(actual) << ", "
            << SkColorGetG(actual) << ", "
            << SkColorGetB(actual) << ", "
            << SkColorGetA(actual) << ")";
        fail(out.str());
    }
}

template <typename Fn>
void expectJsiThrows(Fn&& fn, const std::string& expectedSubstring, const std::string& message)
{
    try {
        fn();
    } catch (const jsi::JSError& error) {
        const auto actual = error.getMessage();
        if (actual.find(expectedSubstring) != std::string::npos) {
            return;
        }
        fail(message + " wrong error message: " + actual);
    } catch (const std::exception& error) {
        const std::string actual = error.what();
        if (actual.find(expectedSubstring) != std::string::npos) {
            return;
        }
        fail(message + " wrong std::exception message: " + actual);
    }

    fail(message + " did not throw");
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

std::variant<std::string, double> points(double value)
{
    return std::variant<std::string, double> { value };
}

double nativeFloatOverflowValue()
{
    return static_cast<double>(std::numeric_limits<float>::max()) * 2.0;
}

SkPaint colorPaint(SkColor color)
{
    SkPaint paint;
    paint.setStyle(SkPaint::kFill_Style);
    paint.setColor(color);
    paint.setAntiAlias(false);
    return paint;
}

NodeStyle fixedStyle(double width, double height, SkColor color, std::optional<double> opacity = std::nullopt)
{
    NodeStyle style {};
    style.width = points(width);
    style.height = points(height);
    style.backgroundColor = colorPaint(color);
    style.antiAlias = false;
    if (opacity.has_value()) {
        style.opacity = opacity;
    }
    return style;
}

NodeStyle strokeStyle(double width, double height, SkColor color, float strokeWidth)
{
    NodeStyle style {};
    style.width = points(width);
    style.height = points(height);
    SkPaint paint;
    paint.setStyle(SkPaint::kStroke_Style);
    paint.setColor(color);
    paint.setAntiAlias(false);
    paint.setStrokeWidth(strokeWidth);
    paint.setStrokeCap(SkPaint::kButt_Cap);
    style.backgroundColor = paint;
    style.antiAlias = false;
    return style;
}

NodeStyle absoluteStyle(double left, double top, double width, double height, SkColor color)
{
    auto style = fixedStyle(width, height, color);
    style.position = Position::ABSOLUTE;
    style.left = points(left);
    style.top = points(top);
    return style;
}

NodeStyle absoluteStrokeStyle(double left, double top, double width, double height, SkColor color, float strokeWidth)
{
    auto style = strokeStyle(width, height, color, strokeWidth);
    style.position = Position::ABSOLUTE;
    style.left = points(left);
    style.top = points(top);
    return style;
}

NodeStyle groupStyle(double width, double height)
{
    NodeStyle style {};
    style.width = points(width);
    style.height = points(height);
    style.antiAlias = false;
    return style;
}

NodeStyle widthOnlyStyle(double width)
{
    NodeStyle style {};
    style.width = points(width);
    style.antiAlias = false;
    return style;
}

NodeStyle pointsStyle(double width, double height, SkColor color)
{
    auto style = fixedStyle(width, height, color);
    auto paint = colorPaint(color);
    paint.setStrokeWidth(5.0f);
    paint.setStrokeCap(SkPaint::kRound_Cap);
    style.backgroundColor = paint;
    return style;
}

sk_sp<SkSurface> makeSurface(int width, int height, SkColor clearColor = SK_ColorTRANSPARENT)
{
    auto surface = SkSurfaces::Raster(SkImageInfo::MakeN32Premul(width, height));
    expect(surface != nullptr, "raster SkSurface must be created");
    surface->getCanvas()->clear(clearColor);
    return surface;
}

sk_sp<SkImage> makeImageFitProbeImage()
{
    auto surface = makeSurface(8, 4);
    auto* canvas = surface->getCanvas();
    auto paint = colorPaint(SK_ColorRED);
    canvas->drawRect(SkRect::MakeXYWH(0.0f, 0.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorGREEN);
    canvas->drawRect(SkRect::MakeXYWH(2.0f, 0.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorBLUE);
    canvas->drawRect(SkRect::MakeXYWH(4.0f, 0.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorYELLOW);
    canvas->drawRect(SkRect::MakeXYWH(6.0f, 0.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorCYAN);
    canvas->drawRect(SkRect::MakeXYWH(0.0f, 2.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorMAGENTA);
    canvas->drawRect(SkRect::MakeXYWH(2.0f, 2.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorWHITE);
    canvas->drawRect(SkRect::MakeXYWH(4.0f, 2.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorBLACK);
    canvas->drawRect(SkRect::MakeXYWH(6.0f, 2.0f, 2.0f, 2.0f), paint);

    auto image = surface->makeImageSnapshot();
    expect(image != nullptr, "synthetic image-fit SkImage must be created");
    expect(image->width() == 8, "synthetic image-fit SkImage width");
    expect(image->height() == 4, "synthetic image-fit SkImage height");
    return image;
}

std::shared_ptr<worklets::Serializable> makeSerializableNumberValue(
    jsi::Runtime& runtime,
    double number)
{
    auto serializableValue = worklets::makeSerializableNumber(runtime, number);
    return worklets::extractSerializableOrThrow(runtime, serializableValue);
}

std::shared_ptr<worklets::Synchronizable> makeSynchronizable(
    jsi::Runtime& runtime,
    double number)
{
    return std::make_shared<worklets::Synchronizable>(
        makeSerializableNumberValue(runtime, number));
}

jsi::Value makeSynchronizableRefValue(
    jsi::Runtime& runtime,
    const std::shared_ptr<worklets::Synchronizable>& synchronizable)
{
    auto ref = worklets::SerializableJSRef::newNativeStateObject(runtime, synchronizable);
    return jsi::Value(runtime, ref);
}

jsi::Value makeWrongSerializableRefValue(jsi::Runtime& runtime)
{
    return worklets::makeSerializableNumber(runtime, 91.0);
}

SkColor pixelAt(const sk_sp<SkSurface>& surface, int x, int y)
{
    SkPixmap pixmap;
    expect(surface->peekPixels(&pixmap), "raster surface pixels must be readable");
    return pixmap.getColor(x, y);
}

bool hasAnyAlphaInRegion(const sk_sp<SkSurface>& surface, int left, int top, int right, int bottom)
{
    for (int y = top; y < bottom; ++y) {
        for (int x = left; x < right; ++x) {
            if (SkColorGetA(pixelAt(surface, x, y)) > 0) {
                return true;
            }
        }
    }
    return false;
}

bool hasAnyBlueDominantPixelInRegion(const sk_sp<SkSurface>& surface, int left, int top, int right, int bottom)
{
    for (int y = top; y < bottom; ++y) {
        for (int x = left; x < right; ++x) {
            const auto color = pixelAt(surface, x, y);
            if (
                SkColorGetA(color) > 0 &&
                SkColorGetB(color) > 48 &&
                SkColorGetB(color) > SkColorGetR(color) + 16 &&
                SkColorGetB(color) > SkColorGetG(color) + 16) {
                return true;
            }
        }
    }
    return false;
}

bool hasAnyRedDominantPixelInRegion(const sk_sp<SkSurface>& surface, int left, int top, int right, int bottom)
{
    for (int y = top; y < bottom; ++y) {
        for (int x = left; x < right; ++x) {
            const auto color = pixelAt(surface, x, y);
            if (
                SkColorGetA(color) > 0 &&
                SkColorGetR(color) > 48 &&
                SkColorGetR(color) > SkColorGetG(color) + 16 &&
                SkColorGetR(color) > SkColorGetB(color) + 16) {
                return true;
            }
        }
    }
    return false;
}

bool hasAnyGreenDominantPixelInRegion(const sk_sp<SkSurface>& surface, int left, int top, int right, int bottom)
{
    for (int y = top; y < bottom; ++y) {
        for (int x = left; x < right; ++x) {
            const auto color = pixelAt(surface, x, y);
            if (
                SkColorGetA(color) > 0 &&
                SkColorGetG(color) > 48 &&
                SkColorGetG(color) > SkColorGetR(color) + 16 &&
                SkColorGetG(color) > SkColorGetB(color) + 16) {
                return true;
            }
        }
    }
    return false;
}

void renderNode(const std::shared_ptr<YogaNode>& node, const sk_sp<SkSurface>& surface)
{
    RNSkia::DrawingCtx ctx(surface->getCanvas());
    node->renderToContext(ctx);
}

jsi::Object makePaintHostObject(jsi::Runtime& runtime, const SkPaint& paint)
{
    return jsi::Object::createFromHostObject(
        runtime,
        std::make_shared<RNSkia::JsiSkPaint>(
            margelo::nitro::RNSkiaYoga::GetPlatformContext(),
            SkPaint(paint)));
}

jsi::Object makePointObject(jsi::Runtime& runtime, double x, double y)
{
    jsi::Object point(runtime);
    point.setProperty(runtime, "x", x);
    point.setProperty(runtime, "y", y);
    return point;
}

NodeCommand convertCommand(jsi::Runtime& runtime, jsi::Object command)
{
    jsi::Value commandValue(runtime, command);
    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
        "NodeCommand converter must accept the probe payload");
    return margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
}

void expectConvertedSetCommandRejects(
    jsi::Runtime& runtime,
    YogaNode& node,
    jsi::Object command,
    const std::string& expectedMessage,
    const char* message)
{
    try {
        auto converted = convertCommand(runtime, std::move(command));
        node.setCommand(std::move(converted));
    } catch (const jsi::JSError& error) {
        const auto actual = error.getMessage();
        if (actual.find(expectedMessage) != std::string::npos) {
            return;
        }
        std::cerr << "FAIL: " << message << " wrong error message: " << actual << "\n";
        std::abort();
    }

    std::cerr << "FAIL: " << message << " did not throw\n";
    std::abort();
}

jsi::Value serializedCommandValue(jsi::Runtime& runtime, const NodeCommand& command, const std::string& label)
{
    auto serialized = margelo::nitro::JSIConverter<NodeCommand>::toJSI(runtime, command);
    expect(serialized.isObject(), label + " toJSI returns an object");
    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, serialized),
        label + " serialized command keeps the NodeCommand transport shape");
    return serialized;
}

jsi::Object serializedDataObject(
    jsi::Runtime& runtime,
    const jsi::Value& serialized,
    const std::string& expectedType,
    const std::string& label)
{
    auto object = serialized.asObject(runtime);
    expect(
        object.getProperty(runtime, "type").asString(runtime).utf8(runtime) == expectedType,
        label + " serialized type");
    auto dataValue = object.getProperty(runtime, "data");
    expect(dataValue.isObject(), label + " serialized data object");
    return dataValue.asObject(runtime);
}

NodeCommand roundTripSerializedCommand(jsi::Runtime& runtime, const jsi::Value& serialized, const std::string& label)
{
    (void)label;
    return margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, serialized);
}

void expectSerializedPoint(
    jsi::Runtime& runtime,
    const jsi::Value& pointValue,
    double expectedX,
    double expectedY,
    const std::string& label)
{
    expect(pointValue.isObject(), label + " point is an object");
    auto point = pointValue.asObject(runtime);
    expectNear(point.getProperty(runtime, "x").asNumber(), expectedX, label + " x");
    expectNear(point.getProperty(runtime, "y").asNumber(), expectedY, label + " y");
}

void expectSerializedStringArray(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const std::vector<std::string>& expected,
    const std::string& label)
{
    expect(value.isObject(), label + " is an array object");
    auto array = value.asObject(runtime).asArray(runtime);
    expect(array.size(runtime) == expected.size(), label + " size");
    for (size_t index = 0; index < expected.size(); ++index) {
        expect(
            array.getValueAtIndex(runtime, index).asString(runtime).utf8(runtime) == expected[index],
            label + "[" + std::to_string(index) + "]");
    }
}

void expectSerializedStrutStyle(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const std::string& label)
{
    expect(value.isObject(), label + " is an object");
    auto object = value.asObject(runtime);
    expect(object.getProperty(runtime, "strutEnabled").getBool(), label + " strutEnabled");
    expectSerializedStringArray(
        runtime,
        object.getProperty(runtime, "fontFamilies"),
        { "StrutSans", "StrutFallback" },
        label + " fontFamilies");
    auto fontStyle = object.getProperty(runtime, "fontStyle").asObject(runtime);
    expectNear(
        fontStyle.getProperty(runtime, "weight").asNumber(),
        static_cast<double>(SkFontStyle::Weight::kMedium_Weight),
        label + " fontStyle.weight");
    expectNear(
        fontStyle.getProperty(runtime, "width").asNumber(),
        static_cast<double>(SkFontStyle::Width::kCondensed_Width),
        label + " fontStyle.width");
    expectNear(
        fontStyle.getProperty(runtime, "slant").asNumber(),
        static_cast<double>(SkFontStyle::Slant::kOblique_Slant),
        label + " fontStyle.slant");
    expectNear(object.getProperty(runtime, "fontSize").asNumber(), 23.0, label + " fontSize");
    expectNear(object.getProperty(runtime, "heightMultiplier").asNumber(), 1.6, label + " heightMultiplier");
    expect(object.getProperty(runtime, "halfLeading").getBool(), label + " halfLeading");
    expectNear(object.getProperty(runtime, "leading").asNumber(), 3.25, label + " leading");
    expect(object.getProperty(runtime, "forceStrutHeight").getBool(), label + " forceStrutHeight");
}

SkColor expectedTextStyleBackgroundColor()
{
    return SkColorSetARGB(255, 0x10, 0x20, 0x30);
}

SkColor expectedTextStyleForegroundColor()
{
    return SkColorSetARGB(255, 0x20, 0x30, 0x40);
}

SkColor expectedTextStyleDecorationColor()
{
    return SkColorSetARGB(255, 0x44, 0x55, 0x66);
}

SkColor expectedTextStyleShadowColor()
{
    return SkColorSetARGB(255, 0x07, 0x08, 0x09);
}

void expectSerializedTextStyle(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    double expectedFontSize,
    SkColor expectedColor,
    const std::string& label,
    std::optional<double> expectedHeightMultiplier = 1.35)
{
    expect(value.isObject(), label + " is an object");
    auto object = value.asObject(runtime);
    expectNear(object.getProperty(runtime, "fontSize").asNumber(), expectedFontSize, label + " fontSize");
    expectNear(object.getProperty(runtime, "color").asNumber(), static_cast<double>(expectedColor), label + " numeric color");
    expectSerializedStringArray(
        runtime,
        object.getProperty(runtime, "fontFamilies"),
        { "Inter", "System" },
        label + " fontFamilies");
    auto fontFeatures = object.getProperty(runtime, "fontFeatures").asObject(runtime).asArray(runtime);
    expect(fontFeatures.size(runtime) == 2, label + " fontFeatures size");
    auto fontFeature0 = fontFeatures.getValueAtIndex(runtime, 0).asObject(runtime);
    expect(
        fontFeature0.getProperty(runtime, "name").asString(runtime).utf8(runtime) == "kern",
        label + " fontFeatures[0].name");
    expectNear(fontFeature0.getProperty(runtime, "value").asNumber(), 1.0, label + " fontFeatures[0].value");
    auto fontFeature1 = fontFeatures.getValueAtIndex(runtime, 1).asObject(runtime);
    expect(
        fontFeature1.getProperty(runtime, "name").asString(runtime).utf8(runtime) == "liga",
        label + " fontFeatures[1].name");
    expectNear(fontFeature1.getProperty(runtime, "value").asNumber(), 0.0, label + " fontFeatures[1].value");
    expectNear(
        object.getProperty(runtime, "backgroundColor").asNumber(),
        static_cast<double>(expectedTextStyleBackgroundColor()),
        label + " normalized backgroundColor");
    expectNear(
        object.getProperty(runtime, "foregroundColor").asNumber(),
        static_cast<double>(expectedTextStyleForegroundColor()),
        label + " normalized foregroundColor");
    expectNear(
        object.getProperty(runtime, "decoration").asNumber(),
        static_cast<double>(skia::textlayout::kUnderline | skia::textlayout::kOverline),
        label + " decoration");
    expectNear(
        object.getProperty(runtime, "decorationColor").asNumber(),
        static_cast<double>(expectedTextStyleDecorationColor()),
        label + " normalized decorationColor");
    expectNear(
        object.getProperty(runtime, "decorationThickness").asNumber(),
        1.75,
        label + " decorationThickness");
    expectNear(
        object.getProperty(runtime, "decorationStyle").asNumber(),
        static_cast<double>(skia::textlayout::kWavy),
        label + " decorationStyle");
    auto fontStyle = object.getProperty(runtime, "fontStyle").asObject(runtime);
    expectNear(
        fontStyle.getProperty(runtime, "weight").asNumber(),
        static_cast<double>(SkFontStyle::Weight::kBold_Weight),
        label + " fontStyle.weight");
    expectNear(
        fontStyle.getProperty(runtime, "width").asNumber(),
        static_cast<double>(SkFontStyle::Width::kExpanded_Width),
        label + " fontStyle.width");
    expectNear(
        fontStyle.getProperty(runtime, "slant").asNumber(),
        static_cast<double>(SkFontStyle::Slant::kItalic_Slant),
        label + " fontStyle.slant");
    if (expectedHeightMultiplier.has_value()) {
        expect(object.hasProperty(runtime, "heightMultiplier"), label + " has heightMultiplier");
        expectNear(
            object.getProperty(runtime, "heightMultiplier").asNumber(),
            expectedHeightMultiplier.value(),
            label + " heightMultiplier");
    }
    expect(object.getProperty(runtime, "halfLeading").getBool(), label + " halfLeading");
    expectNear(object.getProperty(runtime, "letterSpacing").asNumber(), 1.25, label + " letterSpacing");
    expectNear(object.getProperty(runtime, "wordSpacing").asNumber(), 2.5, label + " wordSpacing");
    expect(
        object.getProperty(runtime, "locale").asString(runtime).utf8(runtime) == "en-US",
        label + " locale");
    auto shadows = object.getProperty(runtime, "shadows").asObject(runtime).asArray(runtime);
    expect(shadows.size(runtime) == 1, label + " shadows size");
    auto shadow = shadows.getValueAtIndex(runtime, 0).asObject(runtime);
    expectNear(
        shadow.getProperty(runtime, "color").asNumber(),
        static_cast<double>(expectedTextStyleShadowColor()),
        label + " shadow color");
    auto offset = shadow.getProperty(runtime, "offset").asObject(runtime);
    expectNear(offset.getProperty(runtime, "x").asNumber(), 3.0, label + " shadow offset.x");
    expectNear(offset.getProperty(runtime, "y").asNumber(), 4.0, label + " shadow offset.y");
    expectNear(shadow.getProperty(runtime, "blurRadius").asNumber(), 2.25, label + " shadow blurRadius");
    expectNear(
        object.getProperty(runtime, "textBaseline").asNumber(),
        static_cast<double>(static_cast<int>(skia::textlayout::TextBaseline::kIdeographic)),
        label + " textBaseline");
}

void expectSerializedSimpleTextStyle(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    double expectedFontSize,
    SkColor expectedColor,
    const std::string& label)
{
    expect(value.isObject(), label + " is an object");
    auto object = value.asObject(runtime);
    expectNear(object.getProperty(runtime, "fontSize").asNumber(), expectedFontSize, label + " fontSize");
    expectNear(object.getProperty(runtime, "color").asNumber(), static_cast<double>(expectedColor), label + " numeric color");

    const char* richKeys[] = {
        "backgroundColor",
        "decoration",
        "decorationColor",
        "decorationStyle",
        "decorationThickness",
        "fontFamilies",
        "fontFeatures",
        "fontStyle",
        "fontVariations",
        "foregroundColor",
        "halfLeading",
        "height",
        "heightMultiplier",
        "letterSpacing",
        "locale",
        "shadows",
        "textBaseline",
        "wordSpacing",
    };
    for (const auto* key : richKeys) {
        expect(!object.hasProperty(runtime, key), label + " omits rich key " + key);
    }
}

void expectSimpleTextStyleState(
    const skia::textlayout::TextStyle& textStyle,
    double expectedFontSize,
    SkColor expectedColor,
    const std::string& label)
{
    expectNear(textStyle.getFontSize(), expectedFontSize, label + " fontSize");
    expectColorNear(textStyle.getColor(), expectedColor, 0, label + " color");
}

void expectTextStyleState(
    const skia::textlayout::TextStyle& textStyle,
    double expectedFontSize,
    SkColor expectedColor,
    const std::string& label,
    double expectedHeightMultiplier = 1.35)
{
    expectNear(textStyle.getFontSize(), expectedFontSize, label + " fontSize");
    expectColorNear(textStyle.getColor(), expectedColor, 0, label + " color");
    const auto& families = textStyle.getFontFamilies();
    expect(families.size() == 2, label + " fontFamilies size");
    expect(std::string(families[0].c_str(), families[0].size()) == "Inter", label + " fontFamilies[0]");
    expect(std::string(families[1].c_str(), families[1].size()) == "System", label + " fontFamilies[1]");
    const auto fontFeatures = textStyle.getFontFeatures();
    expect(fontFeatures.size() == 2, label + " fontFeatures size");
    expect(std::string(fontFeatures[0].fName.c_str(), fontFeatures[0].fName.size()) == "kern", label + " fontFeatures[0].name");
    expect(fontFeatures[0].fValue == 1, label + " fontFeatures[0].value");
    expect(std::string(fontFeatures[1].fName.c_str(), fontFeatures[1].fName.size()) == "liga", label + " fontFeatures[1].name");
    expect(fontFeatures[1].fValue == 0, label + " fontFeatures[1].value");
    expect(textStyle.hasBackground(), label + " has backgroundColor");
    expectColorNear(
        textStyle.getBackground().getColor(),
        expectedTextStyleBackgroundColor(),
        0,
        label + " backgroundColor");
    expect(textStyle.hasForeground(), label + " has foregroundColor");
    expectColorNear(
        textStyle.getForeground().getColor(),
        expectedTextStyleForegroundColor(),
        0,
        label + " foregroundColor");
    expect(
        textStyle.getDecorationType() == static_cast<skia::textlayout::TextDecoration>(
            skia::textlayout::kUnderline | skia::textlayout::kOverline),
        label + " decoration");
    expectColorNear(
        textStyle.getDecorationColor(),
        expectedTextStyleDecorationColor(),
        0,
        label + " decorationColor");
    expectNear(textStyle.getDecorationThicknessMultiplier(), 1.75, label + " decorationThickness");
    expect(textStyle.getDecorationStyle() == skia::textlayout::kWavy, label + " decorationStyle");
    const auto fontStyle = textStyle.getFontStyle();
    expect(fontStyle.weight() == SkFontStyle::Weight::kBold_Weight, label + " fontStyle.weight");
    expect(fontStyle.width() == SkFontStyle::Width::kExpanded_Width, label + " fontStyle.width");
    expect(fontStyle.slant() == SkFontStyle::Slant::kItalic_Slant, label + " fontStyle.slant");
    expect(textStyle.getHeightOverride(), label + " height override");
    expectNear(textStyle.getHeight(), expectedHeightMultiplier, label + " heightMultiplier");
    expect(textStyle.getHalfLeading(), label + " halfLeading");
    expectNear(textStyle.getLetterSpacing(), 1.25, label + " letterSpacing");
    expectNear(textStyle.getWordSpacing(), 2.5, label + " wordSpacing");
    const auto locale = textStyle.getLocale();
    expect(std::string(locale.c_str(), locale.size()) == "en-US", label + " locale");
    const auto shadows = textStyle.getShadows();
    expect(shadows.size() == 1, label + " shadows size");
    expectColorNear(shadows[0].fColor, expectedTextStyleShadowColor(), 0, label + " shadow color");
    expectNear(shadows[0].fOffset.x(), 3.0, label + " shadow offset.x");
    expectNear(shadows[0].fOffset.y(), 4.0, label + " shadow offset.y");
    expectNear(shadows[0].fBlurSigma, 2.25, label + " shadow blurRadius");
    expect(
        textStyle.getTextBaseline() == skia::textlayout::TextBaseline::kIdeographic,
        label + " textBaseline");
}

void expectStrutStyleState(
    const skia::textlayout::StrutStyle& strutStyle,
    const std::string& label)
{
    expect(strutStyle.getStrutEnabled(), label + " strutEnabled");
    const auto& families = strutStyle.getFontFamilies();
    expect(families.size() == 2, label + " fontFamilies size");
    expect(std::string(families[0].c_str(), families[0].size()) == "StrutSans", label + " fontFamilies[0]");
    expect(std::string(families[1].c_str(), families[1].size()) == "StrutFallback", label + " fontFamilies[1]");
    const auto fontStyle = strutStyle.getFontStyle();
    expect(fontStyle.weight() == SkFontStyle::Weight::kMedium_Weight, label + " fontStyle.weight");
    expect(fontStyle.width() == SkFontStyle::Width::kCondensed_Width, label + " fontStyle.width");
    expect(fontStyle.slant() == SkFontStyle::Slant::kOblique_Slant, label + " fontStyle.slant");
    expectNear(strutStyle.getFontSize(), 23.0, label + " fontSize");
    expect(strutStyle.getHeightOverride(), label + " height override");
    expectNear(strutStyle.getHeight(), 1.6, label + " heightMultiplier");
    expect(strutStyle.getHalfLeading(), label + " halfLeading");
    expectNear(strutStyle.getLeading(), 3.25, label + " leading");
    expect(strutStyle.getForceStrutHeight(), label + " forceStrutHeight");
}

void expectSerializedParagraphStyle(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const std::string& label)
{
    expect(value.isObject(), label + " is an object");
    auto object = value.asObject(runtime);
    expectNear(
        object.getProperty(runtime, "textAlign").asNumber(),
        static_cast<int>(skia::textlayout::TextAlign::kCenter),
        label + " textAlign");
    expectNear(object.getProperty(runtime, "maxLines").asNumber(), 2.0, label + " maxLines");
    expectNear(object.getProperty(runtime, "heightMultiplier").asNumber(), 1.35, label + " heightMultiplier");
    expect(object.getProperty(runtime, "disableHinting").getBool(), label + " disableHinting");
    expect(object.getProperty(runtime, "replaceTabCharacters").getBool(), label + " replaceTabCharacters");
    expectNear(
        object.getProperty(runtime, "textDirection").asNumber(),
        static_cast<int>(skia::textlayout::TextDirection::kRtl),
        label + " textDirection");
    expectNear(
        object.getProperty(runtime, "textHeightBehavior").asNumber(),
        static_cast<int>(skia::textlayout::TextHeightBehavior::kDisableAll),
        label + " textHeightBehavior");
    expect(
        object.getProperty(runtime, "ellipsis").asString(runtime).utf8(runtime) == "...",
        label + " ellipsis");
    expectSerializedStrutStyle(runtime, object.getProperty(runtime, "strutStyle"), label + " strutStyle");
    expectSerializedTextStyle(
        runtime,
        value,
        18.0,
        SK_ColorBLUE,
        label + " flattened-compatible textStyle",
        std::nullopt);
    expectSerializedTextStyle(
        runtime,
        object.getProperty(runtime, "textStyle"),
        18.0,
        SK_ColorBLUE,
        label + " nested textStyle");
}

void expectSerializedParagraphStyleDistinctTextStyleHeight(
    jsi::Runtime& runtime,
    const jsi::Value& value,
    const std::string& label)
{
    expect(value.isObject(), label + " is an object");
    auto object = value.asObject(runtime);
    expectNear(
        object.getProperty(runtime, "heightMultiplier").asNumber(),
        1.75,
        label + " paragraph heightMultiplier");
    expectSerializedTextStyle(
        runtime,
        value,
        24.0,
        SK_ColorGREEN,
        label + " flattened-compatible textStyle",
        std::nullopt);
    expectSerializedTextStyle(
        runtime,
        object.getProperty(runtime, "textStyle"),
        24.0,
        SK_ColorGREEN,
        label + " nested textStyle",
        1.25);
}

void expectParagraphStyleDistinctTextStyleHeightState(
    const skia::textlayout::ParagraphStyle& paragraphStyle,
    const std::string& label)
{
    expectNear(paragraphStyle.getHeight(), 1.75, label + " paragraph heightMultiplier");
    expectTextStyleState(paragraphStyle.getTextStyle(), 24.0, SK_ColorGREEN, label + " textStyle", 1.25);
}

void expectParagraphStyleState(
    const skia::textlayout::ParagraphStyle& paragraphStyle,
    const std::string& label)
{
    expect(
        paragraphStyle.getTextAlign() == skia::textlayout::TextAlign::kCenter,
        label + " textAlign");
    expect(paragraphStyle.getMaxLines() == 2, label + " maxLines");
    expectNear(paragraphStyle.getHeight(), 1.35, label + " heightMultiplier");
    expect(!paragraphStyle.hintingIsOn(), label + " disableHinting");
    expect(paragraphStyle.getReplaceTabCharacters(), label + " replaceTabCharacters");
    expect(
        paragraphStyle.getTextDirection() == skia::textlayout::TextDirection::kRtl,
        label + " textDirection");
    expect(
        paragraphStyle.getTextHeightBehavior() == skia::textlayout::TextHeightBehavior::kDisableAll,
        label + " textHeightBehavior");
    expect(paragraphStyle.getEllipsisUtf16() == std::u16string(u"..."), label + " ellipsis");
    expectStrutStyleState(paragraphStyle.getStrutStyle(), label + " strutStyle");
    expectTextStyleState(paragraphStyle.getTextStyle(), 18.0, SK_ColorBLUE, label + " textStyle");
}

void expectPathBounds(
    const SkPath& path,
    float expectedLeft,
    float expectedTop,
    float expectedWidth,
    float expectedHeight,
    const std::string& label)
{
    const auto bounds = path.getBounds();
    expectNear(bounds.left(), expectedLeft, label + " left");
    expectNear(bounds.top(), expectedTop, label + " top");
    expectNear(bounds.width(), expectedWidth, label + " width");
    expectNear(bounds.height(), expectedHeight, label + " height");
}

NodeCommand rectCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "rect");
    command.setProperty(runtime, "data", jsi::Object(runtime));
    return convertCommand(runtime, std::move(command));
}

NodeCommand groupCommand(jsi::Runtime& runtime, bool rasterize)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "rasterize", rasterize);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "group");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand pointsCommand(jsi::Runtime& runtime)
{
    jsi::Array points(runtime, 1);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, 12.0, 12.0)));

    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", "points");
    data.setProperty(runtime, "points", std::move(points));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand pointsSerializationCommand(jsi::Runtime& runtime)
{
    jsi::Array points(runtime, 2);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, 2.0, 4.0)));
    points.setValueAtIndex(runtime, 1, jsi::Value(runtime, makePointObject(runtime, 14.0, 18.0)));

    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", "polygon");
    data.setProperty(runtime, "points", std::move(points));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object pointsCommandObject(
    jsi::Runtime& runtime,
    double firstX,
    double firstY,
    double secondX,
    double secondY)
{
    jsi::Array points(runtime, 2);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, firstX, firstY)));
    points.setValueAtIndex(runtime, 1, jsi::Value(runtime, makePointObject(runtime, secondX, secondY)));

    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", "lines");
    data.setProperty(runtime, "points", std::move(points));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

jsi::Object pointsCommandObjectWithNumericPointMode(
    jsi::Runtime& runtime,
    double pointMode)
{
    jsi::Array points(runtime, 2);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, 3.0, 4.0)));
    points.setValueAtIndex(runtime, 1, jsi::Value(runtime, makePointObject(runtime, 13.0, 14.0)));

    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", pointMode);
    data.setProperty(runtime, "points", std::move(points));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

jsi::Object lineCommandObject(
    jsi::Runtime& runtime,
    double fromX,
    double fromY,
    double toX,
    double toY)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "from", makePointObject(runtime, fromX, fromY));
    data.setProperty(runtime, "to", makePointObject(runtime, toX, toY));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "line");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand lineCommand(jsi::Runtime& runtime)
{
    auto command = lineCommandObject(runtime, 0.0, 3.0, 20.0, 3.0);
    return convertCommand(runtime, std::move(command));
}

NodeCommand ovalCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "oval");
    command.setProperty(runtime, "data", jsi::Object(runtime));
    return convertCommand(runtime, std::move(command));
}

jsi::Object circleCommandObject(jsi::Runtime& runtime, double radius)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "radius", radius);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "circle");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand circleCommand(jsi::Runtime& runtime)
{
    auto command = circleCommandObject(runtime, 8.0);
    return convertCommand(runtime, std::move(command));
}

NodeCommand dynamicCircleCommand(
    jsi::Runtime& runtime,
    const std::shared_ptr<worklets::Synchronizable>& radius)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "radius", makeSynchronizableRefValue(runtime, radius));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "circle");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object rrectCommandObject(jsi::Runtime& runtime, double cornerRadius)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "cornerRadius", cornerRadius);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "rrect");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand rrectCommand(jsi::Runtime& runtime)
{
    auto command = rrectCommandObject(runtime, 5.0);
    return convertCommand(runtime, std::move(command));
}

NodeCommand dynamicRRectCommand(
    jsi::Runtime& runtime,
    const std::shared_ptr<worklets::Synchronizable>& cornerRadius)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "cornerRadius", makeSynchronizableRefValue(runtime, cornerRadius));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "rrect");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object blurMaskFilterCommandObject(jsi::Runtime& runtime, double blur)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", blur);
    data.setProperty(runtime, "blurStyle", "normal");
    data.setProperty(runtime, "respectCTM", false);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

jsi::Object blurMaskFilterCommandObjectWithNumericBlurStyle(
    jsi::Runtime& runtime,
    double blurStyle)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", 4.0);
    data.setProperty(runtime, "blurStyle", blurStyle);
    data.setProperty(runtime, "respectCTM", false);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand blurMaskFilterCommand(jsi::Runtime& runtime)
{
    auto command = blurMaskFilterCommandObject(runtime, 4.0);
    return convertCommand(runtime, std::move(command));
}

NodeCommand dynamicBlurMaskFilterCommand(
    jsi::Runtime& runtime,
    const std::shared_ptr<worklets::Synchronizable>& blur)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", makeSynchronizableRefValue(runtime, blur));
    data.setProperty(runtime, "blurStyle", "normal");
    data.setProperty(runtime, "respectCTM", false);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand blurMaskFilterSerializationCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", 3.5);
    data.setProperty(runtime, "blurStyle", "inner");
    data.setProperty(runtime, "respectCTM", true);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

SkPath makeTrimProbePath()
{
    SkPath path;
    path.moveTo(0.0f, 6.0f);
    path.lineTo(20.0f, 6.0f);
    path.lineTo(20.0f, 12.0f);
    return path;
}

jsi::Object pathTrimCommandObject(
    jsi::Runtime& runtime,
    double trimStart,
    double trimEnd)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object data(runtime);
    data.setProperty(runtime, "fillType", "winding");
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "trimStart", trimStart);
    data.setProperty(runtime, "trimEnd", trimEnd);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

jsi::Object pathTrimCommandObjectWithNumericFillType(
    jsi::Runtime& runtime,
    double fillType)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object data(runtime);
    data.setProperty(runtime, "fillType", fillType);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand pathCommand(jsi::Runtime& runtime)
{
    auto command = pathTrimCommandObject(runtime, 0.0, 1.0);
    return convertCommand(runtime, std::move(command));
}

jsi::Object pathStrokeCommandObject(
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

    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", std::move(stroke));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

jsi::Object pathStrokeCommandObjectWithNumericEnums(
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

    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", std::move(stroke));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand publicPathStrokeCommand(jsi::Runtime& runtime)
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

    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", std::move(stroke));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand pathSerializationCommand(jsi::Runtime& runtime)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(1.0f, 2.0f, 10.0f, 6.0f));

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

    jsi::Object data(runtime);
    data.setProperty(runtime, "fillType", "evenOdd");
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", std::move(stroke));
    data.setProperty(runtime, "trimStart", 0.25);
    data.setProperty(runtime, "trimEnd", 0.75);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand pathStrokeAliasPrecedenceCommand(jsi::Runtime& runtime)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object stroke(runtime);
    stroke.setProperty(runtime, "width", 3.0);
    stroke.setProperty(runtime, "miterLimit", 2.0);
    stroke.setProperty(runtime, "miter_limit", 9.0);
    stroke.setProperty(runtime, "join", "round");
    stroke.setProperty(runtime, "cap", "butt");

    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", std::move(stroke));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object pathCommandObjectWithStrokeValue(jsi::Runtime& runtime, jsi::Value stroke)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "stroke", std::move(stroke));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand dynamicPathTrimCommand(
    jsi::Runtime& runtime,
    const std::shared_ptr<worklets::Synchronizable>& trimStart,
    const std::shared_ptr<worklets::Synchronizable>& trimEnd)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, makeTrimProbePath()));
    data.setProperty(runtime, "trimStart", makeSynchronizableRefValue(runtime, trimStart));
    data.setProperty(runtime, "trimEnd", makeSynchronizableRefValue(runtime, trimEnd));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object imageCommandObject(jsi::Runtime& runtime, std::optional<std::string> fit)
{
    jsi::Object sampling(runtime);
    sampling.setProperty(
        runtime,
        "filter",
        static_cast<double>(static_cast<int>(SkFilterMode::kNearest)));
    sampling.setProperty(
        runtime,
        "mipmap",
        static_cast<double>(static_cast<int>(SkMipmapMode::kLinear)));

    auto imageHostObject = jsi::Object::createFromHostObject(
        runtime,
        std::make_shared<RNSkia::JsiSkImage>(
            margelo::nitro::RNSkiaYoga::GetPlatformContext(),
            makeImageFitProbeImage()));

    jsi::Object data(runtime);
    if (fit.has_value()) {
        data.setProperty(runtime, "fit", fit->c_str());
    }
    data.setProperty(runtime, "image", std::move(imageHostObject));
    data.setProperty(runtime, "sampling", std::move(sampling));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "image");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand imageCommand(jsi::Runtime& runtime, std::optional<std::string> fit)
{
    auto command = imageCommandObject(runtime, std::move(fit));
    return convertCommand(runtime, std::move(command));
}

jsi::Object textStyleObject(jsi::Runtime& runtime, double fontSize, SkColor color)
{
    jsi::Object textStyle(runtime);
    textStyle.setProperty(runtime, "fontSize", fontSize);
    textStyle.setProperty(runtime, "color", static_cast<double>(color));
    return textStyle;
}

jsi::Object textStyleObject(jsi::Runtime& runtime, double fontSize, const char* color)
{
    jsi::Object textStyle(runtime);
    textStyle.setProperty(runtime, "fontSize", fontSize);
    textStyle.setProperty(runtime, "color", color);
    return textStyle;
}

jsi::Array stringArray(jsi::Runtime& runtime, const std::vector<std::string>& values)
{
    jsi::Array array(runtime, values.size());
    for (size_t index = 0; index < values.size(); ++index) {
        array.setValueAtIndex(runtime, index, values[index]);
    }
    return array;
}

jsi::Object pointObject(jsi::Runtime& runtime, double x, double y)
{
    jsi::Object point(runtime);
    point.setProperty(runtime, "x", x);
    point.setProperty(runtime, "y", y);
    return point;
}

jsi::Array textStyleShadowArray(jsi::Runtime& runtime)
{
    jsi::Array shadows(runtime, 1);
    jsi::Object shadow(runtime);
    shadow.setProperty(runtime, "color", "#070809");
    shadow.setProperty(runtime, "offset", pointObject(runtime, 3.0, 4.0));
    shadow.setProperty(runtime, "blurRadius", 2.25);
    shadows.setValueAtIndex(runtime, 0, std::move(shadow));
    return shadows;
}

jsi::Array textStyleFontFeatureArray(jsi::Runtime& runtime)
{
    jsi::Array fontFeatures(runtime, 2);
    jsi::Object kern(runtime);
    kern.setProperty(runtime, "name", "kern");
    kern.setProperty(runtime, "value", 1.0);
    fontFeatures.setValueAtIndex(runtime, 0, std::move(kern));

    jsi::Object liga(runtime);
    liga.setProperty(runtime, "name", "liga");
    liga.setProperty(runtime, "value", 0.0);
    fontFeatures.setValueAtIndex(runtime, 1, std::move(liga));
    return fontFeatures;
}

jsi::Array textStyleFontVariationArray(jsi::Runtime& runtime)
{
    jsi::Array fontVariations(runtime, 1);
    jsi::Object weight(runtime);
    weight.setProperty(runtime, "axis", "wght");
    weight.setProperty(runtime, "value", 700.0);
    fontVariations.setValueAtIndex(runtime, 0, std::move(weight));
    return fontVariations;
}

jsi::Object richTextStyleObject(jsi::Runtime& runtime, double fontSize, SkColor color)
{
    jsi::Object textStyle(runtime);
    textStyle.setProperty(runtime, "fontSize", fontSize);
    textStyle.setProperty(runtime, "color", static_cast<double>(color));
    textStyle.setProperty(runtime, "fontFamilies", stringArray(runtime, { "Inter", "System" }));
    textStyle.setProperty(runtime, "fontFeatures", textStyleFontFeatureArray(runtime));
    textStyle.setProperty(runtime, "backgroundColor", static_cast<double>(expectedTextStyleBackgroundColor()));
    textStyle.setProperty(runtime, "foregroundColor", "#203040");
    textStyle.setProperty(
        runtime,
        "decoration",
        static_cast<double>(skia::textlayout::kUnderline | skia::textlayout::kOverline));
    textStyle.setProperty(runtime, "decorationColor", "#445566");
    textStyle.setProperty(runtime, "decorationThickness", 1.75);
    textStyle.setProperty(runtime, "decorationStyle", static_cast<double>(skia::textlayout::kWavy));
    jsi::Object fontStyle(runtime);
    fontStyle.setProperty(runtime, "weight", static_cast<double>(SkFontStyle::Weight::kBold_Weight));
    fontStyle.setProperty(runtime, "width", static_cast<double>(SkFontStyle::Width::kExpanded_Width));
    fontStyle.setProperty(runtime, "slant", static_cast<double>(SkFontStyle::Slant::kItalic_Slant));
    textStyle.setProperty(runtime, "fontStyle", std::move(fontStyle));
    textStyle.setProperty(runtime, "heightMultiplier", 1.35);
    textStyle.setProperty(runtime, "halfLeading", true);
    textStyle.setProperty(runtime, "letterSpacing", 1.25);
    textStyle.setProperty(runtime, "wordSpacing", 2.5);
    textStyle.setProperty(runtime, "locale", "en-US");
    textStyle.setProperty(runtime, "shadows", textStyleShadowArray(runtime));
    textStyle.setProperty(
        runtime,
        "textBaseline",
        static_cast<double>(static_cast<int>(skia::textlayout::TextBaseline::kIdeographic)));
    return textStyle;
}

jsi::Object textStyleWithFontVariationsObject(jsi::Runtime& runtime)
{
    auto textStyle = textStyleObject(runtime, 18.0, SK_ColorBLACK);
    textStyle.setProperty(runtime, "fontVariations", textStyleFontVariationArray(runtime));
    return textStyle;
}

jsi::Object strutStyleObject(jsi::Runtime& runtime, bool includeHeightMultiplier = true)
{
    jsi::Object strutStyle(runtime);
    strutStyle.setProperty(runtime, "strutEnabled", true);
    strutStyle.setProperty(runtime, "fontFamilies", stringArray(runtime, { "StrutSans", "StrutFallback" }));
    jsi::Object fontStyle(runtime);
    fontStyle.setProperty(runtime, "weight", static_cast<double>(SkFontStyle::Weight::kMedium_Weight));
    fontStyle.setProperty(runtime, "width", static_cast<double>(SkFontStyle::Width::kCondensed_Width));
    fontStyle.setProperty(runtime, "slant", static_cast<double>(SkFontStyle::Slant::kOblique_Slant));
    strutStyle.setProperty(runtime, "fontStyle", std::move(fontStyle));
    strutStyle.setProperty(runtime, "fontSize", 23.0);
    if (includeHeightMultiplier) {
        strutStyle.setProperty(runtime, "heightMultiplier", 1.6);
    }
    strutStyle.setProperty(runtime, "halfLeading", true);
    strutStyle.setProperty(runtime, "leading", 3.25);
    strutStyle.setProperty(runtime, "forceStrutHeight", true);
    return strutStyle;
}

jsi::Object paragraphStyleSerializationObject(jsi::Runtime& runtime)
{
    auto paragraphStyle = richTextStyleObject(runtime, 18.0, SK_ColorBLUE);
    paragraphStyle.setProperty(
        runtime,
        "textAlign",
        static_cast<double>(static_cast<int>(skia::textlayout::TextAlign::kCenter)));
    paragraphStyle.setProperty(runtime, "maxLines", 2.0);
    paragraphStyle.setProperty(runtime, "disableHinting", true);
    paragraphStyle.setProperty(runtime, "replaceTabCharacters", true);
    paragraphStyle.setProperty(
        runtime,
        "textDirection",
        static_cast<double>(static_cast<int>(skia::textlayout::TextDirection::kRtl)));
    paragraphStyle.setProperty(
        runtime,
        "textHeightBehavior",
        static_cast<double>(static_cast<int>(skia::textlayout::TextHeightBehavior::kDisableAll)));
    paragraphStyle.setProperty(runtime, "strutStyle", strutStyleObject(runtime));
    paragraphStyle.setProperty(runtime, "ellipsis", "...");
    return paragraphStyle;
}

jsi::Object paragraphStyleWithNestedFontVariationsObject(jsi::Runtime& runtime)
{
    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "textStyle", textStyleWithFontVariationsObject(runtime));
    return paragraphStyle;
}

jsi::Object paragraphStyleWithNestedTextStyleObject(jsi::Runtime& runtime, double fontSize, const char* color)
{
    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "textStyle", textStyleObject(runtime, fontSize, color));
    return paragraphStyle;
}

jsi::Object paragraphStyleWithDistinctNestedTextStyleHeightObject(jsi::Runtime& runtime)
{
    auto textStyle = richTextStyleObject(runtime, 24.0, SK_ColorGREEN);
    textStyle.setProperty(runtime, "heightMultiplier", 1.25);

    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "heightMultiplier", 1.75);
    paragraphStyle.setProperty(runtime, "textStyle", std::move(textStyle));
    return paragraphStyle;
}

jsi::Object paragraphStyleWithFlattenedAndNestedTextStyleObject(jsi::Runtime& runtime)
{
    auto paragraphStyle = paragraphStyleWithNestedTextStyleObject(runtime, 16.0, "#00ff00");
    paragraphStyle.setProperty(runtime, "fontSize", 22.0);
    paragraphStyle.setProperty(runtime, "color", "#ff0000");
    return paragraphStyle;
}

NodeCommand textSerializationCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Serializable styled text");
    data.setProperty(runtime, "textStyle", textStyleObject(runtime, 21.0, SK_ColorMAGENTA));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand defaultTextCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Default Text");

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand styledTextCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Bounded Text");
    data.setProperty(runtime, "textStyle", textStyleObject(runtime, 18.0, SK_ColorBLUE));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand cssColorTextCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "CSS Text");
    data.setProperty(runtime, "textStyle", textStyleObject(runtime, 19.0, "rgba(255,0,0,1)"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand namedColorTextCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Named Color");
    data.setProperty(runtime, "textStyle", textStyleObject(runtime, 17.0, "blue"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object textCommandObjectWithTextStyleFontSize(jsi::Runtime& runtime, double fontSize)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Invalid Text");
    data.setProperty(runtime, "textStyle", textStyleObject(runtime, fontSize, SK_ColorRED));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

NodeCommand paragraphCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Paragraph host text");
    data.setProperty(runtime, "paragraphStyle", textStyleObject(runtime, 18.0, SK_ColorBLUE));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object paragraphCommandObjectWithStyle(jsi::Runtime& runtime, jsi::Object paragraphStyle)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Invalid paragraph text");
    data.setProperty(runtime, "paragraphStyle", std::move(paragraphStyle));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    return command;
}

jsi::Object paragraphStyleWithFlattenedFontSize(jsi::Runtime& runtime, double fontSize)
{
    return textStyleObject(runtime, fontSize, SK_ColorBLUE);
}

jsi::Object paragraphStyleWithNestedFontSize(jsi::Runtime& runtime, double fontSize)
{
    return paragraphStyleWithNestedTextStyleObject(runtime, fontSize, "#00ff00");
}

jsi::Object paragraphStyleWithFontFeatureValue(jsi::Runtime& runtime, double value)
{
    auto paragraphStyle = textStyleObject(runtime, 18.0, SK_ColorBLUE);
    jsi::Array fontFeatures(runtime, 1);
    jsi::Object feature(runtime);
    feature.setProperty(runtime, "name", "kern");
    feature.setProperty(runtime, "value", value);
    fontFeatures.setValueAtIndex(runtime, 0, std::move(feature));
    paragraphStyle.setProperty(runtime, "fontFeatures", std::move(fontFeatures));
    return paragraphStyle;
}

jsi::Object paragraphStyleWithStrutLeading(jsi::Runtime& runtime, double leading)
{
    jsi::Object paragraphStyle(runtime);
    auto strutStyle = strutStyleObject(runtime);
    strutStyle.setProperty(runtime, "leading", leading);
    paragraphStyle.setProperty(runtime, "strutStyle", std::move(strutStyle));
    return paragraphStyle;
}

jsi::Object paragraphStyleWithMaxLines(jsi::Runtime& runtime, double maxLines)
{
    jsi::Object paragraphStyle(runtime);
    paragraphStyle.setProperty(runtime, "maxLines", maxLines);
    return paragraphStyle;
}

NodeCommand paragraphSerializationCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "paragraph", jsi::Value::null());
    data.setProperty(runtime, "text", "Serializable paragraph text");
    data.setProperty(runtime, "paragraphStyle", paragraphStyleSerializationObject(runtime));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand paragraphDistinctTextStyleHeightSerializationCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "paragraph", jsi::Value::null());
    data.setProperty(runtime, "text", "Serializable distinct-height paragraph");
    data.setProperty(runtime, "paragraphStyle", paragraphStyleWithDistinctNestedTextStyleHeightObject(runtime));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand cssColorParagraphCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "CSS paragraph text");
    data.setProperty(runtime, "paragraphStyle", textStyleObject(runtime, 18.0, "#00ff00"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand nestedCssColorParagraphCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Nested CSS paragraph text");
    data.setProperty(runtime, "paragraphStyle", paragraphStyleWithNestedTextStyleObject(runtime, 18.0, "#00ff00"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

std::shared_ptr<YogaNode> makeYogaNode(NodeStyle style, NodeCommand command)
{
    auto node = std::make_shared<YogaNode>();
    node->setStyle(style);
    node->setCommand(std::move(command));
    return node;
}

NodeStyle convertNodeStyle(jsi::Runtime& runtime, jsi::Object styleObject, const std::string& label)
{
    jsi::Value styleValue(runtime, styleObject);
    expect(
        margelo::nitro::JSIConverter<NodeStyle>::canConvert(runtime, styleValue),
        label + " generated NodeStyle converter accepts the style object");
    return margelo::nitro::JSIConverter<NodeStyle>::fromJSI(runtime, styleValue);
}

void assertNodeStyleAntiAliasTransportAndPaint(jsi::Runtime& runtime)
{
    {
        jsi::Object styleObject(runtime);
        styleObject.setProperty(runtime, "antiAlias", false);
        auto style = convertNodeStyle(runtime, std::move(styleObject), "canonical antiAlias");
        expect(style.antiAlias.has_value(), "canonical antiAlias populates NodeStyle.antiAlias");
        expect(!style.antiAlias.value(), "canonical antiAlias keeps false value");
        expect(!style.antiaAlias.has_value(), "canonical antiAlias does not populate legacy NodeStyle.antiaAlias");

        auto serialized = margelo::nitro::JSIConverter<NodeStyle>::toJSI(runtime, style);
        expect(serialized.isObject(), "canonical antiAlias NodeStyle toJSI returns an object");
        auto serializedStyle = serialized.asObject(runtime);
        expect(!serializedStyle.getProperty(runtime, "antiAlias").getBool(), "canonical antiAlias serializes under antiAlias");
        expect(serializedStyle.getProperty(runtime, "antiaAlias").isUndefined(), "canonical antiAlias does not serialize a legacy value");

        YogaNode node;
        node._paint.setAntiAlias(true);
        node.setStyle(style);
        expect(!node._paint.isAntiAlias(), "canonical antiAlias false reaches SkPaint::setAntiAlias(false)");

        auto styleWithPaint = style;
        SkPaint backgroundPaint;
        backgroundPaint.setAntiAlias(true);
        styleWithPaint.backgroundColor = backgroundPaint;
        YogaNode nodeWithPaint;
        nodeWithPaint.setStyle(styleWithPaint);
        expect(!nodeWithPaint._paint.isAntiAlias(), "canonical antiAlias applies after SkPaint backgroundColor assignment");
    }

    {
        jsi::Object styleObject(runtime);
        styleObject.setProperty(runtime, "antiaAlias", true);
        auto style = convertNodeStyle(runtime, std::move(styleObject), "legacy antiaAlias");
        expect(!style.antiAlias.has_value(), "legacy antiaAlias does not populate canonical NodeStyle.antiAlias");
        expect(style.antiaAlias.has_value(), "legacy antiaAlias populates NodeStyle.antiaAlias");
        expect(style.antiaAlias.value(), "legacy antiaAlias keeps true value");

        auto serialized = margelo::nitro::JSIConverter<NodeStyle>::toJSI(runtime, style);
        expect(serialized.isObject(), "legacy antiaAlias NodeStyle toJSI returns an object");
        auto serializedStyle = serialized.asObject(runtime);
        expect(serializedStyle.getProperty(runtime, "antiAlias").isUndefined(), "legacy antiaAlias does not invent canonical serialization");
        expect(serializedStyle.getProperty(runtime, "antiaAlias").getBool(), "legacy antiaAlias serializes under antiaAlias");

        YogaNode node;
        node._paint.setAntiAlias(false);
        node.setStyle(style);
        expect(node._paint.isAntiAlias(), "legacy antiaAlias falls back to SkPaint::setAntiAlias(true)");
    }

    {
        jsi::Object styleObject(runtime);
        styleObject.setProperty(runtime, "antiAlias", false);
        styleObject.setProperty(runtime, "antiaAlias", true);
        auto style = convertNodeStyle(runtime, std::move(styleObject), "antiAlias precedence");
        expect(style.antiAlias.has_value(), "precedence style populates NodeStyle.antiAlias");
        expect(style.antiaAlias.has_value(), "precedence style preserves legacy NodeStyle.antiaAlias");
        expect(!style.antiAlias.value(), "precedence style keeps canonical false value");
        expect(style.antiaAlias.value(), "precedence style keeps legacy true value");

        YogaNode node;
        node._paint.setAntiAlias(true);
        node.setStyle(style);
        expect(!node._paint.isAntiAlias(), "canonical antiAlias wins over legacy antiaAlias in YogaNode::setStyle");
    }
}

void assertNodeStyleLayerTransportAndPaint(jsi::Runtime& runtime)
{
    auto backgroundPaint = colorPaint(SK_ColorBLUE);
    backgroundPaint.setAlphaf(1.0f);

    SkPaint layerPaint;
    layerPaint.setAlphaf(0.375f);
    layerPaint.setBlendMode(SkBlendMode::kMultiply);
    layerPaint.setAntiAlias(true);

    jsi::Object styleObject(runtime);
    styleObject.setProperty(runtime, "backgroundColor", makePaintHostObject(runtime, backgroundPaint));
    styleObject.setProperty(runtime, "layer", makePaintHostObject(runtime, layerPaint));

    auto style = convertNodeStyle(runtime, std::move(styleObject), "layer paint");
    expect(style.layer.has_value(), "generated NodeStyle layer populates optional SkPaint");
    expectNear(style.layer->getAlphaf(), 0.375, "generated NodeStyle layer keeps SkPaint alpha");
    expect(style.layer->isAntiAlias(), "generated NodeStyle layer keeps SkPaint antiAlias");
    auto convertedLayerBlendMode = style.layer->asBlendMode();
    expect(convertedLayerBlendMode.has_value(), "generated NodeStyle layer keeps inspectable blend mode");
    expect(convertedLayerBlendMode.value() == SkBlendMode::kMultiply, "generated NodeStyle layer keeps SkPaint blend mode");
    expect(style.backgroundColor.has_value(), "generated NodeStyle backgroundColor remains populated beside layer");
    expect(
        std::holds_alternative<SkPaint>(*style.backgroundColor),
        "generated NodeStyle backgroundColor uses its own SkPaint variant");

    auto serialized = margelo::nitro::JSIConverter<NodeStyle>::toJSI(runtime, style);
    expect(serialized.isObject(), "layer NodeStyle toJSI returns an object");
    auto serializedStyle = serialized.asObject(runtime);
    auto serializedLayer = serializedStyle.getProperty(runtime, "layer");
    expect(
        margelo::nitro::JSIConverter<SkPaint>::canConvert(runtime, serializedLayer),
        "layer NodeStyle toJSI emits a JsiSkPaint host object");
    auto roundTripLayer = margelo::nitro::JSIConverter<SkPaint>::fromJSI(runtime, serializedLayer);
    expectNear(roundTripLayer.getAlphaf(), 0.375, "layer NodeStyle toJSI/fromJSI keeps SkPaint alpha");
    auto roundTripLayerBlendMode = roundTripLayer.asBlendMode();
    expect(roundTripLayerBlendMode.has_value(), "layer NodeStyle toJSI/fromJSI keeps inspectable blend mode");
    expect(roundTripLayerBlendMode.value() == SkBlendMode::kMultiply, "layer NodeStyle toJSI/fromJSI keeps SkPaint blend mode");

    YogaNode node;
    node.setStyle(style);
    expect(node._style.layer.has_value(), "YogaNode::setStyle stores style.layer in the style snapshot");
    expect(node._layerPaint.has_value(), "YogaNode::setStyle stores style.layer in _layerPaint");
    expectNear(node._layerPaint->getAlphaf(), 0.375, "YogaNode::_layerPaint keeps layer alpha");
    auto nodeLayerBlendMode = node._layerPaint->asBlendMode();
    expect(nodeLayerBlendMode.has_value(), "YogaNode::_layerPaint keeps inspectable blend mode");
    expect(nodeLayerBlendMode.value() == SkBlendMode::kMultiply, "YogaNode::_layerPaint keeps layer blend mode");
    expectColorNear(node._paint.getColor(), SK_ColorBLUE, 0, "YogaNode ordinary _paint keeps background SkPaint color");
    expectNear(node._paint.getAlphaf(), 1.0, "YogaNode ordinary _paint alpha stays separate from layer alpha");

    auto resetStyle = fixedStyle(8.0, 8.0, SK_ColorRED);
    node.setStyle(resetStyle);
    expect(!node._style.layer.has_value(), "YogaNode::setStyle style snapshot omits layer after reset style");
    expect(!node._layerPaint.has_value(), "YogaNode::setStyle resets _layerPaint when layer is omitted");
    expectColorNear(node._paint.getColor(), SK_ColorRED, 0, "YogaNode ordinary _paint is still updated after layer reset");
}

void assertNodeStylePaintOverridesSkPaintBackground()
{
    SkPaint backgroundPaint;
    backgroundPaint.setStyle(SkPaint::kStroke_Style);
    backgroundPaint.setColor(SK_ColorMAGENTA);
    backgroundPaint.setStrokeWidth(2.0f);
    backgroundPaint.setStrokeCap(SkPaint::kSquare_Cap);
    backgroundPaint.setStrokeJoin(SkPaint::kBevel_Join);
    backgroundPaint.setStrokeMiter(3.0f);
    backgroundPaint.setDither(true);
    backgroundPaint.setAntiAlias(true);
    backgroundPaint.setAlphaf(0.25f);
    backgroundPaint.setBlendMode(SkBlendMode::kSrc);

    NodeStyle style {};
    style.backgroundColor = backgroundPaint;
    style.borderWidth = 9.0;
    style.strokeCap = StrokeCap::ROUND;
    style.strokeJoin = StrokeJoin::MITER;
    style.strokeMiter = 12.0;
    style.dither = false;
    style.antiAlias = false;
    style.opacity = 0.75;
    style.blendMode = BlendMode::MULTIPLY;

    YogaNode node;
    node.setStyle(style);

    const auto finalColor = node._paint.getColor();
    expect(node._paint.getStyle() == SkPaint::kStroke_Style, "SkPaint backgroundColor remains the base paint style");
    expect(
        SkColorGetR(finalColor) == SkColorGetR(SK_ColorMAGENTA) &&
            SkColorGetG(finalColor) == SkColorGetG(SK_ColorMAGENTA) &&
            SkColorGetB(finalColor) == SkColorGetB(SK_ColorMAGENTA),
        "SkPaint backgroundColor remains the base paint RGB channels");
    expectNear(node._paint.getStrokeWidth(), 9.0, "style.borderWidth overrides SkPaint background stroke width");
    expectNear(YGNodeStyleGetBorder(node._node, YGEdgeAll), 9.0, "style.borderWidth still sets Yoga layout border width");
    expect(node._paint.getStrokeCap() == SkPaint::kRound_Cap, "style.strokeCap overrides SkPaint background stroke cap");
    expect(node._paint.getStrokeJoin() == SkPaint::kMiter_Join, "style.strokeJoin overrides SkPaint background stroke join");
    expectNear(node._paint.getStrokeMiter(), 12.0, "style.strokeMiter overrides SkPaint background stroke miter");
    expect(!node._paint.isDither(), "style.dither overrides SkPaint background dither");
    expect(!node._paint.isAntiAlias(), "style.antiAlias overrides SkPaint background antiAlias");
    expectNear(node._paint.getAlphaf(), 0.75, "style.opacity overrides SkPaint background alpha");

    const auto blendMode = node._paint.asBlendMode();
    expect(blendMode.has_value(), "style.blendMode keeps an inspectable SkBlendMode");
    expect(blendMode.value() == SkBlendMode::kMultiply, "style.blendMode overrides SkPaint background blend mode");
}

void assertStaticAnimatedDoubleNodeCommandPayloads(jsi::Runtime& runtime)
{
    auto circle = circleCommand(runtime);
    const auto& circlePayload = std::get<CircleCommandData>(circle.data);
    expect(!circlePayload.radius.isDynamic(), "static circle radius remains distinct from dynamic AnimatedDouble");
    expectOptionalNear(circlePayload.radius.value, 8.0, "static circle radius payload value");
    expectOptionalNear(circlePayload.radius.resolve(), 8.0, "static circle radius resolve");

    auto rrect = rrectCommand(runtime);
    const auto& rrectPayload = std::get<RoundedRectCommandData>(rrect.data);
    expect(!rrectPayload.cornerRadius.isDynamic(), "static rrect cornerRadius remains distinct from dynamic AnimatedDouble");
    expectOptionalNear(rrectPayload.cornerRadius.value, 5.0, "static rrect cornerRadius payload value");
    expectOptionalNear(rrectPayload.cornerRadius.resolve(), 5.0, "static rrect cornerRadius resolve");

    auto blur = blurMaskFilterCommand(runtime);
    const auto& blurPayload = std::get<BlurMaskFilterCommandData>(blur.data);
    expect(!blurPayload.blur.isDynamic(), "static blurMaskFilter blur remains distinct from dynamic AnimatedDouble");
    expectOptionalNear(blurPayload.blur.value, 4.0, "static blurMaskFilter blur payload value");
    expectOptionalNear(blurPayload.blur.resolve(), 4.0, "static blurMaskFilter blur resolve");

    auto path = pathCommand(runtime);
    const auto& pathPayload = std::get<PathCommandData>(path.data);
    expect(!pathPayload.trimStart.isDynamic(), "static path trimStart remains distinct from dynamic AnimatedDouble");
    expect(!pathPayload.trimEnd.isDynamic(), "static path trimEnd remains distinct from dynamic AnimatedDouble");
    expectOptionalNear(pathPayload.trimStart.value, 0.0, "static path trimStart payload value");
    expectOptionalNear(pathPayload.trimEnd.value, 1.0, "static path trimEnd payload value");
    expectOptionalNear(pathPayload.trimStart.resolve(), 0.0, "static path trimStart resolve");
    expectOptionalNear(pathPayload.trimEnd.resolve(), 1.0, "static path trimEnd resolve");
}

void expectDynamicAnimatedDoublePayload(
    jsi::Runtime& runtime,
    const AnimatedDouble& animated,
    const std::shared_ptr<worklets::Synchronizable>& synchronizable,
    double initialValue,
    double updatedValue,
    const std::string& label)
{
    expect(animated.isDynamic(), label + " converts to a dynamic AnimatedDouble");
    expect(animated.synchronizable.get() == synchronizable.get(), label + " preserves Synchronizable identity");
    expect(!animated.value.has_value(), label + " does not invent a static fallback");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    expectNoOptionalValue(animated.resolve(), label + " resolve with no main runtime");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
    expectOptionalNear(animated.resolve(), initialValue, label + " resolve with main runtime");

    synchronizable->setBlocking(makeSerializableNumberValue(runtime, updatedValue));
    expectOptionalNear(animated.resolve(), updatedValue, label + " resolve after Synchronizable::setBlocking mutation");
}

void assertDynamicAnimatedDoubleNodeCommandPayloads(jsi::Runtime& runtime)
{
    auto circleRadius = makeSynchronizable(runtime, 6.0);
    auto circle = dynamicCircleCommand(runtime, circleRadius);
    expect(circle.type == NodeCommandKind::CIRCLE, "dynamic circle command kind");
    expectDynamicAnimatedDoublePayload(
        runtime,
        std::get<CircleCommandData>(circle.data).radius,
        circleRadius,
        6.0,
        10.0,
        "circle.radius");

    auto rrectCornerRadius = makeSynchronizable(runtime, 5.0);
    auto rrect = dynamicRRectCommand(runtime, rrectCornerRadius);
    expect(rrect.type == NodeCommandKind::RRECT, "dynamic rrect command kind");
    expectDynamicAnimatedDoublePayload(
        runtime,
        std::get<RoundedRectCommandData>(rrect.data).cornerRadius,
        rrectCornerRadius,
        5.0,
        0.0,
        "rrect.cornerRadius");

    auto blurAmount = makeSynchronizable(runtime, 4.0);
    auto blur = dynamicBlurMaskFilterCommand(runtime, blurAmount);
    expect(blur.type == NodeCommandKind::BLUR_MASK_FILTER, "dynamic blurMaskFilter command kind");
    expectDynamicAnimatedDoublePayload(
        runtime,
        std::get<BlurMaskFilterCommandData>(blur.data).blur,
        blurAmount,
        4.0,
        0.0,
        "blurMaskFilter.blur");

    auto pathTrimStart = makeSynchronizable(runtime, 0.25);
    auto pathTrimEnd = makeSynchronizable(runtime, 0.75);
    auto path = dynamicPathTrimCommand(runtime, pathTrimStart, pathTrimEnd);
    expect(path.type == NodeCommandKind::PATH, "dynamic path command kind");
    const auto& pathPayload = std::get<PathCommandData>(path.data);
    expectDynamicAnimatedDoublePayload(
        runtime,
        pathPayload.trimStart,
        pathTrimStart,
        0.25,
        0.0,
        "path.trimStart");
    expectDynamicAnimatedDoublePayload(
        runtime,
        pathPayload.trimEnd,
        pathTrimEnd,
        0.75,
        0.5,
        "path.trimEnd");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
}

void assertValueBearingStyleConverters(jsi::Runtime& runtime)
{
    {
        SkSamplingOptions sampling(SkFilterMode::kLinear, SkMipmapMode::kNearest);
        auto serialized = margelo::nitro::JSIConverter<SkSamplingOptions>::toJSI(runtime, sampling);
        expect(serialized.isObject(), "direct SkSamplingOptions filter/mipmap toJSI returns object");
        auto object = serialized.asObject(runtime);
        expectNear(
            object.getProperty(runtime, "filter").asNumber(),
            static_cast<int>(SkFilterMode::kLinear),
            "direct SkSamplingOptions toJSI filter");
        expectNear(
            object.getProperty(runtime, "mipmap").asNumber(),
            static_cast<int>(SkMipmapMode::kNearest),
            "direct SkSamplingOptions toJSI mipmap");

        auto roundTrip = margelo::nitro::JSIConverter<SkSamplingOptions>::fromJSI(runtime, serialized);
        expect(!roundTrip.useCubic, "direct SkSamplingOptions filter/mipmap round-trip is non-cubic");
        expect(roundTrip.filter == SkFilterMode::kLinear, "direct SkSamplingOptions round-trip filter");
        expect(roundTrip.mipmap == SkMipmapMode::kNearest, "direct SkSamplingOptions round-trip mipmap");
    }

    {
        SkSamplingOptions sampling(SkCubicResampler { 0.25f, 0.75f });
        auto serialized = margelo::nitro::JSIConverter<SkSamplingOptions>::toJSI(runtime, sampling);
        expect(serialized.isObject(), "direct cubic SkSamplingOptions toJSI returns object");
        auto object = serialized.asObject(runtime);
        expectNear(object.getProperty(runtime, "B").asNumber(), 0.25, "direct cubic SkSamplingOptions B");
        expectNear(object.getProperty(runtime, "C").asNumber(), 0.75, "direct cubic SkSamplingOptions C");

        auto roundTrip = margelo::nitro::JSIConverter<SkSamplingOptions>::fromJSI(runtime, serialized);
        expect(roundTrip.useCubic, "direct cubic SkSamplingOptions round-trip is cubic");
        expectNear(roundTrip.cubic.B, 0.25, "direct cubic SkSamplingOptions round-trip B");
        expectNear(roundTrip.cubic.C, 0.75, "direct cubic SkSamplingOptions round-trip C");
    }

    {
        skia::textlayout::TextStyle textStyle;
        auto serialized = margelo::nitro::JSIConverter<skia::textlayout::TextStyle>::toJSI(runtime, textStyle);
        expect(serialized.isObject(), "empty TextStyle toJSI returns object");
        auto object = serialized.asObject(runtime);
        expect(!object.hasProperty(runtime, "fontFeatures"), "empty TextStyle toJSI omits fontFeatures");
    }

    {
        auto styleObject = richTextStyleObject(runtime, 21.0, SK_ColorMAGENTA);
        auto textStyle = margelo::nitro::JSIConverter<skia::textlayout::TextStyle>::fromJSI(
            runtime,
            jsi::Value(runtime, styleObject));
        auto serialized = margelo::nitro::JSIConverter<skia::textlayout::TextStyle>::toJSI(runtime, textStyle);
        expectSerializedTextStyle(runtime, serialized, 21.0, SK_ColorMAGENTA, "direct TextStyle toJSI");

        auto roundTrip = margelo::nitro::JSIConverter<skia::textlayout::TextStyle>::fromJSI(runtime, serialized);
        expectTextStyleState(roundTrip, 21.0, SK_ColorMAGENTA, "direct TextStyle toJSI/fromJSI");
    }

    {
        auto styleObject = paragraphStyleSerializationObject(runtime);
        auto paragraphStyle = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(
            runtime,
            jsi::Value(runtime, styleObject));
        auto serialized = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::toJSI(runtime, paragraphStyle);
        expectSerializedParagraphStyle(runtime, serialized, "direct ParagraphStyle toJSI");

        auto roundTrip = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(runtime, serialized);
        expectParagraphStyleState(roundTrip, "direct ParagraphStyle toJSI/fromJSI");
    }

    {
        auto styleObject = paragraphStyleWithNestedTextStyleObject(runtime, 16.0, "#00ff00");
        auto paragraphStyle = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(
            runtime,
            jsi::Value(runtime, styleObject));
        expectNear(
            paragraphStyle.getTextStyle().getFontSize(),
            16.0,
            "direct ParagraphStyle conversion keeps nested textStyle fontSize");
        expectColorNear(
            paragraphStyle.getTextStyle().getColor(),
            SK_ColorGREEN,
            0,
            "direct ParagraphStyle conversion parses nested textStyle CSS color string");
    }

    {
        auto styleObject = paragraphStyleWithDistinctNestedTextStyleHeightObject(runtime);
        auto paragraphStyle = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(
            runtime,
            jsi::Value(runtime, styleObject));
        expectParagraphStyleDistinctTextStyleHeightState(
            paragraphStyle,
            "direct ParagraphStyle nested textStyle distinct-height input");

        auto serialized = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::toJSI(runtime, paragraphStyle);
        expectSerializedParagraphStyleDistinctTextStyleHeight(
            runtime,
            serialized,
            "direct ParagraphStyle nested textStyle distinct-height toJSI");

        auto roundTrip = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(runtime, serialized);
        expectParagraphStyleDistinctTextStyleHeightState(
            roundTrip,
            "direct ParagraphStyle nested textStyle distinct-height toJSI/fromJSI");
    }

    {
        auto styleObject = paragraphStyleWithFlattenedAndNestedTextStyleObject(runtime);
        auto paragraphStyle = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(
            runtime,
            jsi::Value(runtime, styleObject));
        expectNear(
            paragraphStyle.getTextStyle().getFontSize(),
            22.0,
            "direct ParagraphStyle conversion gives flattened fontSize precedence over nested textStyle fontSize");
        expectColorNear(
            paragraphStyle.getTextStyle().getColor(),
            SK_ColorRED,
            0,
            "direct ParagraphStyle conversion gives flattened CSS color precedence over nested textStyle color");
    }

    {
        auto styleObject = paragraphStyleSerializationObject(runtime);
        styleObject.setProperty(runtime, "strutStyle", strutStyleObject(runtime, false));
        auto paragraphStyle = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(
            runtime,
            jsi::Value(runtime, styleObject));
        const auto& strutStyle = paragraphStyle.getStrutStyle();
        expect(!strutStyle.getHeightOverride(), "direct ParagraphStyle strutStyle without heightMultiplier has no height override");
        const auto& families = strutStyle.getFontFamilies();
        expect(families.size() == 2, "direct ParagraphStyle strutStyle without heightMultiplier fontFamilies size");
        expect(
            std::string(families[0].c_str(), families[0].size()) == "StrutSans",
            "direct ParagraphStyle strutStyle without heightMultiplier fontFamilies[0]");

        auto serialized = margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::toJSI(runtime, paragraphStyle);
        auto serializedObject = serialized.asObject(runtime);
        auto serializedStrutStyle = serializedObject.getProperty(runtime, "strutStyle").asObject(runtime);
        expect(
            !serializedStrutStyle.hasProperty(runtime, "heightMultiplier"),
            "direct ParagraphStyle strutStyle toJSI omits heightMultiplier without height override");
        expectSerializedStringArray(
            runtime,
            serializedStrutStyle.getProperty(runtime, "fontFamilies"),
            { "StrutSans", "StrutFallback" },
            "direct ParagraphStyle strutStyle without heightMultiplier toJSI fontFamilies");
    }
}

void assertFontVariationsUnsupportedRejections(jsi::Runtime& runtime)
{
    {
        auto styleObject = textStyleWithFontVariationsObject(runtime);
        jsi::Value styleValue(runtime, styleObject);
        expect(
            margelo::nitro::JSIConverter<skia::textlayout::TextStyle>::canConvert(runtime, styleValue),
            "direct TextStyle converter canConvert remains shape-level before rejecting fontVariations");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<skia::textlayout::TextStyle>::fromJSI(runtime, styleValue);
            },
            "TextStyle.fontVariations",
            "direct TextStyle conversion rejects unsupported fontVariations");
    }

    {
        auto styleObject = textStyleWithFontVariationsObject(runtime);
        jsi::Value styleValue(runtime, styleObject);
        expect(
            margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::canConvert(runtime, styleValue),
            "direct ParagraphStyle converter canConvert remains shape-level before rejecting flattened fontVariations");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(runtime, styleValue);
            },
            "ParagraphStyle.fontVariations",
            "direct ParagraphStyle conversion rejects unsupported flattened fontVariations");
    }

    {
        auto styleObject = paragraphStyleWithNestedFontVariationsObject(runtime);
        jsi::Value styleValue(runtime, styleObject);
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<skia::textlayout::ParagraphStyle>::fromJSI(runtime, styleValue);
            },
            "ParagraphStyle.textStyle.fontVariations",
            "direct ParagraphStyle conversion rejects unsupported nested textStyle fontVariations");
    }

    {
        jsi::Object data(runtime);
        data.setProperty(runtime, "text", "unsupported font variations");
        data.setProperty(runtime, "textStyle", textStyleWithFontVariationsObject(runtime));

        jsi::Object command(runtime);
        command.setProperty(runtime, "type", "text");
        command.setProperty(runtime, "data", std::move(data));
        jsi::Value commandValue(runtime, command);

        expect(
            margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
            "NodeCommand converter canConvert accepts shaped text command before rejecting text.textStyle fontVariations");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
            },
            "NodeCommand conversion failed for type \"text\"",
            "NodeCommand conversion scopes text.textStyle fontVariations rejection to the text command");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
            },
            "text.textStyle.fontVariations",
            "NodeCommand conversion rejects unsupported text.textStyle fontVariations");
    }

    {
        jsi::Object data(runtime);
        data.setProperty(runtime, "text", "unsupported flattened paragraph font variations");
        data.setProperty(runtime, "paragraphStyle", textStyleWithFontVariationsObject(runtime));

        jsi::Object command(runtime);
        command.setProperty(runtime, "type", "paragraph");
        command.setProperty(runtime, "data", std::move(data));
        jsi::Value commandValue(runtime, command);

        expect(
            margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
            "NodeCommand converter canConvert accepts shaped paragraph command before rejecting flattened paragraphStyle fontVariations");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
            },
            "NodeCommand conversion failed for type \"paragraph\"",
            "NodeCommand conversion scopes flattened paragraphStyle fontVariations rejection to the paragraph command");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
            },
            "ParagraphStyle.fontVariations",
            "NodeCommand conversion rejects unsupported flattened paragraph.paragraphStyle fontVariations");
    }

    {
        jsi::Object data(runtime);
        data.setProperty(runtime, "text", "unsupported nested paragraph font variations");
        data.setProperty(runtime, "paragraphStyle", paragraphStyleWithNestedFontVariationsObject(runtime));

        jsi::Object command(runtime);
        command.setProperty(runtime, "type", "paragraph");
        command.setProperty(runtime, "data", std::move(data));
        jsi::Value commandValue(runtime, command);

        expect(
            margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
            "NodeCommand converter canConvert accepts shaped paragraph command before rejecting nested paragraphStyle.textStyle fontVariations");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
            },
            "NodeCommand conversion failed for type \"paragraph\"",
            "NodeCommand conversion scopes nested paragraphStyle.textStyle fontVariations rejection to the paragraph command");
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
            },
            "ParagraphStyle.textStyle.fontVariations",
            "NodeCommand conversion rejects unsupported nested paragraph.paragraphStyle.textStyle fontVariations");
    }
}

void expectTextCommandTextStyleUnsupportedKey(
    jsi::Runtime& runtime,
    const char* key,
    const std::function<void(jsi::Runtime&, jsi::Object&)>& setUnsupportedValue)
{
    auto textStyle = textStyleObject(runtime, 18.0, SK_ColorBLACK);
    setUnsupportedValue(runtime, textStyle);

    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "unsupported rich text style");
    data.setProperty(runtime, "textStyle", std::move(textStyle));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    jsi::Value commandValue(runtime, command);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
        std::string("NodeCommand converter canConvert accepts shaped text command before rejecting text.textStyle.") + key);
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
        },
        "NodeCommand conversion failed for type \"text\"",
        std::string("NodeCommand conversion scopes text.textStyle.") + key + " rejection to the text command");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
        },
        std::string("text.textStyle.") + key,
        std::string("NodeCommand conversion rejects unsupported text.textStyle.") + key);
}

void assertTextCommandRichTextStyleUnsupportedRejections(jsi::Runtime& runtime)
{
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "fontFamilies",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "fontFamilies", stringArray(runtime, { "Inter", "System" }));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "fontFeatures",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "fontFeatures", textStyleFontFeatureArray(runtime));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "fontStyle",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            jsi::Object fontStyle(runtime);
            fontStyle.setProperty(runtime, "weight", static_cast<double>(SkFontStyle::Weight::kBold_Weight));
            textStyle.setProperty(runtime, "fontStyle", std::move(fontStyle));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "letterSpacing",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "letterSpacing", 1.25);
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "decoration",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "decoration", static_cast<double>(skia::textlayout::kUnderline));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "decorationColor",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "decorationColor", "#445566");
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "decorationThickness",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "decorationThickness", 1.75);
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "decorationStyle",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "decorationStyle", static_cast<double>(skia::textlayout::kWavy));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "shadows",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "shadows", textStyleShadowArray(runtime));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "foregroundColor",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "foregroundColor", "#203040");
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "backgroundColor",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "backgroundColor", "#102030");
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "textBaseline",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(
                runtime,
                "textBaseline",
                static_cast<double>(static_cast<int>(skia::textlayout::TextBaseline::kIdeographic)));
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "locale",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "locale", "en-US");
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "height",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "height", 1.35);
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "heightMultiplier",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "heightMultiplier", 1.35);
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "halfLeading",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "halfLeading", true);
        });
    expectTextCommandTextStyleUnsupportedKey(
        runtime,
        "wordSpacing",
        [](jsi::Runtime& runtime, jsi::Object& textStyle) {
            textStyle.setProperty(runtime, "wordSpacing", 2.5);
        });
}

void assertNodeCommandToJSISerializationSymmetry(jsi::Runtime& runtime)
{
    {
        auto command = blurMaskFilterSerializationCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "blurMaskFilter");
        auto data = serializedDataObject(runtime, serialized, "blurMaskFilter", "blurMaskFilter");
        expectNear(data.getProperty(runtime, "blur").asNumber(), 3.5, "blurMaskFilter toJSI blur");
        expectNear(
            data.getProperty(runtime, "blurStyle").asNumber(),
            static_cast<int>(SkBlurStyle::kInner_SkBlurStyle),
            "blurMaskFilter toJSI numeric blurStyle");
        expect(data.getProperty(runtime, "respectCTM").getBool(), "blurMaskFilter toJSI respectCTM");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "blurMaskFilter");
        const auto& payload = std::get<BlurMaskFilterCommandData>(roundTrip.data);
        expectOptionalNear(payload.blur.value, 3.5, "blurMaskFilter toJSI/fromJSI blur");
        expect(
            payload.blurStyle.has_value() && payload.blurStyle.value() == SkBlurStyle::kInner_SkBlurStyle,
            "blurMaskFilter toJSI/fromJSI blurStyle");
        expect(
            payload.respectCTM.has_value() && payload.respectCTM.value(),
            "blurMaskFilter toJSI/fromJSI respectCTM");
    }

    {
        auto dynamicBlur = makeSynchronizable(runtime, 6.25);
        auto command = dynamicBlurMaskFilterCommand(runtime, dynamicBlur);
        RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
        auto serialized = serializedCommandValue(runtime, command, "dynamic blurMaskFilter");
        auto data = serializedDataObject(runtime, serialized, "blurMaskFilter", "dynamic blurMaskFilter");
        expectNear(data.getProperty(runtime, "blur").asNumber(), 6.25, "dynamic AnimatedDouble toJSI emits resolved blur value");
        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "dynamic blurMaskFilter");
        const auto& payload = std::get<BlurMaskFilterCommandData>(roundTrip.data);
        expect(!payload.blur.isDynamic(), "dynamic AnimatedDouble toJSI/fromJSI round-trip becomes a static resolved value");
        expectOptionalNear(payload.blur.value, 6.25, "dynamic AnimatedDouble toJSI/fromJSI resolved blur value");
    }

    {
        auto command = imageCommand(runtime, std::optional<std::string>("cover"));
        auto serialized = serializedCommandValue(runtime, command, "image");
        auto data = serializedDataObject(runtime, serialized, "image", "image");
        expect(data.getProperty(runtime, "fit").asString(runtime).utf8(runtime) == "cover", "image toJSI fit");
        auto imageValue = data.getProperty(runtime, "image");
        expect(
            margelo::nitro::JSIConverter<sk_sp<SkImage>>::canConvert(runtime, imageValue),
            "image toJSI emits a JsiSkImage host object");
        auto serializedImage = margelo::nitro::JSIConverter<sk_sp<SkImage>>::fromJSI(runtime, imageValue);
        expect(serializedImage != nullptr, "image toJSI host object resolves to SkImage");
        expect(serializedImage->width() == 8, "image toJSI host object width");
        expect(serializedImage->height() == 4, "image toJSI host object height");
        auto samplingValue = data.getProperty(runtime, "sampling");
        expect(samplingValue.isObject(), "image toJSI emits value-bearing sampling object");
        auto sampling = samplingValue.asObject(runtime);
        expectNear(
            sampling.getProperty(runtime, "filter").asNumber(),
            static_cast<int>(SkFilterMode::kNearest),
            "image toJSI sampling.filter");
        expectNear(
            sampling.getProperty(runtime, "mipmap").asNumber(),
            static_cast<int>(SkMipmapMode::kLinear),
            "image toJSI sampling.mipmap");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "image");
        const auto& payload = std::get<ImageCommandData>(roundTrip.data);
        expect(payload.fit.has_value() && payload.fit.value() == "cover", "image toJSI/fromJSI fit");
        expect(payload.image.has_value() && payload.image.value() != nullptr, "image toJSI/fromJSI image");
        expect(payload.image.value()->width() == 8, "image toJSI/fromJSI image width");
        expect(payload.image.value()->height() == 4, "image toJSI/fromJSI image height");
        expect(payload.sampling.has_value(), "image toJSI/fromJSI keeps a sampling payload object");
        expect(payload.sampling->filter == SkFilterMode::kNearest, "image toJSI/fromJSI sampling.filter");
        expect(payload.sampling->mipmap == SkMipmapMode::kLinear, "image toJSI/fromJSI sampling.mipmap");
    }

    {
        auto command = pathSerializationCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "path");
        auto data = serializedDataObject(runtime, serialized, "path", "path");
        expectNear(
            data.getProperty(runtime, "fillType").asNumber(),
            static_cast<int>(SkPathFillType::kEvenOdd),
            "path toJSI numeric fillType");
        auto pathValue = data.getProperty(runtime, "path");
        expect(
            margelo::nitro::JSIConverter<SkPath>::canConvert(runtime, pathValue),
            "path toJSI emits a JsiSkPath host object");
        auto serializedPath = margelo::nitro::JSIConverter<SkPath>::fromJSI(runtime, pathValue);
        expectPathBounds(serializedPath, 1.0f, 2.0f, 10.0f, 6.0f, "path toJSI host object bounds");
        auto strokeValue = data.getProperty(runtime, "stroke");
        expect(strokeValue.isObject(), "path toJSI stroke object");
        auto stroke = strokeValue.asObject(runtime);
        expectNear(stroke.getProperty(runtime, "width").asNumber(), 4.0, "path toJSI stroke.width");
        expectNear(stroke.getProperty(runtime, "miter_limit").asNumber(), 7.0, "path toJSI public stroke.miter_limit");
        expect(stroke.getProperty(runtime, "miterLimit").isUndefined(), "path toJSI omits private stroke.miterLimit alias");
        expectNear(stroke.getProperty(runtime, "precision").asNumber(), 1.25, "path toJSI stroke.precision");
        expectNear(
            stroke.getProperty(runtime, "join").asNumber(),
            static_cast<int>(SkPaint::Join::kMiter_Join),
            "path toJSI numeric stroke.join");
        expectNear(
            stroke.getProperty(runtime, "cap").asNumber(),
            static_cast<int>(SkPaint::Cap::kSquare_Cap),
            "path toJSI numeric stroke.cap");
        expectNear(data.getProperty(runtime, "trimStart").asNumber(), 0.25, "path toJSI trimStart");
        expectNear(data.getProperty(runtime, "trimEnd").asNumber(), 0.75, "path toJSI trimEnd");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "path");
        const auto& payload = std::get<PathCommandData>(roundTrip.data);
        expect(
            payload.fillType.has_value() && payload.fillType.value() == SkPathFillType::kEvenOdd,
            "path toJSI/fromJSI fillType");
        expectPathBounds(payload.path, 1.0f, 2.0f, 10.0f, 6.0f, "path toJSI/fromJSI path bounds");
        expect(payload.stroke.has_value(), "path toJSI/fromJSI stroke");
        expectOptionalFloatNear(payload.stroke->width, 4.0, "path toJSI/fromJSI stroke.width");
        expectOptionalFloatNear(payload.stroke->miterLimit, 7.0, "path toJSI/fromJSI stroke.miter_limit");
        expectOptionalFloatNear(payload.stroke->precision, 1.25, "path toJSI/fromJSI stroke.precision");
        expect(
            payload.stroke->join.has_value() && payload.stroke->join.value() == SkPaint::Join::kMiter_Join,
            "path toJSI/fromJSI stroke.join");
        expect(
            payload.stroke->cap.has_value() && payload.stroke->cap.value() == SkPaint::Cap::kSquare_Cap,
            "path toJSI/fromJSI stroke.cap");
        expectOptionalNear(payload.trimStart.value, 0.25, "path toJSI/fromJSI trimStart");
        expectOptionalNear(payload.trimEnd.value, 0.75, "path toJSI/fromJSI trimEnd");
    }

    {
        auto command = textSerializationCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "text");
        auto data = serializedDataObject(runtime, serialized, "text", "text");
        expect(
            data.getProperty(runtime, "text").asString(runtime).utf8(runtime) == "Serializable styled text",
            "text toJSI text");
        expectSerializedSimpleTextStyle(runtime, data.getProperty(runtime, "textStyle"), 21.0, SK_ColorMAGENTA, "text toJSI textStyle");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "text");
        const auto& payload = std::get<TextCommandData>(roundTrip.data);
        expect(payload.text.has_value() && payload.text.value() == "Serializable styled text", "text toJSI/fromJSI text");
        expect(payload.textStyle.has_value(), "text toJSI/fromJSI textStyle");
        expectSimpleTextStyleState(payload.textStyle.value(), 21.0, SK_ColorMAGENTA, "text toJSI/fromJSI textStyle");
    }

    {
        auto command = paragraphSerializationCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "paragraph");
        auto data = serializedDataObject(runtime, serialized, "paragraph", "paragraph");
        expect(data.getProperty(runtime, "paragraph").isNull(), "paragraph toJSI emits explicit null paragraph payload");
        expectSerializedParagraphStyle(
            runtime,
            data.getProperty(runtime, "paragraphStyle"),
            "paragraph toJSI paragraphStyle");
        expect(
            data.getProperty(runtime, "text").asString(runtime).utf8(runtime) == "Serializable paragraph text",
            "paragraph toJSI text");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "paragraph");
        const auto& payload = std::get<ParagraphCommandData>(roundTrip.data);
        expect(payload.paragraph.has_value() && payload.paragraph.value() == nullptr, "paragraph toJSI/fromJSI null paragraph");
        expect(payload.paragraphStyle.has_value(), "paragraph toJSI/fromJSI paragraphStyle object");
        expectParagraphStyleState(payload.paragraphStyle.value(), "paragraph toJSI/fromJSI paragraphStyle");
        expect(payload.text.has_value() && payload.text.value() == "Serializable paragraph text", "paragraph toJSI/fromJSI text");
    }

    {
        auto command = paragraphDistinctTextStyleHeightSerializationCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "paragraph distinct textStyle height");
        auto data = serializedDataObject(
            runtime,
            serialized,
            "paragraph",
            "paragraph distinct textStyle height");
        expect(data.getProperty(runtime, "paragraph").isNull(), "paragraph distinct textStyle height toJSI emits explicit null paragraph payload");
        expectSerializedParagraphStyleDistinctTextStyleHeight(
            runtime,
            data.getProperty(runtime, "paragraphStyle"),
            "paragraph distinct textStyle height toJSI paragraphStyle");
        expect(
            data.getProperty(runtime, "text").asString(runtime).utf8(runtime) == "Serializable distinct-height paragraph",
            "paragraph distinct textStyle height toJSI text");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "paragraph distinct textStyle height");
        const auto& payload = std::get<ParagraphCommandData>(roundTrip.data);
        expect(
            payload.paragraph.has_value() && payload.paragraph.value() == nullptr,
            "paragraph distinct textStyle height toJSI/fromJSI null paragraph");
        expect(
            payload.paragraphStyle.has_value(),
            "paragraph distinct textStyle height toJSI/fromJSI paragraphStyle object");
        expectParagraphStyleDistinctTextStyleHeightState(
            payload.paragraphStyle.value(),
            "paragraph distinct textStyle height toJSI/fromJSI paragraphStyle");
        expect(
            payload.text.has_value() && payload.text.value() == "Serializable distinct-height paragraph",
            "paragraph distinct textStyle height toJSI/fromJSI text");
    }

    {
        auto command = lineCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "line");
        auto data = serializedDataObject(runtime, serialized, "line", "line");
        expectSerializedPoint(runtime, data.getProperty(runtime, "from"), 0.0, 3.0, "line toJSI from");
        expectSerializedPoint(runtime, data.getProperty(runtime, "to"), 20.0, 3.0, "line toJSI to");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "line");
        const auto& payload = std::get<LineCommandData>(roundTrip.data);
        expectNear(payload.from.x(), 0.0, "line toJSI/fromJSI from.x");
        expectNear(payload.from.y(), 3.0, "line toJSI/fromJSI from.y");
        expectNear(payload.to.x(), 20.0, "line toJSI/fromJSI to.x");
        expectNear(payload.to.y(), 3.0, "line toJSI/fromJSI to.y");
    }

    {
        auto command = pointsSerializationCommand(runtime);
        auto serialized = serializedCommandValue(runtime, command, "points");
        auto data = serializedDataObject(runtime, serialized, "points", "points");
        expectNear(
            data.getProperty(runtime, "pointMode").asNumber(),
            static_cast<int>(SkCanvas::PointMode::kPolygon_PointMode),
            "points toJSI numeric pointMode");
        auto pointsValue = data.getProperty(runtime, "points");
        expect(pointsValue.isObject(), "points toJSI points array object");
        auto points = pointsValue.asObject(runtime).asArray(runtime);
        expect(points.size(runtime) == 2, "points toJSI points array size");
        expectSerializedPoint(runtime, points.getValueAtIndex(runtime, 0), 2.0, 4.0, "points toJSI points[0]");
        expectSerializedPoint(runtime, points.getValueAtIndex(runtime, 1), 14.0, 18.0, "points toJSI points[1]");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "points");
        const auto& payload = std::get<PointsCommandData>(roundTrip.data);
        expect(
            payload.pointMode.has_value() && payload.pointMode.value() == SkCanvas::PointMode::kPolygon_PointMode,
            "points toJSI/fromJSI pointMode");
        expect(payload.points.size() == 2, "points toJSI/fromJSI points size");
        expectNear(payload.points[0].x(), 2.0, "points toJSI/fromJSI points[0].x");
        expectNear(payload.points[0].y(), 4.0, "points toJSI/fromJSI points[0].y");
        expectNear(payload.points[1].x(), 14.0, "points toJSI/fromJSI points[1].x");
        expectNear(payload.points[1].y(), 18.0, "points toJSI/fromJSI points[1].y");
    }
}

void assertRectOpacityRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        fixedStyle(24.0, 20.0, SK_ColorRED, 0.5),
        rectCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::RECT, "setCommand constructs a real RectCmd");
    expect(root->_command != nullptr, "rect command is installed");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(root->_command.get()) != nullptr, "installed command has RectCmd type");

    auto surface = makeSurface(32, 28, SK_ColorWHITE);
    renderNode(root, surface);

    expectNear(root->_layout.width, 24.0, "rect layout width");
    expectNear(root->_layout.height, 20.0, "rect layout height");
    expectColorNear(
        pixelAt(surface, 12, 10),
        SkColorSetARGB(255, 255, 127, 127),
        2,
        "half-opacity red rect blends over white");
    expectColorNear(
        pixelAt(surface, 28, 24),
        SK_ColorWHITE,
        0,
        "pixels outside the rect remain white");
}

void assertParentChildLayoutRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(groupStyle(40.0, 30.0), groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(9.0, 7.0, 12.0, 10.0, SK_ColorGREEN),
        rectCommand(runtime));

    root->insertChild(child, std::nullopt);
    auto surface = makeSurface(48, 38);
    renderNode(root, surface);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "setCommand constructs a real GroupCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "installed command has GroupCmd type");
    expectNear(child->_layout.left, 9.0, "absolute child Yoga left");
    expectNear(child->_layout.top, 7.0, "absolute child Yoga top");
    expectNear(child->_layout.width, 12.0, "absolute child Yoga width");
    expectNear(child->_layout.height, 10.0, "absolute child Yoga height");

    expectColorNear(pixelAt(surface, 10, 8), SK_ColorGREEN, 0, "child rect renders at Yoga-derived offset");
    expectColorNear(pixelAt(surface, 8, 8), SK_ColorTRANSPARENT, 0, "pixels before child left remain transparent");
    expectColorNear(pixelAt(surface, 22, 18), SK_ColorTRANSPARENT, 0, "pixels after child bottom-right remain transparent");
}

void assertOverflowBoundsClipRender(jsi::Runtime& runtime)
{
    struct OverflowClipCase {
        const char* styleValue;
        Overflow nativeValue;
        YGOverflow yogaValue;
        SkColor childColor;
        const char* label;
    };

    const OverflowClipCase cases[] = {
        { "hidden", Overflow::HIDDEN, YGOverflowHidden, SK_ColorMAGENTA, "overflow hidden" },
        { "scroll", Overflow::SCROLL, YGOverflowScroll, SK_ColorCYAN, "overflow scroll" },
    };

    for (const auto& overflowCase : cases) {
        jsi::Object styleObject(runtime);
        styleObject.setProperty(runtime, "width", 50.0);
        styleObject.setProperty(runtime, "height", 50.0);
        styleObject.setProperty(runtime, "antiAlias", false);
        styleObject.setProperty(runtime, "overflow", overflowCase.styleValue);

        auto rootStyle = convertNodeStyle(
            runtime,
            std::move(styleObject),
            std::string(overflowCase.label) + " style");
        expect(rootStyle.overflow.has_value(), std::string(overflowCase.label) + " NodeStyle converter populates overflow");
        expect(
            rootStyle.overflow.value() == overflowCase.nativeValue,
            std::string(overflowCase.label) + " NodeStyle converter stores the expected enum");

        auto serialized = margelo::nitro::JSIConverter<NodeStyle>::toJSI(runtime, rootStyle);
        expect(serialized.isObject(), std::string(overflowCase.label) + " NodeStyle toJSI returns an object");
        auto serializedStyle = serialized.asObject(runtime);
        expect(
            serializedStyle.getProperty(runtime, "overflow").asString(runtime).utf8(runtime) == overflowCase.styleValue,
            std::string(overflowCase.label) + " NodeStyle toJSI serializes overflow as the public string");

        auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
        auto child = makeYogaNode(
            absoluteStyle(0.0, 0.0, 80.0, 80.0, overflowCase.childColor),
            rectCommand(runtime));
        root->insertChild(child, std::nullopt);

        expect(root->_commandKind == YogaNodeCommandKind::GROUP, std::string(overflowCase.label) + " clip proof uses a GroupCmd parent");
        expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, std::string(overflowCase.label) + " clip proof parent has GroupCmd type");
        expect(child->_commandKind == YogaNodeCommandKind::RECT, std::string(overflowCase.label) + " clip proof uses an oversized RectCmd child");
        expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, std::string(overflowCase.label) + " clip proof child has RectCmd type");
        expect(root->_style.overflow.has_value(), std::string(overflowCase.label) + " stays in NodeStyle overflow");
        expect(root->_style.overflow.value() == overflowCase.nativeValue, std::string(overflowCase.label) + " keeps native overflow enum");
        expect(
            YGNodeStyleGetOverflow(root->_node) == overflowCase.yogaValue,
            std::string(overflowCase.label) + " setStyle writes Yoga overflow state");
        expect(root->_clipsToBounds, std::string(overflowCase.label) + " enables rectangular YogaNode bounds clipping");
        expect(!root->_clipToBoundsRadii.has_value(), std::string(overflowCase.label) + " does not use style corner-radius clipping");
        expect(!root->_style.borderRadius.has_value(), std::string(overflowCase.label) + " does not set global borderRadius");
        expect(!root->_style.clip.has_value(), std::string(overflowCase.label) + " remains distinct from explicit style.clip");
        expect(!root->_clipPath.has_value(), std::string(overflowCase.label) + " does not populate explicit path clip");
        expect(!root->_clipRect.has_value(), std::string(overflowCase.label) + " does not populate explicit rect clip");
        expect(!root->_clipRRect.has_value(), std::string(overflowCase.label) + " does not populate explicit rrect clip");

        auto surface = makeSurface(72, 72);
        renderNode(root, surface);

        expectNear(root->_layout.width, 50.0, std::string(overflowCase.label) + " parent layout width");
        expectNear(root->_layout.height, 50.0, std::string(overflowCase.label) + " parent layout height");
        expectNear(child->_layout.width, 80.0, std::string(overflowCase.label) + " child layout width stays oversized");
        expectNear(child->_layout.height, 80.0, std::string(overflowCase.label) + " child layout height stays oversized");
        expectColorNear(pixelAt(surface, 25, 25), overflowCase.childColor, 0, std::string(overflowCase.label) + " keeps child pixels inside parent bounds");
        expectColorNear(pixelAt(surface, 49, 49), overflowCase.childColor, 0, std::string(overflowCase.label) + " keeps child pixels at the rectangular lower edge");
        expectColorNear(pixelAt(surface, 50, 25), SK_ColorTRANSPARENT, 0, std::string(overflowCase.label) + " clips child pixels past parent width");
        expectColorNear(pixelAt(surface, 25, 50), SK_ColorTRANSPARENT, 0, std::string(overflowCase.label) + " clips child pixels past parent height");
        expectColorNear(pixelAt(surface, 60, 60), SK_ColorTRANSPARENT, 0, std::string(overflowCase.label) + " render remains bounded outside the parent layout");
    }
}

void assertStyleCornerRadiusClipRender(jsi::Runtime& runtime)
{
    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.borderTopLeftRadius = margelo::nitro::RNSkiaYoga::SkPoint(30.0, 20.0);
    rootStyle.borderBottomRightRadius = 24.0;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorGREEN),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "style corner-radius clip proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(root->_command.get()) == nullptr, "style corner-radius clip proof parent is not an RRectCmd");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "style corner-radius clip proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(child->_command.get()) == nullptr, "style corner-radius clip proof child is not an RRectCmd");
    expect(!child->_clipToBoundsRadii.has_value(), "style corner-radius clip proof does not rely on the child RectCmd rounded draw branch");

    expect(root->_clipsToBounds, "style corner radii enable YogaNode bounds clipping before render");
    expect(root->_clipToBoundsRadii.has_value(), "style corner radii populate _clipToBoundsRadii before render");
    expect(root->_style.borderTopLeftRadius.has_value(), "style corner-radius clip proof stores upper-left style radius");
    expect(
        std::holds_alternative<margelo::nitro::RNSkiaYoga::SkPoint>(*root->_style.borderTopLeftRadius),
        "style upper-left radius remains a SkPoint variant");
    expect(root->_style.borderBottomRightRadius.has_value(), "style corner-radius clip proof stores lower-right style radius");
    expect(
        std::holds_alternative<double>(*root->_style.borderBottomRightRadius),
        "style lower-right radius remains a scalar variant");
    const auto& radii = *root->_clipToBoundsRadii;
    expectNear(radii[SkRRect::kUpperLeft_Corner].fX, 30.0, "style upper-left clip radius x");
    expectNear(radii[SkRRect::kUpperLeft_Corner].fY, 20.0, "style upper-left clip radius y");
    expectNear(radii[SkRRect::kLowerRight_Corner].fX, 24.0, "style lower-right scalar clip radius x");
    expectNear(radii[SkRRect::kLowerRight_Corner].fY, 24.0, "style lower-right scalar clip radius y");
    expectNear(radii[SkRRect::kUpperRight_Corner].fX, 0.0, "unset upper-right style radius stays square x");
    expectNear(radii[SkRRect::kUpperRight_Corner].fY, 0.0, "unset upper-right style radius stays square y");
    expectNear(radii[SkRRect::kLowerLeft_Corner].fX, 0.0, "unset lower-left style radius stays square x");
    expectNear(radii[SkRRect::kLowerLeft_Corner].fY, 0.0, "unset lower-left style radius stays square y");
    expect(!root->_style.clip.has_value(), "style corner radii remain distinct from explicit style.clip");
    expect(!root->_clipPath.has_value(), "style corner radii do not populate explicit path clip");
    expect(!root->_clipRect.has_value(), "style corner radii do not populate explicit rect clip");
    expect(!root->_clipRRect.has_value(), "style corner radii do not populate explicit rrect clip");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 30, 20), SK_ColorGREEN, 0, "style upper-left rounded bounds keep pixels inside the SkPoint radius");
    expectColorNear(pixelAt(surface, 1, 1), SK_ColorTRANSPARENT, 0, "style upper-left SkPoint radius clips the full-size child corner");
    expectColorNear(pixelAt(surface, 76, 76), SK_ColorGREEN, 0, "style lower-right rounded bounds keep pixels inside the scalar radius");
    expectColorNear(pixelAt(surface, 99, 99), SK_ColorTRANSPARENT, 0, "style lower-right scalar radius clips the full-size child corner");
    expectColorNear(pixelAt(surface, 99, 1), SK_ColorGREEN, 0, "unset upper-right style radius leaves the child corner square");
    expectColorNear(pixelAt(surface, 1, 99), SK_ColorGREEN, 0, "unset lower-left style radius leaves the child corner square");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "style corner-radius render remains bounded outside the parent layout");
}

void assertGlobalBorderRadiusClipRender(jsi::Runtime& runtime)
{
    constexpr double radius = 24.0;

    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.borderRadius = radius;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorBLUE),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "global borderRadius clip proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(root->_command.get()) == nullptr, "global borderRadius clip proof parent is not an RRectCmd");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "global borderRadius clip proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(child->_command.get()) == nullptr, "global borderRadius clip proof child is not an RRectCmd");
    expect(!child->_style.borderRadius.has_value(), "global borderRadius clip proof keeps the radius on the GroupCmd parent");
    expect(!child->_clipToBoundsRadii.has_value(), "global borderRadius clip proof does not rely on the child RectCmd rounded draw branch");

    expect(root->_style.borderRadius.has_value(), "global borderRadius clip proof stores the scalar style radius");
    expectNear(*root->_style.borderRadius, radius, "global borderRadius scalar value is preserved");
    expect(!root->_style.borderTopLeftRadius.has_value(), "global borderRadius clip proof does not set upper-left style radius");
    expect(!root->_style.borderTopRightRadius.has_value(), "global borderRadius clip proof does not set upper-right style radius");
    expect(!root->_style.borderBottomRightRadius.has_value(), "global borderRadius clip proof does not set lower-right style radius");
    expect(!root->_style.borderBottomLeftRadius.has_value(), "global borderRadius clip proof does not set lower-left style radius");
    expect(root->_clipsToBounds, "global borderRadius enables YogaNode bounds clipping before render");
    expect(root->_clipToBoundsRadii.has_value(), "global borderRadius populates _clipToBoundsRadii before render");

    const auto& radii = *root->_clipToBoundsRadii;
    expectNear(radii[SkRRect::kUpperLeft_Corner].fX, radius, "global borderRadius upper-left clip radius x");
    expectNear(radii[SkRRect::kUpperLeft_Corner].fY, radius, "global borderRadius upper-left clip radius y");
    expectNear(radii[SkRRect::kUpperRight_Corner].fX, radius, "global borderRadius upper-right clip radius x");
    expectNear(radii[SkRRect::kUpperRight_Corner].fY, radius, "global borderRadius upper-right clip radius y");
    expectNear(radii[SkRRect::kLowerRight_Corner].fX, radius, "global borderRadius lower-right clip radius x");
    expectNear(radii[SkRRect::kLowerRight_Corner].fY, radius, "global borderRadius lower-right clip radius y");
    expectNear(radii[SkRRect::kLowerLeft_Corner].fX, radius, "global borderRadius lower-left clip radius x");
    expectNear(radii[SkRRect::kLowerLeft_Corner].fY, radius, "global borderRadius lower-left clip radius y");
    expect(!root->_style.clip.has_value(), "global borderRadius remains distinct from explicit style.clip");
    expect(!root->_clipPath.has_value(), "global borderRadius does not populate explicit path clip");
    expect(!root->_clipRect.has_value(), "global borderRadius does not populate explicit rect clip");
    expect(!root->_clipRRect.has_value(), "global borderRadius does not populate explicit rrect clip");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 1, 1), SK_ColorTRANSPARENT, 0, "global borderRadius clips the upper-left child corner");
    expectColorNear(pixelAt(surface, 99, 1), SK_ColorTRANSPARENT, 0, "global borderRadius clips the upper-right child corner");
    expectColorNear(pixelAt(surface, 99, 99), SK_ColorTRANSPARENT, 0, "global borderRadius clips the lower-right child corner");
    expectColorNear(pixelAt(surface, 1, 99), SK_ColorTRANSPARENT, 0, "global borderRadius clips the lower-left child corner");
    expectColorNear(pixelAt(surface, 24, 24), SK_ColorBLUE, 0, "global borderRadius keeps pixels inside the upper-left rounded bounds");
    expectColorNear(pixelAt(surface, 75, 24), SK_ColorBLUE, 0, "global borderRadius keeps pixels inside the upper-right rounded bounds");
    expectColorNear(pixelAt(surface, 75, 75), SK_ColorBLUE, 0, "global borderRadius keeps pixels inside the lower-right rounded bounds");
    expectColorNear(pixelAt(surface, 24, 75), SK_ColorBLUE, 0, "global borderRadius keeps pixels inside the lower-left rounded bounds");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "global borderRadius render remains bounded outside the parent layout");
}

void assertExplicitRectClipRender(jsi::Runtime& runtime)
{
    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.clip = SkRect::MakeXYWH(10.0f, 10.0f, 40.0f, 40.0f);

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorGREEN),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "explicit rect clip proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "explicit rect clip proof parent has GroupCmd type");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "explicit rect clip proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, "explicit rect clip proof child has RectCmd type");
    expect(!root->_clipsToBounds, "explicit rect clip proof does not use implicit bounds clipping");
    expect(!root->_clipToBoundsRadii.has_value(), "explicit rect clip proof does not use style corner-radius clipping");
    expect(root->_style.clip.has_value(), "explicit rect clip stays in NodeStyle clip");
    expect(std::holds_alternative<SkRect>(*root->_style.clip), "explicit rect clip remains a SkRect variant");
    expect(root->_clipRect.has_value(), "explicit rect clip populates _clipRect");
    expect(!root->_clipPath.has_value(), "explicit rect clip does not populate _clipPath");
    expect(!root->_clipRRect.has_value(), "explicit rect clip does not populate _clipRRect");
    expect(!root->_style.invertClip.value_or(false), "explicit rect clip uses intersect clipping by default");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 20, 20), SK_ColorGREEN, 0, "explicit rect clip keeps child pixels inside style.clip");
    expectColorNear(pixelAt(surface, 5, 5), SK_ColorTRANSPARENT, 0, "explicit rect clip clears child pixels before style.clip");
    expectColorNear(pixelAt(surface, 70, 70), SK_ColorTRANSPARENT, 0, "explicit rect clip clears child pixels after style.clip");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "explicit rect clip render remains bounded outside the parent layout");
}

void assertExplicitRRectClipRender(jsi::Runtime& runtime)
{
    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.clip = SkRRect::MakeRectXY(SkRect::MakeXYWH(10.0f, 10.0f, 40.0f, 40.0f), 18.0f, 18.0f);

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorBLUE),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "explicit rrect clip proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "explicit rrect clip proof parent has GroupCmd type");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "explicit rrect clip proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, "explicit rrect clip proof child has RectCmd type");
    expect(!root->_clipsToBounds, "explicit rrect clip proof does not use implicit bounds clipping");
    expect(!root->_clipToBoundsRadii.has_value(), "explicit rrect clip proof does not use style corner-radius clipping");
    expect(root->_style.clip.has_value(), "explicit rrect clip stays in NodeStyle clip");
    expect(std::holds_alternative<SkRRect>(*root->_style.clip), "explicit rrect clip remains a SkRRect variant");
    expect(root->_clipRRect.has_value(), "explicit rrect clip populates _clipRRect");
    expect(!root->_clipPath.has_value(), "explicit rrect clip does not populate _clipPath");
    expect(!root->_clipRect.has_value(), "explicit rrect clip does not populate _clipRect");
    expect(!root->_style.invertClip.value_or(false), "explicit rrect clip uses intersect clipping by default");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 30, 30), SK_ColorBLUE, 0, "explicit rrect clip keeps child pixels inside rounded style.clip");
    expectColorNear(pixelAt(surface, 11, 11), SK_ColorTRANSPARENT, 0, "explicit rrect clip clears child pixels in the rounded corner");
    expectColorNear(pixelAt(surface, 70, 70), SK_ColorTRANSPARENT, 0, "explicit rrect clip clears child pixels outside the rounded rect");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "explicit rrect clip render remains bounded outside the parent layout");
}

void assertExplicitPathClipRender(jsi::Runtime& runtime)
{
    SkPath clipPath;
    clipPath.addCircle(50.0f, 50.0f, 20.0f);

    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.clip = clipPath;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorCYAN),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "explicit path clip proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "explicit path clip proof parent has GroupCmd type");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "explicit path clip proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, "explicit path clip proof child has RectCmd type");
    expect(!root->_clipsToBounds, "explicit path clip proof does not use implicit bounds clipping");
    expect(!root->_clipToBoundsRadii.has_value(), "explicit path clip proof does not use style corner-radius clipping");
    expect(root->_style.clip.has_value(), "explicit path clip stays in NodeStyle clip");
    expect(std::holds_alternative<SkPath>(*root->_style.clip), "explicit path clip remains a SkPath variant");
    expect(root->_clipPath.has_value(), "explicit path clip populates _clipPath");
    expect(!root->_clipRect.has_value(), "explicit path clip does not populate _clipRect");
    expect(!root->_clipRRect.has_value(), "explicit path clip does not populate _clipRRect");
    expect(!root->_style.invertClip.value_or(false), "explicit path clip uses intersect clipping by default");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 50, 50), SK_ColorCYAN, 0, "explicit path clip keeps child pixels inside style.clip path");
    expectColorNear(pixelAt(surface, 10, 10), SK_ColorTRANSPARENT, 0, "explicit path clip clears child pixels outside the path");
    expectColorNear(pixelAt(surface, 80, 50), SK_ColorTRANSPARENT, 0, "explicit path clip clears child pixels past the path radius");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "explicit path clip render remains bounded outside the parent layout");
}

void assertInvertRectClipRender(jsi::Runtime& runtime)
{
    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.clip = SkRect::MakeXYWH(10.0f, 10.0f, 40.0f, 40.0f);
    rootStyle.invertClip = true;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorMAGENTA),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "invertClip rect proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "invertClip rect proof parent has GroupCmd type");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "invertClip rect proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, "invertClip rect proof child has RectCmd type");
    expect(!root->_clipsToBounds, "invertClip rect proof does not use implicit bounds clipping");
    expect(!root->_clipToBoundsRadii.has_value(), "invertClip rect proof does not use style corner-radius clipping");
    expect(root->_style.clip.has_value(), "invertClip rect proof keeps the explicit clip value");
    expect(std::holds_alternative<SkRect>(*root->_style.clip), "invertClip rect proof clip remains a SkRect variant");
    expect(root->_clipRect.has_value(), "invertClip rect proof populates _clipRect");
    expect(!root->_clipPath.has_value(), "invertClip rect proof does not populate _clipPath");
    expect(!root->_clipRRect.has_value(), "invertClip rect proof does not populate _clipRRect");
    expect(root->_style.invertClip.value_or(false), "invertClip rect proof stores invertClip=true");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 20, 20), SK_ColorTRANSPARENT, 0, "invertClip rect clears child pixels inside style.clip");
    expectColorNear(pixelAt(surface, 5, 5), SK_ColorMAGENTA, 0, "invertClip rect keeps child pixels before style.clip");
    expectColorNear(pixelAt(surface, 70, 70), SK_ColorMAGENTA, 0, "invertClip rect keeps child pixels after style.clip");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "invertClip rect render remains bounded outside the parent layout");
}

void assertInvertRRectClipRender(jsi::Runtime& runtime)
{
    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.clip = SkRRect::MakeRectXY(SkRect::MakeXYWH(10.0f, 10.0f, 40.0f, 40.0f), 18.0f, 18.0f);
    rootStyle.invertClip = true;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorYELLOW),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "invertClip rrect proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "invertClip rrect proof parent has GroupCmd type");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "invertClip rrect proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, "invertClip rrect proof child has RectCmd type");
    expect(!root->_clipsToBounds, "invertClip rrect proof does not use implicit bounds clipping");
    expect(!root->_clipToBoundsRadii.has_value(), "invertClip rrect proof does not use style corner-radius clipping");
    expect(root->_style.clip.has_value(), "invertClip rrect proof keeps the explicit clip value");
    expect(std::holds_alternative<SkRRect>(*root->_style.clip), "invertClip rrect proof clip remains a SkRRect variant");
    expect(root->_clipRRect.has_value(), "invertClip rrect proof populates _clipRRect");
    expect(!root->_clipPath.has_value(), "invertClip rrect proof does not populate _clipPath");
    expect(!root->_clipRect.has_value(), "invertClip rrect proof does not populate _clipRect");
    expect(root->_style.invertClip.value_or(false), "invertClip rrect proof stores invertClip=true");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 30, 30), SK_ColorTRANSPARENT, 0, "invertClip rrect clears child pixels inside rounded style.clip");
    expectColorNear(pixelAt(surface, 5, 5), SK_ColorYELLOW, 0, "invertClip rrect keeps child pixels before rounded style.clip");
    expectColorNear(pixelAt(surface, 70, 70), SK_ColorYELLOW, 0, "invertClip rrect keeps child pixels after rounded style.clip");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "invertClip rrect render remains bounded outside the parent layout");
}

void assertInvertPathClipRender(jsi::Runtime& runtime)
{
    SkPath clipPath;
    clipPath.addCircle(50.0f, 50.0f, 20.0f);

    auto rootStyle = groupStyle(100.0, 100.0);
    rootStyle.clip = clipPath;
    rootStyle.invertClip = true;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 100.0, 100.0, SK_ColorRED),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "invertClip path proof uses a GroupCmd parent");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::GroupCmd*>(root->_command.get()) != nullptr, "invertClip path proof parent has GroupCmd type");
    expect(child->_commandKind == YogaNodeCommandKind::RECT, "invertClip path proof uses a full-size RectCmd child");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RectCmd*>(child->_command.get()) != nullptr, "invertClip path proof child has RectCmd type");
    expect(!root->_clipsToBounds, "invertClip path proof does not use implicit bounds clipping");
    expect(!root->_clipToBoundsRadii.has_value(), "invertClip path proof does not use style corner-radius clipping");
    expect(root->_style.clip.has_value(), "invertClip path proof keeps the explicit clip value");
    expect(std::holds_alternative<SkPath>(*root->_style.clip), "invertClip path proof clip remains a SkPath variant");
    expect(root->_clipPath.has_value(), "invertClip path proof populates _clipPath");
    expect(!root->_clipRect.has_value(), "invertClip path proof does not populate _clipRect");
    expect(!root->_clipRRect.has_value(), "invertClip path proof does not populate _clipRRect");
    expect(root->_style.invertClip.value_or(false), "invertClip path proof stores invertClip=true");

    auto surface = makeSurface(108, 108);
    renderNode(root, surface);

    expectColorNear(pixelAt(surface, 50, 50), SK_ColorTRANSPARENT, 0, "invertClip path clears child pixels inside style.clip path");
    expectColorNear(pixelAt(surface, 10, 10), SK_ColorRED, 0, "invertClip path keeps child pixels outside the path");
    expectColorNear(pixelAt(surface, 80, 50), SK_ColorRED, 0, "invertClip path keeps child pixels past the path radius");
    expectColorNear(pixelAt(surface, 104, 104), SK_ColorTRANSPARENT, 0, "invertClip path render remains bounded outside the parent layout");
}

void assertComposedTransformRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(groupStyle(36.0, 28.0), groupCommand(runtime, false));
    auto childStyle = absoluteStyle(4.0, 5.0, 6.0, 4.0, SK_ColorGREEN);
    childStyle.transform = std::vector<NodeTransformOperation> {
        TransformTranslateX(6.0),
        TransformTranslateY(3.0),
        TransformScale(2.0),
    };
    auto child = makeYogaNode(childStyle, rectCommand(runtime));

    root->insertChild(child, std::nullopt);
    auto surface = makeSurface(44, 36);
    renderNode(root, surface);

    expect(child->_matrix != nullptr, "translate+scale transform array creates native matrix for render");
    expectColorNear(pixelAt(surface, 11, 9), SK_ColorGREEN, 0, "composed translate+scale renders the shifted scaled rect");
    expectColorNear(pixelAt(surface, 5, 9), SK_ColorTRANSPARENT, 0, "composed translate+scale shifts pixels away from the scale-only left edge");
    expectColorNear(pixelAt(surface, 20, 14), SK_ColorGREEN, 0, "composed translate+scale expands pixels beyond translate-only width");
    expectColorNear(pixelAt(surface, 24, 14), SK_ColorTRANSPARENT, 0, "composed translate+scale render remains bounded outside the scaled rect");
}

void assertLayerPaintSaveLayerRender(jsi::Runtime& runtime)
{
    auto rootStyle = groupStyle(24.0, 20.0);
    SkPaint layerPaint;
    layerPaint.setAlphaf(0.5f);
    rootStyle.layer = layerPaint;

    auto root = makeYogaNode(rootStyle, groupCommand(runtime, false));
    auto child = makeYogaNode(
        absoluteStyle(2.0, 3.0, 12.0, 10.0, SK_ColorRED),
        rectCommand(runtime));

    root->insertChild(child, std::nullopt);
    auto surface = makeSurface(32, 28, SK_ColorWHITE);
    renderNode(root, surface);

    expect(root->_layerPaint.has_value(), "style.layer render proof stores a layer paint");
    expectNear(root->_layerPaint->getAlphaf(), 0.5, "style.layer render proof keeps layer alpha");
    expectColorNear(
        pixelAt(surface, 6, 7),
        SkColorSetARGB(255, 255, 127, 127),
        2,
        "style.layer alpha saveLayer modulates the child subtree over white");
    expectColorNear(
        pixelAt(surface, 0, 0),
        SK_ColorWHITE,
        0,
        "style.layer saveLayer leaves pixels outside the child subtree unchanged");
}

void assertGroupRasterCacheBehavior(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(groupStyle(32.0, 24.0), groupCommand(runtime, true));
    auto child = makeYogaNode(
        absoluteStyle(4.0, 5.0, 14.0, 9.0, SK_ColorGREEN),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    auto firstSurface = makeSurface(40, 32);
    renderNode(root, firstSurface);
    expectColorNear(pixelAt(firstSurface, 6, 7), SK_ColorGREEN, 0, "rasterized group renders child into the parent surface");
    expect(root->_rasterCache != nullptr, "rasterized group stores a cache image after first render");
    expect(!root->_rasterCacheDirty, "rasterized static group cache is clean after first render");
    expect(root->_rasterCacheWidth == 32, "raster cache width follows Yoga layout");
    expect(root->_rasterCacheHeight == 24, "raster cache height follows Yoga layout");

    auto* firstCache = root->_rasterCache.get();
    auto secondSurface = makeSurface(40, 32);
    renderNode(root, secondSurface);
    expect(root->_rasterCache.get() == firstCache, "second static rasterized render reuses the cache image");
    expectColorNear(pixelAt(secondSurface, 6, 7), SK_ColorGREEN, 0, "cache reuse still draws child pixels");

    child->setStyle(absoluteStyle(4.0, 5.0, 14.0, 9.0, SK_ColorBLUE));
    expect(root->_rasterCache == nullptr, "child style mutation invalidates parent raster cache image");
    expect(root->_rasterCacheDirty, "child style mutation marks parent raster cache dirty");

    auto thirdSurface = makeSurface(40, 32);
    renderNode(root, thirdSurface);
    expect(root->_rasterCache != nullptr, "rasterized group rebuilds cache after invalidation");
    expect(!root->_rasterCacheDirty, "rebuilt static raster cache is clean");
    expectColorNear(pixelAt(thirdSurface, 6, 7), SK_ColorBLUE, 0, "rebuilt raster cache reflects mutated child pixels");
}

void assertDynamicRasterizedGroupBypassesCache(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(groupStyle(28.0, 28.0), groupCommand(runtime, true));
    auto radius = makeSynchronizable(runtime, 4.0);
    auto child = makeYogaNode(
        absoluteStyle(0.0, 0.0, 24.0, 24.0, SK_ColorYELLOW),
        dynamicCircleCommand(runtime, radius));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "dynamic raster test root is a GroupCmd");
    expect(child->_commandKind == YogaNodeCommandKind::CIRCLE, "dynamic raster test child is a CircleCmd");
    expect(child->subtreeHasDynamicRasterContent(), "dynamic child subtree reports dynamic raster content");
    expect(root->subtreeHasDynamicRasterContent(), "rasterized parent observes dynamic child content");

    auto initialSurface = makeSurface(36, 36);
    renderNode(root, initialSurface);
    expect(root->_rasterCache == nullptr, "rasterized group does not cache a dynamic child subtree");
    expect(root->_rasterCacheDirty, "rasterized group remains dirty for dynamic child subtree");
    expectColorNear(pixelAt(initialSurface, 12, 12), SK_ColorYELLOW, 0, "dynamic raster child renders initial circle center");
    expectColorNear(pixelAt(initialSurface, 18, 12), SK_ColorTRANSPARENT, 0, "dynamic raster child initial radius remains bounded");

    radius->setBlocking(makeSerializableNumberValue(runtime, 10.0));
    auto updatedSurface = makeSurface(36, 36);
    renderNode(root, updatedSurface);
    expect(root->_rasterCache == nullptr, "rasterized group still does not cache after dynamic mutation");
    expect(root->_rasterCacheDirty, "rasterized group stays dirty after dynamic mutation");
    expectColorNear(pixelAt(updatedSurface, 18, 12), SK_ColorYELLOW, 0, "dynamic raster child mutation is visible without stale cache reuse");
}

void assertDynamicPathTrimRasterizedGroupBypassesCache(jsi::Runtime& runtime)
{
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);

    auto root = makeYogaNode(groupStyle(24.0, 16.0), groupCommand(runtime, true));
    auto trimStart = makeSynchronizable(runtime, 0.0);
    auto trimEnd = makeSynchronizable(runtime, 0.5);
    auto child = makeYogaNode(
        absoluteStrokeStyle(0.0, 0.0, 20.0, 12.0, SK_ColorCYAN, 2.0f),
        dynamicPathTrimCommand(runtime, trimStart, trimEnd));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::GROUP, "dynamic path raster test root is a GroupCmd");
    expect(child->_commandKind == YogaNodeCommandKind::PATH, "dynamic path raster test child is a PathCmd");
    expect(child->subtreeHasDynamicRasterContent(), "dynamic path child subtree reports dynamic raster content");
    expect(root->subtreeHasDynamicRasterContent(), "rasterized parent observes dynamic path trim content");

    auto initialSurface = makeSurface(32, 24);
    renderNode(root, initialSurface);
    expect(root->_rasterCache == nullptr, "rasterized group does not cache a dynamic path trim subtree");
    expect(root->_rasterCacheDirty, "rasterized group remains dirty for dynamic path trim subtree");
    expectColorNear(pixelAt(initialSurface, 2, 6), SK_ColorCYAN, 0, "dynamic path raster child renders initial trimmed start segment");
    expectColorNear(pixelAt(initialSurface, 18, 6), SK_ColorTRANSPARENT, 0, "dynamic path raster child initial trim removes trailing segment");

    trimStart->setBlocking(makeSerializableNumberValue(runtime, 0.5));
    trimEnd->setBlocking(makeSerializableNumberValue(runtime, 1.0));
    auto updatedSurface = makeSurface(32, 24);
    renderNode(root, updatedSurface);
    expect(root->_rasterCache == nullptr, "rasterized group still does not cache after dynamic path trim mutation");
    expect(root->_rasterCacheDirty, "rasterized group stays dirty after dynamic path trim mutation");
    expectColorNear(pixelAt(updatedSurface, 2, 6), SK_ColorTRANSPARENT, 0, "dynamic path trim mutation removes the stale start segment");
    expectColorNear(pixelAt(updatedSurface, 18, 6), SK_ColorCYAN, 0, "dynamic path trim mutation is visible without stale cache reuse");
}

void assertAdditionalPointsCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        pointsStyle(24.0, 24.0, SK_ColorBLUE),
        pointsCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::POINTS, "setCommand constructs a real PointsCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::PointsCmd*>(root->_command.get()) != nullptr, "installed command has PointsCmd type");

    auto surface = makeSurface(32, 32);
    renderNode(root, surface);
    expectColorNear(pixelAt(surface, 12, 12), SK_ColorBLUE, 0, "real points command pixel renders");
    expectColorNear(pixelAt(surface, 2, 2), SK_ColorTRANSPARENT, 0, "uncovered points surface stays transparent");
}

void expectLineCommandState(
    const std::shared_ptr<YogaNode>& root,
    double fromX,
    double fromY,
    double toX,
    double toY,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::LINE, std::string(label) + " preserves LineCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* lineCmd = dynamic_cast<LineCmd*>(root->_command.get());
    expect(lineCmd != nullptr, std::string(label) + " preserves LineCmd type");
    expectNear(lineCmd->basePoint1().x(), fromX, std::string(label) + " from.x");
    expectNear(lineCmd->basePoint1().y(), fromY, std::string(label) + " from.y");
    expectNear(lineCmd->basePoint2().x(), toX, std::string(label) + " to.x");
    expectNear(lineCmd->basePoint2().y(), toY, std::string(label) + " to.y");
}

void assertLineCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        strokeStyle(20.0, 8.0, SK_ColorBLUE, 3.0f),
        lineCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::LINE, "setCommand constructs a real LineCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::LineCmd*>(root->_command.get()) != nullptr, "installed command has LineCmd type");

    auto surface = makeSurface(28, 16);
    renderNode(root, surface);
    expectColorNear(pixelAt(surface, 10, 3), SK_ColorBLUE, 0, "real line command stroke renders at the converted coordinates");
    expectColorNear(pixelAt(surface, 10, 7), SK_ColorTRANSPARENT, 0, "line stroke does not fill unrelated pixels");
}

void expectPointsCommandState(
    const std::shared_ptr<YogaNode>& root,
    const std::vector<::SkPoint>& expectedPoints,
    SkCanvas::PointMode expectedMode,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::POINTS, std::string(label) + " preserves PointsCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* pointsCmd = dynamic_cast<PointsCmd*>(root->_command.get());
    expect(pointsCmd != nullptr, std::string(label) + " preserves PointsCmd type");
    expect(pointsCmd->props.mode == expectedMode, std::string(label) + " pointMode");
    const auto& basePoints = pointsCmd->basePoints();
    expect(basePoints.size() == expectedPoints.size(), std::string(label) + " points size");
    for (size_t index = 0; index < expectedPoints.size(); ++index) {
        expectNear(basePoints[index].x(), expectedPoints[index].x(), std::string(label) + " points[" + std::to_string(index) + "].x");
        expectNear(basePoints[index].y(), expectedPoints[index].y(), std::string(label) + " points[" + std::to_string(index) + "].y");
    }
}

void assertCommandPointFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();

    auto lineRoot = makeYogaNode(
        strokeStyle(24.0, 10.0, SK_ColorBLUE, 3.0f),
        lineCommand(runtime));
    const auto* initialLineCommand = lineRoot->_command.get();
    expectLineCommandState(lineRoot, 0.0, 3.0, 20.0, 3.0, "line finite rejection baseline");

    struct LineInvalidCase {
        const char* label;
        double fromX;
        double fromY;
        double toX;
        double toY;
        const char* propertyPath;
    };

    const std::array<LineInvalidCase, 4> lineInvalidCases {{
        { "line.from.x NaN", nan, 5.0, 21.0, 6.0, "line.from.x" },
        { "line.from.y Infinity", 2.0, positiveInfValue, 21.0, 6.0, "line.from.y" },
        { "line.to.x -Infinity", 2.0, 5.0, negativeInfValue, 6.0, "line.to.x" },
        { "line.to.y NaN", 2.0, 5.0, 21.0, nan, "line.to.y" },
    }};

    for (const auto& invalidCase : lineInvalidCases) {
        expectConvertedSetCommandRejects(
            runtime,
            *lineRoot,
            lineCommandObject(
                runtime,
                invalidCase.fromX,
                invalidCase.fromY,
                invalidCase.toX,
                invalidCase.toY),
            std::string("Invalid numeric command point value for ") + invalidCase.propertyPath + ": expected a finite number.",
            invalidCase.label);
        expect(lineRoot->_command.get() == initialLineCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectLineCommandState(lineRoot, 0.0, 3.0, 20.0, 3.0, invalidCase.label);
    }

    auto pointsRoot = makeYogaNode(
        pointsStyle(24.0, 24.0, SK_ColorBLUE),
        convertCommand(runtime, pointsCommandObject(runtime, 3.0, 4.0, 13.0, 14.0)));
    const auto* initialPointsCommand = pointsRoot->_command.get();
    const std::vector<::SkPoint> baselinePoints {
        ::SkPoint::Make(3.0f, 4.0f),
        ::SkPoint::Make(13.0f, 14.0f),
    };
    expectPointsCommandState(pointsRoot, baselinePoints, SkCanvas::PointMode::kLines_PointMode, "points finite rejection baseline");

    struct PointsInvalidCase {
        const char* label;
        double firstX;
        double firstY;
        double secondX;
        double secondY;
        const char* propertyPath;
    };

    const std::array<PointsInvalidCase, 4> pointsInvalidCases {{
        { "points.points[0].x NaN", nan, 4.0, 13.0, 14.0, "points.points[0].x" },
        { "points.points[0].y Infinity", 3.0, positiveInfValue, 13.0, 14.0, "points.points[0].y" },
        { "points.points[1].x -Infinity", 3.0, 4.0, negativeInfValue, 14.0, "points.points[1].x" },
        { "points.points[1].y NaN", 3.0, 4.0, 13.0, nan, "points.points[1].y" },
    }};

    for (const auto& invalidCase : pointsInvalidCases) {
        expectConvertedSetCommandRejects(
            runtime,
            *pointsRoot,
            pointsCommandObject(
                runtime,
                invalidCase.firstX,
                invalidCase.firstY,
                invalidCase.secondX,
                invalidCase.secondY),
            std::string("Invalid numeric command point value for ") + invalidCase.propertyPath + ": expected a finite number.",
            invalidCase.label);
        expect(pointsRoot->_command.get() == initialPointsCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectPointsCommandState(pointsRoot, baselinePoints, SkCanvas::PointMode::kLines_PointMode, invalidCase.label);
    }
}

std::string invalidStaticAnimatedDoubleCommandMessage(const char* propertyPath)
{
    return std::string("Invalid numeric AnimatedDouble command value for ") + propertyPath + ": expected a finite number.";
}

void expectCircleCommandState(
    const std::shared_ptr<YogaNode>& root,
    double expectedRadius,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::CIRCLE, std::string(label) + " preserves CircleCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* circleCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::CircleCmd*>(root->_command.get());
    expect(circleCmd != nullptr, std::string(label) + " preserves CircleCmd type");
    expect(!circleCmd->isDynamic(), std::string(label) + " preserves static CircleCmd behavior");

    auto surface = makeSurface(32, 32);
    renderNode(root, surface);
    expect(circleCmd->hasExplicitRadius(), std::string(label) + " preserves explicit radius flag");
    expectNear(circleCmd->props.r, expectedRadius, std::string(label) + " radius");
}

void expectRRectCommandState(
    const std::shared_ptr<YogaNode>& root,
    double expectedRadius,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::RRECT, std::string(label) + " preserves RRectCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* rrectCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(root->_command.get());
    expect(rrectCmd != nullptr, std::string(label) + " preserves RRectCmd type");
    expect(!rrectCmd->isDynamic(), std::string(label) + " preserves static RRectCmd behavior");

    auto surface = makeSurface(28, 24);
    renderNode(root, surface);
    expect(rrectCmd->props.r.has_value(), std::string(label) + " preserves radius optional");
    expectNear(rrectCmd->props.r->rX, expectedRadius, std::string(label) + " radius x");
    expectNear(rrectCmd->props.r->rY, expectedRadius, std::string(label) + " radius y");
}

void expectBlurMaskFilterCommandState(
    const std::shared_ptr<YogaNode>& root,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::BLUR_MASK_FILTER, std::string(label) + " preserves BlurMaskFilterCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* blurCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::BlurMaskFilterCmd*>(root->_command.get());
    expect(blurCmd != nullptr, std::string(label) + " preserves BlurMaskFilterCmd type");
    expect(!blurCmd->isDynamic(), std::string(label) + " preserves static BlurMaskFilterCmd behavior");

    auto surface = makeSurface(16, 16);
    RNSkia::DrawingCtx ctx(surface->getCanvas());
    blurCmd->draw(&ctx);
    expect(ctx.getPaint().refMaskFilter() != nullptr, std::string(label) + " preserves mask-filter draw side effect");
}

void expectPathTrimCommandState(
    const std::shared_ptr<YogaNode>& root,
    double expectedTrimStart,
    double expectedTrimEnd,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::PATH, std::string(label) + " preserves PathCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* pathCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(root->_command.get());
    expect(pathCmd != nullptr, std::string(label) + " preserves PathCmd type");
    expect(!pathCmd->isDynamic(), std::string(label) + " preserves static PathCmd behavior");

    auto surface = makeSurface(28, 20);
    renderNode(root, surface);
    expectNear(pathCmd->props.start, expectedTrimStart, std::string(label) + " trimStart");
    expectNear(pathCmd->props.end, expectedTrimEnd, std::string(label) + " trimEnd");
}

std::string invalidStrokeCommandMessage(const char* propertyPath)
{
    return std::string("Invalid numeric stroke value for ") + propertyPath + ": expected a finite number.";
}

std::string invalidNumericEnumMessage(const char* propertyPath, const char* validValues)
{
    return std::string("Invalid numeric enum value for ") + propertyPath +
        ": expected a finite integer in " + validValues + ".";
}

void expectPathFillTypeCommandState(
    const std::shared_ptr<YogaNode>& root,
    SkPathFillType expectedFillType,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::PATH, std::string(label) + " preserves PathCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* pathCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(root->_command.get());
    expect(pathCmd != nullptr, std::string(label) + " preserves PathCmd type");
    expect(!pathCmd->isDynamic(), std::string(label) + " preserves static PathCmd behavior");
    expect(pathCmd->props.fillType.has_value(), std::string(label) + " preserves fillType optional");
    expect(pathCmd->props.fillType.value() == expectedFillType, std::string(label) + " fillType");
}

void expectPathStrokeCommandState(
    const std::shared_ptr<YogaNode>& root,
    double expectedWidth,
    double expectedMiterLimit,
    double expectedPrecision,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::PATH, std::string(label) + " preserves PathCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* pathCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(root->_command.get());
    expect(pathCmd != nullptr, std::string(label) + " preserves PathCmd type");
    expect(!pathCmd->isDynamic(), std::string(label) + " preserves static PathCmd behavior");
    expect(pathCmd->props.stroke.has_value(), std::string(label) + " preserves stroke optional");
    const auto& stroke = pathCmd->props.stroke.value();
    expectOptionalFloatNear(stroke.width, expectedWidth, std::string(label) + " stroke.width");
    expectOptionalFloatNear(stroke.miter_limit, expectedMiterLimit, std::string(label) + " stroke.miter_limit");
    expectOptionalFloatNear(stroke.precision, expectedPrecision, std::string(label) + " stroke.precision");
    expect(
        stroke.join.has_value() && stroke.join.value() == SkPaint::Join::kMiter_Join,
        std::string(label) + " stroke.join");
    expect(
        stroke.cap.has_value() && stroke.cap.value() == SkPaint::Cap::kSquare_Cap,
        std::string(label) + " stroke.cap");
}

void assertStaticAnimatedDoubleCommandFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();

    {
        auto root = makeYogaNode(
            fixedStyle(24.0, 24.0, SK_ColorYELLOW),
            circleCommand(runtime));
        const auto* initialCommand = root->_command.get();
        expectCircleCommandState(root, 8.0, "circle.radius finite rejection baseline");
        expectConvertedSetCommandRejects(
            runtime,
            *root,
            circleCommandObject(runtime, nan),
            invalidStaticAnimatedDoubleCommandMessage("circle.radius"),
            "circle.radius NaN");
        expect(root->_command.get() == initialCommand, "circle.radius NaN preserves command pointer");
        expectCircleCommandState(root, 8.0, "circle.radius NaN");
    }

    {
        auto root = makeYogaNode(
            fixedStyle(20.0, 16.0, SK_ColorMAGENTA),
            rrectCommand(runtime));
        const auto* initialCommand = root->_command.get();
        expectRRectCommandState(root, 5.0, "rrect.cornerRadius finite rejection baseline");
        expectConvertedSetCommandRejects(
            runtime,
            *root,
            rrectCommandObject(runtime, positiveInfValue),
            invalidStaticAnimatedDoubleCommandMessage("rrect.cornerRadius"),
            "rrect.cornerRadius Infinity");
        expect(root->_command.get() == initialCommand, "rrect.cornerRadius Infinity preserves command pointer");
        expectRRectCommandState(root, 5.0, "rrect.cornerRadius Infinity");
    }

    {
        auto root = makeYogaNode(
            groupStyle(32.0, 32.0),
            blurMaskFilterCommand(runtime));
        const auto* initialCommand = root->_command.get();
        expectBlurMaskFilterCommandState(root, "blurMaskFilter.blur finite rejection baseline");
        expectConvertedSetCommandRejects(
            runtime,
            *root,
            blurMaskFilterCommandObject(runtime, negativeInfValue),
            invalidStaticAnimatedDoubleCommandMessage("blurMaskFilter.blur"),
            "blurMaskFilter.blur -Infinity");
        expect(root->_command.get() == initialCommand, "blurMaskFilter.blur -Infinity preserves command pointer");
        expectBlurMaskFilterCommandState(root, "blurMaskFilter.blur -Infinity");
    }

    {
        auto root = makeYogaNode(
            strokeStyle(20.0, 12.0, SK_ColorCYAN, 2.0f),
            convertCommand(runtime, pathTrimCommandObject(runtime, 0.25, 0.75)));
        const auto* initialCommand = root->_command.get();
        expectPathTrimCommandState(root, 0.25, 0.75, "path trim finite rejection baseline");

        expectConvertedSetCommandRejects(
            runtime,
            *root,
            pathTrimCommandObject(runtime, nan, 0.75),
            invalidStaticAnimatedDoubleCommandMessage("path.trimStart"),
            "path.trimStart NaN");
        expect(root->_command.get() == initialCommand, "path.trimStart NaN preserves command pointer");
        expectPathTrimCommandState(root, 0.25, 0.75, "path.trimStart NaN");

        expectConvertedSetCommandRejects(
            runtime,
            *root,
            pathTrimCommandObject(runtime, 0.25, positiveInfValue),
            invalidStaticAnimatedDoubleCommandMessage("path.trimEnd"),
            "path.trimEnd Infinity");
        expect(root->_command.get() == initialCommand, "path.trimEnd Infinity preserves command pointer");
        expectPathTrimCommandState(root, 0.25, 0.75, "path.trimEnd Infinity");
    }
}

void assertPathStrokeNumericFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();

    auto root = makeYogaNode(
        fixedStyle(20.0, 12.0, SK_ColorCYAN),
        publicPathStrokeCommand(runtime));
    const auto* initialCommand = root->_command.get();
    expectPathStrokeCommandState(root, 4.0, 7.0, 1.25, "path stroke finite rejection baseline");

    struct InvalidCase {
        const char* label;
        double width;
        const char* miterKey;
        double miterValue;
        double precision;
        const char* propertyPath;
    };

    const std::array<InvalidCase, 12> invalidCases {{
        { "path.stroke.width NaN", nan, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "path.stroke.width Infinity", positiveInfValue, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "path.stroke.width -Infinity", negativeInfValue, "miter_limit", 7.0, 1.25, "path.stroke.width" },
        { "path.stroke.miter_limit NaN", 4.0, "miter_limit", nan, 1.25, "path.stroke.miter_limit" },
        { "path.stroke.miter_limit Infinity", 4.0, "miter_limit", positiveInfValue, 1.25, "path.stroke.miter_limit" },
        { "path.stroke.miter_limit -Infinity", 4.0, "miter_limit", negativeInfValue, 1.25, "path.stroke.miter_limit" },
        { "path.stroke.miterLimit NaN", 4.0, "miterLimit", nan, 1.25, "path.stroke.miterLimit" },
        { "path.stroke.miterLimit Infinity", 4.0, "miterLimit", positiveInfValue, 1.25, "path.stroke.miterLimit" },
        { "path.stroke.miterLimit -Infinity", 4.0, "miterLimit", negativeInfValue, 1.25, "path.stroke.miterLimit" },
        { "path.stroke.precision NaN", 4.0, "miter_limit", 7.0, nan, "path.stroke.precision" },
        { "path.stroke.precision Infinity", 4.0, "miter_limit", 7.0, positiveInfValue, "path.stroke.precision" },
        { "path.stroke.precision -Infinity", 4.0, "miter_limit", 7.0, negativeInfValue, "path.stroke.precision" },
    }};

    for (const auto& invalidCase : invalidCases) {
        expectConvertedSetCommandRejects(
            runtime,
            *root,
            pathStrokeCommandObject(
                runtime,
                invalidCase.width,
                invalidCase.miterKey,
                invalidCase.miterValue,
                invalidCase.precision),
            invalidStrokeCommandMessage(invalidCase.propertyPath),
            invalidCase.label);
        expect(root->_command.get() == initialCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectPathStrokeCommandState(root, 4.0, 7.0, 1.25, invalidCase.label);
    }
}

void assertCommandNumericEnumRejections(jsi::Runtime& runtime)
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
        auto root = makeYogaNode(
            groupStyle(32.0, 32.0),
            blurMaskFilterCommand(runtime));
        const auto* initialCommand = root->_command.get();
        expectBlurMaskFilterCommandState(root, "blurMaskFilter.blurStyle numeric enum rejection baseline");

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("blurMaskFilter.blurStyle ") + invalidCase.labelSuffix;
            expectConvertedSetCommandRejects(
                runtime,
                *root,
                blurMaskFilterCommandObjectWithNumericBlurStyle(runtime, invalidCase.value),
                invalidNumericEnumMessage("blurMaskFilter.blurStyle", "[0, 1, 2, 3]"),
                label.c_str());
            expect(root->_command.get() == initialCommand, label + " preserves command pointer");
            expectBlurMaskFilterCommandState(root, label.c_str());
        }
    }

    {
        auto root = makeYogaNode(
            pointsStyle(24.0, 24.0, SK_ColorBLUE),
            convertCommand(runtime, pointsCommandObject(runtime, 3.0, 4.0, 13.0, 14.0)));
        const auto* initialCommand = root->_command.get();
        const std::vector<::SkPoint> baselinePoints {
            ::SkPoint::Make(3.0f, 4.0f),
            ::SkPoint::Make(13.0f, 14.0f),
        };
        expectPointsCommandState(root, baselinePoints, SkCanvas::PointMode::kLines_PointMode, "points.pointMode numeric enum rejection baseline");

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("points.pointMode ") + invalidCase.labelSuffix;
            expectConvertedSetCommandRejects(
                runtime,
                *root,
                pointsCommandObjectWithNumericPointMode(runtime, invalidCase.value),
                invalidNumericEnumMessage("points.pointMode", "[0, 1, 2]"),
                label.c_str());
            expect(root->_command.get() == initialCommand, label + " preserves command pointer");
            expectPointsCommandState(root, baselinePoints, SkCanvas::PointMode::kLines_PointMode, label.c_str());
        }
    }

    {
        auto root = makeYogaNode(
            strokeStyle(20.0, 12.0, SK_ColorCYAN, 2.0f),
            convertCommand(runtime, pathTrimCommandObjectWithNumericFillType(runtime, 0.0)));
        const auto* initialCommand = root->_command.get();
        expectPathFillTypeCommandState(root, SkPathFillType::kWinding, "path.fillType numeric enum rejection baseline");

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("path.fillType ") + invalidCase.labelSuffix;
            expectConvertedSetCommandRejects(
                runtime,
                *root,
                pathTrimCommandObjectWithNumericFillType(runtime, invalidCase.value),
                invalidNumericEnumMessage("path.fillType", "[0, 1, 2, 3]"),
                label.c_str());
            expect(root->_command.get() == initialCommand, label + " preserves command pointer");
            expectPathFillTypeCommandState(root, SkPathFillType::kWinding, label.c_str());
        }
    }

    {
        auto root = makeYogaNode(
            fixedStyle(20.0, 12.0, SK_ColorCYAN),
            publicPathStrokeCommand(runtime));
        const auto* initialCommand = root->_command.get();
        expectPathStrokeCommandState(root, 4.0, 7.0, 1.25, "path.stroke enum rejection baseline");
        const auto validJoin = static_cast<double>(static_cast<int>(SkPaint::Join::kMiter_Join));
        const auto validCap = static_cast<double>(static_cast<int>(SkPaint::Cap::kSquare_Cap));

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("path.stroke.join ") + invalidCase.labelSuffix;
            expectConvertedSetCommandRejects(
                runtime,
                *root,
                pathStrokeCommandObjectWithNumericEnums(runtime, invalidCase.value, validCap),
                invalidNumericEnumMessage("path.stroke.join", "[0, 1, 2]"),
                label.c_str());
            expect(root->_command.get() == initialCommand, label + " preserves command pointer");
            expectPathStrokeCommandState(root, 4.0, 7.0, 1.25, label.c_str());
        }

        for (const auto& invalidCase : invalidCases) {
            const auto label = std::string("path.stroke.cap ") + invalidCase.labelSuffix;
            expectConvertedSetCommandRejects(
                runtime,
                *root,
                pathStrokeCommandObjectWithNumericEnums(runtime, validJoin, invalidCase.value),
                invalidNumericEnumMessage("path.stroke.cap", "[0, 1, 2]"),
                label.c_str());
            expect(root->_command.get() == initialCommand, label + " preserves command pointer");
            expectPathStrokeCommandState(root, 4.0, 7.0, 1.25, label.c_str());
        }
    }
}

std::string invalidTextParagraphStyleNumericMessage(const char* propertyPath)
{
    return std::string("Invalid numeric text/paragraph style value for ") + propertyPath + ": expected a finite number within native range.";
}

void expectTextCommandState(
    const std::shared_ptr<YogaNode>& root,
    const std::string& expectedText,
    double expectedFontSize,
    SkColor expectedColor,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::TEXT, std::string(label) + " preserves TextCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* textCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::TextCmd*>(root->_command.get());
    expect(textCmd != nullptr, std::string(label) + " preserves TextCmd type");
    expect(textCmd->props.text == expectedText, std::string(label) + " text payload");
    expect(textCmd->props.font.has_value(), std::string(label) + " font optional");
    expectNear(textCmd->props.font->getSize(), expectedFontSize, std::string(label) + " font size");
    expect(textCmd->fallbackPaintColor().has_value(), std::string(label) + " fallback color optional");
    expectColorNear(*textCmd->fallbackPaintColor(), expectedColor, 0, std::string(label) + " fallback color");
}

void expectParagraphCommandState(
    const std::shared_ptr<YogaNode>& root,
    const std::shared_ptr<RNSkia::JsiSkParagraph>& expectedParagraph,
    const char* label)
{
    expect(root->_commandKind == YogaNodeCommandKind::PARAGRAPH, std::string(label) + " preserves ParagraphCmd kind");
    expect(root->_command != nullptr, std::string(label) + " preserves native command");
    auto* paragraphCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ParagraphCmd*>(root->_command.get());
    expect(paragraphCmd != nullptr, std::string(label) + " preserves ParagraphCmd type");
    expect(YGNodeHasMeasureFunc(root->_node), std::string(label) + " preserves ParagraphCmd measure function");
    expect(paragraphCmd->props.paragraph == expectedParagraph, std::string(label) + " paragraph object");
    auto measured = margelo::nitro::RNSkiaYoga::ParagraphCmd::measureFunc(
        root->_node,
        92.0f,
        YGMeasureModeAtMost,
        YGUndefined,
        YGMeasureModeUndefined);
    expect(measured.width > 0.0f, std::string(label) + " measure width stays positive");
    expect(measured.height > 0.0f, std::string(label) + " measure height stays positive");
}

void assertTextParagraphStyleNumericFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();
    const double floatOverflow = std::numeric_limits<double>::max();
    const double intOverflow = static_cast<double>(std::numeric_limits<int>::max()) * 2.0;

    auto textRoot = makeYogaNode(
        groupStyle(116.0, 42.0),
        styledTextCommand(runtime));
    const auto* initialTextCommand = textRoot->_command.get();
    expectTextCommandState(textRoot, "Bounded Text", 18.0, SK_ColorBLUE, "text style finite rejection baseline");

    struct TextInvalidCase {
        const char* label;
        double fontSize;
    };

    const std::array<TextInvalidCase, 4> textInvalidCases {{
        { "text.textStyle.fontSize NaN", nan },
        { "text.textStyle.fontSize Infinity", positiveInfValue },
        { "text.textStyle.fontSize -Infinity", negativeInfValue },
        { "text.textStyle.fontSize float overflow", floatOverflow },
    }};

    for (const auto& invalidCase : textInvalidCases) {
        expectConvertedSetCommandRejects(
            runtime,
            *textRoot,
            textCommandObjectWithTextStyleFontSize(runtime, invalidCase.fontSize),
            invalidTextParagraphStyleNumericMessage("TextStyle.fontSize"),
            invalidCase.label);
        expect(textRoot->_command.get() == initialTextCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectTextCommandState(textRoot, "Bounded Text", 18.0, SK_ColorBLUE, invalidCase.label);
    }

    auto paragraphRoot = makeYogaNode(
        widthOnlyStyle(92.0),
        paragraphCommand(runtime));
    const auto* initialParagraphCommand = paragraphRoot->_command.get();
    auto* paragraphCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ParagraphCmd*>(paragraphRoot->_command.get());
    expect(paragraphCmd != nullptr, "paragraph style finite rejection baseline command type");
    auto initialParagraph = paragraphCmd->props.paragraph;
    expect(initialParagraph != nullptr, "paragraph style finite rejection baseline paragraph object");
    expectParagraphCommandState(paragraphRoot, initialParagraph, "paragraph style finite rejection baseline");

    struct ParagraphInvalidCase {
        const char* label;
        jsi::Object (*makeStyle)(jsi::Runtime&, double);
        double value;
        const char* propertyPath;
    };

	const std::array<ParagraphInvalidCase, 10> paragraphInvalidCases {{
        { "paragraph.paragraphStyle.fontSize Infinity", paragraphStyleWithFlattenedFontSize, positiveInfValue, "ParagraphStyle.fontSize" },
        { "paragraph.paragraphStyle.fontSize float overflow", paragraphStyleWithFlattenedFontSize, floatOverflow, "ParagraphStyle.fontSize" },
        { "paragraph.paragraphStyle.textStyle.fontSize NaN", paragraphStyleWithNestedFontSize, nan, "ParagraphStyle.textStyle.fontSize" },
        { "paragraph.paragraphStyle.textStyle.fontSize -Infinity", paragraphStyleWithNestedFontSize, negativeInfValue, "ParagraphStyle.textStyle.fontSize" },
        { "paragraph.paragraphStyle.maxLines NaN", paragraphStyleWithMaxLines, nan, "ParagraphStyle.maxLines" },
        { "paragraph.paragraphStyle.maxLines -Infinity", paragraphStyleWithMaxLines, negativeInfValue, "ParagraphStyle.maxLines" },
        { "paragraph.paragraphStyle.maxLines fractional", paragraphStyleWithMaxLines, 1.5, "ParagraphStyle.maxLines" },
        { "paragraph.paragraphStyle.strutStyle.leading -Infinity", paragraphStyleWithStrutLeading, negativeInfValue, "ParagraphStyle.strutStyle.leading" },
        { "paragraph.paragraphStyle.fontFeatures[0].value fractional", paragraphStyleWithFontFeatureValue, 1.5, "ParagraphStyle.fontFeatures[0].value" },
        { "paragraph.paragraphStyle.fontFeatures[0].value int overflow", paragraphStyleWithFontFeatureValue, intOverflow, "ParagraphStyle.fontFeatures[0].value" },
    }};

    for (const auto& invalidCase : paragraphInvalidCases) {
        expectConvertedSetCommandRejects(
            runtime,
            *paragraphRoot,
            paragraphCommandObjectWithStyle(runtime, invalidCase.makeStyle(runtime, invalidCase.value)),
            invalidTextParagraphStyleNumericMessage(invalidCase.propertyPath),
            invalidCase.label);
        expect(paragraphRoot->_command.get() == initialParagraphCommand, std::string(invalidCase.label) + " preserves command pointer");
        expectParagraphCommandState(paragraphRoot, initialParagraph, invalidCase.label);
    }
}

void assertOvalCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        fixedStyle(20.0, 12.0, SK_ColorGREEN),
        ovalCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::OVAL, "setCommand constructs a real OvalCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::OvalCmd*>(root->_command.get()) != nullptr, "installed command has OvalCmd type");

    auto surface = makeSurface(28, 20);
    renderNode(root, surface);
    expectColorNear(pixelAt(surface, 10, 6), SK_ColorGREEN, 0, "real oval command fills the layout center");
    expectColorNear(pixelAt(surface, 1, 1), SK_ColorTRANSPARENT, 0, "oval corners remain transparent");
}

void assertCircleCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        fixedStyle(24.0, 24.0, SK_ColorYELLOW),
        circleCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::CIRCLE, "setCommand constructs a real CircleCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::CircleCmd*>(root->_command.get()) != nullptr, "installed command has CircleCmd type");

    auto surface = makeSurface(32, 32);
    renderNode(root, surface);
    expectColorNear(pixelAt(surface, 12, 12), SK_ColorYELLOW, 0, "numeric circle radius fills the layout center");
    expectColorNear(pixelAt(surface, 22, 12), SK_ColorTRANSPARENT, 0, "numeric circle radius bounds the filled region");
}

void assertDynamicCircleCommandRender(jsi::Runtime& runtime)
{
    auto radius = makeSynchronizable(runtime, 6.0);
    auto command = dynamicCircleCommand(runtime, radius);
    const auto& payload = std::get<CircleCommandData>(command.data);
    expect(payload.radius.isDynamic(), "circle NodeCommand conversion keeps dynamic AnimatedDouble radius");
    expect(payload.radius.synchronizable.get() == radius.get(), "circle NodeCommand conversion keeps Synchronizable identity");
    expect(!payload.radius.value.has_value(), "circle dynamic AnimatedDouble radius does not invent a static fallback");
    const auto convertedRadius = payload.radius;

    auto root = makeYogaNode(
        fixedStyle(24.0, 24.0, SK_ColorYELLOW),
        std::move(command));

    expect(root->_commandKind == YogaNodeCommandKind::CIRCLE, "dynamic setCommand constructs a real CircleCmd");
    auto* circleCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::CircleCmd*>(root->_command.get());
    expect(circleCmd != nullptr, "dynamic installed command has CircleCmd type");
    expect(circleCmd->isDynamic(), "CircleCmd reports dynamic raster content for Synchronizable radius");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    auto fallbackSurface = makeSurface(32, 32);
    renderNode(root, fallbackSurface);
    expectNear(circleCmd->props.r, 12.0, "dynamic circle radius falls back to layout radius while main runtime is unset");
    expectColorNear(pixelAt(fallbackSurface, 22, 12), SK_ColorYELLOW, 0, "unset-main-runtime fallback radius uses layout bounds");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
    auto firstDynamicSurface = makeSurface(32, 32);
    renderNode(root, firstDynamicSurface);
    expectNear(circleCmd->props.r, 6.0, "dynamic circle radius resolves initial Synchronizable number");
    expectColorNear(pixelAt(firstDynamicSurface, 12, 12), SK_ColorYELLOW, 0, "dynamic circle center renders");
    expectColorNear(pixelAt(firstDynamicSurface, 19, 12), SK_ColorTRANSPARENT, 0, "dynamic circle initial radius bounds rendered pixels");

    radius->setBlocking(makeSerializableNumberValue(runtime, 10.0));
    expectOptionalNear(convertedRadius.resolve(), 10.0, "converted dynamic circle payload observes Synchronizable mutation");

    auto updatedDynamicSurface = makeSurface(32, 32);
    renderNode(root, updatedDynamicSurface);
    expectNear(circleCmd->props.r, 10.0, "dynamic CircleCmd render observes Synchronizable setBlocking mutation");
    expectColorNear(pixelAt(updatedDynamicSurface, 19, 12), SK_ColorYELLOW, 0, "updated dynamic circle radius expands rendered pixels");
    expectColorNear(pixelAt(updatedDynamicSurface, 23, 12), SK_ColorTRANSPARENT, 0, "updated dynamic circle radius remains bounded");

    radius->setBlocking(makeSerializableNumberValue(runtime, std::numeric_limits<double>::quiet_NaN()));
    auto invalidDynamicSurface = makeSurface(32, 32);
    renderNode(root, invalidDynamicSurface);
    expectFiniteNativeFloat(circleCmd->props.r, 10.0, "dynamic CircleCmd render preserves last valid radius after NaN mutation");
    expectColorNear(pixelAt(invalidDynamicSurface, 19, 12), SK_ColorYELLOW, 0, "invalid dynamic circle radius preserves prior rendered extent");
    expectColorNear(pixelAt(invalidDynamicSurface, 23, 12), SK_ColorTRANSPARENT, 0, "invalid dynamic circle radius does not install an overflowing extent");
}

void assertRRectCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        fixedStyle(20.0, 16.0, SK_ColorMAGENTA),
        rrectCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::RRECT, "setCommand constructs a real RRectCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(root->_command.get()) != nullptr, "installed command has RRectCmd type");

    auto surface = makeSurface(28, 24);
    renderNode(root, surface);
    expectColorNear(pixelAt(surface, 10, 8), SK_ColorMAGENTA, 0, "numeric rrect corner radius still fills the layout center");
    expectColorNear(pixelAt(surface, 0, 0), SK_ColorTRANSPARENT, 0, "numeric rrect corner radius clips the corner");
}

void assertDynamicRRectCommandRender(jsi::Runtime& runtime)
{
    auto cornerRadius = makeSynchronizable(runtime, 5.0);
    auto root = makeYogaNode(
        fixedStyle(20.0, 16.0, SK_ColorMAGENTA),
        dynamicRRectCommand(runtime, cornerRadius));

    expect(root->_commandKind == YogaNodeCommandKind::RRECT, "dynamic setCommand constructs a real RRectCmd");
    auto* rrectCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::RRectCmd*>(root->_command.get());
    expect(rrectCmd != nullptr, "dynamic installed command has RRectCmd type");
    expect(rrectCmd->isDynamic(), "RRectCmd reports dynamic raster content for Synchronizable corner radius");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    auto fallbackSurface = makeSurface(28, 24);
    renderNode(root, fallbackSurface);
    expectColorNear(pixelAt(fallbackSurface, 0, 0), SK_ColorMAGENTA, 0, "dynamic rrect falls back to zero corner radius with no main runtime");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
    auto initialSurface = makeSurface(28, 24);
    renderNode(root, initialSurface);
    expectColorNear(pixelAt(initialSurface, 10, 8), SK_ColorMAGENTA, 0, "dynamic rrect center renders");
    expectColorNear(pixelAt(initialSurface, 0, 0), SK_ColorTRANSPARENT, 0, "dynamic rrect resolves initial Synchronizable corner radius");
    expect(rrectCmd->props.r.has_value(), "dynamic rrect initial render stores a radius");
    expectFiniteNativeFloat(rrectCmd->props.r->rX, 5.0, "dynamic rrect initial corner radius x");
    expectFiniteNativeFloat(rrectCmd->props.r->rY, 5.0, "dynamic rrect initial corner radius y");

    cornerRadius->setBlocking(makeSerializableNumberValue(runtime, nativeFloatOverflowValue()));
    auto invalidSurface = makeSurface(28, 24);
    renderNode(root, invalidSurface);
    expect(rrectCmd->props.r.has_value(), "dynamic rrect invalid render preserves a radius");
    expectFiniteNativeFloat(rrectCmd->props.r->rX, 5.0, "dynamic rrect preserves last valid corner radius after native-float-overflow mutation");
    expectFiniteNativeFloat(rrectCmd->props.r->rY, 5.0, "dynamic rrect preserves last valid corner radius y after native-float-overflow mutation");
    expectColorNear(pixelAt(invalidSurface, 0, 0), SK_ColorTRANSPARENT, 0, "dynamic rrect native-float-overflow mutation preserves prior clipped corner");

    cornerRadius->setBlocking(makeSerializableNumberValue(runtime, 0.0));
    auto updatedSurface = makeSurface(28, 24);
    renderNode(root, updatedSurface);
    expectColorNear(pixelAt(updatedSurface, 0, 0), SK_ColorMAGENTA, 0, "dynamic rrect observes Synchronizable corner-radius mutation during later render");
}

void assertDynamicAnimatedDoubleCommandRejections(jsi::Runtime& runtime)
{
    jsi::Object plainRadius(runtime);
    plainRadius.setProperty(runtime, "not", "a synchronizable");

    jsi::Object plainData(runtime);
    plainData.setProperty(runtime, "radius", std::move(plainRadius));

    jsi::Object plainCommand(runtime);
    plainCommand.setProperty(runtime, "type", "circle");
    plainCommand.setProperty(runtime, "data", std::move(plainData));
    jsi::Value plainCommandValue(runtime, plainCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, plainCommandValue),
        "NodeCommand converter canConvert remains a shape-level guard before AnimatedDouble payload conversion");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, plainCommandValue);
        },
        "NodeCommand conversion failed for type \"circle\"",
        "NodeCommand conversion rejects plain JS object circle radius");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, plainCommandValue);
        },
        "Worklets SerializableJSRef",
        "NodeCommand conversion requires Worklets SerializableJSRef for object AnimatedDouble radius");

    jsi::Object wrongData(runtime);
    wrongData.setProperty(runtime, "radius", makeWrongSerializableRefValue(runtime));

    jsi::Object wrongCommand(runtime);
    wrongCommand.setProperty(runtime, "type", "circle");
    wrongCommand.setProperty(runtime, "data", std::move(wrongData));
    jsi::Value wrongCommandValue(runtime, wrongCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, wrongCommandValue),
        "NodeCommand converter canConvert accepts shaped command before rejecting non-Synchronizable AnimatedDouble payload");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, wrongCommandValue);
        },
        "Worklets Synchronizable",
        "NodeCommand conversion rejects non-Synchronizable SerializableJSRef circle radius");
}

void assertBlurMaskFilterCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        groupStyle(32.0, 32.0),
        blurMaskFilterCommand(runtime));
    auto child = makeYogaNode(
        absoluteStyle(10.0, 10.0, 8.0, 8.0, SK_ColorRED),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::BLUR_MASK_FILTER, "setCommand constructs a real BlurMaskFilterCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::BlurMaskFilterCmd*>(root->_command.get()) != nullptr, "installed command has BlurMaskFilterCmd type");

    auto surface = makeSurface(40, 40);
    renderNode(root, surface);
    expect(
        hasAnyAlphaInRegion(surface, 6, 11, 10, 17),
        "bounded blur mask filter produces non-transparent pixels just outside the child rect");
    expect(
        SkColorGetA(pixelAt(surface, 1, 1)) == 0,
        "bounded blur mask filter does not leak to a far outside pixel");
}

void assertDynamicBlurMaskFilterCommandRender(jsi::Runtime& runtime)
{
    auto blurAmount = makeSynchronizable(runtime, 4.0);
    auto root = makeYogaNode(
        groupStyle(32.0, 32.0),
        dynamicBlurMaskFilterCommand(runtime, blurAmount));
    auto child = makeYogaNode(
        absoluteStyle(10.0, 10.0, 8.0, 8.0, SK_ColorRED),
        rectCommand(runtime));
    root->insertChild(child, std::nullopt);

    expect(root->_commandKind == YogaNodeCommandKind::BLUR_MASK_FILTER, "dynamic setCommand constructs a real BlurMaskFilterCmd");
    auto* blurCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::BlurMaskFilterCmd*>(root->_command.get());
    expect(blurCmd != nullptr, "dynamic installed command has BlurMaskFilterCmd type");
    expect(blurCmd->isDynamic(), "BlurMaskFilterCmd reports dynamic raster content for Synchronizable blur");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    auto fallbackSurface = makeSurface(40, 40);
    renderNode(root, fallbackSurface);
    expectColorNear(pixelAt(fallbackSurface, 12, 12), SK_ColorRED, 0, "dynamic blur fallback still renders child rect");
    expect(
        !hasAnyAlphaInRegion(fallbackSurface, 6, 11, 10, 17),
        "dynamic blur falls back to zero blur with no main runtime");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
    auto initialSurface = makeSurface(40, 40);
    renderNode(root, initialSurface);
    expect(
        hasAnyAlphaInRegion(initialSurface, 6, 11, 10, 17),
        "dynamic blur resolves initial Synchronizable value during render");
    expect(
        SkColorGetA(pixelAt(initialSurface, 1, 1)) == 0,
        "dynamic blur initial render remains bounded");

    blurAmount->setBlocking(makeSerializableNumberValue(runtime, std::numeric_limits<double>::infinity()));
    auto invalidSurface = makeSurface(40, 40);
    renderNode(root, invalidSurface);
    expect(
        hasAnyAlphaInRegion(invalidSurface, 6, 11, 10, 17),
        "dynamic blur preserves last valid blur after Infinity mutation");
    expect(
        SkColorGetA(pixelAt(invalidSurface, 1, 1)) == 0,
        "invalid dynamic blur does not install an unbounded blur");

    blurAmount->setBlocking(makeSerializableNumberValue(runtime, 0.0));
    auto updatedSurface = makeSurface(40, 40);
    renderNode(root, updatedSurface);
    expect(
        !hasAnyAlphaInRegion(updatedSurface, 6, 11, 10, 17),
        "dynamic blur observes Synchronizable mutation during later render");
}

void assertDynamicPathTrimCommandRender(jsi::Runtime& runtime)
{
    auto trimStart = makeSynchronizable(runtime, 0.25);
    auto trimEnd = makeSynchronizable(runtime, 0.5);
    auto command = dynamicPathTrimCommand(runtime, trimStart, trimEnd);
    const auto& payload = std::get<PathCommandData>(command.data);
    expect(payload.trimStart.isDynamic(), "path NodeCommand conversion keeps dynamic AnimatedDouble trimStart");
    expect(payload.trimEnd.isDynamic(), "path NodeCommand conversion keeps dynamic AnimatedDouble trimEnd");
    expect(payload.trimStart.synchronizable.get() == trimStart.get(), "path NodeCommand conversion keeps trimStart Synchronizable identity");
    expect(payload.trimEnd.synchronizable.get() == trimEnd.get(), "path NodeCommand conversion keeps trimEnd Synchronizable identity");
    expect(!payload.trimStart.value.has_value(), "path dynamic trimStart does not invent a static fallback");
    expect(!payload.trimEnd.value.has_value(), "path dynamic trimEnd does not invent a static fallback");
    const auto convertedTrimStart = payload.trimStart;
    const auto convertedTrimEnd = payload.trimEnd;

    auto root = makeYogaNode(
        strokeStyle(20.0, 12.0, SK_ColorCYAN, 2.0f),
        std::move(command));

    expect(root->_commandKind == YogaNodeCommandKind::PATH, "dynamic setCommand constructs a real PathCmd");
    auto* pathCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(root->_command.get());
    expect(pathCmd != nullptr, "dynamic installed command has PathCmd type");
    expect(pathCmd->isDynamic(), "PathCmd reports dynamic raster content for Synchronizable trim values");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    auto fallbackSurface = makeSurface(28, 20);
    renderNode(root, fallbackSurface);
    expectNear(pathCmd->props.start, 0.0, "dynamic path trimStart falls back to zero while main runtime is unset");
    expectNear(pathCmd->props.end, 1.0, "dynamic path trimEnd falls back to one while main runtime is unset");
    expectColorNear(pixelAt(fallbackSurface, 2, 6), SK_ColorCYAN, 0, "unset-main-runtime fallback renders the untrimmed path start");
    expectColorNear(pixelAt(fallbackSurface, 18, 6), SK_ColorCYAN, 0, "unset-main-runtime fallback renders the untrimmed path end");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
    auto initialSurface = makeSurface(28, 20);
    renderNode(root, initialSurface);
    expectNear(pathCmd->props.start, 0.25, "dynamic path trimStart resolves initial Synchronizable number");
    expectNear(pathCmd->props.end, 0.5, "dynamic path trimEnd resolves initial Synchronizable number");
    expectColorNear(pixelAt(initialSurface, 2, 6), SK_ColorTRANSPARENT, 0, "dynamic path initial trim removes the path start");
    expectColorNear(pixelAt(initialSurface, 10, 6), SK_ColorCYAN, 0, "dynamic path initial trim renders the middle segment");
    expectColorNear(pixelAt(initialSurface, 18, 6), SK_ColorTRANSPARENT, 0, "dynamic path initial trim removes the path end");

    trimStart->setBlocking(makeSerializableNumberValue(runtime, 0.5));
    trimEnd->setBlocking(makeSerializableNumberValue(runtime, 1.0));
    expectOptionalNear(convertedTrimStart.resolve(), 0.5, "converted dynamic path trimStart observes Synchronizable mutation");
    expectOptionalNear(convertedTrimEnd.resolve(), 1.0, "converted dynamic path trimEnd observes Synchronizable mutation");

    auto updatedSurface = makeSurface(28, 20);
    renderNode(root, updatedSurface);
    expectNear(pathCmd->props.start, 0.5, "dynamic PathCmd render observes trimStart setBlocking mutation");
    expectNear(pathCmd->props.end, 1.0, "dynamic PathCmd render observes trimEnd setBlocking mutation");
    expectColorNear(pixelAt(updatedSurface, 2, 6), SK_ColorTRANSPARENT, 0, "updated dynamic path trim removes the stale start segment");
    expectColorNear(pixelAt(updatedSurface, 18, 6), SK_ColorCYAN, 0, "updated dynamic path trim renders the new end segment");
    expectColorNear(pixelAt(updatedSurface, 19, 10), SK_ColorCYAN, 0, "updated dynamic path trim renders the vertical segment");

    trimStart->setBlocking(makeSerializableNumberValue(runtime, std::numeric_limits<double>::quiet_NaN()));
    trimEnd->setBlocking(makeSerializableNumberValue(runtime, nativeFloatOverflowValue()));
    auto invalidSurface = makeSurface(28, 20);
    renderNode(root, invalidSurface);
    expectFiniteNativeFloat(pathCmd->props.start, 0.5, "dynamic path trimStart preserves last valid value after NaN mutation");
    expectFiniteNativeFloat(pathCmd->props.end, 1.0, "dynamic path trimEnd preserves last valid value after native-float-overflow mutation");
    expectColorNear(pixelAt(invalidSurface, 2, 6), SK_ColorTRANSPARENT, 0, "invalid dynamic path trim preserves removed start segment");
    expectColorNear(pixelAt(invalidSurface, 18, 6), SK_ColorCYAN, 0, "invalid dynamic path trim preserves rendered end segment");
    expectColorNear(pixelAt(invalidSurface, 19, 10), SK_ColorCYAN, 0, "invalid dynamic path trim preserves rendered vertical segment");
}

void assertPathHostObjectCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        fixedStyle(20.0, 12.0, SK_ColorCYAN),
        pathCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::PATH, "setCommand constructs a real PathCmd");
    expect(dynamic_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(root->_command.get()) != nullptr, "installed command has PathCmd type");

    auto surface = makeSurface(28, 20);
    renderNode(root, surface);
    expectColorNear(pixelAt(surface, 10, 6), SK_ColorCYAN, 0, "real JsiSkPath host-object path renders after layout scaling");
    expectColorNear(pixelAt(surface, 22, 14), SK_ColorTRANSPARENT, 0, "path render remains bounded by its scaled path");
}

void assertPublicPathStrokeCommandRender(jsi::Runtime& runtime)
{
    auto command = publicPathStrokeCommand(runtime);
    const auto& payload = std::get<PathCommandData>(command.data);
    expect(payload.stroke.has_value(), "public path.stroke payload conversion keeps stroke options");
    const auto& stroke = payload.stroke.value();
    expectOptionalFloatNear(stroke.width, 4.0, "public path.stroke conversion keeps width");
    expectOptionalFloatNear(stroke.miterLimit, 7.0, "public path.stroke conversion keeps miter_limit");
    expectOptionalFloatNear(stroke.precision, 1.25, "public path.stroke conversion keeps precision");
    expect(
        stroke.join.has_value() && stroke.join.value() == SkPaint::Join::kMiter_Join,
        "public path.stroke conversion keeps join");
    expect(
        stroke.cap.has_value() && stroke.cap.value() == SkPaint::Cap::kSquare_Cap,
        "public path.stroke conversion keeps cap");

    auto root = makeYogaNode(
        fixedStyle(20.0, 12.0, SK_ColorCYAN),
        std::move(command));

    expect(root->_commandKind == YogaNodeCommandKind::PATH, "public path.stroke setCommand constructs a real PathCmd");
    auto* pathCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::PathCmd*>(root->_command.get());
    expect(pathCmd != nullptr, "public path.stroke installed command has PathCmd type");
    expect(pathCmd->props.stroke.has_value(), "public path.stroke reaches PathCmd props before draw");
    const auto& nativeStroke = pathCmd->props.stroke.value();
    expectOptionalFloatNear(nativeStroke.width, 4.0, "public path.stroke native PathCmd width");
    expectOptionalFloatNear(nativeStroke.miter_limit, 7.0, "public path.stroke native PathCmd miter_limit");
    expectOptionalFloatNear(nativeStroke.precision, 1.25, "public path.stroke native PathCmd precision");
    expect(
        nativeStroke.join.has_value() && nativeStroke.join.value() == SkPaint::Join::kMiter_Join,
        "public path.stroke native PathCmd join");
    expect(
        nativeStroke.cap.has_value() && nativeStroke.cap.value() == SkPaint::Cap::kSquare_Cap,
        "public path.stroke native PathCmd cap");

    auto surface = makeSurface(28, 20);
    renderNode(root, surface);
    expect(pathCmd->props.stroke.has_value(), "public path.stroke remains installed during PathCmd draw");
    expectColorNear(pixelAt(surface, 10, 6), SK_ColorCYAN, 0, "public path.stroke renders through PathCmd::draw");
    expectColorNear(pixelAt(surface, 22, 14), SK_ColorTRANSPARENT, 0, "public path.stroke render remains bounded outside the path");
}

void assertPathStrokeMiterAliasPrecedence(jsi::Runtime& runtime)
{
    auto command = pathStrokeAliasPrecedenceCommand(runtime);
    const auto& payload = std::get<PathCommandData>(command.data);
    expect(payload.stroke.has_value(), "path.stroke alias precedence payload keeps stroke options");
    expectOptionalFloatNear(
        payload.stroke->miterLimit,
        9.0,
        "path.stroke public miter_limit wins over miterLimit alias");
    expect(
        payload.stroke->join.has_value() && payload.stroke->join.value() == SkPaint::Join::kRound_Join,
        "public path.stroke conversion accepts string join");
    expect(
        payload.stroke->cap.has_value() && payload.stroke->cap.value() == SkPaint::Cap::kButt_Cap,
        "public path.stroke conversion accepts string cap");
}

void assertStrokeOptsConverterPublicMiterContract(jsi::Runtime& runtime)
{
    RNSkia::StrokeOpts outbound;
    outbound.width = 4.0f;
    outbound.miter_limit = 11.0f;
    outbound.precision = 1.25f;
    outbound.join = SkPaint::Join::kMiter_Join;
    outbound.cap = SkPaint::Cap::kSquare_Cap;

    auto outboundValue = margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::toJSI(runtime, outbound);
    auto outboundObject = outboundValue.asObject(runtime);
    expectNear(outboundObject.getProperty(runtime, "miter_limit").asNumber(), 11.0, "StrokeOpts toJSI emits public miter_limit");
    expect(
        outboundObject.getProperty(runtime, "miterLimit").isUndefined(),
        "StrokeOpts toJSI does not emit private miterLimit");

    jsi::Object inbound(runtime);
    inbound.setProperty(runtime, "miterLimit", 2.0);
    inbound.setProperty(runtime, "miter_limit", 8.0);
    auto inboundValue = jsi::Value(runtime, inbound);
    auto converted = margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::fromJSI(runtime, inboundValue);
    expectOptionalFloatNear(converted.miter_limit, 8.0, "StrokeOpts fromJSI public miter_limit wins over alias");

    jsi::Object aliasOnly(runtime);
    aliasOnly.setProperty(runtime, "miterLimit", 3.0);
    auto aliasOnlyValue = jsi::Value(runtime, aliasOnly);
    auto aliasConverted = margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::fromJSI(runtime, aliasOnlyValue);
    expectOptionalFloatNear(aliasConverted.miter_limit, 3.0, "StrokeOpts fromJSI preserves miterLimit alias fallback");
}

void assertStrokeOptsConverterDirectConsistency(jsi::Runtime& runtime)
{
    jsi::Object stroke(runtime);
    stroke.setProperty(runtime, "width", 4.0);
    stroke.setProperty(runtime, "miter_limit", 8.0);
    stroke.setProperty(runtime, "precision", 1.25);
    stroke.setProperty(runtime, "join", "round");
    stroke.setProperty(runtime, "cap", "butt");
    jsi::Value strokeValue(runtime, stroke);

    expect(
        margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::canConvert(runtime, strokeValue),
        "StrokeOpts canConvert accepts object payloads");
    auto converted = margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::fromJSI(runtime, strokeValue);
    expectOptionalFloatNear(converted.width, 4.0, "StrokeOpts direct fromJSI keeps object width");
    expectOptionalFloatNear(converted.miter_limit, 8.0, "StrokeOpts direct fromJSI keeps object miter_limit");
    expectOptionalFloatNear(converted.precision, 1.25, "StrokeOpts direct fromJSI keeps object precision");
    expect(
        converted.join.has_value() && converted.join.value() == SkPaint::Join::kRound_Join,
        "StrokeOpts direct fromJSI keeps object join");
    expect(
        converted.cap.has_value() && converted.cap.value() == SkPaint::Cap::kButt_Cap,
        "StrokeOpts direct fromJSI keeps object cap");

    const auto expectRejected = [&](const jsi::Value& value, const std::string& label) {
        expect(
            !margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::canConvert(runtime, value),
            "StrokeOpts canConvert rejects " + label);
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::fromJSI(runtime, value);
            },
            "Invalid prop value for StrokeOpts received",
            "StrokeOpts fromJSI rejects " + label);
    };

    auto nullValue = jsi::Value::null();
    auto undefinedValue = jsi::Value::undefined();
    auto numberValue = jsi::Value(42.0);
    auto boolValue = jsi::Value(true);
    auto stringValue = jsi::Value(jsi::String::createFromUtf8(runtime, "stroke"));

    expectRejected(nullValue, "null");
    expectRejected(undefinedValue, "undefined");
    expectRejected(numberValue, "number");
    expectRejected(boolValue, "boolean");
    expectRejected(stringValue, "string");
}

void assertStrokeOptsConverterFiniteRejections(jsi::Runtime& runtime)
{
    const double nan = std::numeric_limits<double>::quiet_NaN();
    const double positiveInfValue = std::numeric_limits<double>::infinity();
    const double negativeInfValue = -std::numeric_limits<double>::infinity();

    const auto expectRejected = [&](
        const std::function<void(jsi::Object&)>& configure,
        const std::string& expectedMessage,
        const char* label) {
        jsi::Object stroke(runtime);
        configure(stroke);
        jsi::Value strokeValue(runtime, stroke);
        expect(
            margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::canConvert(runtime, strokeValue),
            std::string("StrokeOpts canConvert accepts object before finite rejection for ") + label);
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::fromJSI(runtime, strokeValue);
            },
            expectedMessage,
            std::string("StrokeOpts fromJSI rejects ") + label);
    };

    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "width", nan);
        },
        invalidStrokeCommandMessage("stroke.width"),
        "stroke.width NaN");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "width", positiveInfValue);
        },
        invalidStrokeCommandMessage("stroke.width"),
        "stroke.width Infinity");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "width", negativeInfValue);
        },
        invalidStrokeCommandMessage("stroke.width"),
        "stroke.width -Infinity");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "miter_limit", nan);
        },
        invalidStrokeCommandMessage("stroke.miter_limit"),
        "stroke.miter_limit NaN");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "miterLimit", 2.0);
            stroke.setProperty(runtime, "miter_limit", positiveInfValue);
        },
        invalidStrokeCommandMessage("stroke.miter_limit"),
        "stroke.miter_limit Infinity with alias present");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "miter_limit", negativeInfValue);
        },
        invalidStrokeCommandMessage("stroke.miter_limit"),
        "stroke.miter_limit -Infinity");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "miterLimit", nan);
        },
        invalidStrokeCommandMessage("stroke.miterLimit"),
        "stroke.miterLimit NaN");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "miterLimit", positiveInfValue);
        },
        invalidStrokeCommandMessage("stroke.miterLimit"),
        "stroke.miterLimit Infinity");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "miterLimit", negativeInfValue);
        },
        invalidStrokeCommandMessage("stroke.miterLimit"),
        "stroke.miterLimit -Infinity");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "precision", nan);
        },
        invalidStrokeCommandMessage("stroke.precision"),
        "stroke.precision NaN");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "precision", positiveInfValue);
        },
        invalidStrokeCommandMessage("stroke.precision"),
        "stroke.precision Infinity");
    expectRejected(
        [&](jsi::Object& stroke) {
            stroke.setProperty(runtime, "precision", negativeInfValue);
        },
        invalidStrokeCommandMessage("stroke.precision"),
        "stroke.precision -Infinity");
}

void assertStrokeOptsConverterNumericEnumRejections(jsi::Runtime& runtime)
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

    const auto validJoin = static_cast<double>(static_cast<int>(SkPaint::Join::kMiter_Join));
    const auto validCap = static_cast<double>(static_cast<int>(SkPaint::Cap::kSquare_Cap));
    const auto expectRejected = [&](
        const std::function<void(jsi::Object&)>& configure,
        const std::string& expectedMessage,
        const std::string& label) {
        jsi::Object stroke(runtime);
        stroke.setProperty(runtime, "width", 4.0);
        stroke.setProperty(runtime, "miter_limit", 7.0);
        stroke.setProperty(runtime, "precision", 1.25);
        stroke.setProperty(runtime, "join", validJoin);
        stroke.setProperty(runtime, "cap", validCap);
        configure(stroke);
        jsi::Value strokeValue(runtime, stroke);
        expect(
            margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::canConvert(runtime, strokeValue),
            "StrokeOpts canConvert accepts object before numeric enum rejection for " + label);
        expectJsiThrows(
            [&]() {
                (void)margelo::nitro::JSIConverter<RNSkia::StrokeOpts>::fromJSI(runtime, strokeValue);
            },
            expectedMessage,
            "StrokeOpts fromJSI rejects " + label);
    };

    for (const auto& invalidCase : invalidCases) {
        const auto label = std::string("stroke.join ") + invalidCase.labelSuffix;
        expectRejected(
            [&](jsi::Object& stroke) {
                stroke.setProperty(runtime, "join", invalidCase.value);
            },
            invalidNumericEnumMessage("stroke.join", "[0, 1, 2]"),
            label);
    }

    for (const auto& invalidCase : invalidCases) {
        const auto label = std::string("stroke.cap ") + invalidCase.labelSuffix;
        expectRejected(
            [&](jsi::Object& stroke) {
                stroke.setProperty(runtime, "cap", invalidCase.value);
            },
            invalidNumericEnumMessage("stroke.cap", "[0, 1, 2]"),
            label);
    }
}

struct ExpectedPixel {
    int x;
    int y;
    SkColor color;
    std::string message;
    int tolerance = 0;
};

void expectRectNear(
    const SkRect& actual,
    float expectedLeft,
    float expectedTop,
    float expectedWidth,
    float expectedHeight,
    const std::string& label)
{
    expectNear(actual.left(), expectedLeft, label + " left");
    expectNear(actual.top(), expectedTop, label + " top");
    expectNear(actual.width(), expectedWidth, label + " width");
    expectNear(actual.height(), expectedHeight, label + " height");
}

void assertImageFitRects(
    const std::string& fit,
    float dstWidth,
    float dstHeight,
    const SkRect& expectedSrc,
    const SkRect& expectedDst)
{
    const auto rects = RNSkiaImage::fitRects(
        fit,
        SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 4.0f),
        SkRect::MakeXYWH(0.0f, 0.0f, dstWidth, dstHeight));
    expectRectNear(rects.src, expectedSrc.left(), expectedSrc.top(), expectedSrc.width(), expectedSrc.height(), fit + " source fit rect");
    expectRectNear(rects.dst, expectedDst.left(), expectedDst.top(), expectedDst.width(), expectedDst.height(), fit + " destination fit rect");
}

void assertImageFitHelperGeometry()
{
    assertImageFitRects(
        "fill",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 4.0f),
        SkRect::MakeXYWH(0.0f, 0.0f, 16.0f, 16.0f));
    assertImageFitRects(
        "contain",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 4.0f),
        SkRect::MakeXYWH(0.0f, 4.0f, 16.0f, 8.0f));
    assertImageFitRects(
        "cover",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(2.0f, 0.0f, 4.0f, 4.0f),
        SkRect::MakeXYWH(0.0f, 0.0f, 16.0f, 16.0f));
    assertImageFitRects(
        "fitWidth",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(0.0f, -2.0f, 8.0f, 8.0f),
        SkRect::MakeXYWH(0.0f, 0.0f, 16.0f, 16.0f));
    assertImageFitRects(
        "fitHeight",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(2.0f, 0.0f, 4.0f, 4.0f),
        SkRect::MakeXYWH(0.0f, 0.0f, 16.0f, 16.0f));
    assertImageFitRects(
        "none",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 4.0f),
        SkRect::MakeXYWH(4.0f, 6.0f, 8.0f, 4.0f));
    assertImageFitRects(
        "scaleDown",
        16.0f,
        16.0f,
        SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 4.0f),
        SkRect::MakeXYWH(4.0f, 6.0f, 8.0f, 4.0f));
    assertImageFitRects(
        "scaleDown",
        6.0f,
        6.0f,
        SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 4.0f),
        SkRect::MakeXYWH(0.0f, 1.5f, 6.0f, 3.0f));
}

void assertImageFitCase(
    jsi::Runtime& runtime,
    const std::string& label,
    std::optional<std::string> requestedFit,
    const std::string& expectedNativeFit,
    double layoutWidth,
    double layoutHeight,
    const std::vector<ExpectedPixel>& expectedPixels)
{
    auto command = imageCommand(runtime, requestedFit);
    const auto& payload = std::get<ImageCommandData>(command.data);
    if (requestedFit.has_value()) {
        expect(payload.fit.has_value(), label + " converted payload keeps explicit fit");
        expect(payload.fit.value() == requestedFit.value(), label + " converted payload fit value");
    } else {
        expect(!payload.fit.has_value(), label + " converted payload leaves omitted fit empty");
    }
    expect(payload.image.has_value(), label + " converted payload keeps image");
    expect(payload.image.value() != nullptr, label + " converted payload image is non-null");
    expect(payload.sampling.has_value(), label + " converted payload keeps sampling");

    auto root = makeYogaNode(
        groupStyle(layoutWidth, layoutHeight),
        std::move(command));

    expect(root->_commandKind == YogaNodeCommandKind::IMAGE, label + " setCommand constructs a real ImageCmd");
    auto* imageCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ImageCmd*>(root->_command.get());
    expect(imageCmd != nullptr, label + " installed command has ImageCmd type");
    expect(imageCmd->props.image.has_value(), label + " ImageCmd keeps the converted SkImage host object payload");
    expect(imageCmd->props.image.value() != nullptr, label + " ImageCmd converted SkImage payload is non-null");
    expect(imageCmd->props.image.value()->width() == 8, label + " ImageCmd converted SkImage width");
    expect(imageCmd->props.image.value()->height() == 4, label + " ImageCmd converted SkImage height");
    expect(imageCmd->props.fit == expectedNativeFit, label + " ImageCmd native fit mode");

    const int surfaceWidth = static_cast<int>(std::ceil(layoutWidth)) + 4;
    const int surfaceHeight = static_cast<int>(std::ceil(layoutHeight)) + 4;
    auto surface = makeSurface(surfaceWidth, surfaceHeight);
    renderNode(root, surface);

    expectNear(root->_layout.width, layoutWidth, label + " image layout width");
    expectNear(root->_layout.height, layoutHeight, label + " image layout height");
    expect(imageCmd->props.rect.has_value(), label + " ImageCmd layout resolves a draw rect");
    expectRectNear(*imageCmd->props.rect, 0.0f, 0.0f, static_cast<float>(layoutWidth), static_cast<float>(layoutHeight), label + " ImageCmd draw rect");

    for (const auto& expected : expectedPixels) {
        expectColorNear(
            pixelAt(surface, expected.x, expected.y),
            expected.color,
            expected.tolerance,
            label + " " + expected.message);
    }

    expectColorNear(
        pixelAt(surface, static_cast<int>(std::ceil(layoutWidth)) + 1, 1),
        SK_ColorTRANSPARENT,
        0,
        label + " image render remains bounded by the Yoga layout width");
    expectColorNear(
        pixelAt(surface, 1, static_cast<int>(std::ceil(layoutHeight)) + 1),
        SK_ColorTRANSPARENT,
        0,
        label + " image render remains bounded by the Yoga layout height");
}

void assertImageFitCommandRender(jsi::Runtime& runtime)
{
    assertImageFitHelperGeometry();

    assertImageFitCase(
        runtime,
        "fill",
        std::optional<std::string>("fill"),
        "fill",
        16.0,
        16.0,
        {
            { 2, 3, SK_ColorRED, "stretches red source block into the destination" },
            { 6, 3, SK_ColorGREEN, "stretches green source block into the destination" },
            { 10, 3, SK_ColorBLUE, "stretches blue source block into the destination" },
            { 14, 3, SK_ColorYELLOW, "stretches yellow source block into the destination" },
            { 2, 12, SK_ColorCYAN, "stretches cyan source block into the destination" },
            { 6, 12, SK_ColorMAGENTA, "stretches magenta source block into the destination" },
            { 10, 12, SK_ColorWHITE, "stretches white source block into the destination" },
            { 14, 12, SK_ColorBLACK, "stretches black source block into the destination" },
        });

    assertImageFitCase(
        runtime,
        "default contain",
        std::nullopt,
        "contain",
        16.0,
        16.0,
        {
            { 2, 2, SK_ColorTRANSPARENT, "leaves the top letterbox transparent" },
            { 2, 5, SK_ColorRED, "renders the contained red source block" },
            { 14, 5, SK_ColorYELLOW, "renders the contained yellow source block" },
            { 2, 10, SK_ColorCYAN, "renders the contained cyan source block" },
            { 14, 10, SK_ColorBLACK, "renders the contained black source block" },
            { 2, 14, SK_ColorTRANSPARENT, "leaves the bottom letterbox transparent" },
        });

    assertImageFitCase(
        runtime,
        "cover",
        std::optional<std::string>("cover"),
        "cover",
        16.0,
        16.0,
        {
            { 3, 3, SK_ColorGREEN, "crops away the left source edge" },
            { 12, 3, SK_ColorBLUE, "crops away the right source edge" },
            { 3, 12, SK_ColorMAGENTA, "renders the cropped lower-left source region" },
            { 12, 12, SK_ColorWHITE, "renders the cropped lower-right source region" },
        });

    assertImageFitCase(
        runtime,
        "none",
        std::optional<std::string>("none"),
        "none",
        16.0,
        16.0,
        {
            { 3, 7, SK_ColorTRANSPARENT, "leaves pixels before the unscaled image transparent" },
            { 5, 7, SK_ColorRED, "renders the unscaled red source block" },
            { 7, 7, SK_ColorGREEN, "renders the unscaled green source block" },
            { 9, 7, SK_ColorBLUE, "renders the unscaled blue source block" },
            { 11, 7, SK_ColorYELLOW, "renders the unscaled yellow source block" },
            { 5, 9, SK_ColorCYAN, "renders the unscaled cyan source block" },
            { 11, 9, SK_ColorBLACK, "renders the unscaled black source block" },
            { 12, 7, SK_ColorTRANSPARENT, "leaves pixels after the unscaled image transparent" },
        });

    assertImageFitCase(
        runtime,
        "scaleDown",
        std::optional<std::string>("scaleDown"),
        "scaleDown",
        16.0,
        16.0,
        {
            { 3, 7, SK_ColorTRANSPARENT, "does not upscale when the destination is larger than the image" },
            { 5, 7, SK_ColorRED, "renders the no-upscale red source block" },
            { 9, 7, SK_ColorBLUE, "renders the no-upscale blue source block" },
            { 5, 9, SK_ColorCYAN, "renders the no-upscale cyan source block" },
            { 11, 9, SK_ColorBLACK, "renders the no-upscale black source block" },
            { 12, 7, SK_ColorTRANSPARENT, "keeps the no-upscale image bounded" },
        });

    assertImageFitCase(
        runtime,
        "fitWidth",
        std::optional<std::string>("fitWidth"),
        "fitWidth",
        16.0,
        16.0,
        {
            { 2, 2, SK_ColorTRANSPARENT, "keeps the out-of-source top band transparent" },
            { 2, 5, SK_ColorRED, "renders the width-fit red source block" },
            { 14, 5, SK_ColorYELLOW, "renders the width-fit yellow source block" },
            { 2, 10, SK_ColorCYAN, "renders the width-fit cyan source block" },
            { 14, 10, SK_ColorBLACK, "renders the width-fit black source block" },
            { 2, 14, SK_ColorTRANSPARENT, "keeps the out-of-source bottom band transparent" },
        });

    assertImageFitCase(
        runtime,
        "fitHeight",
        std::optional<std::string>("fitHeight"),
        "fitHeight",
        16.0,
        16.0,
        {
            { 3, 3, SK_ColorGREEN, "crops horizontally to satisfy height fitting" },
            { 12, 3, SK_ColorBLUE, "renders the height-fit cropped upper-right source region" },
            { 3, 12, SK_ColorMAGENTA, "renders the height-fit cropped lower-left source region" },
            { 12, 12, SK_ColorWHITE, "renders the height-fit cropped lower-right source region" },
        });
}

void assertTextCommandStateAndRender(jsi::Runtime& runtime)
{
    auto defaultCommand = defaultTextCommand(runtime);
    const auto& defaultPayload = std::get<TextCommandData>(defaultCommand.data);
    expect(defaultPayload.text.has_value(), "default text command conversion keeps text");
    expect(defaultPayload.text.value() == "Default Text", "default text command conversion keeps text value");

    auto defaultNode = makeYogaNode(
        groupStyle(96.0, 36.0),
        std::move(defaultCommand));

    expect(defaultNode->_commandKind == YogaNodeCommandKind::TEXT, "setCommand constructs a real TextCmd");
    auto* defaultTextCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::TextCmd*>(defaultNode->_command.get());
    expect(defaultTextCmd != nullptr, "installed command has TextCmd type");
    expect(defaultTextCmd->props.text == "Default Text", "TextCmd keeps converted text payload");
    expect(defaultTextCmd->props.font.has_value(), "TextCmd has a default font");
    expectNear(defaultTextCmd->props.font->getSize(), 14.0, "TextCmd default font size");

    auto styledCommand = styledTextCommand(runtime);
    const auto& styledPayload = std::get<TextCommandData>(styledCommand.data);
    expect(styledPayload.text.has_value(), "styled text command conversion keeps text");
    expect(styledPayload.text.value() == "Bounded Text", "styled text command conversion keeps text value");
    expect(styledPayload.textStyle.has_value(), "styled text command conversion keeps textStyle");
    expectNear(styledPayload.textStyle->getFontSize(), 18.0, "styled text command conversion keeps font size");
    expectColorNear(styledPayload.textStyle->getColor(), SkColorSetARGB(255, 0, 0, 255), 0, "styled text command conversion keeps color");

    auto root = makeYogaNode(
        groupStyle(116.0, 42.0),
        std::move(styledCommand));

    expect(root->_commandKind == YogaNodeCommandKind::TEXT, "styled setCommand constructs a real TextCmd");
    auto* textCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::TextCmd*>(root->_command.get());
    expect(textCmd != nullptr, "styled installed command has TextCmd type");
    expect(textCmd->props.text == "Bounded Text", "styled TextCmd keeps converted text payload");
    expect(textCmd->props.font.has_value(), "styled TextCmd has a font");
    expectNear(textCmd->props.font->getSize(), 18.0, "styled TextCmd applies textStyle font size");
    expect(textCmd->fallbackPaintColor().has_value(), "styled TextCmd exposes fallback paint color");
    expectColorNear(*textCmd->fallbackPaintColor(), SkColorSetARGB(255, 0, 0, 255), 0, "styled TextCmd fallback paint color comes from textStyle");

    auto surface = makeSurface(140, 64);
    renderNode(root, surface);

    expectNear(root->_layout.width, 116.0, "text layout width");
    expectNear(root->_layout.height, 42.0, "text layout height");
    expect(
        hasAnyBlueDominantPixelInRegion(surface, 0, 1, 116, 34),
        "TextCmd renders bounded blue-dominant glyph pixels from textStyle fallback paint");
    expect(
        !hasAnyAlphaInRegion(surface, 126, 48, 138, 62),
        "TextCmd render remains away from far outside pixels");

    auto cssCommand = cssColorTextCommand(runtime);
    const auto& cssPayload = std::get<TextCommandData>(cssCommand.data);
    expect(cssPayload.text.has_value(), "CSS color text command conversion keeps text");
    expect(cssPayload.text.value() == "CSS Text", "CSS color text command conversion keeps text value");
    expect(cssPayload.textStyle.has_value(), "CSS color text command conversion keeps textStyle");
    expectNear(cssPayload.textStyle->getFontSize(), 19.0, "CSS color text command conversion keeps font size");
    expectColorNear(cssPayload.textStyle->getColor(), SK_ColorRED, 0, "TextCmd conversion parses rgba CSS color string");

    auto cssRoot = makeYogaNode(
        groupStyle(116.0, 44.0),
        std::move(cssCommand));

    expect(cssRoot->_commandKind == YogaNodeCommandKind::TEXT, "CSS color setCommand constructs a real TextCmd");
    auto* cssTextCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::TextCmd*>(cssRoot->_command.get());
    expect(cssTextCmd != nullptr, "CSS color installed command has TextCmd type");
    expect(cssTextCmd->props.text == "CSS Text", "CSS color TextCmd keeps converted text payload");
    expect(cssTextCmd->props.font.has_value(), "CSS color TextCmd has a font");
    expectNear(cssTextCmd->props.font->getSize(), 19.0, "CSS color TextCmd applies textStyle font size");
    expect(cssTextCmd->fallbackPaintColor().has_value(), "CSS color TextCmd exposes fallback paint color");
    expectColorNear(*cssTextCmd->fallbackPaintColor(), SK_ColorRED, 0, "TextCmd fallback paint color comes from rgba CSS string");

    auto cssSurface = makeSurface(140, 66);
    renderNode(cssRoot, cssSurface);

    expectNear(cssRoot->_layout.width, 116.0, "CSS text layout width");
    expectNear(cssRoot->_layout.height, 44.0, "CSS text layout height");
    expect(
        hasAnyRedDominantPixelInRegion(cssSurface, 0, 1, 116, 36),
        "TextCmd renders bounded red-dominant glyph pixels from rgba CSS color string");
    expect(
        !hasAnyAlphaInRegion(cssSurface, 126, 50, 138, 64),
        "CSS TextCmd render remains away from far outside pixels");

    auto namedCommand = namedColorTextCommand(runtime);
    const auto& namedPayload = std::get<TextCommandData>(namedCommand.data);
    expect(namedPayload.textStyle.has_value(), "named color text command conversion keeps textStyle");
    expectColorNear(namedPayload.textStyle->getColor(), SK_ColorBLUE, 0, "TextCmd conversion parses named CSS color string");
}

void assertParagraphCommandMeasureAndRender(jsi::Runtime& runtime)
{
    auto command = paragraphCommand(runtime);
    const auto& payload = std::get<ParagraphCommandData>(command.data);
    expect(payload.text.has_value(), "paragraph command conversion keeps text");
    expect(payload.text.value() == "Paragraph host text", "paragraph command conversion keeps text value");
    expect(payload.paragraphStyle.has_value(), "paragraph command conversion keeps paragraphStyle");
    expectNear(payload.paragraphStyle->getTextStyle().getFontSize(), 18.0, "paragraph command conversion keeps flattened font size");
    expectColorNear(payload.paragraphStyle->getTextStyle().getColor(), SkColorSetARGB(255, 0, 0, 255), 0, "paragraph command conversion keeps flattened color");
    expect(!payload.paragraph.has_value(), "paragraph command conversion does not require a JS-created JsiSkParagraph");

    auto root = makeYogaNode(
        widthOnlyStyle(92.0),
        std::move(command));

    expect(root->_commandKind == YogaNodeCommandKind::PARAGRAPH, "setCommand constructs a real ParagraphCmd");
    auto* paragraphCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ParagraphCmd*>(root->_command.get());
    expect(paragraphCmd != nullptr, "installed command has ParagraphCmd type");
    expect(YGNodeHasMeasureFunc(root->_node), "ParagraphCmd installs a Yoga measure function");
    expect(paragraphCmd->props.paragraph != nullptr, "ParagraphCmd builds a paragraph from text and paragraphStyle");

    auto measured = margelo::nitro::RNSkiaYoga::ParagraphCmd::measureFunc(
        root->_node,
        92.0f,
        YGMeasureModeAtMost,
        YGUndefined,
        YGMeasureModeUndefined);
    expect(measured.width > 0.0f, "ParagraphCmd measure width is positive");
    expect(measured.width <= 92.0f, "ParagraphCmd measure width is bounded by the available width");
    expect(measured.height > 0.0f, "ParagraphCmd measure height is positive");
    expect(measured.height < 140.0f, "ParagraphCmd measure height remains bounded for probe text");

    auto surface = makeSurface(140, 120);
    renderNode(root, surface);

    expectNear(root->_layout.width, 92.0, "paragraph Yoga layout width follows style constraint");
    expect(root->_layout.height > 0.0, "paragraph Yoga layout height comes from measure function");
    expect(root->_layout.height < 140.0, "paragraph Yoga layout height remains bounded");
    expectNear(paragraphCmd->props.width, 92.0, "ParagraphCmd draw width follows Yoga layout");
    expect(paragraphCmd->props.paragraph->getObject()->getHeight() > 0.0f, "ParagraphCmd paragraph object has positive laid-out height");

    expect(
        hasAnyBlueDominantPixelInRegion(surface, 2, 2, 90, 96),
        "ParagraphCmd renders blue-dominant paragraph glyph pixels inside the debug border");
    expect(
        !hasAnyAlphaInRegion(surface, 112, 96, 136, 116),
        "ParagraphCmd render remains bounded away from far outside pixels");

    auto cssCommand = cssColorParagraphCommand(runtime);
    const auto& cssPayload = std::get<ParagraphCommandData>(cssCommand.data);
    expect(cssPayload.text.has_value(), "CSS color paragraph command conversion keeps text");
    expect(cssPayload.text.value() == "CSS paragraph text", "CSS color paragraph command conversion keeps text value");
    expect(cssPayload.paragraphStyle.has_value(), "CSS color paragraph command conversion keeps paragraphStyle");
    expectNear(cssPayload.paragraphStyle->getTextStyle().getFontSize(), 18.0, "CSS color paragraph command conversion keeps flattened font size");
    expectColorNear(cssPayload.paragraphStyle->getTextStyle().getColor(), SK_ColorGREEN, 0, "ParagraphCmd conversion parses flattened hex CSS color string");
    expect(!cssPayload.paragraph.has_value(), "CSS color paragraph command conversion does not require a JS-created JsiSkParagraph");

    auto cssRoot = makeYogaNode(
        widthOnlyStyle(92.0),
        std::move(cssCommand));

    expect(cssRoot->_commandKind == YogaNodeCommandKind::PARAGRAPH, "CSS color setCommand constructs a real ParagraphCmd");
    auto* cssParagraphCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ParagraphCmd*>(cssRoot->_command.get());
    expect(cssParagraphCmd != nullptr, "CSS color installed command has ParagraphCmd type");
    expect(YGNodeHasMeasureFunc(cssRoot->_node), "CSS color ParagraphCmd installs a Yoga measure function");
    expect(cssParagraphCmd->props.paragraph != nullptr, "CSS color ParagraphCmd builds a paragraph from text and paragraphStyle");

    auto cssMeasured = margelo::nitro::RNSkiaYoga::ParagraphCmd::measureFunc(
        cssRoot->_node,
        92.0f,
        YGMeasureModeAtMost,
        YGUndefined,
        YGMeasureModeUndefined);
    expect(cssMeasured.width > 0.0f, "CSS color ParagraphCmd measure width is positive");
    expect(cssMeasured.width <= 92.0f, "CSS color ParagraphCmd measure width is bounded by the available width");
    expect(cssMeasured.height > 0.0f, "CSS color ParagraphCmd measure height is positive");
    expect(cssMeasured.height < 140.0f, "CSS color ParagraphCmd measure height remains bounded for probe text");

    auto cssSurface = makeSurface(140, 120);
    renderNode(cssRoot, cssSurface);

    expectNear(cssRoot->_layout.width, 92.0, "CSS color paragraph Yoga layout width follows style constraint");
    expect(cssRoot->_layout.height > 0.0, "CSS color paragraph Yoga layout height comes from measure function");
    expect(cssRoot->_layout.height < 140.0, "CSS color paragraph Yoga layout height remains bounded");
    expectNear(cssParagraphCmd->props.width, 92.0, "CSS color ParagraphCmd draw width follows Yoga layout");
    expect(cssParagraphCmd->props.paragraph->getObject()->getHeight() > 0.0f, "CSS color ParagraphCmd paragraph object has positive laid-out height");

    expect(
        hasAnyGreenDominantPixelInRegion(cssSurface, 2, 2, 90, 96),
        "ParagraphCmd renders green-dominant glyph pixels from flattened hex CSS color string inside the debug border");
    expect(
        !hasAnyAlphaInRegion(cssSurface, 112, 96, 136, 116),
        "CSS color ParagraphCmd render remains bounded away from far outside pixels");

    auto nestedCssCommand = nestedCssColorParagraphCommand(runtime);
    const auto& nestedCssPayload = std::get<ParagraphCommandData>(nestedCssCommand.data);
    expect(nestedCssPayload.text.has_value(), "nested CSS color paragraph command conversion keeps text");
    expect(nestedCssPayload.text.value() == "Nested CSS paragraph text", "nested CSS color paragraph command conversion keeps text value");
    expect(nestedCssPayload.paragraphStyle.has_value(), "nested CSS color paragraph command conversion keeps paragraphStyle");
    expectNear(nestedCssPayload.paragraphStyle->getTextStyle().getFontSize(), 18.0, "nested CSS color paragraph command conversion keeps nested font size");
    expectColorNear(nestedCssPayload.paragraphStyle->getTextStyle().getColor(), SK_ColorGREEN, 0, "ParagraphCmd conversion parses nested textStyle hex CSS color string");
    expect(!nestedCssPayload.paragraph.has_value(), "nested CSS color paragraph command conversion does not require a JS-created JsiSkParagraph");

    auto nestedCssRoot = makeYogaNode(
        widthOnlyStyle(92.0),
        std::move(nestedCssCommand));

    expect(nestedCssRoot->_commandKind == YogaNodeCommandKind::PARAGRAPH, "nested CSS color setCommand constructs a real ParagraphCmd");
    auto* nestedCssParagraphCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ParagraphCmd*>(nestedCssRoot->_command.get());
    expect(nestedCssParagraphCmd != nullptr, "nested CSS color installed command has ParagraphCmd type");
    expect(YGNodeHasMeasureFunc(nestedCssRoot->_node), "nested CSS color ParagraphCmd installs a Yoga measure function");
    expect(nestedCssParagraphCmd->props.paragraph != nullptr, "nested CSS color ParagraphCmd builds a paragraph from text and paragraphStyle");

    auto nestedCssMeasured = margelo::nitro::RNSkiaYoga::ParagraphCmd::measureFunc(
        nestedCssRoot->_node,
        92.0f,
        YGMeasureModeAtMost,
        YGUndefined,
        YGMeasureModeUndefined);
    expect(nestedCssMeasured.width > 0.0f, "nested CSS color ParagraphCmd measure width is positive");
    expect(nestedCssMeasured.width <= 92.0f, "nested CSS color ParagraphCmd measure width is bounded by the available width");
    expect(nestedCssMeasured.height > 0.0f, "nested CSS color ParagraphCmd measure height is positive");
    expect(nestedCssMeasured.height < 140.0f, "nested CSS color ParagraphCmd measure height remains bounded for probe text");

    auto nestedCssSurface = makeSurface(140, 120);
    renderNode(nestedCssRoot, nestedCssSurface);

    expectNear(nestedCssRoot->_layout.width, 92.0, "nested CSS color paragraph Yoga layout width follows style constraint");
    expect(nestedCssRoot->_layout.height > 0.0, "nested CSS color paragraph Yoga layout height comes from measure function");
    expect(nestedCssRoot->_layout.height < 140.0, "nested CSS color paragraph Yoga layout height remains bounded");
    expectNear(nestedCssParagraphCmd->props.width, 92.0, "nested CSS color ParagraphCmd draw width follows Yoga layout");
    expect(nestedCssParagraphCmd->props.paragraph->getObject()->getHeight() > 0.0f, "nested CSS color ParagraphCmd paragraph object has positive laid-out height");

    expect(
        hasAnyGreenDominantPixelInRegion(nestedCssSurface, 2, 2, 90, 96),
        "ParagraphCmd renders green-dominant glyph pixels from nested textStyle hex CSS color string inside the debug border");
    expect(
        !hasAnyAlphaInRegion(nestedCssSurface, 112, 96, 136, 116),
        "nested CSS color ParagraphCmd render remains bounded away from far outside pixels");
}

void assertConverterErrorPath(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", jsi::Object(runtime));
    jsi::Value commandValue(runtime, command);

    try {
        (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
    } catch (const jsi::JSError& error) {
        const auto message = error.getMessage();
        expect(
            message.find("NodeCommand conversion failed for type \"path\"") != std::string::npos,
            "path conversion failure should be scoped to NodeCommand payload conversion");
        return;
    }

    fail("path command conversion without a JsiSkPath host object must fail in this host probe");
}

void assertDynamicPathTrimCommandRejections(jsi::Runtime& runtime)
{
    jsi::Object plainTrimStart(runtime);
    plainTrimStart.setProperty(runtime, "not", "a synchronizable");

    jsi::Object plainData(runtime);
    plainData.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, makeTrimProbePath()));
    plainData.setProperty(runtime, "trimStart", std::move(plainTrimStart));
    plainData.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object plainCommand(runtime);
    plainCommand.setProperty(runtime, "type", "path");
    plainCommand.setProperty(runtime, "data", std::move(plainData));
    jsi::Value plainCommandValue(runtime, plainCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, plainCommandValue),
        "NodeCommand converter canConvert accepts shaped path command before rejecting plain trimStart payload");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, plainCommandValue);
        },
        "NodeCommand conversion failed for type \"path\"",
        "NodeCommand conversion rejects plain JS object path trimStart");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, plainCommandValue);
        },
        "Worklets SerializableJSRef",
        "NodeCommand conversion requires Worklets SerializableJSRef for object path trimStart");

    jsi::Object wrongData(runtime);
    wrongData.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, makeTrimProbePath()));
    wrongData.setProperty(runtime, "trimStart", 0.0);
    wrongData.setProperty(runtime, "trimEnd", makeWrongSerializableRefValue(runtime));

    jsi::Object wrongCommand(runtime);
    wrongCommand.setProperty(runtime, "type", "path");
    wrongCommand.setProperty(runtime, "data", std::move(wrongData));
    jsi::Value wrongCommandValue(runtime, wrongCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, wrongCommandValue),
        "NodeCommand converter canConvert accepts shaped path command before rejecting non-Synchronizable trimEnd payload");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, wrongCommandValue);
        },
        "Worklets Synchronizable",
        "NodeCommand conversion rejects non-Synchronizable SerializableJSRef path trimEnd");

    jsi::Object plainTrimEnd(runtime);
    plainTrimEnd.setProperty(runtime, "not", "a synchronizable");

    jsi::Object plainEndData(runtime);
    plainEndData.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, makeTrimProbePath()));
    plainEndData.setProperty(runtime, "trimStart", 0.0);
    plainEndData.setProperty(runtime, "trimEnd", std::move(plainTrimEnd));

    jsi::Object plainEndCommand(runtime);
    plainEndCommand.setProperty(runtime, "type", "path");
    plainEndCommand.setProperty(runtime, "data", std::move(plainEndData));
    jsi::Value plainEndCommandValue(runtime, plainEndCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, plainEndCommandValue),
        "NodeCommand converter canConvert accepts shaped path command before rejecting plain trimEnd payload");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, plainEndCommandValue);
        },
        "Worklets SerializableJSRef",
        "NodeCommand conversion requires Worklets SerializableJSRef for object path trimEnd");

    jsi::Object wrongStartData(runtime);
    wrongStartData.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, makeTrimProbePath()));
    wrongStartData.setProperty(runtime, "trimStart", makeWrongSerializableRefValue(runtime));
    wrongStartData.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object wrongStartCommand(runtime);
    wrongStartCommand.setProperty(runtime, "type", "path");
    wrongStartCommand.setProperty(runtime, "data", std::move(wrongStartData));
    jsi::Value wrongStartCommandValue(runtime, wrongStartCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, wrongStartCommandValue),
        "NodeCommand converter canConvert accepts shaped path command before rejecting non-Synchronizable trimStart payload");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, wrongStartCommandValue);
        },
        "Worklets Synchronizable",
        "NodeCommand conversion rejects non-Synchronizable SerializableJSRef path trimStart");
}

void assertPathStrokeCommandRejections(jsi::Runtime& runtime)
{
    auto omittedStrokeCommand = pathCommand(runtime);
    expect(
        !std::get<PathCommandData>(omittedStrokeCommand.data).stroke.has_value(),
        "NodeCommand conversion preserves omitted path.stroke as no stroke");

    auto nullStrokeCommand = convertCommand(
        runtime,
        pathCommandObjectWithStrokeValue(runtime, jsi::Value::null()));
    expect(
        !std::get<PathCommandData>(nullStrokeCommand.data).stroke.has_value(),
        "NodeCommand conversion preserves null path.stroke as no stroke");

    auto nonObjectCommand = pathCommandObjectWithStrokeValue(runtime, jsi::Value(42.0));
    jsi::Value nonObjectCommandValue(runtime, nonObjectCommand);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, nonObjectCommandValue),
        "NodeCommand converter canConvert accepts shaped path command before rejecting non-object stroke");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, nonObjectCommandValue);
        },
        "Expected stroke object.",
        "NodeCommand conversion rejects non-object path.stroke payload");

    jsi::Object invalidJoinStroke(runtime);
    invalidJoinStroke.setProperty(runtime, "width", 4.0);
    invalidJoinStroke.setProperty(runtime, "miter_limit", 7.0);
    invalidJoinStroke.setProperty(runtime, "join", "spike");
    auto invalidJoinCommand = pathCommandObjectWithStrokeValue(
        runtime,
        jsi::Value(runtime, invalidJoinStroke));
    jsi::Value invalidJoinCommandValue(runtime, invalidJoinCommand);

    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, invalidJoinCommandValue);
        },
        "Invalid stroke join: spike",
        "NodeCommand conversion rejects invalid path.stroke join");

    jsi::Object invalidCapStroke(runtime);
    invalidCapStroke.setProperty(runtime, "width", 4.0);
    invalidCapStroke.setProperty(runtime, "miter_limit", 7.0);
    invalidCapStroke.setProperty(runtime, "cap", "triangle");
    auto invalidCapCommand = pathCommandObjectWithStrokeValue(
        runtime,
        jsi::Value(runtime, invalidCapStroke));
    jsi::Value invalidCapCommandValue(runtime, invalidCapCommand);

    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, invalidCapCommandValue);
        },
        "Invalid stroke cap: triangle",
        "NodeCommand conversion rejects invalid path.stroke cap");
}

void assertConverterErrorImage(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "fit", "fill");
    data.setProperty(runtime, "image", jsi::Object(runtime));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "image");
    command.setProperty(runtime, "data", std::move(data));
    jsi::Value commandValue(runtime, command);

    try {
        (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
    } catch (const jsi::JSError& error) {
        const auto message = error.getMessage();
        expect(
            message.find("NodeCommand conversion failed for type \"image\"") != std::string::npos,
            "image conversion failure should be scoped to NodeCommand payload conversion");
        expect(
            message.find("SkImage must be a host object") != std::string::npos,
            "image conversion failure should require a real JsiSkImage host object");
        return;
    }

    fail("image command conversion with a plain JS image object must fail in this host probe");
}

void assertConverterErrorImageFit(jsi::Runtime& runtime)
{
    auto command = imageCommandObject(runtime, std::optional<std::string>("stretch"));
    jsi::Value commandValue(runtime, command);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
        "NodeCommand converter canConvert accepts shaped image command before rejecting invalid fit");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
        },
        "NodeCommand conversion failed for type \"image\"",
        "NodeCommand conversion rejects invalid image fit");
    expectJsiThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
        },
        "Invalid fit: stretch",
        "NodeCommand conversion reports the invalid image fit value");
}

void assertConverterErrorTextFont(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "plain font object");
    data.setProperty(runtime, "font", jsi::Object(runtime));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    jsi::Value commandValue(runtime, command);

    try {
        (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
    } catch (const jsi::JSError& error) {
        const auto message = error.getMessage();
        expect(
            message.find("NodeCommand conversion failed for type \"text\"") != std::string::npos,
            "text conversion failure should be scoped to NodeCommand payload conversion");
        expect(
            message.find("SkFont") != std::string::npos || message.find("JsiSkFont") != std::string::npos,
            "text conversion failure should require a real JsiSkFont host object");
        return;
    }

    fail("text command conversion with a plain JS font object must fail in this host probe");
}

void assertConverterErrorTextStyleColorString(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "bad CSS text color");
    data.setProperty(runtime, "textStyle", textStyleObject(runtime, 18.0, "not-a-css-color"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "text");
    command.setProperty(runtime, "data", std::move(data));
    jsi::Value commandValue(runtime, command);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
        "NodeCommand converter canConvert accepts shaped text command before rejecting invalid CSS color string");
    try {
        (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
    } catch (const jsi::JSError& error) {
        const auto message = error.getMessage();
        expect(
            message.find("NodeCommand conversion failed for type \"text\"") != std::string::npos,
            "text invalid color failure should be scoped to NodeCommand payload conversion");
        expect(
            message.find("Invalid color string for text style: not-a-css-color") != std::string::npos,
            "text invalid color failure should report the invalid CSS color string");
        return;
    }

    fail("text command conversion with an invalid textStyle CSS color string must fail");
}

void assertConverterErrorParagraphStyleColorString(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "bad CSS paragraph color");
    data.setProperty(runtime, "paragraphStyle", textStyleObject(runtime, 18.0, "not-a-css-color"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    jsi::Value commandValue(runtime, command);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
        "NodeCommand converter canConvert accepts shaped paragraph command before rejecting invalid CSS color string");
    try {
        (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
    } catch (const jsi::JSError& error) {
        const auto message = error.getMessage();
        expect(
            message.find("NodeCommand conversion failed for type \"paragraph\"") != std::string::npos,
            "paragraph invalid color failure should be scoped to NodeCommand payload conversion");
        expect(
            message.find("Invalid color string for text style: not-a-css-color") != std::string::npos,
            "paragraph invalid color failure should report the invalid CSS color string");
        return;
    }

    fail("paragraph command conversion with an invalid paragraphStyle CSS color string must fail");
}

void assertConverterErrorParagraphStyleNestedColorString(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "bad nested CSS paragraph color");
    data.setProperty(runtime, "paragraphStyle", paragraphStyleWithNestedTextStyleObject(runtime, 18.0, "not-a-css-color"));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "paragraph");
    command.setProperty(runtime, "data", std::move(data));
    jsi::Value commandValue(runtime, command);

    expect(
        margelo::nitro::JSIConverter<NodeCommand>::canConvert(runtime, commandValue),
        "NodeCommand converter canConvert accepts shaped paragraph command before rejecting invalid nested paragraphStyle.textStyle CSS color string");
    try {
        (void)margelo::nitro::JSIConverter<NodeCommand>::fromJSI(runtime, commandValue);
    } catch (const jsi::JSError& error) {
        const auto message = error.getMessage();
        expect(
            message.find("NodeCommand conversion failed for type \"paragraph\"") != std::string::npos,
            "paragraph nested invalid color failure should be scoped to NodeCommand payload conversion");
        expect(
            message.find("Invalid color string for text style: not-a-css-color") != std::string::npos,
            "paragraph nested invalid color failure should report the invalid CSS color string");
        return;
    }

    fail("paragraph command conversion with an invalid paragraphStyle.textStyle CSS color string must fail");
}

} // namespace

int main()
{
    auto runtime = facebook::jsc::makeJSCRuntime();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(runtime.get());
    auto callInvoker = std::make_shared<HostCallInvoker>();
    auto platformContext = std::make_shared<HostPlatformContext>(callInvoker);
    margelo::nitro::RNSkiaYoga::SetPlatformContext(platformContext);

    assertStaticAnimatedDoubleNodeCommandPayloads(*runtime);
    assertDynamicAnimatedDoubleNodeCommandPayloads(*runtime);
    assertValueBearingStyleConverters(*runtime);
    assertFontVariationsUnsupportedRejections(*runtime);
    assertTextCommandRichTextStyleUnsupportedRejections(*runtime);
    assertNodeStyleAntiAliasTransportAndPaint(*runtime);
    assertNodeStyleLayerTransportAndPaint(*runtime);
    assertNodeStylePaintOverridesSkPaintBackground();
    assertNodeCommandToJSISerializationSymmetry(*runtime);
    assertRectOpacityRender(*runtime);
    assertParentChildLayoutRender(*runtime);
    assertOverflowBoundsClipRender(*runtime);
    assertStyleCornerRadiusClipRender(*runtime);
    assertGlobalBorderRadiusClipRender(*runtime);
    assertExplicitRectClipRender(*runtime);
    assertExplicitRRectClipRender(*runtime);
    assertExplicitPathClipRender(*runtime);
    assertInvertRectClipRender(*runtime);
    assertInvertRRectClipRender(*runtime);
    assertInvertPathClipRender(*runtime);
    assertComposedTransformRender(*runtime);
    assertLayerPaintSaveLayerRender(*runtime);
    assertGroupRasterCacheBehavior(*runtime);
    assertDynamicRasterizedGroupBypassesCache(*runtime);
    assertDynamicPathTrimRasterizedGroupBypassesCache(*runtime);
    assertAdditionalPointsCommandRender(*runtime);
    assertLineCommandRender(*runtime);
    assertCommandPointFiniteRejections(*runtime);
    assertStaticAnimatedDoubleCommandFiniteRejections(*runtime);
    assertPathStrokeNumericFiniteRejections(*runtime);
    assertCommandNumericEnumRejections(*runtime);
    assertTextParagraphStyleNumericFiniteRejections(*runtime);
    assertOvalCommandRender(*runtime);
    assertCircleCommandRender(*runtime);
    assertDynamicCircleCommandRender(*runtime);
    assertRRectCommandRender(*runtime);
    assertDynamicRRectCommandRender(*runtime);
    assertBlurMaskFilterCommandRender(*runtime);
    assertDynamicBlurMaskFilterCommandRender(*runtime);
    assertPathHostObjectCommandRender(*runtime);
    assertPublicPathStrokeCommandRender(*runtime);
    assertPathStrokeMiterAliasPrecedence(*runtime);
    assertStrokeOptsConverterPublicMiterContract(*runtime);
    assertStrokeOptsConverterDirectConsistency(*runtime);
    assertStrokeOptsConverterFiniteRejections(*runtime);
    assertStrokeOptsConverterNumericEnumRejections(*runtime);
    assertDynamicPathTrimCommandRender(*runtime);
    assertImageFitCommandRender(*runtime);
    assertTextCommandStateAndRender(*runtime);
    assertParagraphCommandMeasureAndRender(*runtime);
    assertConverterErrorPath(*runtime);
    assertDynamicPathTrimCommandRejections(*runtime);
    assertPathStrokeCommandRejections(*runtime);
    assertConverterErrorImage(*runtime);
    assertConverterErrorImageFit(*runtime);
    assertConverterErrorTextFont(*runtime);
    assertConverterErrorTextStyleColorString(*runtime);
    assertConverterErrorParagraphStyleColorString(*runtime);
    assertConverterErrorParagraphStyleNestedColorString(*runtime);
    assertDynamicAnimatedDoubleCommandRejections(*runtime);

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    std::cout << "YogaNode native command/render host probe passed\n";
    return 0;
}
`
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
