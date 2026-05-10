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
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, AnimatedDouble.cpp, generated Nitro specs, React Native JSC, upstream Yoga sources, RN Skia macOS archives, Worklets shared-item sources, ColorParser, PlatformContextAccessor, and Nitro/JSI helper sources.")
	console.log("- The executable created a JSC runtime, installed it as RN Skia's main runtime, converted simple NodeCommand payloads through JSIConverter<NodeCommand>::fromJSI(...), and executed real YogaNode::setCommand().")
	console.log("- The executable rendered real RectCmd, GroupCmd, PointsCmd, LineCmd, OvalCmd, CircleCmd, RRectCmd, BlurMaskFilterCmd, PathCmd, ImageCmd, TextCmd, and ParagraphCmd paths through YogaNode::renderToContext() onto raster SkSurfaces.")
	console.log("- The executable asserted pixels/regions for opacity blending, Yoga-derived child coordinates, group raster-cache reuse/invalidation, point drawing, line stroke drawing, oval/circle/rrect fills, bounded blur-mask-filter inheritance, real JsiSkPath/JsiSkImage host-object conversion/rendering, bounded TextCmd raster evidence, and ParagraphCmd measure/raster evidence.")
	console.log("- Proof boundary: host-native macOS C++ command construction, paragraph measurement, and bounded raster behavior for selected commands. This does not prove exact typography, font fallback correctness, paragraph shaping fidelity, all text/paragraph styles, Nitro toObject()/prototype materialization, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, RNGH native delivery, dynamic Worklets-backed AnimatedDouble resolution, image decoding/assets/loading, or full image-fit coverage.")
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
#include <yoga/Yoga.h>

#include "JSCRuntime.h"
#include "RuntimeAwareCache.h"
#include "DrawingCtx.h"
#include "RNSkPlatformContext.h"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::GroupCommandData;
using margelo::nitro::RNSkiaYoga::NodeCommand;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::NodeCommandKind;
using margelo::nitro::RNSkiaYoga::ParagraphCommandData;
using margelo::nitro::RNSkiaYoga::PointsCommandData;
using margelo::nitro::RNSkiaYoga::Position;
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
    style.antiaAlias = false;
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
    style.antiaAlias = false;
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

NodeStyle groupStyle(double width, double height)
{
    NodeStyle style {};
    style.width = points(width);
    style.height = points(height);
    style.antiaAlias = false;
    return style;
}

