#!/usr/bin/env node

import { rmSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync, existsSync, readdirSync, statSync, realpathSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
	createVerifierTempDir,
	formatVerifierTempDiagnostics,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = createVerifierTempDir("rnskia-yoganode-hit-testing-")
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

	const probePath = path.join(tmpDir, "yoganode-native-hit-testing.cpp")
	const binaryPath = path.join(tmpDir, "yoganode-native-hit-testing")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-ferror-limit=20",
		"-ffunction-sections",
		"-fdata-sections",
		"-Wl,-dead_strip",
		// YogaNode.cpp contains generated/JSI-facing entry points that this host probe never enters.
		// dynamic_lookup keeps those paths lazy while the exercised hit-test path still resolves
		// against real Yoga, Nitro, JSI, React Native Skia helper objects, and macOS Skia archives.
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
		throw new Error(formatFailure(`${compiler} native YogaNode hit-testing compile/link failed with exit code ${compileResult.status}.`, compileResult, [
			{ label: "YogaNode hit-testing temp root", targetPath: tmpDir },
			{ label: "probe source", targetPath: probePath },
			{ label: "binary output", targetPath: binaryPath },
			{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
		]))
	}

	assertLinkedBinary(binaryPath, [
		{ label: "YogaNode hit-testing temp root", targetPath: tmpDir },
		{ label: "binary output", targetPath: binaryPath },
		{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
	])

	const runResult = spawnSync(binaryPath, [], {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (runResult.error) {
		throw new Error([
			`Failed to execute YogaNode native hit-testing binary: ${runResult.error.message}`,
			`diagnostics:\n${formatVerifierTempDiagnostics([
				{ label: "YogaNode hit-testing temp root", targetPath: tmpDir },
				{ label: "binary output", targetPath: binaryPath },
			])}`,
		].join("\n\n"))
	}

	if (runResult.status !== 0) {
		throw new Error(formatFailure(`YogaNode native hit-testing execution failed with exit code ${runResult.status}.`, runResult, [
			{ label: "YogaNode hit-testing temp root", targetPath: tmpDir },
			{ label: "binary output", targetPath: binaryPath },
		]))
	}

	console.log("YogaNode native hit-testing verifier passed:")
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, upstream Yoga sources, RN Skia macOS archives, and the helper sources required for object emission.")
	console.log("- The executable asserted YogaNode::hitTestTagAt / hitTestInternal behavior for pointerEvents, child z-order, layout coordinate translation, matrix inversion, composed public transform-array inversion, overflow clipping, style corner-radius clipping, explicit style.clip clipping, hitSlop, precise-hit geometry, and interactive descendant count propagation.")
	console.log("- Host-only direct interaction-field setup is limited to the JSI config boundary; hit-test traversal, layout, clipping, transform inversion, precise command checks, and descendant count mutation execute the real native runtime path.")
	console.log("- -Wl,-undefined,dynamic_lookup is limited to unentered host-incompatible entry points in the shared translation unit.")
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
		"Native linker reported success but the expected YogaNode hit-testing binary was not created.",
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
		"Unable to locate RN Skia macOS archives required for YogaNode native hit-testing.",
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
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <variant>
#include <vector>
#include <yoga/Yoga.h>

#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::HitSlopInsets;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::Overflow;
using margelo::nitro::RNSkiaYoga::PointerEventsMode;
using margelo::nitro::RNSkiaYoga::Position;
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
using margelo::nitro::RNSkiaYoga::YogaNodeCommand;
using margelo::nitro::RNSkiaYoga::YogaNodeLayout;

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

class PreciseRectCommand final : public YogaNodeCommand {
public:
    PreciseRectCommand(YogaNode* node, SkRect rect)
        : YogaNodeCommand(node)
        , _rect(rect)
    {
    }

    void setLayout(const YogaNodeLayout& layout) override
    {
        (void)layout;
    }

    void draw(RNSkia::DrawingCtx* ctx) override
    {
        (void)ctx;
    }

    bool supportsPreciseHitTesting() const override
    {
        return true;
    }

    bool containsLocalPoint(const ::SkPoint& point) const override
    {
        return _rect.contains(point.fX, point.fY);
    }

private:
    SkRect _rect;
};

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

void expectTag(double actual, double expected, const std::string& message)
{
    if (std::abs(actual - expected) > 0.001) {
        std::ostringstream out;
        out << message << " expected tag " << expected << " but got " << actual;
        fail(out.str());
    }
}

void expectCount(const std::shared_ptr<YogaNode>& node, int expected, const std::string& message)
{
    if (node->_interactiveDescendantCount != expected) {
        std::ostringstream out;
        out << message << " expected count " << expected << " but got " << node->_interactiveDescendantCount;
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

NodeStyle absoluteStyle(double left, double top, double width, double height)
{
    auto style = fixedStyle(width, height);
    style.position = Position::ABSOLUTE;
    style.left = points(left);
    style.top = points(top);
    return style;
}

std::shared_ptr<YogaNode> makeNode(double width, double height)
{
    auto node = std::make_shared<YogaNode>();
    node->setStyle(fixedStyle(width, height));
    return node;
}

std::shared_ptr<YogaNode> makeAbsoluteNode(double left, double top, double width, double height)
{
    auto node = std::make_shared<YogaNode>();
    node->setStyle(absoluteStyle(left, top, width, height));
    return node;
}

void configureInteraction(
    const std::shared_ptr<YogaNode>& node,
    double eventTag,
    PointerEventsMode pointerEvents = PointerEventsMode::AUTO,
    HitSlopInsets hitSlop = {},
    bool preciseHit = false)
{
    // setInteractionConfig() is JSI-only. The host probe sets the same native fields directly,
    // then exercises the real hitTestTagAt()/hitTestInternal() traversal and count propagation.
    node->_pointerEvents = pointerEvents;
    node->_hitSlop = hitSlop;
    node->_preciseHit = preciseHit;
    node->_eventTag = eventTag;
    node->updateSelfInteractionState(eventTag > 0.0);
}

void attachPreciseRectCommand(const std::shared_ptr<YogaNode>& node, SkRect rect)
{
    node->_command = std::make_unique<PreciseRectCommand>(node.get(), rect);
}

void compute(const std::shared_ptr<YogaNode>& node)
{
    node->computeLayout(std::nullopt, std::nullopt);
}

void pointerEventsModes()
{
    {
        auto root = makeNode(100, 100);
        auto child = makeAbsoluteNode(10, 10, 40, 40);
        root->insertChild(child, std::nullopt);

        configureInteraction(root, 10.0);
        configureInteraction(child, 20.0);
        compute(root);

        expectTag(root->hitTestTagAt(20, 20), 20.0, "auto descends into children before self");
        expectTag(root->hitTestTagAt(90, 90), 10.0, "auto returns self when no child matches");
    }

    {
        auto root = makeNode(100, 100);
        auto child = makeAbsoluteNode(10, 10, 40, 40);
        root->insertChild(child, std::nullopt);

        configureInteraction(root, 10.0);
        configureInteraction(child, 20.0, PointerEventsMode::NONE);
        compute(root);

        expectTag(root->hitTestTagAt(20, 20), 10.0, "none suppresses node and descendants, allowing ancestor fallback");
    }

    {
        auto root = makeNode(100, 100);
        auto child = makeAbsoluteNode(10, 10, 40, 40);
        root->insertChild(child, std::nullopt);

        configureInteraction(root, 10.0, PointerEventsMode::BOX_ONLY);
        configureInteraction(child, 20.0);
        compute(root);

        expectTag(root->hitTestTagAt(20, 20), 10.0, "box-only skips descendants and returns self");
    }

    {
        auto root = makeNode(100, 100);
        auto child = makeAbsoluteNode(10, 10, 40, 40);
        root->insertChild(child, std::nullopt);

        configureInteraction(root, 10.0, PointerEventsMode::BOX_NONE);
        configureInteraction(child, 20.0);
        compute(root);

        expectTag(root->hitTestTagAt(20, 20), 20.0, "box-none still descends into children");
        expectTag(root->hitTestTagAt(90, 90), 0.0, "box-none skips self when no child matches");
    }
}

void reverseTraversalTopmostWins()
{
    auto root = makeNode(100, 100);
    auto bottom = makeAbsoluteNode(0, 0, 50, 50);
    auto top = makeAbsoluteNode(0, 0, 50, 50);

    root->insertChild(bottom, std::nullopt);
    root->insertChild(top, std::nullopt);

    configureInteraction(bottom, 101.0);
    configureInteraction(top, 102.0);
    compute(root);

    expectTag(root->hitTestTagAt(25, 25), 102.0, "later sibling wins overlapping hit by reverse traversal");

    configureInteraction(top, 102.0, PointerEventsMode::NONE);
    expectTag(root->hitTestTagAt(25, 25), 101.0, "reverse traversal continues to lower sibling when top sibling is none");
}

void parentToLocalCoordinateTranslation()
{
    auto root = makeNode(100, 100);
    auto child = makeAbsoluteNode(30, 20, 10, 10);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 201.0);
    compute(root);

    expectTag(root->hitTestTagAt(35, 25), 201.0, "parent coordinates are translated into child local coordinates");
    expectTag(root->hitTestTagAt(15, 15), 0.0, "untranslated outside point does not hit child");
}

void inverseMatrixTransforms()
{
    auto root = makeNode(100, 100);
    auto child = makeAbsoluteNode(10, 10, 20, 20);
    auto style = absoluteStyle(10, 10, 20, 20);
    auto matrix = std::make_shared<SkMatrix>();
    matrix->setScale(2.0f, 2.0f);
    style.matrix = matrix;
    child->setStyle(style);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 301.0);
    compute(root);

    expectTag(root->hitTestTagAt(45, 20), 301.0, "inverse matrix maps visual scaled point back inside local bounds");
    expectTag(root->hitTestTagAt(55, 20), 0.0, "inverse matrix rejects point outside scaled local bounds");
}

void composedTransformArrayInversion()
{
    {
        auto root = makeNode(100, 100);
        auto child = makeAbsoluteNode(10, 10, 20, 20);
        auto style = absoluteStyle(10, 10, 20, 20);
        style.transform = std::vector<NodeTransformOperation> {
            TransformTranslateX(5.0),
            TransformTranslateY(4.0),
            TransformScale(2.0),
        };
        child->setStyle(style);
        root->insertChild(child, std::nullopt);

        configureInteraction(child, 302.0);
        compute(root);

        expect(child->_matrix != nullptr, "translate+scale transform array creates native matrix for hit testing");
        expectTag(root->hitTestTagAt(52, 45), 302.0, "inverse composed translate+scale maps visual point back inside local bounds");
        expectTag(root->hitTestTagAt(12, 45), 0.0, "inverse composed translateX+scale rejects point a scale-only transform would include");
        expectTag(root->hitTestTagAt(20, 12), 0.0, "inverse composed translateY+scale rejects point a scale-only transform would include");
    }

    {
        auto root = makeNode(100, 100);
        auto child = makeAbsoluteNode(10, 10, 20, 10);
        auto style = absoluteStyle(10, 10, 20, 10);
        style.transform = std::vector<NodeTransformOperation> {
            TransformTranslateX(30.0),
            TransformRotateZ(1.5707963267948966),
        };
        child->setStyle(style);
        root->insertChild(child, std::nullopt);

        configureInteraction(child, 303.0);
        compute(root);

        expect(child->_matrix != nullptr, "translate+rotateZ transform array creates native matrix for hit testing");
        expectTag(root->hitTestTagAt(35, 19), 303.0, "inverse composed translate+rotateZ maps rotated visual point back inside local bounds");
        expectTag(root->hitTestTagAt(45, 19), 0.0, "inverse composed translate+rotateZ rejects point outside the rotated visual bounds");
    }
}

void clipsToBounds()
{
    auto root = makeNode(50, 50);
    auto style = fixedStyle(50, 50);
    style.overflow = Overflow::HIDDEN;
    root->setStyle(style);

    auto child = makeAbsoluteNode(40, 10, 30, 30);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 401.0);
    compute(root);

    expectTag(root->hitTestTagAt(45, 15), 401.0, "clips-to-bounds allows visible child portion");
    expectTag(root->hitTestTagAt(65, 15), 0.0, "clips-to-bounds rejects clipped child portion");
}

void explicitClipRect()
{
    auto root = makeNode(100, 100);
    auto style = fixedStyle(100, 100);
    style.clip = SkRect::MakeXYWH(10, 10, 40, 40);
    root->setStyle(style);

    auto child = makeAbsoluteNode(0, 0, 100, 100);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 501.0);
    compute(root);

    expectTag(root->hitTestTagAt(20, 20), 501.0, "explicit rect clip allows contained point");
    expectTag(root->hitTestTagAt(5, 5), 0.0, "explicit rect clip rejects outside point");
}

void explicitClipPath()
{
    auto root = makeNode(100, 100);
    auto style = fixedStyle(100, 100);
    SkPath path;
    path.addCircle(50.0f, 50.0f, 20.0f);
    style.clip = path;
    root->setStyle(style);

    auto child = makeAbsoluteNode(0, 0, 100, 100);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 502.0);
    compute(root);

    expectTag(root->hitTestTagAt(50, 50), 502.0, "explicit path clip allows contained point");
    expectTag(root->hitTestTagAt(10, 10), 0.0, "explicit path clip rejects outside point");
}

void explicitClipRRect()
{
    auto root = makeNode(100, 100);
    auto style = fixedStyle(100, 100);
    style.clip = SkRRect::MakeRectXY(SkRect::MakeXYWH(10, 10, 40, 40), 18.0f, 18.0f);
    root->setStyle(style);

    auto child = makeAbsoluteNode(0, 0, 100, 100);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 503.0);
    compute(root);

    expectTag(root->hitTestTagAt(30, 30), 503.0, "explicit rrect clip allows center point");
    expectTag(root->hitTestTagAt(11, 11), 0.0, "explicit rrect clip rejects rounded corner point");
}

