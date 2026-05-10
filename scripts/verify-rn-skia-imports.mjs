#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const skiaPackage = "@shopify/react-native-skia"
const skiaViewNativeId = "SkiaView" + "NativeId"

const forbiddenImports = [
	{
		label: modulePath("src", ""),
		pattern: literalPattern(modulePath("src", "")),
	},
	{
		label: modulePath("lib", "typescript", "src", ""),
		pattern: literalPattern(modulePath("lib", "typescript", "src", "")),
	},
	{
		label: `${modulePath("lib", "module", "")}.../${skiaViewNativeId}`,
		pattern: privateNativeIdPattern("lib", "module"),
	},
	{
		label: `${modulePath("lib", "commonjs", "")}.../${skiaViewNativeId}`,
		pattern: privateNativeIdPattern("lib", "commonjs"),
	},
]

const sourceExtensions = new Set([
	".c",
	".cc",
	".cjs",
	".cmake",
	".cpp",
	".gradle",
	".h",
	".hpp",
	".java",
	".js",
	".json",
	".jsx",
	".kt",
	".m",
	".mjs",
	".mm",
	".podspec",
	".rb",
	".swift",
	".ts",
	".tsx",
])

const violations = []

for (const filePath of trackedSourceFiles()) {
	const source = readFileSync(path.join(rootDir, filePath), "utf8")
	for (const forbiddenImport of forbiddenImports) {
		if (forbiddenImport.pattern.test(source)) {
			violations.push({ filePath, label: forbiddenImport.label })
		}
	}
}

if (violations.length > 0) {
	throw new Error([
		"Tracked source imports private RN Skia internals:",
		...violations.map(
			({ filePath, label }) => `- ${filePath}: ${label}`,
		),
	].join("\n"))
}

console.log("RN Skia import verifier passed:")
console.log("- Tracked source does not import private RN Skia internals.")
console.log("- Worker progress reports and Markdown planning notes were not scanned.")

function trackedSourceFiles() {
	const result = spawnSync("git", ["ls-files"], {
		cwd: rootDir,
		encoding: "utf8",
	})

	if (result.error) {
		throw new Error(`Failed to run git ls-files: ${result.error.message}`)
	}

	if (result.status !== 0) {
		throw new Error(`git ls-files failed with exit code ${result.status}.`)
	}

	return result.stdout
		.split("\n")
		.filter(Boolean)
		.filter((filePath) => !filePath.startsWith("worker-progress/"))
		.filter((filePath) => path.extname(filePath) !== ".md")
		.filter((filePath) => sourceExtensions.has(path.extname(filePath)))
}

function modulePath(...segments) {
	return [skiaPackage, ...segments].join("/")
}

function literalPattern(value) {
	return new RegExp(escapeRegExp(value))
}

function privateNativeIdPattern(...segments) {
	return new RegExp(
		`${escapeRegExp(modulePath(...segments, ""))}[\\w./-]*${skiaViewNativeId}`,
	)
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
