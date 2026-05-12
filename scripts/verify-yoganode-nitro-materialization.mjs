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
	console.log("- The executable asserted generated prototype members setCommand, setStyle, computeLayout, and layout exist on the materialized object, then invoked generated JS-facing wrappers for setCommand(group), setStyle(width/height/antiAlias/layer), setStyle(SkPaint-backed backgroundColor plus paint fields), setStyle(global borderRadius), setStyle(style corner radii, clip path/rect/rrect, 9- and 16-value matrix arrays, single-operation transform variants, non-empty transform precedence, empty transform matrix fallback, empty transform no-matrix reset, invertClip), computeLayout(width, height), and the layout getter.")
	console.log("- The executable materialized parent/child YogaNodes, inserted the child through the generated parent.insertChild(...) wrapper, called materialized parent.getChildren(), and asserted the returned child is the cached materialized child object with generated and raw YogaNode prototype methods.")
	console.log("- The executable called generated setStyle/computeLayout/insertChild and raw setInteractionConfig/hitTest/getChildren through the returned child object, then asserted recursive returned-grandchild identity through returnedChild.getChildren().")
	console.log("- The executable used fresh materialized YogaNode objects to invoke generated JS-facing setCommand(line), setCommand(points), setCommand(path), setCommand(text), setCommand(paragraph), setCommand(circle), setCommand(rrect), setCommand(blurMaskFilter), setCommand(rect), setCommand(oval), and setCommand(image) wrappers, preserving the native no-command-kind-change invariant.")
	console.log("- The executable asserted native side effects from generated calls: GroupCmd installation/rasterize state, LineCmd nested from/to base points, PointsCmd array payload and point mode, PathCmd public stroke.miter_limit payload from a real JsiSkPath host object, TextCmd CSS string textStyle state, ParagraphCmd text/nested paragraphStyle.textStyle CSS color measure state, CircleCmd radius state, RRectCmd corner-radius state, BlurMaskFilterCmd mask-filter state, RectCmd/OvalCmd layout rect state, ImageCmd synthetic JsiSkImage host-object fit/layout state, NodeStyle width/height/antiAlias/layer state, generated materialized JsiSkPaint layer delivery, generated materialized SkPaint-backed backgroundColor delivery, public paint-field override state for borderWidth/strokeCap/strokeJoin/strokeMiter/dither/opacity/blendMode, generated materialized global borderRadius delivery into _style.borderRadius, _clipsToBounds, and all four _clipToBoundsRadii slots without per-corner or explicit clip state, generated materialized clip path/rect/rrect delivery into _style.clip and _clipPath/_clipRect/_clipRRect, generated materialized all-four style corner-radius delivery into _style SkPoint/scalar variants, _clipsToBounds, and _clipToBoundsRadii, generated materialized 9- and 16-value matrix array delivery into _style.matrix and _matrix, generated materialized single-operation transform delivery for rotateX/rotateY/rotateZ/scale/scaleX/scaleY/translateX/translateY/skewX/skewY into _style.transform and _matrix, generated materialized non-empty transform-array delivery into _style.transform and _matrix with transform-over-matrix precedence, generated materialized empty transform-array delivery that preserves empty _style.transform and falls back to _style.matrix for _matrix, generated materialized empty transform-array delivery with no matrix that clears _style.matrix and resets _matrix to nullptr, generated materialized invertClip delivery into _style.invertClip and the clipping predicate, Yoga border state from borderWidth, YogaNode::setStyle SkPaint antiAlias and _layerPaint state, ordinary _paint separation, Yoga layout computation, and generated layout getter values.")
	console.log("- For CircleCmd, RRectCmd, and BlurMaskFilterCmd, selected no-pixel draw calls are used only to expose render-time native state/mask-filter side effects after generated wrapper delivery; no command-rendering or render-fidelity claim is made.")
	console.log("- Proof boundary: host-JSC Nitro YogaNode toObject/prototype materialization, materialized getChildren returned-child identity/prototype behavior, generated materialized setStyle(layer) delivery from a JsiSkPaint host object into native _layerPaint state, generated materialized setStyle(SkPaint-backed backgroundColor plus public paint fields) delivery into native NodeStyle/_paint/Yoga border state, generated materialized setStyle(global borderRadius/corner-radius/clip/matrix-9/matrix-16/single-operation-transform/non-empty-transform/empty-transform fallback/empty-transform no-matrix reset/invertClip) delivery into native NodeStyle/_clipToBoundsRadii/_clipPath/_clipRect/_clipRRect/_matrix/invertClip predicate state, and selected generated/raw YogaNode method/getter execution only; this does not prove actual React Native bridge delivery, Nitro module registry install in a React Native runtime, React Native runtime integration, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, real Reanimated SharedValue delivery, RNGH native delivery, gesture delivery, image assets/decoding/loading, exact saveLayer/GPU blend fidelity, exact typography, pixel rendering, exact hit-test behavior, command rendering, or exact render fidelity.")
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
	const reconciler = readProjectFile("src/Reconciler.ts")
	const yogaNodeCpp = readProjectFile("cpp/YogaNode.cpp")
	const yogaNodeConverter = readProjectFile("cpp/JSIConverter+YogaNode.hpp")
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
		generatedNodeStyle.includes("std::optional<std::variant<std::shared_ptr<SkMatrix>") &&
			generatedNodeStyle.includes("double, double, double, double, double, double, double, double, double, double, double, double, double, double, double, double"),
		"Generated NodeStyle must still accept shared SkMatrix, tuple-9, and tuple-16 matrix variants.",
	)
	for (const cornerKey of [
		"borderTopLeftRadius",
		"borderTopRightRadius",
		"borderBottomRightRadius",
		"borderBottomLeftRadius",
	]) {
		assert(
			generatedNodeStyle.includes(`std::optional<std::variant<double, SkPoint>> ${cornerKey}`) &&
				generatedNodeStyle.includes(`obj.getProperty(runtime, "${cornerKey}")`),
			`Generated NodeStyle must still accept SkPoint-capable ${cornerKey}.`,
		)
	}
	assert(
		styleSpec.includes("borderRadius?: number") &&
			generatedNodeStyle.includes("std::optional<double> borderRadius") &&
			generatedNodeStyle.includes('obj.getProperty(runtime, "borderRadius")') &&
			yogaNodeCpp.includes("style.borderRadius.has_value()") &&
			yogaNodeCpp.includes("radii[SkRRect::kUpperLeft_Corner] = SkVector::Make(radius, radius)") &&
			yogaNodeCpp.includes("radii[SkRRect::kUpperRight_Corner] = SkVector::Make(radius, radius)") &&
			yogaNodeCpp.includes("radii[SkRRect::kLowerRight_Corner] = SkVector::Make(radius, radius)") &&
			yogaNodeCpp.includes("radii[SkRRect::kLowerLeft_Corner] = SkVector::Make(radius, radius)"),
		"Public/generated/native style paths must retain scalar borderRadius delivery and all-corner seeding.",
	)
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
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <variant>

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
using margelo::nitro::RNSkiaYoga::CircleCmd;
using margelo::nitro::RNSkiaYoga::GroupCmd;
using margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec;
using margelo::nitro::RNSkiaYoga::ImageCmd;
using margelo::nitro::RNSkiaYoga::LineCmd;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::OvalCmd;
using margelo::nitro::RNSkiaYoga::ParagraphCmd;
using margelo::nitro::RNSkiaYoga::PathCmd;
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

