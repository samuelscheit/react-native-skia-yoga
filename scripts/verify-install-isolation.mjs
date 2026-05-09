#!/usr/bin/env node

import { existsSync, lstatSync, realpathSync } from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleNodeModulesDir = path.join(rootDir, "example", "node_modules")
const rootNodeModulesDir = path.join(rootDir, "node_modules")
const requireFromRoot = createRequire(path.join(rootDir, "package.json"))

if (!existsSync(rootNodeModulesDir)) {
	throw new Error(`Missing root node_modules at ${rootNodeModulesDir}`)
}

const exampleNodeModulesRealPath = existsSync(exampleNodeModulesDir)
	? `${realpathSync(exampleNodeModulesDir)}${path.sep}`
	: null

for (const relativePath of [
	".bin",
	"@types",
	"eslint",
	"typescript",
	"react",
	"react-native",
]) {
	assertNotResolvedFromExample(path.join(rootNodeModulesDir, relativePath))
}

for (const packageName of ["eslint", "typescript", "nitrogen"]) {
	const resolvedPackageJsonPath = requireFromRoot.resolve(`${packageName}/package.json`)
	assertNotResolvedFromExample(resolvedPackageJsonPath)
}

if (!existsSync(path.join(rootNodeModulesDir, ".bin", "nitrogen"))) {
	throw new Error("Missing root nitrogen binary at node_modules/.bin/nitrogen")
}

console.log("Install isolation verified: root dependency resolution stays in root node_modules.")

function assertNotResolvedFromExample(targetPath) {
	if (!existsSync(targetPath)) {
		throw new Error(`Missing expected install target: ${targetPath}`)
	}

	const resolvedPath = `${realpathSync(targetPath)}${path.sep}`
	if (exampleNodeModulesRealPath !== null && resolvedPath.startsWith(exampleNodeModulesRealPath)) {
		throw new Error(`Root install target resolves from example node_modules: ${targetPath} -> ${resolvedPath}`)
	}

	if (lstatSync(targetPath).isSymbolicLink() && exampleNodeModulesRealPath !== null) {
		const symlinkResolvedPath = `${realpathSync(targetPath)}${path.sep}`
		if (symlinkResolvedPath.startsWith(exampleNodeModulesRealPath)) {
			throw new Error(`Root install symlink points into example node_modules: ${targetPath} -> ${symlinkResolvedPath}`)
		}
	}
}
