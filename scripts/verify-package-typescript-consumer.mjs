#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import {
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const rootDir = path.resolve(import.meta.dirname, "..")
const rootPackageJson = readPackageJson(path.join(rootDir, "package.json"))
const examplePackageJson = readPackageJson(
	path.join(rootDir, "example", "package.json"),
)

const tempRoot = mkdtempSync(
	path.join(tmpdir(), "rnskia-package-typescript-consumer-"),
)

try {
	const tarballDir = path.join(tempRoot, "tarball")
	const consumerDir = path.join(tempRoot, "consumer")
	mkdirSync(tarballDir, { recursive: true })
	mkdirSync(path.join(consumerDir, "src"), { recursive: true })

	const packedTarball = packPackage(tarballDir)
	writeConsumerProject(consumerDir, packedTarball)

	run(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--package-lock=false",
			"--prefer-offline",
			"--legacy-peer-deps",
		],
		{ cwd: consumerDir, timeout: 300_000 },
	)

	assertPackedPackageInstall(consumerDir)

	run(
		process.execPath,
		[
			path.join(
				consumerDir,
				"node_modules",
				"typescript",
				"lib",
				"tsc.js",
			),
			"-p",
			"tsconfig.json",
			"--noEmit",
		],
		{ cwd: consumerDir, timeout: 120_000 },
	)

	console.log("Packed package TypeScript consumer verifier passed:")
	console.log("- npm pack created a real tarball outside the repository.")
	console.log(
		"- A temporary consumer installed react-native-skia-yoga from that tarball.",
	)
	console.log(
		"- Consumer TypeScript used jsx: react-jsx and jsxImportSource: react-native-skia-yoga.",
	)
	console.log(
		"- Public package entrypoints and lowercase intrinsic JSX compiled from the installed package.",
	)
} finally {
	rmSync(tempRoot, { recursive: true, force: true })
}

function packPackage(tarballDir) {
	const packResult = run(
		"npm",
		[
			"pack",
			"--json",
			"--ignore-scripts",
			"--pack-destination",
			tarballDir,
		],
		{ cwd: rootDir, timeout: 120_000 },
	)
	const packManifest = JSON.parse(packResult.stdout.trim())
	if (!Array.isArray(packManifest) || packManifest.length === 0) {
		throw new Error(
			"npm pack --json --ignore-scripts returned no manifest entries.",
		)
	}

	const filename = packManifest[0]?.filename
	if (typeof filename !== "string" || filename.length === 0) {
		throw new Error("npm pack manifest did not include a tarball filename.")
	}

	return path.join(tarballDir, filename)
}

function writeConsumerProject(consumerDir, packedTarball) {
	const consumerPackageJson = {
		name: "rnskia-yoga-packed-typescript-consumer-smoke",
		version: "0.0.0",
		private: true,
		type: "module",
		dependencies: {
			[rootPackageJson.name]: pathToFileURL(packedTarball).href,
			"@shopify/react-native-skia": exampleDependencyVersion(
				"@shopify/react-native-skia",
			),
			react: exampleDependencyVersion("react"),
			"react-native": exampleDependencyVersion("react-native"),
			"react-native-gesture-handler": exampleDependencyVersion(
				"react-native-gesture-handler",
			),
			"react-native-nitro-modules": exampleDependencyVersion(
				"react-native-nitro-modules",
			),
			"react-native-reanimated": exampleDependencyVersion(
				"react-native-reanimated",
			),
			"react-native-worklets": exampleDependencyVersion(
				"react-native-worklets",
			),
		},
		devDependencies: {
			"@types/react": exampleDependencyVersion("@types/react"),
			"@types/react-reconciler": rootDevDependencyVersion(
				"@types/react-reconciler",
			),
			typescript: exampleDependencyVersion("typescript"),
		},
	}

	const tsconfig = {
		compilerOptions: {
			allowSyntheticDefaultImports: true,
			esModuleInterop: true,
			forceConsistentCasingInFileNames: true,
			jsx: "react-jsx",
			jsxImportSource: rootPackageJson.name,
			lib: ["ES2022", "DOM"],
			module: "ESNext",
			moduleResolution: "Node",
			noEmit: true,
			skipLibCheck: true,
			strict: true,
			target: "ES2022",
			types: ["react"],
		},
		include: ["src"],
	}

	if (
		Object.prototype.hasOwnProperty.call(
			tsconfig.compilerOptions,
			"paths",
		) ||
		Object.prototype.hasOwnProperty.call(
			tsconfig.compilerOptions,
			"baseUrl",
		)
	) {
		throw new Error(
			"Consumer tsconfig must not use paths or baseUrl shortcuts.",
		)
	}

	writeJson(path.join(consumerDir, "package.json"), consumerPackageJson)
	writeJson(path.join(consumerDir, "tsconfig.json"), tsconfig)
	writeFileSync(
		path.join(consumerDir, "src", "packed-package-smoke.tsx"),
		consumerSource(),
	)
}

