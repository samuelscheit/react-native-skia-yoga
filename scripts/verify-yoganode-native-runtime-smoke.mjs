#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync, existsSync, readdirSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = mkdtempSync(path.join(tmpdir(), "rnskia-yoganode-runtime-"))

try {
	createNitroModulesShim(tmpDir)

	const probePath = path.join(tmpDir, "yoganode-runtime-smoke.cpp")
	const binaryPath = path.join(tmpDir, "yoganode-runtime-smoke")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const compileArgs = [
		"-std=c++20",
		"-ferror-limit=20",
		"-ffunction-sections",
		"-fdata-sections",
		"-Wl,-dead_strip",
		// YogaNode.cpp shares a translation unit with generated/JNI/JSI-facing entry points that are
		// unreachable in this host-only smoke probe. dynamic_lookup keeps those unentered paths lazy,
		// but the exercised lifetime/reparenting code still must resolve against the real Yoga, Nitro,
		// JSI, React Native Skia helper objects, and macOS Skia archives below.
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
		throw new Error(formatFailure(`${compiler} native runtime smoke compile/link failed with exit code ${compileResult.status}.`, compileResult))
	}

	const runResult = spawnSync(binaryPath, [], {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (runResult.error) {
		throw new Error(`Failed to execute YogaNode native runtime smoke binary: ${runResult.error.message}`)
	}

	if (runResult.status !== 0) {
		throw new Error(formatFailure(`YogaNode native runtime smoke execution failed with exit code ${runResult.status}.`, runResult))
	}

	console.log("YogaNode native runtime smoke passed:")
	console.log("- clang++ compiled and linked a host executable against real YogaNode.cpp, upstream Yoga sources, RN Skia macOS archives, and the minimal helper sources required for object emission.")
	console.log("- The executable asserted retained-descendant teardown cleanup, post-teardown mutation safety, and reparent ownership consistency across vector links and Yoga native parents.")
	console.log("- -Wl,-undefined,dynamic_lookup is limited to unentered host-incompatible entry points in the shared translation unit; the exercised lifetime/reparenting path still resolves and executes for real.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

function formatFailure(prefix, result) {
	const stdout = result.stdout.trim()
	const stderr = result.stderr.trim()
	const signal = result.signal == null ? "" : `\n\nsignal: ${result.signal}`
	return [
		prefix,
		stdout ? `stdout:\n${stdout}` : "",
		stderr ? `stderr:\n${stderr}` : "",
		signal,
	].filter(Boolean).join("\n\n")
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
	const skiaLibDir = projectPath("node_modules/@shopify/react-native-skia/libs/macos")
	return walkFiles(skiaLibDir, (entryPath) => entryPath.endsWith(".a")).sort()
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
#include <iostream>
#include <memory>
#include <optional>
#include <variant>
#include <vector>
#include <yoga/Yoga.h>

#include "HybridYogaNodeSpec.cpp"
#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::YogaNode;

namespace {

void expect(bool condition, const char* message)
{
    if (!condition) {
        std::cerr << "FAIL: " << message << "\n";
        std::abort();
    }
}

void retainedDescendantSurvivesAncestorTeardown()
{
    std::shared_ptr<YogaNode> retainedGrandchild;

    {
        auto root = std::make_shared<YogaNode>();
        auto child = std::make_shared<YogaNode>();
        auto grandchild = std::make_shared<YogaNode>();

        root->insertChild(child, std::nullopt);
        child->insertChild(grandchild, std::nullopt);

        expect(root->_children.size() == 1, "root owns child before teardown");
        expect(YGNodeGetChildCount(root->_node) == 1, "root Yoga tree owns child before teardown");
        expect(child->_children.size() == 1, "child owns grandchild before teardown");
        expect(YGNodeGetChildCount(child->_node) == 1, "child Yoga tree owns grandchild before teardown");
        expect(grandchild->_parent.lock().get() == child.get(), "grandchild weak parent points at child before teardown");
        expect(YGNodeGetParent(grandchild->_node) == child->_node, "grandchild Yoga parent points at child before teardown");

        retainedGrandchild = grandchild;
        child.reset();
        grandchild.reset();
        root.reset();
    }

    expect(retainedGrandchild != nullptr, "retained grandchild stays alive after ancestor teardown");
    expect(retainedGrandchild->_node != nullptr, "retained grandchild keeps its Yoga node");
    expect(retainedGrandchild->_parent.expired(), "retained grandchild clears weak parent after ancestor teardown");
    expect(YGNodeGetParent(retainedGrandchild->_node) == nullptr, "retained grandchild clears Yoga parent after ancestor teardown");
    expect(retainedGrandchild->_children.empty(), "retained grandchild remains childless");
    expect(YGNodeGetChildCount(retainedGrandchild->_node) == 0, "retained grandchild Yoga node remains childless");

    retainedGrandchild->invalidateLayout();
    retainedGrandchild->invalidateRasterCache();
    retainedGrandchild->removeAllChildren();

    expect(retainedGrandchild->_children.empty(), "retained grandchild removeAllChildren stays a no-op");
    expect(YGNodeGetChildCount(retainedGrandchild->_node) == 0, "retained grandchild Yoga children stay empty after mutation");
}

void reparentingMovesOwnershipAcrossParents()
{
    auto firstParent = std::make_shared<YogaNode>();
    auto secondParent = std::make_shared<YogaNode>();
    auto child = std::make_shared<YogaNode>();

    firstParent->insertChild(child, std::nullopt);

    expect(firstParent->_children.size() == 1, "first parent owns child after initial insert");
    expect(YGNodeGetChildCount(firstParent->_node) == 1, "first parent Yoga tree owns child after initial insert");
    expect(child->_parent.lock().get() == firstParent.get(), "child weak parent points at first parent after initial insert");
    expect(YGNodeGetParent(child->_node) == firstParent->_node, "child Yoga parent points at first parent after initial insert");

    secondParent->insertChild(child, std::nullopt);

    expect(firstParent->_children.empty(), "reparent clears old parent child vector");
    expect(YGNodeGetChildCount(firstParent->_node) == 0, "reparent clears old parent Yoga child count");
    expect(secondParent->_children.size() == 1, "reparent inserts child into new parent vector");
    expect(secondParent->_children[0] == child, "reparent keeps shared child identity in new parent vector");
    expect(YGNodeGetChildCount(secondParent->_node) == 1, "reparent inserts child into new parent Yoga tree");
    expect(child->_parent.lock().get() == secondParent.get(), "reparent updates child weak parent");
    expect(YGNodeGetParent(child->_node) == secondParent->_node, "reparent updates child Yoga parent");

    firstParent->removeAllChildren();

    expect(firstParent->_children.empty(), "old parent cleanup keeps old parent vector empty");
    expect(YGNodeGetChildCount(firstParent->_node) == 0, "old parent cleanup keeps old parent Yoga tree empty");
    expect(secondParent->_children.size() == 1, "old parent cleanup preserves new parent vector");
    expect(YGNodeGetChildCount(secondParent->_node) == 1, "old parent cleanup preserves new parent Yoga tree");
    expect(child->_parent.lock().get() == secondParent.get(), "old parent cleanup preserves child weak parent");
    expect(YGNodeGetParent(child->_node) == secondParent->_node, "old parent cleanup preserves child Yoga parent");

    child->invalidateLayout();
    child->invalidateRasterCache();
    secondParent->removeChild(child);

    expect(secondParent->_children.empty(), "removeChild clears new parent vector");
    expect(YGNodeGetChildCount(secondParent->_node) == 0, "removeChild clears new parent Yoga tree");
    expect(child->_parent.expired(), "removeChild clears child weak parent");
    expect(YGNodeGetParent(child->_node) == nullptr, "removeChild clears child Yoga parent");

    child->removeAllChildren();
    expect(child->_children.empty(), "detached child remains childless after cleanup");
    expect(YGNodeGetChildCount(child->_node) == 0, "detached child Yoga node remains childless after cleanup");
}

} // namespace

int main()
{
    retainedDescendantSurvivesAncestorTeardown();
    reparentingMovesOwnershipAcrossParents();
    std::cout << "YogaNode native runtime smoke passed\n";
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
