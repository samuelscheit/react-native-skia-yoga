#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
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
const tmpDir = createVerifierTempDir("rnskia-animated-double-synchronizable-")

try {
	assertCurrentGapAndSourceShape()
	createNitroModulesShim(tmpDir)

	const probePath = path.join(tmpDir, "animated-double-synchronizable.cpp")
	const binaryPath = path.join(tmpDir, "animated-double-synchronizable")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-DNDEBUG",
		"-ferror-limit=20",
		"-include",
		projectPath("cpp/polyfill.h"),
		...includeFlags(tmpDir),
		probePath,
		...helperSourcePaths(),
		"-framework",
		"CoreFoundation",
		"-framework",
		"Foundation",
		"-framework",
		"JavaScriptCore",
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
				`${compiler} AnimatedDouble Synchronizable compile/link failed with exit code ${compileResult.status}.`,
				compileResult,
				[
					{ label: "AnimatedDouble Synchronizable temp root", targetPath: tmpDir },
					{ label: "probe source", targetPath: probePath },
					{ label: "binary output", targetPath: binaryPath },
					{ label: "binary output parent", targetPath: path.dirname(binaryPath) },
				],
			),
		)
	}

	assertLinkedBinary(binaryPath, [
		{ label: "AnimatedDouble Synchronizable temp root", targetPath: tmpDir },
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
				`Failed to execute AnimatedDouble Synchronizable binary: ${runResult.error.message}`,
				`diagnostics:\n${formatVerifierTempDiagnostics([
					{ label: "AnimatedDouble Synchronizable temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				])}`,
			].join("\n\n"),
		)
	}

	if (runResult.status !== 0) {
		throw new Error(
			formatFailure(
				`AnimatedDouble Synchronizable execution failed with exit code ${runResult.status}.`,
				runResult,
				[
					{ label: "AnimatedDouble Synchronizable temp root", targetPath: tmpDir },
					{ label: "binary output", targetPath: binaryPath },
				],
			),
		)
	}

	console.log("AnimatedDouble Synchronizable verifier passed:")
	console.log("- Source boundary confirmed: this verifier proves raw AnimatedDouble extraction/resolution, while the YogaNode command/render verifier separately owns selected dynamic Worklets-backed AnimatedDouble NodeCommand coverage.")
	console.log("- clang++ compiled and linked a host executable against real cpp/AnimatedDouble.cpp, React Native JSC/JSI, RN Skia RuntimeAwareCache, and real Worklets Serializable, Synchronizable, SynchronizableAccess, and WorkletRuntimeRegistry sources.")
	console.log("- The executable created a real Worklets Synchronizable, wrapped it in a SerializableJSRef NativeState JSI object, asserted JSIConverter<AnimatedDouble>::canConvert(...), extracted it with JSIConverter<AnimatedDouble>::fromJSI(...), and asserted AnimatedDouble::isDynamic().")
	console.log("- The executable asserted plain JS objects and non-Synchronizable Worklets SerializableJSRef objects are rejected with stable AnimatedDouble-owned failures.")
	console.log("- The executable asserted AnimatedDouble::resolve() returns fallback while RN Skia's main runtime is unset, then resolves the Synchronizable getBlocking() numeric value after BaseRuntimeAwareCache::setMainJsRuntime(runtime).")
	console.log("- The executable mutated the Synchronizable with setBlocking(...) and asserted AnimatedDouble::resolve() observes the updated number.")
	console.log("- Proof boundary: host-JSC/native Worklets Synchronizable extraction into AnimatedDouble, canConvert(...), dynamic flag behavior, getBlocking() numeric resolution through RN Skia main runtime, fallback with no main runtime, mutation observation, and stable local rejection paths only. This does not prove UI-runtime Worklets execution, Reanimated SharedValue delivery, executeOnUIRuntimeSync, real JS listener scheduling, RNGH delivery, Nitro module registry install, React Native runtime integration, iOS/Android app build/run, simulator/device launch, native platform presentation, image asset/decoding/loading, exact render fidelity, or command-converter integration.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

function assertCurrentGapAndSourceShape() {
	const animatedCpp = readProjectFile("cpp/AnimatedDouble.cpp")
	const animatedHeader = readProjectFile("cpp/JSIConverter+AnimatedDouble.hpp")
	const reconcilerVerifier = readProjectFile(
		"scripts/verify-reconciler-animated-bindings.mjs",
	)
	const commandVerifier = readProjectFile(
		"scripts/verify-yoganode-native-commands-render.mjs",
	)
	const workletsModuleProxy = readProjectFile(
		"node_modules/react-native-worklets/Common/cpp/worklets/NativeModules/JSIWorkletsModuleProxy.cpp",
	)
	const synchronizableCpp = readProjectFile(
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Synchronizable.cpp",
	)
	const serializableHeader = readProjectFile(
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Serializable.h",
	)
	const runtimeAwareCache = readProjectFile(
		"node_modules/@shopify/react-native-skia/cpp/jsi/RuntimeAwareCache.h",
	)

	assert(
		reconcilerVerifier.includes("createSynchronizable") &&
			reconcilerVerifier.includes("native mirror"),
		"Reconciler animated binding verifier must still be a JS mirror/source-level check.",
	)
	assert(
		commandVerifier.includes("selected dynamic Worklets-backed AnimatedDouble NodeCommand"),
		"Command/render verifier must explicitly own selected dynamic Worklets-backed AnimatedDouble NodeCommand coverage.",
	)
	assert(
		animatedHeader.includes("AnimatedDouble") &&
			animatedHeader.includes("extractAnimatedSynchronizable") &&
			animatedHeader.includes("canExtractAnimatedSynchronizable") &&
			animatedHeader.includes("resolveAnimatedSynchronizable"),
		"AnimatedDouble converter surface must expose extraction and resolution helpers.",
	)
	assert(
		animatedCpp.includes("SerializableJSRef") &&
			animatedCpp.includes("Worklets Synchronizable") &&
			animatedCpp.includes("BaseRuntimeAwareCache::getMainJsRuntime") &&
			animatedCpp.includes("getBlocking()"),
		"AnimatedDouble.cpp must own Worklets SerializableJSRef extraction and getBlocking resolution.",
	)
	assert(
		workletsModuleProxy.includes("createSynchronizable") &&
			workletsModuleProxy.includes("std::make_shared<Synchronizable>") &&
			workletsModuleProxy.includes("SerializableJSRef::newNativeStateObject"),
		"Worklets module proxy must still create Synchronizable values as SerializableJSRef NativeState objects.",
	)
	assert(
		synchronizableCpp.includes("Synchronizable::getBlocking()") &&
			synchronizableCpp.includes("Synchronizable::setBlocking") &&
			synchronizableCpp.includes("extractSynchronizableOrThrow"),
		"Worklets Synchronizable source must still provide getBlocking, setBlocking, and extraction behavior.",
	)
	assert(
		serializableHeader.includes("class SerializableJSRef") &&
			serializableHeader.includes("newNativeStateObject"),
		"Worklets SerializableJSRef must still be the NativeState wrapper.",
	)
	assert(
		runtimeAwareCache.includes("setMainJsRuntime") &&
			runtimeAwareCache.includes("getMainJsRuntime"),
		"RN Skia RuntimeAwareCache must still own main JS runtime access.",
	)
}

function helperSourcePaths() {
	return [
		"cpp/AnimatedDouble.cpp",
		"node_modules/react-native/ReactCommon/jsi/jsi/jsi.cpp",
		"node_modules/react-native/ReactCommon/jsi/jsi/jsilib-posix.cpp",
		"node_modules/react-native/ReactCommon/jsc/JSCRuntime.cpp",
		"node_modules/@shopify/react-native-skia/cpp/jsi/RuntimeAwareCache.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Serializable.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/Synchronizable.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/SharedItems/SynchronizableAccess.cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets/Registries/WorkletRuntimeRegistry.cpp",
	].map(projectPathChecked)
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

function walkFiles(directory, predicate) {
	if (!existsSync(directory) || !statSync(directory).isDirectory()) {
		throw new Error(`Missing required directory: ${path.relative(rootDir, directory)}`)
	}

	const files = []
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			files.push(...walkFiles(entryPath, predicate))
		} else if (entry.isFile() && predicate(entryPath)) {
			files.push(entryPath)
		}
	}

	return files
}

