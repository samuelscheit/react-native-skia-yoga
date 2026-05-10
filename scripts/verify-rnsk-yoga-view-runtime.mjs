#!/usr/bin/env node

import { rmSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync, existsSync, readdirSync, statSync, realpathSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
	createVerifierTempDir,
	formatVerifierTempDiagnostics,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = createVerifierTempDir("rnskia-rnsk-yoga-view-runtime-")
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
		matchesArchive: createMacosXcframeworkArchiveMatcher(projectPath("node_modules/react-native-skia-apple-macos/libs")),
		followSymlinks: true,
	},
	{
		name: "current bundled RN Skia macOS xcframework archives",
		root: projectPath("node_modules/@shopify/react-native-skia/libs/apple/macos"),
		archivePattern: "*.xcframework/macos*/*.a",
		matchesArchive: createMacosXcframeworkArchiveMatcher(projectPath("node_modules/@shopify/react-native-skia/libs/apple/macos")),
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

	const probePath = path.join(tmpDir, "rnsk-yoga-view-runtime.cpp")
	const binaryPath = path.join(tmpDir, "rnsk-yoga-view-runtime")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-ferror-limit=20",
		"-ffunction-sections",
		"-fdata-sections",
		"-Wl,-dead_strip",
		// YogaNode.cpp and RN Skia's view API headers share generated/JSI-facing entry points that
		// this host probe never enters. dynamic_lookup keeps those paths lazy while the exercised
		// SkiaYoga/ViewRegistry/RNSkYogaView scheduler path resolves against real compiled code.
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
		throw new Error(formatFailure(`${compiler} RNSkYogaView runtime compile/link failed with exit code ${compileResult.status}.`, compileResult, [
			{ label: "RNSkYogaView runtime temp root", targetPath: tmpDir },
			{ label: "probe source", targetPath: probePath },
			{ label: "binary output", targetPath: binaryPath },
			{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
		]))
	}

	assertLinkedBinary(binaryPath, [
		{ label: "RNSkYogaView runtime temp root", targetPath: tmpDir },
		{ label: "binary output", targetPath: binaryPath },
		{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
	])

	const runResult = spawnSync(binaryPath, [], {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (runResult.error) {
		throw new Error([
			`Failed to execute RNSkYogaView runtime binary: ${runResult.error.message}`,
			`diagnostics:\n${formatVerifierTempDiagnostics([
				{ label: "RNSkYogaView runtime temp root", targetPath: tmpDir },
				{ label: "binary output", targetPath: binaryPath },
			])}`,
		].join("\n\n"))
	}

	if (runResult.status !== 0) {
		throw new Error(formatFailure(`RNSkYogaView runtime execution failed with exit code ${runResult.status}.`, runResult, [
			{ label: "RNSkYogaView runtime temp root", targetPath: tmpDir },
			{ label: "binary output", targetPath: binaryPath },
		]))
	}

	console.log("RNSkYogaView runtime verifier passed:")
	console.log("- clang++ compiled and linked a host executable against real SkiaYoga.cpp, RNSkYogaView.cpp, YogaNode.cpp, generated Nitro specs, upstream Yoga sources, RN Skia macOS archives, and required helper sources.")
	console.log("- The executable registered a real RNSkYogaView through RN Skia's RNSkJsiViewApi/ViewRegistry path and exercised SkiaYoga attachViewRoot, requestViewRender, setViewAnimating, consumeViewProfileSample, and detachViewRoot.")
	console.log("- The executable asserted missing-view no-ops, dirty-frame rendering, idle-frame skips, animating-frame continuation, profile sample serialization/reset, root detachment, and safe post-detach calls.")
	console.log("- Host shims are limited to platform context, JS call invoker, and raster canvas provider; this does not claim iOS/Android view presentation, simulator/device runtime, Worklets UI-runtime execution, or RNGH native delivery.")
	console.log("- -Wl,-undefined,dynamic_lookup is limited to unentered host-incompatible JSI/platform entry points in shared translation units.")
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
	].filter(Boolean).join("\n\n")
}

function assertLinkedBinary(binaryPath, diagnosticPaths) {
	if (existsSync(binaryPath) && statSync(binaryPath).isFile()) {
		return
	}

	throw new Error([
		"Native linker reported success but the expected RNSkYogaView runtime binary was not created.",
		`diagnostics:\n${formatVerifierTempDiagnostics(diagnosticPaths)}`,
	].join("\n\n"))
}

function helperSourcePaths() {
	return [
		"node_modules/react-native/ReactCommon/jsi/jsi/jsi.cpp",
		"node_modules/react-native/ReactCommon/jsi/jsi/jsilib-posix.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/JsiHostObject.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/RuntimeAwareCache.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/RuntimeLifecycleMonitor.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/JsiPromises.cpp",
		"node_modules/@shopify/react-native-skia/cpp/api/JsiSkDispatcher.cpp",
		"node_modules/react-native-nitro-modules/cpp/core/HybridObject.cpp",
		"node_modules/react-native-nitro-modules/cpp/prototype/HybridObjectPrototype.cpp",
		"node_modules/react-native-nitro-modules/cpp/utils/CommonGlobals.cpp",
		"node_modules/react-native-nitro-modules/cpp/jsi/JSICache.cpp",
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
		attempt.archiveBasenames = attempt.archivePaths.map((archivePath) => path.basename(archivePath))
		attempt.missingExpectedArchives = expectedSkiaArchiveBasenames.filter((archiveName) => !attempt.archiveBasenames.includes(archiveName))
		attempt.isValid = attempt.missingExpectedArchives.length === 0
	}

	const selectedLayout = attempts.find((attempt) => attempt.isValid)
	if (selectedLayout) {
		return selectedLayout.archivePaths
	}

	throw new Error([
		"Unable to locate RN Skia macOS archives required for RNSkYogaView runtime verifier.",
		`Expected archive basenames: ${expectedSkiaArchiveBasenames.join(", ")}`,
		"Checked archive layouts:",
		...attempts.map(formatArchiveLayoutAttempt),
	].join("\n"))
}

function createNitroModulesShim(baseDir) {
	const shimDir = path.join(baseDir, "NitroModules")
	mkdirSync(shimDir, { recursive: true })

	const nitroCppDir = projectPathChecked("node_modules/react-native-nitro-modules/cpp")
	for (const headerPath of walkFiles(nitroCppDir, (entryPath) => entryPath.endsWith(".hpp") || entryPath.endsWith(".h"))) {
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
		return segments.length === 3 && segments[0].endsWith(".xcframework") && segments[1].startsWith("macos")
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
		if (entry.isDirectory() || (followSymlinks && entry.isSymbolicLink() && statSync(entryPath).isDirectory())) {
			files.push(...walkFiles(entryPath, predicate, options))
		} else if ((entry.isFile() || (followSymlinks && entry.isSymbolicLink() && statSync(entryPath).isFile())) && predicate(entryPath)) {
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
	details.push(`  matched basenames: ${attempt.archiveBasenames.length > 0 ? attempt.archiveBasenames.join(", ") : "none"}`)
	details.push(`  missing expected archives: ${attempt.missingExpectedArchives.length > 0 ? attempt.missingExpectedArchives.join(", ") : "none"}`)
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
	].flatMap((includePath) => ["-I", path.isAbsolute(includePath) ? includePath : projectPath(includePath)])
}

function nativeProbeSource() {
	return String.raw`
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <exception>
#include <functional>
#include <iostream>
#include <memory>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <variant>
#include <vector>

#include <ReactCommon/CallInvoker.h>
#include <include/core/SkCanvas.h>
#include <include/core/SkColor.h>
#include <include/core/SkFontMgr.h>
#include <include/core/SkImage.h>
#include <include/core/SkImageInfo.h>
#include <include/core/SkStream.h>
#include <include/core/SkSurface.h>
#if !defined(SK_GRAPHITE)
#include <include/gpu/ganesh/GrDirectContext.h>
#endif

#include "HybridSkiaYogaSpec.cpp"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"
#include "RNSkYogaView.cpp"
#include "SkiaYoga.cpp"

using margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::RNSkYogaView;
using margelo::nitro::RNSkiaYoga::SkiaYoga;
using margelo::nitro::RNSkiaYoga::YogaNode;
using margelo::nitro::RNSkiaYoga::YogaNodeCommand;
using margelo::nitro::RNSkiaYoga::YogaNodeLayout;

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

void expectEqual(double actual, double expected, const std::string& message)
{
    if (std::fabs(actual - expected) > 0.001) {
        std::ostringstream out;
        out << message << " expected " << expected << " but got " << actual;
        fail(out.str());
    }
}

std::variant<std::string, double> points(double value)
{
    return std::variant<std::string, double> { value };
}

NodeStyle fixedStyle(double width, double height)
{
    NodeStyle style {};
    style.width = points(width);
    style.height = points(height);
    return style;
}

class HostCallInvoker final : public facebook::react::CallInvoker {
public:
    void invokeAsync(facebook::react::CallFunc&& func) noexcept override
    {
        (void)func;
        asyncCalls += 1;
    }

    void invokeSync(facebook::react::CallFunc&& func) override
    {
        (void)func;
        syncCalls += 1;
    }

    int asyncCalls = 0;
    int syncCalls = 0;
};

class HostPlatformContext final : public RNSkia::RNSkPlatformContext {
public:
    explicit HostPlatformContext(std::shared_ptr<HostCallInvoker> callInvoker)
        : RNSkia::RNSkPlatformContext(std::move(callInvoker), 1.0f)
    {
    }

    void runOnMainThread(std::function<void()> func) override
    {
        mainThreadCalls += 1;
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
        streamOperations += 1;
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
        return nullptr;
    }

    int mainThreadCalls = 0;
    int streamOperations = 0;
};

class HostCanvasProvider final : public RNSkia::RNSkCanvasProvider {
public:
    HostCanvasProvider(int width, int height)
        : RNSkia::RNSkCanvasProvider([]() {})
        , _width(width)
        , _height(height)
        , _surface(SkSurfaces::Raster(SkImageInfo::MakeN32Premul(width, height)))
    {
        expect(_surface != nullptr, "host canvas provider created a raster SkSurface");
    }

    int getWidth() override
    {
        return _width;
    }

    int getHeight() override
    {
        return _height;
    }

    bool renderToCanvas(const std::function<void(SkCanvas*)>& draw) override
    {
        renderCalls += 1;
        draw(_surface->getCanvas());
        return true;
    }

    int renderCalls = 0;

private:
    int _width;
    int _height;
    sk_sp<SkSurface> _surface;
};

class ProbeCommand final : public YogaNodeCommand {
public:
    ProbeCommand(YogaNode* node, int* drawCalls)
        : YogaNodeCommand(node)
        , _drawCalls(drawCalls)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        (void)layout;
        layoutUpdates += 1;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        *_drawCalls += 1;
        SkPaint paint;
        paint.setColor(SK_ColorRED);
        ctx->canvas->drawRect(SkRect::MakeXYWH(0.0f, 0.0f, 8.0f, 8.0f), paint);
    }

    int layoutUpdates = 0;

private:
    int* _drawCalls;
};

double numericJsonField(const std::string& json, const std::string& field)
{
    const std::string key = "\"" + field + "\":";
    const auto fieldStart = json.find(key);
    if (fieldStart == std::string::npos) {
        fail("profile sample is missing field " + field + ": " + json);
    }

    const auto numberStart = fieldStart + key.size();
    char* numberEnd = nullptr;
    const auto value = std::strtod(json.c_str() + numberStart, &numberEnd);
    if (numberEnd == json.c_str() + numberStart) {
        fail("profile sample field is not numeric " + field + ": " + json);
    }
    return value;
}

void expectProfileFrames(const std::string& json, double expectedFrames)
{
    expect(json != "{}", "registered view profile sample should not use missing-view JSON");
    expectEqual(numericJsonField(json, "frames"), expectedFrames, "profile sample frames");
    expect(numericJsonField(json, "avgDrawMs") >= 0.0, "profile sample avgDrawMs is non-negative");
    expect(numericJsonField(json, "avgPresentMs") >= 0.0, "profile sample avgPresentMs is non-negative");
    expect(numericJsonField(json, "maxDrawMs") >= 0.0, "profile sample maxDrawMs is non-negative");
    expect(numericJsonField(json, "maxPresentMs") >= 0.0, "profile sample maxPresentMs is non-negative");
    expect(numericJsonField(json, "sampleDurationMs") >= 0.0, "profile sample sampleDurationMs is non-negative");
}

void assertMissingViewNoOps(SkiaYoga& module, const std::shared_ptr<HybridYogaNodeSpec>& root)
{
    constexpr double missingId = 987654.0;
    module.requestViewRender(missingId);
    module.setViewAnimating(missingId, true);
    module.setViewAnimating(missingId, false);
    module.attachViewRoot(missingId, root);
    module.detachViewRoot(missingId);
    expect(module.consumeViewProfileSample(missingId) == "{}", "missing view profile sample is {}");
}

} // namespace

int main()
{
    RNSkia::ViewRegistry::getInstance().clear();

    auto callInvoker = std::make_shared<HostCallInvoker>();
    auto context = std::make_shared<HostPlatformContext>(callInvoker);
    auto canvasProvider = std::make_shared<HostCanvasProvider>(64, 64);
    auto view = std::make_shared<RNSkYogaView>(context, canvasProvider);
    SkiaYoga module;

    int rootDrawCalls = 0;
    auto root = std::make_shared<YogaNode>();
    root->setStyle(fixedStyle(64.0, 64.0));
    auto probeCommand = std::make_unique<ProbeCommand>(root.get(), &rootDrawCalls);
    auto* probeCommandPtr = probeCommand.get();
    root->_command = std::move(probeCommand);

    assertMissingViewNoOps(module, root);

    int startSchedulerCalls = 0;
    int stopSchedulerCalls = 0;
    view->setSchedulerCallbacks(
        [&]() { startSchedulerCalls += 1; },
        [&]() { stopSchedulerCalls += 1; });

    auto viewApi = std::make_shared<RNSkia::RNSkJsiViewApi>(context);
    constexpr size_t nativeId = 4242;
    viewApi->registerSkiaView(nativeId, view);

    module.attachViewRoot(static_cast<double>(nativeId), root);
    expect(startSchedulerCalls == 1, "attachViewRoot marks the registered view dirty and starts the scheduler");
    expect(view->onFrame() == false, "dirty non-animating attach frame renders once and stops");
    expect(canvasProvider->renderCalls == 1, "attach frame renders through the real canvas provider");
    expect(rootDrawCalls == 1, "attach frame dispatches Yoga root drawing");
    expect(probeCommandPtr->layoutUpdates == 1, "attach frame computes root command layout");
    expect(stopSchedulerCalls == 1, "attach frame stops scheduler after dirty work is flushed");

    expect(view->onFrame() == false, "idle frame returns false");
    expect(canvasProvider->renderCalls == 1, "idle frame skips renderer redraw");
    expect(rootDrawCalls == 1, "idle frame skips Yoga root drawing");

    module.requestViewRender(static_cast<double>(nativeId));
    expect(startSchedulerCalls == 2, "requestViewRender starts scheduler for a registered idle view");
    expect(view->onFrame() == false, "requested dirty frame renders once and stops");
    expect(canvasProvider->renderCalls == 2, "requestViewRender triggers one renderer redraw");
    expect(rootDrawCalls == 2, "requestViewRender dispatches root drawing");
    expect(stopSchedulerCalls == 2, "requestViewRender frame stops scheduler after dirty work is flushed");

    module.setViewAnimating(static_cast<double>(nativeId), true);
    expect(startSchedulerCalls == 3, "setViewAnimating(true) starts scheduler for a registered idle view");
    expect(view->onFrame() == true, "animating frame continues scheduling");
    expect(canvasProvider->renderCalls == 3, "first animating frame redraws");
    expect(rootDrawCalls == 3, "first animating frame draws root");
    expect(view->onFrame() == true, "second animating frame continues scheduling");
    expect(canvasProvider->renderCalls == 4, "second animating frame redraws");
    expect(rootDrawCalls == 4, "second animating frame draws root");

    module.setViewAnimating(static_cast<double>(nativeId), false);
    expect(view->onFrame() == false, "setViewAnimating(false) makes the next frame idle");
    expect(canvasProvider->renderCalls == 4, "post-animation idle frame skips redraw");
    expect(rootDrawCalls == 4, "post-animation idle frame skips root drawing");

    module.requestViewRender(static_cast<double>(nativeId));
    expect(startSchedulerCalls == 4, "requestViewRender restarts scheduler after animation stops");
    expect(view->onFrame() == false, "post-animation dirty frame renders once");
    expect(canvasProvider->renderCalls == 5, "post-animation dirty frame redraws");
    expect(rootDrawCalls == 5, "post-animation dirty frame draws root");

    const auto firstProfile = module.consumeViewProfileSample(static_cast<double>(nativeId));
    expectProfileFrames(firstProfile, 5.0);
    const auto resetProfile = module.consumeViewProfileSample(static_cast<double>(nativeId));
    expectProfileFrames(resetProfile, 0.0);

    module.detachViewRoot(static_cast<double>(nativeId));
    expect(startSchedulerCalls == 5, "detachViewRoot marks the view dirty so the cleared root is presented");
    expect(view->onFrame() == false, "detachViewRoot flushes one non-animating frame");
    expect(canvasProvider->renderCalls == 6, "detachViewRoot renders the cleared view");
    expect(rootDrawCalls == 5, "detachViewRoot clears root before rendering");

    module.requestViewRender(static_cast<double>(nativeId));
    expect(startSchedulerCalls == 6, "requestViewRender remains safe after detach");
    expect(view->onFrame() == false, "post-detach dirty frame renders without a root");
    expect(canvasProvider->renderCalls == 7, "post-detach request redraws the cleared view");
    expect(rootDrawCalls == 5, "post-detach request does not draw the old root");

    module.setViewAnimating(static_cast<double>(nativeId), true);
    expect(startSchedulerCalls == 7, "setViewAnimating(true) remains safe after detach");
    expect(view->onFrame() == true, "post-detach animating frame continues without a root");
    expect(canvasProvider->renderCalls == 8, "post-detach animating frame redraws the cleared view");
    expect(rootDrawCalls == 5, "post-detach animating frame does not draw the old root");

    module.detachViewRoot(static_cast<double>(nativeId));
    expect(view->onFrame() == false, "detach while animating is safe and stops on the next frame");
    expect(canvasProvider->renderCalls == 9, "detach while animating flushes the cleared view");
    expect(rootDrawCalls == 5, "detach while animating keeps root cleared");

    viewApi->unregisterSkiaView(nativeId);
    module.requestViewRender(static_cast<double>(nativeId));
    module.setViewAnimating(static_cast<double>(nativeId), true);
    module.detachViewRoot(static_cast<double>(nativeId));
    expect(module.consumeViewProfileSample(static_cast<double>(nativeId)) == "{}", "unregistered view falls back to missing-view profile sample");

    RNSkia::ViewRegistry::getInstance().clear();
    std::cout << "RNSkYogaView runtime passed\n";
    return 0;
}
`
}

function projectPath(relativePath) {
	return path.join(rootDir, relativePath)
}

function projectPathChecked(relativePath) {
	const filePath = projectPath(relativePath)
	if (!existsSync(filePath)) {
		throw new Error(`Missing required file: ${relativePath}`)
	}
	return filePath
}