void styleCornerRadiiClipToBounds()
{
    auto root = makeNode(100, 100);
    auto style = fixedStyle(100, 100);
    style.borderTopLeftRadius = margelo::nitro::RNSkiaYoga::SkPoint(30.0, 20.0);
    style.borderBottomRightRadius = margelo::nitro::RNSkiaYoga::SkPoint(25.0, 35.0);
    root->setStyle(style);

    expect(root->_clipsToBounds, "style corner radii enable YogaNode bounds clipping");
    expect(root->_clipToBoundsRadii.has_value(), "style corner radii populate _clipToBoundsRadii");
    expect(!root->_style.clip.has_value(), "style corner radii remain distinct from explicit style.clip");
    expect(!root->_clipPath.has_value(), "style corner radii do not populate explicit path clip");
    expect(!root->_clipRect.has_value(), "style corner radii do not populate explicit rect clip");
    expect(!root->_clipRRect.has_value(), "style corner radii do not populate explicit rrect clip");

    auto child = makeAbsoluteNode(0, 0, 100, 100);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 505.0);
    compute(root);

    expectTag(root->hitTestTagAt(30, 20), 505.0, "style top-left radius allows point inside rounded bounds");
    expectTag(root->hitTestTagAt(1, 1), 0.0, "style top-left radius rejects rounded clipped corner");
    expectTag(root->hitTestTagAt(75, 65), 505.0, "style bottom-right radius allows point inside rounded bounds");
    expectTag(root->hitTestTagAt(99, 99), 0.0, "style bottom-right radius rejects rounded clipped corner");
    expectTag(root->hitTestTagAt(99, 1), 505.0, "unset top-right style radius keeps that corner square");
}

