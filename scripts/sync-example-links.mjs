#!/usr/bin/env bun

import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from "node:fs"
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

function linkPath(sourcePath, targetPath) {
	mkdirSync(path.dirname(targetPath), { recursive: true })
	rmSync(targetPath, { force: true, recursive: true })

	const relativeSourcePath = path.relative(path.dirname(targetPath), sourcePath)
	const linkType = process.platform === "win32" ? "junction" : "dir"
	symlinkSync(relativeSourcePath, targetPath, linkType)
}
