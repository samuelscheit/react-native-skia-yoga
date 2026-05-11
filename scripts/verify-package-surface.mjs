#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const canonicalRepositoryUrl =
	"https://github.com/SamuelScheit/react-native-skia-yoga.git"
const representativeNativeFiles = [
	"cpp/SkiaYoga.cpp",
	"cpp/SkiaYoga.hpp",
	"cpp/YogaNode.cpp",
	"cpp/YogaNode.hpp",
	"cpp/polyfill.h",
	"android/build.gradle",
	"android/CMakeLists.txt",
	"android/fix-prefab.gradle",
	"android/gradle.properties",
	"android/src/main/cpp/cpp-adapter.cpp",
	"android/src/main/cpp/SkiaYogaModuleNative.cpp",
	"RNSkiaYoga.podspec",
	"ios/SkiaYogaModule.mm",
	"ios/SkiaYogaView.mm",
	"nitrogen/generated/android/RNSkiaYoga+autolinking.cmake",
	"nitrogen/generated/ios/RNSkiaYoga+autolinking.rb",
	"nitrogen/generated/shared/c++/HybridSkiaYogaSpec.hpp",
]
const sourceFirstRuntimeFiles = [
	"src/YogaCanvas.tsx",
	"src/Reconciler.ts",
	"src/SkiaYogaObject.ts",
	"src/util.ts",
]
const sourceSpecFiles = [
	"src/specs/commands.ts",
	"src/specs/SkiaYoga.nitro.ts",
	"src/specs/NativeSkiaYoga.ts",
	"src/specs/SkiaYogaViewNativeComponent.ts",
	"src/specs/style.ts",
]

const packageJson = JSON.parse(
	readFileSync(projectPath("package.json"), "utf8"),
)
const packageFiles = packageJson.files ?? []
assertPackageEntrypoints()
assertPackageExportsBoundary()
assertIncludes(
	packageFiles,
	"cpp",
	"package.json files must publish the shared native C++ directory.",
)
assertIncludes(
	packageFiles,
	"android/fix-prefab.gradle",
	"package.json files must publish the Android Gradle prefab patch script.",
)

const podspec = readFileSync(projectPath("RNSkiaYoga.podspec"), "utf8")
assertContains(
	podspec,
	`:git => "${canonicalRepositoryUrl}"`,
	"RNSkiaYoga.podspec must point s.source at the canonical repository.",
)
assertNotContains(
	podspec,
	"https://github.com/mrousavy/nitro.git",
	"RNSkiaYoga.podspec must not keep the stale Nitro template source repository.",
)
assertContains(
	podspec,
	"cpp/**/*.{hpp,cpp}",
	"RNSkiaYoga.podspec must include the shared C++ implementation sources.",
)
assertContains(
	podspec,
	'"$(PODS_TARGET_SRCROOT)/cpp/polyfill.h"',
	"RNSkiaYoga.podspec must force-include cpp/polyfill.h from the published package.",
)

const androidCMake = readFileSync(projectPath("android/CMakeLists.txt"), "utf8")
assertContains(
	androidCMake,
	'set(CPP_SRC_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../cpp")',
	"android/CMakeLists.txt must source shared C++ files from the package cpp directory.",
)
assertContains(
	androidCMake,
	"target_sources(${PACKAGE_NAME} PRIVATE ${PROJECT_CPP_SOURCES})",
	"android/CMakeLists.txt must add the shared C++ files to the native target.",
)

const androidBuildGradle = readFileSync(
	projectPath("android/build.gradle"),
	"utf8",
)
assertContains(
	androidBuildGradle,
	'apply from: "./fix-prefab.gradle"',
	"android/build.gradle must apply the packaged Android Gradle prefab patch script.",
)
assertPublicDeclarationBoundary()
assertPublicSourceBoundary()

const packResult = run(
	"npm",
	["pack", "--dry-run", "--json", "--ignore-scripts"],
	{
		cwd: rootDir,
	},
)
const packManifest = JSON.parse(packResult.stdout.trim())
if (!Array.isArray(packManifest) || packManifest.length === 0) {
	throw new Error(
		"npm pack --dry-run --json --ignore-scripts returned no manifest entries.",
	)
}

const packedEntry = packManifest[0]
const packedPaths = new Set(
	(packedEntry.files ?? []).map((entry) => normalizePackagePath(entry.path)),
)
if (packedPaths.size === 0) {
	throw new Error("npm pack manifest did not include a files list.")
}

const requiredPackedFiles = unique([
	"package.json",
	"README.md",
	"index.d.ts",
	"jsx-runtime.js",
	"jsx-runtime.d.ts",
	"jsx-dev-runtime.js",
	"jsx-dev-runtime.d.ts",
	"src/index.ts",
	...sourceFirstRuntimeFiles,
	...sourceSpecFiles,
	...representativeNativeFiles,
	...walkFiles(projectPath("cpp")).map((filePath) => toPackagePath(filePath)),
])