void invertedExplicitClip()
{
    auto root = makeNode(100, 100);
    auto style = fixedStyle(100, 100);
    style.clip = SkRect::MakeXYWH(10, 10, 40, 40);
    style.invertClip = true;
    root->setStyle(style);

    auto child = makeAbsoluteNode(0, 0, 100, 100);
    root->insertChild(child, std::nullopt);

    configureInteraction(child, 504.0);
    compute(root);

    expectTag(root->hitTestTagAt(20, 20), 0.0, "invertClip rejects point inside explicit clip");
    expectTag(root->hitTestTagAt(70, 70), 504.0, "invertClip allows point outside explicit clip");
}

void hitSlopExpansion()
{
    {
        auto node = makeNode(20, 20);
        configureInteraction(node, 601.0, PointerEventsMode::AUTO, HitSlopInsets { .top = 10.0f, .right = 10.0f, .bottom = 10.0f, .left = 10.0f });
        compute(node);

        expectTag(node->hitTestTagAt(-5, 10), 601.0, "numeric hitSlop expands left edge");
        expectTag(node->hitTestTagAt(-11, 10), 0.0, "numeric hitSlop keeps finite left edge");
        expectTag(node->hitTestTagAt(25, 10), 601.0, "numeric hitSlop expands right edge");
        expectTag(node->hitTestTagAt(31, 10), 0.0, "numeric hitSlop keeps finite right edge");
    }

    {
        auto node = makeNode(20, 20);
        configureInteraction(node, 602.0, PointerEventsMode::AUTO, HitSlopInsets { .top = 3.0f, .right = 7.0f, .bottom = 4.0f, .left = 2.0f });
        compute(node);

        expectTag(node->hitTestTagAt(-1, 10), 602.0, "edge hitSlop expands left independently");
        expectTag(node->hitTestTagAt(-3, 10), 0.0, "edge hitSlop left expansion is bounded");
        expectTag(node->hitTestTagAt(26, 10), 602.0, "edge hitSlop expands right independently");
        expectTag(node->hitTestTagAt(28, 10), 0.0, "edge hitSlop right expansion is bounded");
        expectTag(node->hitTestTagAt(10, -2), 602.0, "edge hitSlop expands top independently");
        expectTag(node->hitTestTagAt(10, -4), 0.0, "edge hitSlop top expansion is bounded");
        expectTag(node->hitTestTagAt(10, 23), 602.0, "edge hitSlop expands bottom independently");
        expectTag(node->hitTestTagAt(10, 25), 0.0, "edge hitSlop bottom expansion is bounded");
    }
}

