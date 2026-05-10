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
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, AnimatedDouble.cpp, generated Nitro specs, React Native JSC, upstream Yoga sources, RN Skia macOS archives, ColorParser, PlatformContextAccessor, and Nitro/JSI helper sources.")
	console.log("- The executable created a JSC runtime, installed it as RN Skia's main runtime, converted simple NodeCommand payloads through JSIConverter<NodeCommand>::fromJSI(...), and executed real YogaNode::setCommand().")
	console.log("- The executable rendered real RectCmd, GroupCmd, PointsCmd, LineCmd, OvalCmd, CircleCmd, RRectCmd, BlurMaskFilterCmd, and PathCmd paths through YogaNode::renderToContext() onto raster SkSurfaces.")
	console.log("- The executable asserted pixels/regions for opacity blending, Yoga-derived child coordinates, group raster-cache reuse/invalidation, point drawing, line stroke drawing, oval/circle/rrect fills, bounded blur-mask-filter inheritance, and real JsiSkPath host-object path conversion/rendering.")
	console.log("- Proof boundary: host-native macOS C++ command construction and raster behavior for deterministic geometry/filter/path commands only. This does not prove Nitro toObject()/prototype materialization, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, RNGH native delivery, dynamic Worklets-backed AnimatedDouble resolution, or text/paragraph/image command fidelity.")
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
#include <cstdlib>
#include <iostream>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <variant>
#include <vector>

#include <include/core/SkCanvas.h>
#include <include/core/SkColor.h>
#include <include/core/SkImage.h>
#include <include/core/SkImageInfo.h>
#include <include/core/SkPaint.h>
#include <include/core/SkPath.h>
#include <include/core/SkPixmap.h>
#include <include/core/SkRect.h>
#include <include/core/SkSurface.h>
#include <jsi/jsi.h>
#include <yoga/Yoga.h>

#include "JSCRuntime.h"
#include "RuntimeAwareCache.h"
#include "DrawingCtx.h"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::GroupCommandData;
using margelo::nitro::RNSkiaYoga::NodeCommand;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::NodeCommandKind;
using margelo::nitro::RNSkiaYoga::PointsCommandData;
using margelo::nitro::RNSkiaYoga::Position;
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

} // namespace

int main()
{
    auto runtime = facebook::jsc::makeJSCRuntime();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(runtime.get());

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
    assertConverterErrorPath(*runtime);

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