jsi::Object makeGroupCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "rasterize", true);
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

jsi::Object makeLineCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "from", makePointObject(runtime, 1.0, 2.0));
    data.setProperty(runtime, "to", makePointObject(runtime, 11.0, 22.0));
    command.setProperty(runtime, "type", "line");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makePointsCommand(jsi::Runtime& runtime)
{
    jsi::Array points(runtime, 2);
    points.setValueAtIndex(runtime, 0, jsi::Value(runtime, makePointObject(runtime, 3.0, 4.0)));
    points.setValueAtIndex(runtime, 1, jsi::Value(runtime, makePointObject(runtime, 13.0, 14.0)));

    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "pointMode", "lines");
    data.setProperty(runtime, "points", points);
    command.setProperty(runtime, "type", "points");
    command.setProperty(runtime, "data", data);
    return command;
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

jsi::Object makeCircleCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "radius", 5.5);
    command.setProperty(runtime, "type", "circle");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeRRectCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "cornerRadius", 6.0);
    command.setProperty(runtime, "type", "rrect");
    command.setProperty(runtime, "data", data);
    return command;
}

jsi::Object makeBlurMaskFilterCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", 3.0);
    data.setProperty(runtime, "blurStyle", "outer");
    data.setProperty(runtime, "respectCTM", true);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", data);
    return command;
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

void callComputeLayout(
    jsi::Runtime& runtime,
    const jsi::Object& thisObject,
    const jsi::Function& computeLayout)
{
    jsi::Value args[] = {jsi::Value(200.0), jsi::Value(100.0)};
    auto result = computeLayout.callWithThis(
        runtime,
        thisObject,
        static_cast<const jsi::Value*>(args),
        static_cast<size_t>(2));
    expect(result.isUndefined(), "generated computeLayout must return undefined");
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

void applyGeneratedStyleAndComputeLayout(
    jsi::Runtime& runtime,
    const MaterializedYogaNode& materialized,
    jsi::Object style)
{
    expectObjectFunction(runtime, materialized.object, "setStyle");
    expectObjectFunction(runtime, materialized.object, "computeLayout");
    auto setStyle = materialized.object.getPropertyAsFunction(runtime, "setStyle");
    auto computeLayout = materialized.object.getPropertyAsFunction(runtime, "computeLayout");
    callFunctionWithOneObject(
        runtime,
        materialized.object,
        setStyle,
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

double getNumberProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* name)
{
    const auto value = object.getProperty(runtime, name);
    expect(value.isNumber(), "layout property must be numeric");
    return value.asNumber();
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

    std::cerr << "probe: read generated layout getter" << std::endl;
    auto layoutValue = object.getProperty(*runtime, "layout");
    expect(layoutValue.isObject(), "generated layout getter must return an object");
    auto layoutObject = layoutValue.asObject(*runtime);
    expectNear(getNumberProperty(*runtime, layoutObject, "left"), 0.0, "generated layout getter left");
    expectNear(getNumberProperty(*runtime, layoutObject, "top"), 0.0, "generated layout getter top");
    expectNear(getNumberProperty(*runtime, layoutObject, "width"), 64.0, "generated layout getter width");
    expectNear(getNumberProperty(*runtime, layoutObject, "height"), 32.0, "generated layout getter height");

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
    assertGeneratedPublicPathStrokeSetCommand(*runtime);
    assertGeneratedTextSetCommand(*runtime);
    assertGeneratedParagraphSetCommand(*runtime);
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

function assert(condition, message) {
	if (!condition) {
		throw new Error(message)
	}
}