void preciseHitGeometry()
{
    auto node = makeNode(100, 100);
    attachPreciseRectCommand(node, SkRect::MakeXYWH(10, 10, 30, 30));
    configureInteraction(node, 701.0, PointerEventsMode::AUTO, {}, true);
    compute(node);

    expectTag(node->hitTestTagAt(20, 20), 701.0, "precise-hit returns tag for command-contained point");
    expectTag(node->hitTestTagAt(5, 5), 0.0, "precise-hit rejects point inside layout but outside command geometry");
}

void interactiveDescendantCounts()
{
    auto root = makeNode(100, 100);
    auto branch = makeAbsoluteNode(0, 0, 50, 50);
    auto leaf = makeAbsoluteNode(0, 0, 20, 20);
    root->insertChild(branch, std::nullopt);
    branch->insertChild(leaf, std::nullopt);

    expectCount(root, 0, "root starts without interactive descendants");
    expectCount(branch, 0, "branch starts without interactive descendants");
    expectCount(leaf, 0, "leaf starts without interactive descendants");

    configureInteraction(leaf, 801.0);
    expectCount(leaf, 1, "leaf enabling increments self count");
    expectCount(branch, 1, "leaf enabling propagates to branch");
    expectCount(root, 1, "leaf enabling propagates to root");

    configureInteraction(leaf, 0.0);
    expectCount(leaf, 0, "clearing leaf event tag decrements self count");
    expectCount(branch, 0, "clearing leaf propagates to branch");
    expectCount(root, 0, "clearing leaf propagates to root");

    configureInteraction(leaf, 801.0);
    root->removeChild(branch);
    expectCount(root, 0, "removeChild subtracts removed interactive subtree from old parent");
    expectCount(branch, 1, "removed branch retains its subtree count");
    expect(branch->_parent.expired(), "removeChild clears removed child weak parent");

    root->insertChild(branch, std::nullopt);
    expectCount(root, 1, "reinserting branch restores subtree count");
    root->removeAllChildren();
    expectCount(root, 0, "removeAllChildren subtracts interactive subtree count");
    expectCount(branch, 1, "removeAllChildren leaves detached subtree count intact");
    expect(branch->_parent.expired(), "removeAllChildren clears detached branch weak parent");

    auto firstParent = makeNode(100, 100);
    auto secondParent = makeNode(100, 100);
    firstParent->insertChild(branch, std::nullopt);
    expectCount(firstParent, 1, "first parent receives interactive subtree before reparenting");
    expectCount(secondParent, 0, "second parent starts without interactive subtree before reparenting");

    secondParent->insertChild(branch, std::nullopt);
    expectCount(firstParent, 0, "reparenting subtracts interactive subtree from old parent");
    expectCount(secondParent, 1, "reparenting adds interactive subtree to new parent");
    expect(branch->_parent.lock().get() == secondParent.get(), "reparenting updates weak parent link");
}

} // namespace

int main()
{
    pointerEventsModes();
    reverseTraversalTopmostWins();
    parentToLocalCoordinateTranslation();
    inverseMatrixTransforms();
    composedTransformArrayInversion();
    clipsToBounds();
    explicitClipRect();
    explicitClipPath();
    explicitClipRRect();
    styleCornerRadiiClipToBounds();
    invertedExplicitClip();
    hitSlopExpansion();
    preciseHitGeometry();
    interactiveDescendantCounts();

    std::cout << "YogaNode native hit-testing passed\n";
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
