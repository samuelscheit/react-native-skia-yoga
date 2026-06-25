#!/usr/bin/env node

import {
	cpSync,
	existsSync,
	lstatSync,
	mkdtempSync,
	mkdirSync,
	realpathSync,
	readFileSync,
	rmSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
import { execFileSync } from "node:child_process"
import os from "node:os"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const rootNodeModulesDir = path.join(rootDir, "node_modules")
const exampleNodeModulesDir = path.join(exampleDir, "node_modules")
const args = new Set(process.argv.slice(2))
const syncRoot = args.has("--root") || args.has("--all")
const syncExample = args.has("--example") || args.has("--all")

if (!syncRoot && !syncExample) {
	throw new Error("Usage: node ./scripts/sync-example-links.mjs --root|--example|--all")
}

if (syncExample) {
	ensureExamplePackageLink()
	patchReactNativeGestureHandlerMetadata(exampleNodeModulesDir)
	patchReactNativeSkiaHeaders(exampleNodeModulesDir)
	patchReactNativeSkiaCatalystLibraries(exampleNodeModulesDir)
}

if (syncRoot) {
	patchReactNativeGestureHandlerMetadata(rootNodeModulesDir)
	patchReactNativeSkiaHeaders(rootNodeModulesDir)
	patchReactNativeSkiaCatalystLibraries(rootNodeModulesDir)
}

function patchReactNativeGestureHandlerMetadata(nodeModulesDir) {
	if (!existsSync(nodeModulesDir)) {
		return
	}

	const packageJsonPath = path.join(
		nodeModulesDir,
		"react-native-gesture-handler",
		"package.json"
	)
	if (!existsSync(packageJsonPath)) {
		return
	}

	const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"))
	packageJson.codegenConfig ??= {}
	packageJson.codegenConfig.ios ??= {}
	packageJson.codegenConfig.ios.modulesProvider ??= {}

	const moduleProviders = packageJson.codegenConfig.ios.modulesProvider
	if (moduleProviders.RNGestureHandlerModule === "RNGestureHandlerModule") {
		return
	}

	moduleProviders.RNGestureHandlerModule = "RNGestureHandlerModule"
	writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function patchReactNativeSkiaHeaders(nodeModulesDir) {
	if (!existsSync(nodeModulesDir)) {
		return
	}

	const skiaDir = path.join(nodeModulesDir, "@shopify", "react-native-skia")
	if (!existsSync(skiaDir)) {
		return
	}

	ensureInclude(
		path.join(skiaDir, "cpp/api/JsiSkStrutStyle.h"),
		'#include "JsiSkFontStyle.h"',
		'#include <jsi/jsi.h>'
	)
	ensureInclude(
		path.join(skiaDir, "cpp/api/recorder/Convertor.h"),
		'#include "../JsiSkSkottie.h"',
		'#include "DataTypes.h"'
	)
	ensureInclude(
		path.join(skiaDir, "cpp/api/CustomBlendModes.h"),
		'#include "include/core/SkPaint.h"',
		'#include "include/core/SkBlender.h"'
	)
}

function patchReactNativeSkiaCatalystLibraries(nodeModulesDir) {
	const catalystLibsDir = process.env.RNSKIA_CATALYST_LIBS_DIR
	if (!catalystLibsDir) {
		return
	}

	if (!existsSync(nodeModulesDir)) {
		return
	}

	const skiaDir = path.join(nodeModulesDir, "@shopify", "react-native-skia")
	const iosLibsDir = path.join(skiaDir, "libs", "ios")
	if (!existsSync(iosLibsDir)) {
		return
	}

	const frameworkNames = [
		"libskia",
		"libsvg",
		"libskshaper",
		"libskparagraph",
		"libskunicode_core",
		"libskunicode_libgrapheme",
		"libskottie",
		"libsksg",
	]

	for (const frameworkName of frameworkNames) {
		mergeCatalystXCFrameworkSlice({
			frameworkName,
			sourceFrameworkDir: path.join(catalystLibsDir, `${frameworkName}.xcframework`),
			targetFrameworkDir: path.join(iosLibsDir, `${frameworkName}.xcframework`),
		})
	}
}

function mergeCatalystXCFrameworkSlice({ frameworkName, sourceFrameworkDir, targetFrameworkDir }) {
	if (!existsSync(sourceFrameworkDir) || !existsSync(targetFrameworkDir)) {
		return
	}

	const sourcePlistPath = path.join(sourceFrameworkDir, "Info.plist")
	const targetPlistPath = path.join(targetFrameworkDir, "Info.plist")
	const sourcePlist = readPlist(sourcePlistPath)
	const targetPlist = readPlist(targetPlistPath)
	const sourceLibrary = sourcePlist.AvailableLibraries?.find(
		(library) => library.SupportedPlatformVariant === "maccatalyst"
	)

	if (!sourceLibrary) {
		throw new Error(`Missing Mac Catalyst slice in ${sourcePlistPath}`)
	}

	const libraryIdentifier = sourceLibrary.LibraryIdentifier
	const sourceSliceDir = path.join(sourceFrameworkDir, libraryIdentifier)
	const targetSliceDir = path.join(targetFrameworkDir, libraryIdentifier)
	if (!existsSync(sourceSliceDir)) {
		throw new Error(`Missing Mac Catalyst library directory: ${sourceSliceDir}`)
	}

	rmSync(targetSliceDir, { recursive: true, force: true })
	cpSync(sourceSliceDir, targetSliceDir, { recursive: true })

	targetPlist.AvailableLibraries = [
		...(targetPlist.AvailableLibraries ?? []).filter(
			(library) => library.LibraryIdentifier !== libraryIdentifier
		),
		sourceLibrary,
	]
	writePlist(targetPlistPath, targetPlist)
	console.log(`Patched ${frameworkName}.xcframework with Mac Catalyst slice`)
}

function readPlist(filePath) {
	return JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", filePath], { encoding: "utf8" }))
}

function writePlist(filePath, plist) {
	const tempDir = mkdtempSync(path.join(os.tmpdir(), "rnskia-plist-"))
	try {
		const jsonPath = path.join(tempDir, "Info.json")
		writeFileSync(jsonPath, `${JSON.stringify(plist, null, 2)}\n`)
		execFileSync("plutil", ["-convert", "xml1", "-o", filePath, jsonPath])
	} finally {
		rmSync(tempDir, { recursive: true, force: true })
	}
}

function ensureExamplePackageLink() {
	mkdirSync(exampleNodeModulesDir, { recursive: true })

	const linkPath = path.join(exampleNodeModulesDir, "react-native-skia-yoga")
	const stat = lstatIfExists(linkPath)
	if (stat) {
		if (!stat.isSymbolicLink()) {
			throw new Error(`Refusing to replace unexpected example package path: ${linkPath}`)
		}

		try {
			if (realpathSync(linkPath) === rootDir) {
				return
			}
		} catch {
			// Recreate broken links below.
		}

		unlinkSync(linkPath)
	}

	const relativeTarget = path.relative(path.dirname(linkPath), rootDir)
	symlinkSync(relativeTarget, linkPath, "dir")
}

function lstatIfExists(filePath) {
	try {
		return lstatSync(filePath)
	} catch (error) {
		if (error?.code === "ENOENT") {
			return null
		}
		throw error
	}
}

function ensureInclude(filePath, includeLine, afterLine) {
	if (!existsSync(filePath)) {
		return
	}

	const source = readFileSync(filePath, "utf8")
	if (source.includes(includeLine)) {
		return
	}

	const anchor = `${afterLine}\n`
	if (!source.includes(anchor)) {
		throw new Error(`Could not patch ${filePath}: anchor not found`)
	}

	writeFileSync(filePath, source.replace(anchor, `${anchor}${includeLine}\n`))
}
