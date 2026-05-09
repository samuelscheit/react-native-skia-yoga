#!/usr/bin/env bun

import {
	existsSync,
	readFileSync,
	writeFileSync,
} from "node:fs"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const rootNodeModulesDir = path.join(rootDir, "node_modules")
const exampleNodeModulesDir = path.join(exampleDir, "node_modules")

patchReactNativeSkiaHeaders(rootNodeModulesDir)
patchReactNativeSkiaHeaders(exampleNodeModulesDir)

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
