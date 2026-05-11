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
	console.log("- The executable asserted generated prototype members setCommand, setStyle, computeLayout, and layout exist on the materialized object, then invoked generated JS-facing wrappers for setCommand(group), setStyle(width/height), computeLayout(width, height), and the layout getter.")
	console.log("- The executable materialized parent/child YogaNodes, inserted the child through the generated parent.insertChild(...) wrapper, called materialized parent.getChildren(), and asserted the returned child is the cached materialized child object with generated and raw YogaNode prototype methods.")
	console.log("- The executable called generated setStyle/computeLayout/insertChild and raw setInteractionConfig/hitTest/getChildren through the returned child object, then asserted recursive returned-grandchild identity through returnedChild.getChildren().")
	console.log("- The executable used fresh materialized YogaNode objects to invoke generated JS-facing setCommand(line), setCommand(points), setCommand(path), setCommand(text), setCommand(paragraph), setCommand(circle), setCommand(rrect), setCommand(blurMaskFilter), setCommand(rect), setCommand(oval), and setCommand(image) wrappers, preserving the native no-command-kind-change invariant.")
	console.log("- The executable asserted native side effects from generated calls: GroupCmd installation/rasterize state, LineCmd nested from/to base points, PointsCmd array payload and point mode, PathCmd public stroke.miter_limit payload from a real JsiSkPath host object, TextCmd CSS string textStyle state, ParagraphCmd text/paragraphStyle measure state, CircleCmd radius state, RRectCmd corner-radius state, BlurMaskFilterCmd mask-filter state, RectCmd/OvalCmd layout rect state, ImageCmd synthetic JsiSkImage host-object fit/layout state, NodeStyle width/height state, Yoga layout computation, and generated layout getter values.")
	console.log("- For CircleCmd, RRectCmd, and BlurMaskFilterCmd, selected no-pixel draw calls are used only to expose render-time native state/mask-filter side effects after generated wrapper delivery; no command-rendering or render-fidelity claim is made.")
	console.log("- Proof boundary: host-JSC Nitro YogaNode toObject/prototype materialization, materialized getChildren returned-child identity/prototype behavior, and selected generated/raw YogaNode method/getter execution only; this does not prove actual React Native bridge delivery, Nitro module registry install in a React Native runtime, React Native runtime integration, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, real Reanimated SharedValue delivery, RNGH native delivery, image assets/decoding/loading, exact typography, command rendering, or exact render fidelity.")
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
	const reconciler = readProjectFile("src/Reconciler.ts")
	const yogaNodeCpp = readProjectFile("cpp/YogaNode.cpp")
	const yogaNodeConverter = readProjectFile("cpp/JSIConverter+YogaNode.hpp")
	const generatedSpec = readProjectFile(
		"nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp",
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
using margelo::nitro::RNSkiaYoga::TextCmd;
using margelo::nitro::RNSkiaYoga::YogaNode;
using margelo::nitro::RNSkiaYoga::YogaNodeCommandKind;

namespace {

void expect(bool condition, const char* message)
{
    if (!condition) {
        std::cerr << "FAIL: " << message << "\n";
        std::abort();
    }
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
    data.setProperty(runtime, "paragraphStyle", makeTextStyle(runtime, 18.0, "#00ff00"));
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
    expect(paragraphCmd->props.paragraph != nullptr, "generated setCommand(paragraph) must build a paragraph from text and paragraphStyle");

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
    auto style = makeStyle(*runtime, 64.0, 32.0);
    callFunctionWithOneObject(
        *runtime,
        object,
        setStyle,
        style,
        "generated setStyle(width/height) must return undefined");
    expect(node->_style.width.has_value(), "generated setStyle must populate native width");
    expect(node->_style.height.has_value(), "generated setStyle must populate native height");
    expectNear(std::get<double>(*node->_style.width), 64.0, "generated setStyle native width");
    expectNear(std::get<double>(*node->_style.height), 32.0, "generated setStyle native height");

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
