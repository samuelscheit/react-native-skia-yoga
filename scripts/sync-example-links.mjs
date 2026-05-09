#!/usr/bin/env node

import {
	existsSync,
	lstatSync,
	mkdirSync,
	realpathSync,
	readFileSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from "node:fs"
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
	patchReactNativeSkiaHeaders(exampleNodeModulesDir)
}

if (syncRoot) {
	patchReactNativeSkiaHeaders(rootNodeModulesDir)
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
