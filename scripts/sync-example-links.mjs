#!/usr/bin/env bun

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const rootNodeModulesDir = path.join(rootDir, "node_modules")
const exampleNodeModulesDir = path.join(exampleDir, "node_modules")

if (!existsSync(exampleNodeModulesDir)) {
	process.exit(0)
}

for (const entry of readdirSync(exampleNodeModulesDir, { withFileTypes: true })) {
	if (!entry.isDirectory() && !entry.isSymbolicLink()) {
		continue
	}

	if (entry.name === "react-native-skia-yoga") {
		continue
	}

	const sourcePath = path.join(exampleNodeModulesDir, entry.name)
	const targetPath = path.join(rootNodeModulesDir, entry.name)
	linkPath(sourcePath, targetPath)
}

patchReactNativeSkiaHeaders(exampleNodeModulesDir)

function linkPath(sourcePath, targetPath) {
	mkdirSync(path.dirname(targetPath), { recursive: true })
	rmSync(targetPath, { force: true, recursive: true })

	const relativeSourcePath = path.relative(path.dirname(targetPath), sourcePath)
	const linkType = process.platform === "win32" ? "junction" : "dir"
	symlinkSync(relativeSourcePath, targetPath, linkType)
}

function patchReactNativeSkiaHeaders(nodeModulesDir) {
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
