#!/usr/bin/env node

import {
	existsSync,
	mkdirSync,
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

try {
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
	console.log("- The executable asserted NodeCommand toJSI payload shape and representative toJSI/fromJSI round-trip coverage for blurMaskFilter, image, path, text, paragraph, line, and points, including numeric enum output for blurStyle, fillType, and pointMode, resolved-number AnimatedDouble output, public path.stroke.miter_limit output, SkPath/JsiSkPath and SkImage/JsiSkImage host-object fields, selected textStyle/paragraphStyle fields including fontFeatures, line from/to points, and points arrays.")
	console.log("- The executable asserted selected value-bearing toJSI/fromJSI serialization for SkSamplingOptions filter/mipmap and cubic B/C, SkTextStyle fontSize/color/fontFamilies/fontFeatures/backgroundColor/foregroundColor/decoration fields/fontStyle/heightMultiplier/halfLeading/letterSpacing/wordSpacing/locale/shadows/textBaseline, and SkParagraphStyle textAlign/maxLines/heightMultiplier/ellipsis/disableHinting/replaceTabCharacters/textDirection/textHeightBehavior plus flattened default text style fields.")
	console.log("- The executable asserted generated NodeStyle transport and host-native SkPaint state for canonical style.antiAlias, legacy style.antiaAlias fallback, and canonical precedence when both keys are present.")
	console.log("- The executable asserted pixels/regions for opacity blending, Yoga-derived child coordinates, group raster-cache reuse/invalidation, circle/path-trim dynamic raster-cache bypass, point drawing, line stroke drawing, oval/circle/rrect fills, public-shaped path.stroke conversion/rendering, bounded blur-mask-filter inheritance, real JsiSkPath host-object conversion/rendering, expanded synthetic JsiSkImage fit/default rendering, numeric and CSS color-string TextCmd raster evidence, ParagraphCmd measure/raster evidence, and Worklets-backed dynamic circle/rrect/blur/path-trim render-time fallback, resolution, and mutation.")
	console.log("- The executable asserted synthetic ImageCmd fit helper geometry, command state, draw bounds, and bounded raster evidence for fill, omitted/default contain, cover, none, scaleDown, fitWidth, and fitHeight, plus invalid fit rejection in JSIConverter<NodeCommand>::fromJSI(...).")
	console.log("- The executable asserted TextCmd/ParagraphCmd CSS color-string conversion, installed command state, bounded raster evidence for TextCmd rgba(...) and flattened ParagraphCmd hex colors, named-color conversion, and invalid text/paragraph color-string rejection in JSIConverter<NodeCommand>::fromJSI(...).")
	console.log("- The executable asserted direct StrokeOpts converter canConvert/fromJSI consistency for object, null, undefined, number, boolean, and string payloads; public path.stroke width, miter_limit, precision, numeric/string join, and numeric/string cap parsing; miterLimit alias fallback with public-key precedence; StrokeOpts toJSI public miter_limit output; non-object stroke rejection; and invalid join/cap rejection.")
	console.log("- The executable asserted selected dynamic Worklets-backed AnimatedDouble NodeCommand props for circle.radius, rrect.cornerRadius, blurMaskFilter.blur, path.trimStart, and path.trimEnd, including render-time fallback behavior while RN Skia's main runtime is unset, main-runtime numeric resolution, and later Synchronizable::setBlocking(...) mutation observation through render/object-state evidence.")
	console.log("- Proof boundary: host-native macOS C++ command construction, generated NodeStyle JSIConverter transport for antiAlias/antiaAlias, YogaNode::setStyle SkPaint antiAlias state, NodeCommand toJSI converter serialization shape and representative host-JSC/native toJSI/fromJSI round trips, selected value-bearing SkSamplingOptions, SkTextStyle including fontFeatures, and selected SkParagraphStyle serialization fields including disableHinting/replaceTabCharacters/textDirection/textHeightBehavior, selected TextCmd/ParagraphCmd CSS color-string payload conversion/rendering, paragraph measurement, public-shaped path.stroke payload conversion and bounded PathCmd stroke raster evidence, direct StrokeOpts converter top-level value consistency, synthetic in-memory JsiSkImage fit/default/invalid command-render coverage, selected dynamic Worklets-backed AnimatedDouble NodeCommand conversion/resolution for circle.radius, rrect.cornerRadius, blurMaskFilter.blur, path.trimStart, and path.trimEnd, and bounded raster behavior for selected commands. This does not prove unsupported SkSamplingOptions maxAniso preservation, every SkTextStyle/SkParagraphStyle field, CSS color string preservation, exact path/stroke geometry fidelity, exact typography, font fallback correctness, paragraph shaping fidelity, Nitro toObject()/prototype materialization, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, Reanimated SharedValue delivery, JS listener scheduling, RNGH native delivery, image decoding/assets/loading, local/remote asset resolution, texture-backed images, exact image render fidelity, or every AnimatedDouble command prop.")
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
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <exception>
#include <functional>
#include <iostream>
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
using margelo::nitro::RNSkiaYoga::BlurMaskFilterCommandData;
using margelo::nitro::RNSkiaYoga::GroupCommandData;
using margelo::nitro::RNSkiaYoga::NodeCommand;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::CircleCommandData;
using margelo::nitro::RNSkiaYoga::ImageCommandData;
using margelo::nitro::RNSkiaYoga::LineCommandData;
using margelo::nitro::RNSkiaYoga::NodeCommandKind;
using margelo::nitro::RNSkiaYoga::ParagraphCommandData;
using margelo::nitro::RNSkiaYoga::PathCommandData;
using margelo::nitro::RNSkiaYoga::PointsCommandData;
using margelo::nitro::RNSkiaYoga::Position;
using margelo::nitro::RNSkiaYoga::RoundedRectCommandData;
using margelo::nitro::RNSkiaYoga::TextCommandData;
using margelo::nitro::RNSkiaYoga::YogaNode;
using margelo::nitro::RNSkiaYoga::YogaNodeCommandKind;

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
    const std::string& label)
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
    expectNear(object.getProperty(runtime, "heightMultiplier").asNumber(), 1.35, label + " heightMultiplier");
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

void expectTextStyleState(
    const skia::textlayout::TextStyle& textStyle,
    double expectedFontSize,
    SkColor expectedColor,
    const std::string& label)
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
    expectNear(textStyle.getHeight(), 1.35, label + " heightMultiplier");
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
    expectSerializedTextStyle(runtime, value, 18.0, SK_ColorBLUE, label + " flattened textStyle");
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

NodeCommand lineCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "from", makePointObject(runtime, 0.0, 3.0));
    data.setProperty(runtime, "to", makePointObject(runtime, 20.0, 3.0));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "line");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

