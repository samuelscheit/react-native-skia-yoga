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
const tmpDir = createVerifierTempDir("rnskia-yoganode-jsi-raw-methods-")
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
	assertRegistrationInvariant()
	createNitroModulesShim(tmpDir)

	const probePath = path.join(tmpDir, "yoganode-jsi-raw-methods.cpp")
	const binaryPath = path.join(tmpDir, "yoganode-jsi-raw-methods")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-ferror-limit=20",
		"-ffunction-sections",
		"-fdata-sections",
		"-Wl,-dead_strip",
		// YogaNode.cpp still contains drawing and command paths this boundary verifier never enters.
		// dynamic_lookup keeps those paths lazy while the exercised loadHybridMethods(),
		// generated NodeStyle conversion, raw setInteractionConfig(), and raw hitTest()
		// paths resolve and execute against a real JSC runtime.
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
				`${compiler} YogaNode JSI raw-method compile/link failed with exit code ${compileResult.status}.`,
				compileResult,
				[
					{ label: "YogaNode JSI raw-method temp root", targetPath: tmpDir },
					{ label: "probe source", targetPath: probePath },
					{ label: "binary output", targetPath: binaryPath },
					{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
				],
			),
		)
	}

	assertLinkedBinary(binaryPath, [
		{ label: "YogaNode JSI raw-method temp root", targetPath: tmpDir },
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
				`Failed to execute YogaNode JSI raw-method binary: ${runResult.error.message}`,
				`diagnostics:\n${formatVerifierTempDiagnostics([
					{ label: "YogaNode JSI raw-method temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				])}`,
			].join("\n\n"),
		)
	}

	if (runResult.status !== 0) {
		throw new Error(
			formatFailure(
				`YogaNode JSI raw-method execution failed with exit code ${runResult.status}.`,
				runResult,
				[
					{ label: "YogaNode JSI raw-method temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				],
			),
		)
	}

	console.log("YogaNode JSI raw-method verifier passed:")
	console.log("- Source invariant holds: generated HybridYogaNodeSpec methods and manual YogaNode raw methods have no duplicate names.")
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, generated Nitro specs, React Native JSC, upstream Yoga sources, RN Skia macOS archives, and Nitro/JSI helper sources.")
	console.log("- The executable called YogaNode::loadHybridMethods() without duplicate-name overlap, created a real JSC runtime, converted a generated NodeStyle object, and called raw setInteractionConfig() / hitTest() with valid and invalid JSI inputs, including invalid hitSlop and hitTest numeric state-preservation cases.")
	console.log("- Proof boundary: source-level duplicate-registration invariant plus host-native compile/link and direct host-JSC execution of the remaining raw methods. This harness does not claim Nitro toObject()/prototype materialization proof, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, or RNGH native delivery.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

function assertRegistrationInvariant() {
	const generatedSpec = readProjectFile(
		"nitrogen/generated/shared/c++/HybridYogaNodeSpec.cpp",
	)
	const yogaNodeHeader = readProjectFile("cpp/YogaNode.hpp")
	const prototypeHeader = readProjectFile(
		"node_modules/react-native-nitro-modules/cpp/prototype/Prototype.hpp",
	)

	const generatedMethods = extractRegistrations(
		generatedSpec,
		/registerHybridMethod\("([^"]+)"/g,
	)
	const manualRawMethods = extractRegistrations(
		yogaNodeHeader,
		/registerRawHybridMethod\("([^"]+)"/g,
	)
	const duplicates = manualRawMethods.filter((name) =>
		generatedMethods.includes(name),
	)

	assert(
		generatedMethods.includes("setStyle"),
		"HybridYogaNodeSpec must keep the generated JS-facing setStyle(style) method.",
	)
	assert(
		!manualRawMethods.includes("setStyle"),
		"YogaNode must not manually register a raw setStyle method while HybridYogaNodeSpec registers generated setStyle.",
	)
	assert(
		manualRawMethods.includes("hitTest"),
		"YogaNode must keep the manual raw hitTest method.",
	)
	assert(
		manualRawMethods.includes("setInteractionConfig"),
		"YogaNode must keep the manual raw setInteractionConfig method.",
	)
	assert(
		yogaNodeHeader.includes("HybridYogaNodeSpec::loadHybridMethods();"),
		"YogaNode must still load generated HybridYogaNodeSpec methods.",
	)
	assert(
		prototypeHeader.includes("_methods.contains(name)") &&
			prototypeHeader.includes("Cannot add Hybrid Method"),
		"Nitro Prototype duplicate-method guard must remain present.",
	)
	assert(
		duplicates.length === 0,
		`Duplicate generated/manual YogaNode method registrations: ${duplicates.join(", ")}`,
	)
}

function extractRegistrations(source, regex) {
	return [...source.matchAll(regex)].map((match) => match[1])
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
			"Native linker reported success but the expected YogaNode JSI raw-method binary was not created.",
			`diagnostics:\n${formatVerifierTempDiagnostics(diagnosticPaths)}`,
		].join("\n\n"),
	)
}