function consumerSource() {
	return `import * as React from "react"
import {
\tYogaCanvas,
\ttype YogaCanvasProfileSample,
\ttype YogaIntrinsicElements,
\ttype YogaNodeStyle,
} from "react-native-skia-yoga"
import { Fragment as YogaRuntimeFragment } from "react-native-skia-yoga/jsx-runtime"

const rootStyle: YogaNodeStyle = {
\talignItems: "center",
\tbackgroundColor: "#0f172a",
\tflex: 1,
\tjustifyContent: "center",
\tpadding: 12,
}

const panelStyle: YogaNodeStyle = {
\talignItems: "center",
\tbackgroundColor: "#1d4ed8",
\tborderRadius: 12,
\tflexDirection: "row",
\tgap: 8,
\theight: 72,
\tpadding: 8,
\twidth: 180,
}

const interactiveGroupProps: YogaIntrinsicElements["group"] = {
\thitSlop: 8,
\tonPress() {},
\tpreciseHit: true,
\tstyle: { opacity: 0.9 },
}

function handleProfileSample(sample: YogaCanvasProfileSample) {
\treturn sample.avgDrawMs + sample.avgPresentMs + sample.frames
}

export function PackedPackageSmoke() {
\treturn (
\t\t<YogaCanvas
\t\t\tdebug={false}
\t\t\tonProfileSample={handleProfileSample}
\t\t\tprofilingEnabled
\t\t\tstyle={{ flex: 1 }}
\t\t>
\t\t\t<>
\t\t\t\t<rect style={rootStyle}>
\t\t\t\t\t<group {...interactiveGroupProps}>
\t\t\t\t\t\t<rrect
\t\t\t\t\t\t\tcornerRadius={10}
\t\t\t\t\t\t\tstyle={panelStyle}
\t\t\t\t\t\t>
\t\t\t\t\t\t\t<circle
\t\t\t\t\t\t\t\tradius={16}
\t\t\t\t\t\t\t\tstyle={{
\t\t\t\t\t\t\t\t\tbackgroundColor: "#14b8a6",
\t\t\t\t\t\t\t\t\theight: 32,
\t\t\t\t\t\t\t\t\twidth: 32,
\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t<text
\t\t\t\t\t\t\t\tstyle={{ height: 24, width: 84 }}
\t\t\t\t\t\t\t\ttext="packed"
\t\t\t\t\t\t\t\ttextStyle={{ color: "white", fontSize: 14 }}
\t\t\t\t\t\t\t/>
\t\t\t\t\t\t</rrect>
\t\t\t\t\t</group>
\t\t\t\t</rect>
\t\t\t</>
\t\t</YogaCanvas>
\t)
}

const smokeElement: React.JSX.Element = <PackedPackageSmoke />
const runtimeFragment = YogaRuntimeFragment

void smokeElement
void runtimeFragment
`
}

function assertPackedPackageInstall(consumerDir) {
	const packageRoot = path.join(
		consumerDir,
		"node_modules",
		rootPackageJson.name,
	)
	const packageStat = lstatSync(packageRoot)
	if (packageStat.isSymbolicLink()) {
		throw new Error("Packed package install resolved to a symlink.")
	}

	const installedRealPath = realpathSync(packageRoot)
	if (isPathInside(installedRealPath, rootDir)) {
		throw new Error(
			`Packed package install resolved inside the repository: ${installedRealPath}`,
		)
	}

	const installedPackageJson = readPackageJson(
		path.join(packageRoot, "package.json"),
	)
	if (installedPackageJson.name !== rootPackageJson.name) {
		throw new Error(
			`Installed package name mismatch: ${installedPackageJson.name}`,
		)
	}
}

function exampleDependencyVersion(name) {
	const dependencySections = [
		examplePackageJson.dependencies,
		examplePackageJson.devDependencies,
	]

	for (const section of dependencySections) {
		const version = section?.[name]
		if (typeof version === "string" && version.length > 0) {
			return version
		}
	}

	throw new Error(`Example package.json does not declare ${name}.`)
}

function rootDevDependencyVersion(name) {
	const version = rootPackageJson.devDependencies?.[name]
	if (typeof version === "string" && version.length > 0) {
		return version
	}

	throw new Error(`Root package.json does not declare devDependency ${name}.`)
}

function writeJson(filePath, value) {
	writeFileSync(filePath, `${JSON.stringify(value, null, "\t")}\n`)
}

function readPackageJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"))
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

function isPathInside(candidatePath, parentPath) {
	const relativePath = path.relative(parentPath, candidatePath)
	return (
		relativePath === "" ||
		(Boolean(relativePath) &&
			!relativePath.startsWith("..") &&
			!path.isAbsolute(relativePath))
	)
}