NodeStyle widthOnlyStyle(double width)
{
    NodeStyle style {};
    style.width = points(width);
    style.antiaAlias = false;
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

sk_sp<SkImage> makeQuadrantImage()
{
    auto surface = makeSurface(4, 4);
    auto* canvas = surface->getCanvas();
    auto paint = colorPaint(SK_ColorRED);
    canvas->drawRect(SkRect::MakeXYWH(0.0f, 0.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorGREEN);
    canvas->drawRect(SkRect::MakeXYWH(2.0f, 0.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorBLUE);
    canvas->drawRect(SkRect::MakeXYWH(0.0f, 2.0f, 2.0f, 2.0f), paint);

    paint.setColor(SK_ColorYELLOW);
    canvas->drawRect(SkRect::MakeXYWH(2.0f, 2.0f, 2.0f, 2.0f), paint);

    auto image = surface->makeImageSnapshot();
    expect(image != nullptr, "synthetic quadrant SkImage must be created");
    expect(image->width() == 4, "synthetic quadrant SkImage width");
    expect(image->height() == 4, "synthetic quadrant SkImage height");
    return image;
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

NodeCommand rrectCommand(jsi::Runtime& runtime)
{
    jsi::Object data(runtime);
    data.setProperty(runtime, "cornerRadius", 5.0);

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

NodeCommand imageCommand(jsi::Runtime& runtime)
{
    jsi::Object sampling(runtime);
    sampling.setProperty(
        runtime,
        "filter",
        static_cast<double>(static_cast<int>(SkFilterMode::kNearest)));

    auto imageHostObject = jsi::Object::createFromHostObject(
        runtime,
        std::make_shared<RNSkia::JsiSkImage>(
            margelo::nitro::RNSkiaYoga::GetPlatformContext(),
            makeQuadrantImage()));

    jsi::Object data(runtime);
    data.setProperty(runtime, "fit", "fill");
    data.setProperty(runtime, "image", std::move(imageHostObject));
    data.setProperty(runtime, "sampling", std::move(sampling));

    jsi::Object command(runtime);
    command.setProperty(runtime, "type", "image");
    command.setProperty(runtime, "data", std::move(data));
    return convertCommand(runtime, std::move(command));
}

jsi::Object textStyleObject(jsi::Runtime& runtime, double fontSize, SkColor color)
{
    jsi::Object textStyle(runtime);
    textStyle.setProperty(runtime, "fontSize", fontSize);
    textStyle.setProperty(runtime, "color", static_cast<double>(color));
    return textStyle;
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

std::shared_ptr<YogaNode> makeYogaNode(NodeStyle style, NodeCommand command)
{
    auto node = std::make_shared<YogaNode>();
    node->setStyle(style);
    node->setCommand(std::move(command));
    return node;
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

void assertImageHostObjectCommandRender(jsi::Runtime& runtime)
{
    auto root = makeYogaNode(
        groupStyle(8.0, 8.0),
        imageCommand(runtime));

    expect(root->_commandKind == YogaNodeCommandKind::IMAGE, "setCommand constructs a real ImageCmd");
    auto* imageCmd = dynamic_cast<margelo::nitro::RNSkiaYoga::ImageCmd*>(root->_command.get());
    expect(imageCmd != nullptr, "installed command has ImageCmd type");
    expect(imageCmd->props.image.has_value(), "ImageCmd keeps the converted SkImage host object payload");
    expect(imageCmd->props.image.value() != nullptr, "ImageCmd converted SkImage payload is non-null");
    expect(imageCmd->props.image.value()->width() == 4, "ImageCmd converted SkImage width");
    expect(imageCmd->props.image.value()->height() == 4, "ImageCmd converted SkImage height");
    expect(imageCmd->props.fit == "fill", "ImageCmd keeps the requested fill fit mode");

    auto surface = makeSurface(12, 12);
    renderNode(root, surface);

    expectNear(root->_layout.width, 8.0, "image layout width");
    expectNear(root->_layout.height, 8.0, "image layout height");
    expect(imageCmd->props.rect.has_value(), "ImageCmd layout resolves a draw rect");
    expectNear(imageCmd->props.rect->width(), 8.0, "ImageCmd draw rect width");
    expectNear(imageCmd->props.rect->height(), 8.0, "ImageCmd draw rect height");

    expectColorNear(pixelAt(surface, 1, 1), SK_ColorRED, 0, "fill image renders the red source quadrant");
    expectColorNear(pixelAt(surface, 6, 1), SK_ColorGREEN, 0, "fill image renders the green source quadrant");
    expectColorNear(pixelAt(surface, 1, 6), SK_ColorBLUE, 0, "fill image renders the blue source quadrant");
    expectColorNear(pixelAt(surface, 6, 6), SK_ColorYELLOW, 0, "fill image renders the yellow source quadrant");
    expectColorNear(pixelAt(surface, 9, 1), SK_ColorTRANSPARENT, 0, "image render remains bounded by the Yoga layout width");
    expectColorNear(pixelAt(surface, 1, 9), SK_ColorTRANSPARENT, 0, "image render remains bounded by the Yoga layout height");
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

} // namespace

int main()
{
    auto runtime = facebook::jsc::makeJSCRuntime();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(runtime.get());
    auto callInvoker = std::make_shared<HostCallInvoker>();
    auto platformContext = std::make_shared<HostPlatformContext>(callInvoker);
    margelo::nitro::RNSkiaYoga::SetPlatformContext(platformContext);

    assertRectOpacityRender(*runtime);
    assertParentChildLayoutRender(*runtime);
    assertGroupRasterCacheBehavior(*runtime);
    assertAdditionalPointsCommandRender(*runtime);
    assertLineCommandRender(*runtime);
    assertOvalCommandRender(*runtime);
    assertCircleCommandRender(*runtime);
    assertRRectCommandRender(*runtime);
    assertBlurMaskFilterCommandRender(*runtime);
    assertPathHostObjectCommandRender(*runtime);
    assertImageHostObjectCommandRender(*runtime);
    assertTextCommandStateAndRender(*runtime);
    assertParagraphCommandMeasureAndRender(*runtime);
    assertConverterErrorPath(*runtime);
    assertConverterErrorImage(*runtime);
    assertConverterErrorTextFont(*runtime);

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