function includeFlags(shimDir) {
	return [
		"cpp",
		shimDir,
		"node_modules/react-native-nitro-modules/cpp/core",
		"node_modules/react-native-nitro-modules/cpp/entrypoint",
		"node_modules/react-native-nitro-modules/cpp/jsi",
		"node_modules/react-native-nitro-modules/cpp/prototype",
		"node_modules/react-native-nitro-modules/cpp/templates",
		"node_modules/react-native-nitro-modules/cpp/utils",
		"node_modules/react-native-nitro-modules/cpp/platform",
		"node_modules/react-native-nitro-modules/cpp/threading",
		"node_modules/react-native/ReactCommon",
		"node_modules/react-native/ReactCommon/jsc",
		"node_modules/react-native/ReactCommon/jsi",
		"node_modules/react-native-worklets/Common/cpp",
		"node_modules/react-native-worklets/Common/cpp/worklets",
		"node_modules/@shopify/react-native-skia/cpp/jsi",
	].flatMap((includePath) => [
		"-I",
		path.isAbsolute(includePath) ? includePath : projectPath(includePath),
	])
}

function nativeProbeSource() {
	return String.raw`
#include <cmath>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <memory>
#include <optional>
#include <sstream>
#include <string>

#include <jsi/jsi.h>

#include "JSCRuntime.h"
#include "JSIConverter+AnimatedDouble.hpp"
#include "RuntimeAwareCache.h"
#include "SharedItems/Serializable.h"
#include "SharedItems/Synchronizable.h"

using margelo::nitro::RNSkiaYoga::AnimatedDouble;

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

void expectNear(double actual, double expected, const std::string& message)
{
    if (std::fabs(actual - expected) > 0.001) {
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

template <typename Fn>
void expectThrows(Fn&& fn, const std::string& expectedSubstring, const std::string& message)
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

jsi::Value makePlainObjectValue(jsi::Runtime& runtime)
{
    jsi::Object object(runtime);
    object.setProperty(runtime, "not", "a synchronizable");
    return jsi::Value(runtime, object);
}

jsi::Value makeWrongSerializableRefValue(jsi::Runtime& runtime)
{
    return worklets::makeSerializableNumber(runtime, 91.0);
}

void assertStaticNumericFallback(jsi::Runtime& runtime)
{
    jsi::Value numericValue(14.25);
    expect(
        margelo::nitro::JSIConverter<AnimatedDouble>::canConvert(runtime, numericValue),
        "AnimatedDouble canConvert must accept static numbers");

    auto animated = margelo::nitro::JSIConverter<AnimatedDouble>::fromJSI(runtime, numericValue);
    expect(!animated.isDynamic(), "numeric AnimatedDouble must not be dynamic");
    expectOptionalNear(animated.resolve(), 14.25, "numeric AnimatedDouble resolve");
}

void assertStableRejections(jsi::Runtime& runtime)
{
    auto plainObject = makePlainObjectValue(runtime);
    expect(
        !margelo::nitro::JSIConverter<AnimatedDouble>::canConvert(runtime, plainObject),
        "AnimatedDouble canConvert must reject plain JS objects");
    expectThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<AnimatedDouble>::fromJSI(runtime, plainObject);
        },
        "Worklets SerializableJSRef",
        "AnimatedDouble conversion must reject plain JS objects with source-owned failure");

    auto wrongSerializable = makeWrongSerializableRefValue(runtime);
    expect(wrongSerializable.isObject(), "wrong Serializable test value must be a Worklets SerializableJSRef object");
    auto wrongSerializableValue = worklets::extractSerializableOrThrow(runtime, wrongSerializable);
    expect(
        wrongSerializableValue->valueType() == worklets::Serializable::NumberType,
        "wrong Serializable test value must carry a Worklets Number serializable");
    expect(
        std::dynamic_pointer_cast<worklets::Synchronizable>(wrongSerializableValue) == nullptr,
        "wrong Serializable test value must not already be a Synchronizable");
    expect(
        !margelo::nitro::RNSkiaYoga::canExtractAnimatedSynchronizable(runtime, wrongSerializable),
        "canExtractAnimatedSynchronizable must reject non-Synchronizable SerializableJSRef values");
    expect(
        !margelo::nitro::JSIConverter<AnimatedDouble>::canConvert(runtime, wrongSerializable),
        "AnimatedDouble canConvert must reject non-Synchronizable SerializableJSRef values");
    expectThrows(
        [&]() {
            (void)margelo::nitro::JSIConverter<AnimatedDouble>::fromJSI(runtime, wrongSerializable);
        },
        "Worklets Synchronizable",
        "AnimatedDouble conversion must reject wrong Worklets Serializable type with source-owned failure");
}

void assertDynamicSynchronizableResolution(jsi::Runtime& runtime)
{
    auto synchronizable = makeSynchronizable(runtime, 12.5);
    auto synchronizableValue = makeSynchronizableRefValue(runtime, synchronizable);

    expect(
        margelo::nitro::RNSkiaYoga::canExtractAnimatedSynchronizable(runtime, synchronizableValue),
        "canExtractAnimatedSynchronizable must accept real Worklets Synchronizable NativeState object");
    auto directExtracted = margelo::nitro::RNSkiaYoga::extractAnimatedSynchronizable(
        runtime,
        synchronizableValue);
    expect(directExtracted.get() == synchronizable.get(), "direct AnimatedDouble extraction must preserve Synchronizable identity");

    expect(
        margelo::nitro::JSIConverter<AnimatedDouble>::canConvert(runtime, synchronizableValue),
        "AnimatedDouble canConvert must accept real Worklets Synchronizable NativeState object");
    auto animated = margelo::nitro::JSIConverter<AnimatedDouble>::fromJSI(runtime, synchronizableValue);
    expect(animated.isDynamic(), "AnimatedDouble extracted from Synchronizable must be dynamic");
    expect(animated.synchronizable.get() == synchronizable.get(), "AnimatedDouble must retain the extracted Synchronizable");
    expect(!animated.value.has_value(), "Synchronizable-only AnimatedDouble must not invent a fallback value");

    AnimatedDouble withFallback = animated;
    withFallback.value = 7.75;
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    expectOptionalNear(
        withFallback.resolve(),
        7.75,
        "dynamic AnimatedDouble resolve while main runtime is unset must return fallback");

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(&runtime);
    auto blockingValue = synchronizable->getBlocking()->toJSValue(runtime);
    expect(blockingValue.isNumber(), "Synchronizable getBlocking() must convert current value to a JS number");
    expectNear(blockingValue.asNumber(), 12.5, "Synchronizable getBlocking JS number");
    expectOptionalNear(
        withFallback.resolve(),
        12.5,
        "dynamic AnimatedDouble resolve with main runtime must read Synchronizable value");

    auto resolvedJSValue = margelo::nitro::JSIConverter<AnimatedDouble>::toJSI(runtime, withFallback);
    expect(resolvedJSValue.isNumber(), "AnimatedDouble toJSI must emit the resolved dynamic number");
    expectNear(resolvedJSValue.asNumber(), 12.5, "AnimatedDouble toJSI resolved dynamic number");

    synchronizable->setBlocking(makeSerializableNumberValue(runtime, 42.25));
    auto updatedBlockingValue = synchronizable->getBlocking()->toJSValue(runtime);
    expect(updatedBlockingValue.isNumber(), "Synchronizable updated getBlocking() value must convert to a JS number");
    expectNear(updatedBlockingValue.asNumber(), 42.25, "Synchronizable updated getBlocking JS number");
    expectOptionalNear(
        withFallback.resolve(),
        42.25,
        "dynamic AnimatedDouble resolve must observe Synchronizable setBlocking mutation");
}

} // namespace

int main()
{
    auto runtime = facebook::jsc::makeJSCRuntime();
    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);

    assertStaticNumericFallback(*runtime);
    assertStableRejections(*runtime);
    assertDynamicSynchronizableResolution(*runtime);

    RNJsi::BaseRuntimeAwareCache::setMainJsRuntime(nullptr);
    std::cout << "AnimatedDouble Synchronizable host probe passed\n";
    return 0;
}
`
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
			"Native linker reported success but the expected AnimatedDouble Synchronizable binary was not created.",
			`diagnostics:\n${formatVerifierTempDiagnostics(diagnosticPaths)}`,
		].join("\n\n"),
	)
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