const missingPackedFiles = requiredPackedFiles.filter(
	(filePath) => !packedPaths.has(filePath),
)
if (missingPackedFiles.length > 0) {
	throw new Error(
		[
			"Package publish surface is missing required native/package files.",
			...missingPackedFiles.map((filePath) => `- ${filePath}`),
		].join("\n"),
	)
}

console.log("Package surface verifier passed:")
console.log(`- npm pack manifest includes ${packedPaths.size} files.`)
console.log(
	`- All ${walkFiles(projectPath("cpp")).length} files under cpp/ are published.`,
)
console.log(
	"- Representative iOS, Android, Nitrogen, and package entrypoint files are published.",
)
console.log("- Podspec source metadata points at the canonical repository.")
console.log(
	"- Source-first runtime files remain published for React Native, while public declarations and the source barrel use explicit allowlists.",
)
console.log(
	"- Package exports expose only the root entrypoint, JSX runtime subpaths, and package.json metadata; src/specs remains physically packed for codegen but unexported.",
)
console.log(
	"- Required src/specs files remain published for React Native codegen and Nitrogen.",
)

function projectPath(...segments) {
	return path.join(rootDir, ...segments)
}

function assertPackageEntrypoints() {
	assertEqual(
		packageJson.main,
		"src/index",
		'package.json main must preserve the source-first "src/index" entrypoint.',
	)
	assertEqual(
		packageJson.module,
		"src/index",
		'package.json module must preserve the source-first "src/index" entrypoint.',
	)
	assertEqual(
		packageJson.types,
		"index.d.ts",
		'package.json types must preserve the root "index.d.ts" declaration entrypoint.',
	)
	assertEqual(
		packageJson["react-native"],
		"src/index",
		'package.json react-native must preserve the source-first "src/index" entrypoint.',
	)
	assertEqual(
		packageJson.source,
		"src/index",
		'package.json source must preserve the source-first "src/index" entrypoint.',
	)
	assertEqual(
		packageJson.codegenConfig?.jsSrcsDir,
		"./src/specs",
		'package.json codegenConfig.jsSrcsDir must preserve "./src/specs".',
	)
}

function assertPackageExportsBoundary() {
	const expectedExports = {
		".": {
			types: "./index.d.ts",
			"react-native": "./src/index.ts",
			source: "./src/index.ts",
			import: "./src/index.ts",
			require: "./src/index.ts",
			default: "./src/index.ts",
		},
		"./jsx-runtime": {
			types: "./jsx-runtime.d.ts",
			import: "./jsx-runtime.js",
			require: "./jsx-runtime.js",
			default: "./jsx-runtime.js",
		},
		"./jsx-dev-runtime": {
			types: "./jsx-dev-runtime.d.ts",
			import: "./jsx-dev-runtime.js",
			require: "./jsx-dev-runtime.js",
			default: "./jsx-dev-runtime.js",
		},
		"./package.json": "./package.json",
	}

	assertPlainObject(
		packageJson.exports,
		"package.json must declare an exports map.",
	)
	assertObjectKeys(
		packageJson.exports,
		Object.keys(expectedExports),
		"package.json exports must expose only the supported public entrypoints and package metadata.",
	)

	for (const [subpath, expectedTarget] of Object.entries(expectedExports)) {
		if (typeof expectedTarget === "string") {
			assertEqual(
				packageJson.exports[subpath],
				expectedTarget,
				`package.json exports["${subpath}"] mismatch.`,
			)
			continue
		}

		assertPlainObject(
			packageJson.exports[subpath],
			`package.json exports["${subpath}"] must be a conditional export object.`,
		)
		assertObjectKeys(
			packageJson.exports[subpath],
			Object.keys(expectedTarget),
			`package.json exports["${subpath}"] must keep the expected condition order and keys.`,
		)
		for (const [condition, target] of Object.entries(expectedTarget)) {
			assertEqual(
				packageJson.exports[subpath][condition],
				target,
				`package.json exports["${subpath}"].${condition} mismatch.`,
			)
		}
	}

	for (const subpath of Object.keys(packageJson.exports)) {
		if (subpath.startsWith("./src")) {
			throw new Error(
				`package.json exports must not expose source deep imports: ${subpath}`,
			)
		}
	}
}