NodeCommand ovalCommand(jsi::Runtime& runtime)
{
    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "oval");
    command.setProperty(runtime, "data", jsi::Object(runtime));
    return convertCommand(runtime, std::move(command));
}

NodeCommand circleCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "radius", 8.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "circle");
    command.setProperty(runtime, "data", std::move(data));
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

NodeCommand rrectCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "cornerRadius", 5.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "rrect");
    command.setProperty(runtime, "data", std::move(data));
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

NodeCommand blurMaskFilterCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "blur", 4.0);
    data.setProperty(runtime, "blurStyle", "normal");
    data.setProperty(runtime, "respectCTM", false);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "blurMaskFilter");
    command.setProperty(runtime, "data", std::move(data));
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

NodeCommand pathCommand(jsi::Runtime& runtime)
{
    SkPath path;
    path.addRect(SkRect::MakeXYWH(0.0f, 0.0f, 10.0f, 6.0f));

    jsi::Object data(runtime);
    data.setProperty(runtime, "fillType", "winding");
    data.setProperty(runtime, "path", RNSkia::JsiSkPath::toValue(runtime, nullptr, std::move(path)));
    data.setProperty(runtime, "trimStart", 0.0);
    data.setProperty(runtime, "trimEnd", 1.0);

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "path");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
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
    paragraphStyle.setProperty(runtime, "ellipsis", "...");
    return paragraphStyle;
}

NodeCommand textSerializationCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "text", "Serializable styled text");
    data.setProperty(runtime, "textStyle", richTextStyleObject(runtime, 21.0, SK_ColorMAGENTA));

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
        expectSerializedTextStyle(runtime, data.getProperty(runtime, "textStyle"), 21.0, SK_ColorMAGENTA, "text toJSI textStyle");

        auto roundTrip = roundTripSerializedCommand(runtime, serialized, "text");
        const auto& payload = std::get<TextCommandData>(roundTrip.data);
        expect(payload.text.has_value() && payload.text.value() == "Serializable styled text", "text toJSI/fromJSI text");
        expect(payload.textStyle.has_value(), "text toJSI/fromJSI textStyle");
        expectTextStyleState(payload.textStyle.value(), 21.0, SK_ColorMAGENTA, "text toJSI/fromJSI textStyle");
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
    assertNodeStyleAntiAliasTransportAndPaint(*runtime);
    assertNodeCommandToJSISerializationSymmetry(*runtime);
    assertRectOpacityRender(*runtime);
    assertParentChildLayoutRender(*runtime);
    assertGroupRasterCacheBehavior(*runtime);
    assertDynamicRasterizedGroupBypassesCache(*runtime);
    assertDynamicPathTrimRasterizedGroupBypassesCache(*runtime);
    assertAdditionalPointsCommandRender(*runtime);
    assertLineCommandRender(*runtime);
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