function helperSourcePaths() {
	return [
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
			"Unable to locate RN Skia macOS archives required for YogaNode JSI raw-method verification.",
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
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>
#include <yoga/Yoga.h>

#include "JSCRuntime.h"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::HitSlopInsets;
using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::Overflow;
using margelo::nitro::RNSkiaYoga::PointerEventsMode;
using margelo::nitro::RNSkiaYoga::Position;
using margelo::nitro::RNSkiaYoga::YogaNode;
using margelo::nitro::RNSkiaYoga::YogaNodeLayout;

namespace {

class PrototypeProbeYogaNode : public YogaNode {
public:
    PrototypeProbeYogaNode()
        : margelo::nitro::HybridObject("YogaNode")
        , YogaNode()
    {
    }

    void exposeLoadHybridMethods()
    {
        loadHybridMethods();
    }
};

void expect(bool condition, const char* message)
{
    if (!condition) {
        std::cerr << "FAIL: " << message << "\n";
        std::abort();
    }
}

void expectNear(float actual, float expected, const char* message)
{
    if (std::fabs(actual - expected) > 0.001f) {
        std::cerr << "FAIL: " << message << " expected=" << expected << " actual=" << actual << "\n";
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

struct InteractionStateSnapshot {
    PointerEventsMode pointerEvents;
    HitSlopInsets hitSlop;
    bool preciseHit;
    bool selfInteractive;
    int interactiveDescendantCount;
    double eventTag;
};

InteractionStateSnapshot captureInteractionState(const YogaNode& node)
{
    return InteractionStateSnapshot {
        .pointerEvents = node._pointerEvents,
        .hitSlop = node._hitSlop,
        .preciseHit = node._preciseHit,
        .selfInteractive = node._selfInteractive,
        .interactiveDescendantCount = node._interactiveDescendantCount,
        .eventTag = node._eventTag,
    };
}

void expectInteractionStatePreserved(
    const YogaNode& node,
    const InteractionStateSnapshot& state,
    int parentInteractiveDescendantCount,
    const YogaNode* parent,
    const char* message)
{
    expect(node._pointerEvents == state.pointerEvents, (std::string(message) + " preserves pointerEvents").c_str());
    expectNear(node._hitSlop.top, state.hitSlop.top, (std::string(message) + " preserves hitSlop top").c_str());
    expectNear(node._hitSlop.right, state.hitSlop.right, (std::string(message) + " preserves hitSlop right").c_str());
    expectNear(node._hitSlop.bottom, state.hitSlop.bottom, (std::string(message) + " preserves hitSlop bottom").c_str());
    expectNear(node._hitSlop.left, state.hitSlop.left, (std::string(message) + " preserves hitSlop left").c_str());
    expect(node._preciseHit == state.preciseHit, (std::string(message) + " preserves preciseHit").c_str());
    expect(node._selfInteractive == state.selfInteractive, (std::string(message) + " preserves selfInteractive").c_str());
    expect(node._interactiveDescendantCount == state.interactiveDescendantCount, (std::string(message) + " preserves interactive count").c_str());
    expectNear(node._eventTag, state.eventTag, (std::string(message) + " preserves eventTag").c_str());
    if (parent != nullptr) {
        expect(
            parent->_interactiveDescendantCount == parentInteractiveDescendantCount,
            (std::string(message) + " preserves parent interactive count").c_str());
    }
}

struct HitTestStateSnapshot {
    InteractionStateSnapshot interaction;
    bool hasLayoutBeenComputed;
    YogaNodeLayout layout;
    int parentInteractiveDescendantCount;
};

HitTestStateSnapshot captureHitTestState(const YogaNode& node, const YogaNode* parent)
{
    return HitTestStateSnapshot {
        .interaction = captureInteractionState(node),
        .hasLayoutBeenComputed = node._hasLayoutBeenComputed,
        .layout = node._layout,
        .parentInteractiveDescendantCount = parent == nullptr ? 0 : parent->_interactiveDescendantCount,
    };
}

void expectHitTestStatePreserved(
    const YogaNode& node,
    const HitTestStateSnapshot& state,
    const YogaNode* parent,
    const char* message)
{
    expectInteractionStatePreserved(
        node,
        state.interaction,
        state.parentInteractiveDescendantCount,
        parent,
        message);
    expect(
        node._hasLayoutBeenComputed == state.hasLayoutBeenComputed,
        (std::string(message) + " preserves layout-computed flag").c_str());
    expectNear(node._layout.left, state.layout.left, (std::string(message) + " preserves layout left").c_str());
    expectNear(node._layout.right, state.layout.right, (std::string(message) + " preserves layout right").c_str());
    expectNear(node._layout.top, state.layout.top, (std::string(message) + " preserves layout top").c_str());
    expectNear(node._layout.bottom, state.layout.bottom, (std::string(message) + " preserves layout bottom").c_str());
    expectNear(node._layout.width, state.layout.width, (std::string(message) + " preserves layout width").c_str());
    expectNear(node._layout.height, state.layout.height, (std::string(message) + " preserves layout height").c_str());
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

jsi::Object makeStyle(jsi::Runtime& runtime, double width, double height)
{
    jsi::Object style(runtime);
    style.setProperty(runtime, "width", width);
    style.setProperty(runtime, "height", height);
    return style;
}

jsi::Object makeHitSlopObject(
    jsi::Runtime& runtime,
    double left,
    double right,
    double top,
    double bottom,
    double horizontal,
    double vertical)
{
    jsi::Object hitSlop(runtime);
    hitSlop.setProperty(runtime, "left", left);
    hitSlop.setProperty(runtime, "right", right);
    hitSlop.setProperty(runtime, "top", top);
    hitSlop.setProperty(runtime, "bottom", bottom);
    hitSlop.setProperty(runtime, "horizontal", horizontal);
    hitSlop.setProperty(runtime, "vertical", vertical);
    return hitSlop;
}

jsi::Object makeConfig(
    jsi::Runtime& runtime,
    double eventTag,
    const char* pointerEvents,
    bool preciseHit)
{
    jsi::Object config(runtime);
    config.setProperty(runtime, "eventTag", eventTag);
    config.setProperty(runtime, "pointerEvents", pointerEvents);
    config.setProperty(runtime, "preciseHit", preciseHit);
    return config;
}

void callSetInteraction(
    YogaNode& node,
    jsi::Runtime& runtime,
    const jsi::Object& config)
{
    jsi::Value args[] = {jsi::Value(runtime, config)};
    node.setInteractionConfig(runtime, jsi::Value::undefined(), args, 1);
}

double callHitTest(
    YogaNode& node,
    jsi::Runtime& runtime,
    double x,
    double y)
{
    jsi::Value args[] = {jsi::Value(x), jsi::Value(y)};
    auto result = node.hitTest(runtime, jsi::Value::undefined(), args, 2);
    expect(result.isNumber(), "hitTest must return a number");
    return result.asNumber();
}

template <typename ConfigureHitSlop>
void expectInvalidHitSlopPreservesState(
    YogaNode& node,
    jsi::Runtime& runtime,
    const YogaNode* parent,
    ConfigureHitSlop&& configureHitSlop,
    const char* message)
{
    const auto state = captureInteractionState(node);
    const auto parentInteractiveDescendantCount = parent == nullptr ? 0 : parent->_interactiveDescendantCount;
    auto config = makeConfig(runtime, 99.0, "none", false);
    configureHitSlop(config);
    expectThrows(
        [&]() {
            callSetInteraction(node, runtime, config);
        },
        "finite native float",
        message);
    expectInteractionStatePreserved(node, state, parentInteractiveDescendantCount, parent, message);
}

void expectInvalidHitTestPreservesState(
    YogaNode& node,
    jsi::Runtime& runtime,
    const YogaNode* parent,
    double x,
    double y,
    const std::string& messageSubstring,
    const char* message)
{
    const auto state = captureHitTestState(node, parent);
    expectThrows(
        [&]() {
            jsi::Value args[] = {jsi::Value(x), jsi::Value(y)};
            node.hitTest(runtime, jsi::Value::undefined(), args, 2);
        },
        messageSubstring,
        message);
    expectHitTestStatePreserved(node, state, parent, message);
}

} // namespace

int main()
{
    std::cerr << "probe: exercise loadHybridMethods" << std::endl;
    {
        PrototypeProbeYogaNode prototypeProbe;
        prototypeProbe.exposeLoadHybridMethods();
    }

    std::cerr << "probe: create JSC runtime" << std::endl;
    auto runtime = facebook::jsc::makeJSCRuntime();
    std::cerr << "probe: create YogaNode" << std::endl;
    auto node = std::make_shared<YogaNode>();

    std::cerr << "probe: exercise generated setStyle" << std::endl;
    auto style = makeStyle(*runtime, 80.0, 40.0);
    jsi::Value styleValue(*runtime, style);
    const auto convertedStyle = margelo::nitro::JSIConverter<NodeStyle>::fromJSI(*runtime, styleValue);
    node->setStyle(convertedStyle);
    expect(node->_style.width.has_value(), "generated setStyle must populate native width");
    expect(node->_style.height.has_value(), "generated setStyle must populate native height");
    expectNear(std::get<double>(*node->_style.width), 80.0, "generated setStyle width");
    expectNear(std::get<double>(*node->_style.height), 40.0, "generated setStyle height");

    std::cerr << "probe: exercise numeric setInteractionConfig and hitTest" << std::endl;
    auto numericConfig = makeConfig(*runtime, 11.0, "auto", false);
    numericConfig.setProperty(*runtime, "hitSlop", 4.0);
    callSetInteraction(*node, *runtime, numericConfig);
    expect(node->_pointerEvents == PointerEventsMode::AUTO, "numeric config pointerEvents auto");
    expectNear(node->_hitSlop.top, 4.0f, "numeric hitSlop top");
    expectNear(node->_hitSlop.right, 4.0f, "numeric hitSlop right");
    expectNear(node->_hitSlop.bottom, 4.0f, "numeric hitSlop bottom");
    expectNear(node->_hitSlop.left, 4.0f, "numeric hitSlop left");
    expect(!node->_preciseHit, "numeric config preciseHit false");
    expectNear(node->_eventTag, 11.0, "numeric config eventTag");
    expect(node->_selfInteractive, "positive eventTag marks node interactive");
    expect(node->_interactiveDescendantCount == 1, "positive eventTag increments interactive count once");

    expectNear(callHitTest(*node, *runtime, 10.0, 10.0), 11.0, "valid hitTest inside node");
    expectNear(callHitTest(*node, *runtime, -3.0, -3.0), 11.0, "valid hitTest inside numeric hitSlop");

    std::cerr << "probe: exercise object setInteractionConfig and hitTest" << std::endl;
    auto objectConfig = makeConfig(*runtime, 12.0, "box-only", true);
    objectConfig.setProperty(
        *runtime,
        "hitSlop",
        makeHitSlopObject(*runtime, 1.0, 6.0, 2.0, 4.0, 3.0, 5.0));
    callSetInteraction(*node, *runtime, objectConfig);
    expect(node->_pointerEvents == PointerEventsMode::BOX_ONLY, "object config pointerEvents box-only");
    expectNear(node->_hitSlop.left, 4.0f, "object hitSlop left plus horizontal");
    expectNear(node->_hitSlop.right, 9.0f, "object hitSlop right plus horizontal");
    expectNear(node->_hitSlop.top, 7.0f, "object hitSlop top plus vertical");
    expectNear(node->_hitSlop.bottom, 9.0f, "object hitSlop bottom plus vertical");
    expect(node->_preciseHit, "object config preciseHit true");
    expectNear(node->_eventTag, 12.0, "object config eventTag");
    expect(node->_interactiveDescendantCount == 1, "eventTag update must not double-count interactivity");
    expectNear(callHitTest(*node, *runtime, -3.0, -6.0), 12.0, "valid hitTest inside object hitSlop");

    auto parent = std::make_shared<YogaNode>();
    parent->insertChild(node, std::nullopt);
    expect(parent->_interactiveDescendantCount == 1, "parent observes interactive child before invalid hitSlop updates");

    std::cerr << "probe: reject invalid hitSlop without mutating interaction state" << std::endl;
    const auto nan = std::numeric_limits<double>::quiet_NaN();
    const auto infinity = std::numeric_limits<double>::infinity();
    const auto nativeFloatOverflow = std::numeric_limits<double>::max();
    const auto combinedOverflow = 2.0e38;

    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            config.setProperty(*runtime, "hitSlop", nan);
        },
        "scalar NaN hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            config.setProperty(*runtime, "hitSlop", infinity);
        },
        "scalar Infinity hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            config.setProperty(*runtime, "hitSlop", -infinity);
        },
        "scalar -Infinity hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            config.setProperty(*runtime, "hitSlop", nativeFloatOverflow);
        },
        "scalar native-float overflow hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "left", nan);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object left NaN hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "right", infinity);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object right Infinity hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "top", -infinity);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object top -Infinity hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "bottom", nativeFloatOverflow);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object bottom native-float overflow hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "horizontal", infinity);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object horizontal Infinity hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "vertical", -infinity);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object vertical -Infinity hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "left", combinedOverflow);
            hitSlop.setProperty(*runtime, "horizontal", combinedOverflow);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object horizontal combined overflow hitSlop must preserve interaction state");
    expectInvalidHitSlopPreservesState(
        *node,
        *runtime,
        parent.get(),
        [&](jsi::Object& config) {
            jsi::Object hitSlop(*runtime);
            hitSlop.setProperty(*runtime, "top", -combinedOverflow);
            hitSlop.setProperty(*runtime, "vertical", -combinedOverflow);
            config.setProperty(*runtime, "hitSlop", hitSlop);
        },
        "object vertical combined overflow hitSlop must preserve interaction state");

    std::cerr << "probe: exercise pointerEvents none and reset" << std::endl;
    auto noneConfig = makeConfig(*runtime, 13.0, "none", false);
    noneConfig.setProperty(*runtime, "hitSlop", 0.0);
    callSetInteraction(*node, *runtime, noneConfig);
    expect(node->_pointerEvents == PointerEventsMode::NONE, "pointerEvents none parsed");
    expectNear(callHitTest(*node, *runtime, 10.0, 10.0), 0.0, "pointerEvents none suppresses hitTest");

    auto resetConfig = makeConfig(*runtime, 0.0, "auto", false);
    resetConfig.setProperty(*runtime, "hitSlop", 0.0);
    callSetInteraction(*node, *runtime, resetConfig);
    expect(!node->_selfInteractive, "eventTag zero clears self interactive state");
    expect(node->_interactiveDescendantCount == 0, "eventTag zero decrements interactive count");
    expect(parent->_interactiveDescendantCount == 0, "eventTag zero decrements parent interactive count");

    std::cerr << "probe: exercise invalid raw inputs" << std::endl;
    expectThrows(
        [&]() {
            jsi::Value args[] = {jsi::Value(42.0)};
            node->setInteractionConfig(*runtime, jsi::Value::undefined(), args, 1);
        },
        "expects a config object",
        "setInteractionConfig must reject non-object config");

    expectThrows(
        [&]() {
            auto x = jsi::String::createFromAscii(*runtime, "x");
            jsi::Value args[] = {jsi::Value(*runtime, x), jsi::Value(1.0)};
            node->hitTest(*runtime, jsi::Value::undefined(), args, 2);
        },
        "expects numeric x and y arguments",
        "hitTest must reject nonnumeric x");

    expectThrows(
        [&]() {
            jsi::Value args[] = {jsi::Value(1.0)};
            node->hitTest(*runtime, jsi::Value::undefined(), args, 1);
        },
        "expects numeric x and y arguments",
        "hitTest must reject missing y");

    std::cerr << "probe: reject invalid hitTest numeric values before implicit layout" << std::endl;
    node->_layout = YogaNodeLayout(1.0, 2.0, 3.0, 4.0, 5.0, 6.0);
    node->_hasLayoutBeenComputed = false;
    expectInvalidHitTestPreservesState(
        *node,
        *runtime,
        parent.get(),
        nan,
        1.0,
        "hitTest.x",
        "hitTest.x NaN must reject and preserve state");
    expectInvalidHitTestPreservesState(
        *node,
        *runtime,
        parent.get(),
        infinity,
        1.0,
        "hitTest.x",
        "hitTest.x Infinity must reject and preserve state");
    expectInvalidHitTestPreservesState(
        *node,
        *runtime,
        parent.get(),
        1.0,
        -infinity,
        "hitTest.y",
        "hitTest.y -Infinity must reject and preserve state");
    expectInvalidHitTestPreservesState(
        *node,
        *runtime,
        parent.get(),
        1.0,
        nativeFloatOverflow,
        "hitTest.y",
        "hitTest.y native-float overflow must reject and preserve state");

    std::cout << "YogaNode JSI raw-method host probe passed\n";
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