function assertPublicDeclarationBoundary() {
	const indexDts = readProjectFile("index.d.ts")
	const jsxRuntimeDts = readProjectFile("jsx-runtime.d.ts")
	const jsxDevRuntimeDts = readProjectFile("jsx-dev-runtime.d.ts")

	assertContains(
		indexDts,
		'export { YogaCanvas } from "./src/YogaCanvas"',
		"index.d.ts must explicitly publish YogaCanvas.",
	)
	assertContains(
		indexDts,
		"YogaCanvasProfileSample",
		"index.d.ts must explicitly publish the YogaCanvas profiling sample type.",
	)
	assertContains(
		indexDts,
		"YogaIntrinsicElements",
		"index.d.ts must explicitly publish the JSX intrinsic element map.",
	)
	assertContains(
		indexDts,
		"YogaNodeStyle",
		"index.d.ts must explicitly publish the public Yoga node style type.",
	)
	assertNotContains(
		indexDts,
		'export * from "./src/index"',
		"index.d.ts must not re-export the source runtime barrel wholesale.",
	)
	assertNotContains(
		indexDts,
		"./src/Reconciler",
		"index.d.ts must not expose the internal reconciler module.",
	)
	assertNotContains(
		indexDts,
		"./src/util",
		"index.d.ts must not expose internal native object factories.",
	)
	assertNotContains(
		indexDts,
		"./src/SkiaYogaObject",
		"index.d.ts must not expose the internal native hybrid object.",
	)

	assertContains(
		jsxRuntimeDts,
		'export { Fragment, jsx, jsxs } from "react/jsx-runtime"',
		"jsx-runtime.d.ts must preserve the React JSX runtime contract.",
	)
	assertNotContains(
		jsxRuntimeDts,
		'export * from "./src/jsx-runtime"',
		"jsx-runtime.d.ts must not re-export the source runtime module wholesale.",
	)
	assertContains(
		jsxDevRuntimeDts,
		'export { Fragment, jsxDEV } from "react/jsx-dev-runtime"',
		"jsx-dev-runtime.d.ts must preserve the React dev JSX runtime contract.",
	)
	assertNotContains(
		jsxDevRuntimeDts,
		'export * from "./src/jsx-dev-runtime"',
		"jsx-dev-runtime.d.ts must not re-export the source dev runtime module wholesale.",
	)
}

function assertPublicSourceBoundary() {
	const sourceIndex = readProjectFile("src/index.ts")

	assertContains(
		sourceIndex,
		'export { YogaCanvas } from "./YogaCanvas"',
		"src/index.ts must explicitly publish YogaCanvas.",
	)
	assertNotContains(
		sourceIndex,
		"export *",
		"src/index.ts must not wildcard-export implementation modules.",
	)
	assertNotContains(
		sourceIndex,
		'from "./Reconciler"',
		"src/index.ts must not expose the internal reconciler module.",
	)
	assertNotContains(
		sourceIndex,
		'from "./util"',
		"src/index.ts must not expose internal native object factories.",
	)
	assertNotContains(
		sourceIndex,
		'from "./SkiaYogaObject"',
		"src/index.ts must not expose the internal native hybrid object.",
	)
	assertNotContains(
		sourceIndex,
		"YogaNodeFinal",
		"src/index.ts must not expose the internal native Yoga node interface.",
	)
	assertNotContains(
		sourceIndex,
		"YogaInteractionRegistry",
		"src/index.ts must not expose internal event registry plumbing.",
	)
}

function run(command, args, options) {
	const result = spawnSync(command, args, {
		...options,
		encoding: "utf8",
	})

	if (result.error) {
		throw new Error(`Failed to run ${command}: ${result.error.message}`)
	}

	if (result.status !== 0) {
		const stdout = result.stdout.trim()
		const stderr = result.stderr.trim()
		throw new Error(
			[
				`${command} ${args.join(" ")} failed with exit code ${result.status}.`,
				stdout ? `stdout:\n${stdout}` : "",
				stderr ? `stderr:\n${stderr}` : "",
			]
				.filter(Boolean)
				.join("\n\n"),
		)
	}

	return result
}

function walkFiles(dir) {
	if (!existsSync(dir)) {
		throw new Error(
			`Missing required directory: ${path.relative(rootDir, dir)}`,
		)
	}

	const files = []
	for (const entryName of readdirSync(dir)) {
		const entryPath = path.join(dir, entryName)
		const stat = statSync(entryPath)
		if (stat.isDirectory()) {
			files.push(...walkFiles(entryPath))
		} else if (stat.isFile()) {
			files.push(entryPath)
		}
	}
	return files.sort()
}

function toPackagePath(filePath) {
	return normalizePackagePath(path.relative(rootDir, filePath))
}

function normalizePackagePath(filePath) {
	return filePath.split(path.sep).join("/")
}

function unique(values) {
	return [...new Set(values)]
}

function assertIncludes(values, expected, message) {
	if (!values.includes(expected)) {
		throw new Error(message)
	}
}

function assertEqual(actual, expected, message) {
	if (actual !== expected) {
		throw new Error(
			`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.`,
		)
	}
}

function assertPlainObject(value, message) {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(message)
	}
}

function assertObjectKeys(value, expectedKeys, message) {
	const actualKeys = Object.keys(value)
	if (
		actualKeys.length !== expectedKeys.length ||
		actualKeys.some((key, index) => key !== expectedKeys[index])
	) {
		throw new Error(
			`${message} Expected keys ${JSON.stringify(expectedKeys)}, got ${JSON.stringify(actualKeys)}.`,
		)
	}
}

function assertContains(source, expected, message) {
	if (!source.includes(expected)) {
		throw new Error(message)
	}
}

function assertNotContains(source, unexpected, message) {
	if (source.includes(unexpected)) {
		throw new Error(message)
	}
}

function readProjectFile(...segments) {
	return readFileSync(projectPath(...segments), "utf8")
}
