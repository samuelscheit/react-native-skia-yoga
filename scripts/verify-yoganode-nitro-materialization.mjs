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
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, generated HybridYogaNodeSpec.cpp, Nitro HybridObject/prototype/cache sources, platform ThreadUtils, React Native JSC, upstream Yoga sources, RN Skia macOS archives, Worklets shared-item sources, ColorParser, PlatformContextAccessor, AnimatedDouble, and Nitro/JSI helper sources.")
	console.log("- The executable created a shared YogaNode, called YogaNode::toObject(runtime), asserted the returned value is a JS object with NativeState wrapping the original YogaNode, and asserted repeated toObject(runtime) returns the cached JS object.")
	console.log("- The executable asserted generated prototype members setCommand, setStyle, computeLayout, and layout exist on the materialized object, then invoked generated JS-facing wrappers for setCommand(group), setStyle(width/height), computeLayout(width, height), and the layout getter.")
	console.log("- The executable asserted native side effects from generated calls: GroupCmd installation/rasterize state, NodeStyle width/height state, Yoga layout computation, and generated layout getter values.")
	console.log("- Proof boundary: host-JSC Nitro YogaNode toObject/prototype materialization and selected generated YogaNode method/getter execution only; this does not prove Nitro module registry install, React Native runtime integration, iOS/Android app build/run, simulator/device launch, native platform presentation, UI-runtime Worklets execution, RNGH native delivery, dynamic Worklets-backed AnimatedDouble, image assets/decoding/loading, or exact render fidelity.")
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
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <memory>
#include <optional>
#include <string>
#include <variant>

#include <jsi/jsi.h>
#include <yoga/Yoga.h>

#include "JSCRuntime.h"
#include "RuntimeAwareCache.h"
#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::GroupCmd;
using margelo::nitro::RNSkiaYoga::HybridYogaNodeSpec;
using margelo::nitro::RNSkiaYoga::NodeStyle;
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
    expect(object.hasProperty(runtime, name), "materialized object must expose generated member");
    const auto value = object.getProperty(runtime, name);
    expect(value.isObject(), "generated member must be an object");
    expect(value.asObject(runtime).isFunction(runtime), "generated member must be a function");
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

double getNumberProperty(jsi::Runtime& runtime, const jsi::Object& object, const char* name)
{
    const auto value = object.getProperty(runtime, name);
    expect(value.isNumber(), "layout property must be numeric");
    return value.asNumber();
}

} // namespace

int main()
{
    std::cerr << "probe: create JSC runtime" << std::endl;
    auto runtime = facebook::jsc::makeJSCRuntime();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(runtime.get());

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

    std::cerr << "probe: dispose materialized object before runtime teardown" << std::endl;
    auto dispose = object.getPropertyAsFunction(*runtime, "dispose");
    const jsi::Value* noArgs = nullptr;
    auto disposeResult = dispose.callWithThis(*runtime, object, noArgs, static_cast<size_t>(0));
    expect(disposeResult.isUndefined(), "generated base dispose must return undefined");
    node.reset();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);

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
