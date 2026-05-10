#!/usr/bin/env node

import { rmSync, writeFileSync, mkdirSync, symlinkSync, unlinkSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
	createVerifierTempDir,
	formatVerifierTempDiagnostics,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = createVerifierTempDir("rnskia-yoganode-lifetime-")

try {
	const yogaNodeCpp = readProjectFile("cpp/YogaNode.cpp")
	const yogaNodeHpp = readProjectFile("cpp/YogaNode.hpp")

	verifySourceInvariants(yogaNodeCpp, yogaNodeHpp)
	createNitroModulesShim(tmpDir)

	const probePath = path.join(tmpDir, "yoganode-lifetime-probe.cpp")
	writeFileSync(probePath, nativeProbeSource(), "utf8")

	const compiler = process.env.CXX || "clang++"
	const result = spawnSync(compiler, [
		"-std=c++20",
		"-fsyntax-only",
		"-ferror-limit=20",
		"-include",
		projectPath("cpp/polyfill.h"),
		...includeFlags(tmpDir),
		probePath,
	], {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (result.error) {
		throw new Error(`Failed to run ${compiler}: ${result.error.message}`)
	}

	if (result.status !== 0) {
		const stdout = result.stdout.trim()
		const stderr = result.stderr.trim()
		throw new Error([
			`${compiler} native syntax probe failed with exit code ${result.status}.`,
			`diagnostics:\n${formatVerifierTempDiagnostics([
				{ label: "YogaNode lifetime temp root", targetPath: tmpDir },
				{ label: "probe source", targetPath: probePath },
			])}`,
			stdout ? `stdout:\n${stdout}` : "",
			stderr ? `stderr:\n${stderr}` : "",
		].filter(Boolean).join("\n\n"))
	}

	console.log("YogaNode native lifetime verifier passed:")
	console.log("- clang++ -fsyntax-only accepted retained-descendant teardown and reparenting probe.")
	console.log("- Source invariants passed for weak parent links, destructor detach cleanup, reparent detach, and upward weak traversal.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

function readProjectFile(relativePath) {
	return readdirSafeFile(projectPath(relativePath), relativePath)
}

function readdirSafeFile(filePath, label) {
	if (!existsSync(filePath)) {
		throw new Error(`Missing required file: ${label}`)
	}
	return statSync(filePath).isFile()
		? readFileSync(filePath, "utf8")
		: (() => {
			throw new Error(`Expected file but found directory: ${label}`)
		})()
}

function verifySourceInvariants(yogaNodeCpp, yogaNodeHpp) {
	if (typeof yogaNodeCpp !== "string" || typeof yogaNodeHpp !== "string") {
		throw new Error("Source invariant verifier expected synchronous string file contents.")
	}

	assertIncludes(
		yogaNodeHpp,
		"std::weak_ptr<YogaNode> _parent;",
		"YogaNode::_parent must remain a weak_ptr so retained descendants cannot keep ancestors alive or dereference freed raw parents.",
	)

	const destructorBody = extractFunctionBody(yogaNodeCpp, "YogaNode::~YogaNode()")
	assertOrder(
		destructorBody,
		"detachAllChildren(*this, false);",
		"YGNodeFree(_node);",
		"YogaNode destructor must clear immediate child parent links before freeing its native Yoga node.",
	)

	const insertChildBody = extractFunctionBody(yogaNodeCpp, "void YogaNode::insertChild(")
	assertIncludes(
		insertChildBody,
		"if (isAncestorOrSelf(*yogaNode, *this))",
		"YogaNode::insertChild() must keep the cycle guard.",
	)
	assertOrder(
		insertChildBody,
		"detachChildFromParent(*oldParent, yogaNode);",
		"_children.insert(",
		"YogaNode::insertChild() must detach a live old parent before inserting into the new parent.",
	)
	assertOrder(
		insertChildBody,
		"YGNodeGetParent(yogaNode->_node) != nullptr",
		"_children.insert(",
		"YogaNode::insertChild() must reject orphaned Yoga native owners before mutating the new parent.",
	)
	assertOrder(
		insertChildBody,
		"_children.insert(",
		"YGNodeInsertChild(_node, yogaNode->_node, insertIndex);",
		"YogaNode::insertChild() must stage the owning child reference before native insertion rollback handling.",
	)
	assertOrder(
		insertChildBody,
		"YGNodeInsertChild(_node, yogaNode->_node, insertIndex);",
		"yogaNode->_parent = parentSelf;",
		"YogaNode::insertChild() must assign the weak parent only after native insertion succeeds.",
	)
	assertOrder(
		insertChildBody,
		"yogaNode->_parent = parentSelf;",
		"adjustInteractiveDescendantCount(yogaNode->_interactiveDescendantCount);",
		"YogaNode::insertChild() must propagate interactive descendants after assigning the new parent.",
	)

	const detachAllBody = extractFunctionBody(yogaNodeCpp, "void detachAllChildren(")
	assertIncludes(
		detachAllBody,
		"child->_parent.reset();",
		"detachAllChildren() must clear child parent links for destructor/remove-all cleanup.",
	)
	assertOrder(
		detachAllBody,
		"YGNodeRemoveAllChildren(parent._node);",
		"parent._children.clear();",
		"detachAllChildren() must clear native Yoga children before releasing owning child references.",
	)

	const removeAllBody = extractFunctionBody(yogaNodeCpp, "void YogaNode::removeAllChildren()")
	assertIncludes(
		removeAllBody,
		"detachAllChildren(*this, true);",
		"YogaNode::removeAllChildren() must use the centralized detach cleanup path.",
	)

	for (const signature of [
		"void YogaNode::invalidateLayout()",
		"void YogaNode::invalidateRasterCache()",
		"void YogaNode::adjustInteractiveDescendantCount(int delta)",
	]) {
		const body = extractFunctionBody(yogaNodeCpp, signature)
		assertIncludes(
			body,
			"if (auto parent = _parent.lock())",
			`${signature} must traverse parent links through weak_ptr::lock().`,
		)
	}
}

function extractFunctionBody(source, signature) {
	const signatureIndex = source.indexOf(signature)
	if (signatureIndex === -1) {
		throw new Error(`Could not find function signature: ${signature}`)
	}

	const braceIndex = source.indexOf("{", signatureIndex)
	if (braceIndex === -1) {
		throw new Error(`Could not find function body for: ${signature}`)
	}

	let depth = 0
	for (let index = braceIndex; index < source.length; index += 1) {
		const char = source[index]
		if (char === "{") {
			depth += 1
		} else if (char === "}") {
			depth -= 1
			if (depth === 0) {
				return source.slice(braceIndex + 1, index)
			}
		}
	}

	throw new Error(`Could not parse function body for: ${signature}`)
}

function assertIncludes(source, needle, message) {
	if (!source.includes(needle)) {
		throw new Error(message)
	}
}

function assertOrder(source, firstNeedle, secondNeedle, message) {
	const firstIndex = source.indexOf(firstNeedle)
	const secondIndex = source.indexOf(secondNeedle)
	if (firstIndex === -1 || secondIndex === -1 || firstIndex >= secondIndex) {
		throw new Error(message)
	}
}

function createNitroModulesShim(baseDir) {
	const shimDir = path.join(baseDir, "NitroModules")
	mkdirSync(shimDir, { recursive: true })

	const nitroCppDir = projectPath("node_modules/react-native-nitro-modules/cpp")
	if (!existsSync(nitroCppDir)) {
		throw new Error("Missing node_modules/react-native-nitro-modules/cpp. Install dependencies before running this verifier.")
	}

	for (const headerPath of walkHeaderFiles(nitroCppDir)) {
		const targetPath = path.join(shimDir, path.basename(headerPath))
		if (existsSync(targetPath)) {
			unlinkSync(targetPath)
		}
		symlinkSync(headerPath, targetPath)
	}
}

function walkHeaderFiles(directory) {
	const files = []
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory()) {
			files.push(...walkHeaderFiles(entryPath))
		} else if (entry.isFile() && (entry.name.endsWith(".hpp") || entry.name.endsWith(".h"))) {
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
#include <memory>
#include <optional>
#include <type_traits>
#include <variant>
#include <vector>

#include "YogaNode.cpp"

using margelo::nitro::RNSkiaYoga::NodeStyle;
using margelo::nitro::RNSkiaYoga::YogaNode;

static_assert(std::is_same_v<decltype(std::declval<YogaNode&>()._parent), std::weak_ptr<YogaNode>>,
              "YogaNode parent back-link must remain weak to avoid retained-descendant stale parent dereferences.");
static_assert(std::is_same_v<decltype(std::declval<YogaNode&>()._children), std::vector<std::shared_ptr<YogaNode>>>,
              "YogaNode children remain owning references; parent links must not be owning.");

namespace {

void retainedDescendantCanBeMutatedAfterAncestorTeardownProbe()
{
    auto root = std::make_shared<YogaNode>();
    auto child = std::make_shared<YogaNode>();
    auto grandchild = std::make_shared<YogaNode>();

    root->insertChild(child, std::nullopt);
    child->insertChild(grandchild, std::nullopt);

    auto retainedGrandchild = grandchild;
    root.reset();
    child.reset();
    grandchild.reset();

    NodeStyle style {};
    retainedGrandchild->setStyle(style);
    retainedGrandchild->invalidateLayout();
    retainedGrandchild->invalidateRasterCache();
    retainedGrandchild->removeAllChildren();
}

void reparentingSameChildDoesNotRequireOldParentRemovalProbe()
{
    auto firstParent = std::make_shared<YogaNode>();
    auto secondParent = std::make_shared<YogaNode>();
    auto child = std::make_shared<YogaNode>();

    firstParent->insertChild(child, std::nullopt);
    secondParent->insertChild(child, std::nullopt);

    firstParent->removeAllChildren();
    child->invalidateLayout();
    secondParent->removeChild(child);
    child->invalidateRasterCache();
}

void destructorCleanupRetainsDescendantProbe()
{
    auto parent = std::make_shared<YogaNode>();
    auto child = std::make_shared<YogaNode>();
    parent->insertChild(child, std::nullopt);

    auto retainedChild = child;
    parent.reset();
    child.reset();

    retainedChild->invalidateLayout();
    retainedChild->removeAllChildren();
}

} // namespace
`
}

function projectPath(relativePath) {
	return path.join(rootDir, relativePath)
}
