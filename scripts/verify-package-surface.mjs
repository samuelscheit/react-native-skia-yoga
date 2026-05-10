#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const canonicalRepositoryUrl = "https://github.com/SamuelScheit/react-native-skia-yoga.git"
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

const packageJson = JSON.parse(readFileSync(projectPath("package.json"), "utf8"))
const packageFiles = packageJson.files ?? []
assertIncludes(packageFiles, "cpp", "package.json files must publish the shared native C++ directory.")
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

const androidBuildGradle = readFileSync(projectPath("android/build.gradle"), "utf8")
assertContains(
	androidBuildGradle,
	'apply from: "./fix-prefab.gradle"',
	"android/build.gradle must apply the packaged Android Gradle prefab patch script.",
)

const packResult = run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
	cwd: rootDir,
})
const packManifest = JSON.parse(packResult.stdout.trim())
if (!Array.isArray(packManifest) || packManifest.length === 0) {
	throw new Error("npm pack --dry-run --json --ignore-scripts returned no manifest entries.")
}

const packedEntry = packManifest[0]
const packedPaths = new Set((packedEntry.files ?? []).map((entry) => normalizePackagePath(entry.path)))
if (packedPaths.size === 0) {
	throw new Error("npm pack manifest did not include a files list.")
}

const requiredPackedFiles = unique([
	"package.json",
	"README.md",
	"index.d.ts",
	"src/index.ts",
	...representativeNativeFiles,
	...walkFiles(projectPath("cpp")).map((filePath) => toPackagePath(filePath)),
])

const missingPackedFiles = requiredPackedFiles.filter((filePath) => !packedPaths.has(filePath))
if (missingPackedFiles.length > 0) {
	throw new Error([
		"Package publish surface is missing required native/package files.",
		...missingPackedFiles.map((filePath) => `- ${filePath}`),
	].join("\n"))
}

console.log("Package surface verifier passed:")
console.log(`- npm pack manifest includes ${packedPaths.size} files.`)
console.log(`- All ${walkFiles(projectPath("cpp")).length} files under cpp/ are published.`)
console.log("- Representative iOS, Android, Nitrogen, and package entrypoint files are published.")
console.log("- Podspec source metadata points at the canonical repository.")

function projectPath(...segments) {
	return path.join(rootDir, ...segments)
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
		throw new Error([
			`${command} ${args.join(" ")} failed with exit code ${result.status}.`,
			stdout ? `stdout:\n${stdout}` : "",
			stderr ? `stderr:\n${stderr}` : "",
		].filter(Boolean).join("\n\n"))
	}

	return result
}

function walkFiles(dir) {
	if (!existsSync(dir)) {
		throw new Error(`Missing required directory: ${path.relative(rootDir, dir)}`)
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
