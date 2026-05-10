#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const rootDir = path.resolve(import.meta.dirname, "..")
const rootRequire = createRequire(import.meta.url)
const { combineSchemasInFileList } = rootRequire(
	"@react-native/codegen/lib/cli/combine/combine-js-to-schema",
)
const { filterJSFile } = rootRequire(
	"@react-native/codegen/lib/cli/combine/combine-utils",
)

const rootPackageJson = readJson(projectPath("package.json"))
const examplePackageJson = readJson(projectPath("example", "package.json"))
const packageName = rootPackageJson.name
const tempRoot = mkdtempSync(
	path.join(tmpdir(), "rnskia-package-codegen-autolinking-"),
)

let summary

try {
	const tarballDir = path.join(tempRoot, "tarball")
	const consumerDir = path.join(tempRoot, "consumer")
	mkdirSync(tarballDir, { recursive: true })
	mkdirSync(consumerDir, { recursive: true })

	const packedTarball = packPackage(tarballDir)
	assertPackedTarball(packedTarball)
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

	const installSummary = assertPackedPackageInstall(consumerDir)
	const codegenSummary = assertInstalledPackageCodegen(
		installSummary.packageRoot,
		installSummary.installedRealPath,
	)
	const cliSummary = assertReactNativeCliAutolinkingMetadata(
		consumerDir,
		installSummary.packageRoot,
		installSummary.installedRealPath,
	)

	summary = {
		codegenSummary,
		installSummary,
		cliSummary,
		packedTarball,
		tempRoot,
	}
} finally {
	rmSync(tempRoot, { recursive: true, force: true })
}

console.log("Packed package RN codegen/autolinking verifier passed:")
console.log("- npm pack created a real tarball outside the repository.")
console.log(
	"- A temporary external consumer installed react-native-skia-yoga from that tarball.",
)
console.log(
	`- Installed package root was a real directory outside the repository: ${summary.installSummary.installedRealPath}`,
)
console.log(
	`- RN codegen used installed package codegenConfig.jsSrcsDir: ${summary.codegenSummary.codegenSrcDir}`,
)
console.log(
	`- Installed-package codegen admitted ${summary.codegenSummary.admittedFiles.join(", ")}.`,
)
console.log(
	`- Documented ignored non-RN-codegen files: ${summary.codegenSummary.ignoredFiles.join(", ")}.`,
)
console.log(
	"- Installed NativeSkiaYoga schema is a NativeModule named SkiaYoga with required install(): void.",
)
console.log(
	"- Installed SkiaYogaView schema has the expected props, ReactNativeCoreViewProps extension, no commands, and no events.",
)
console.log(
	`- React Native CLI config resolved iOS podspec: ${summary.cliSummary.iosPodspecPath}`,
)
console.log(
	`- React Native CLI config resolved Android source: ${summary.cliSummary.androidSourceDir}`,
)
console.log(
	`- React Native CLI config resolved ${summary.cliSummary.packageInstance}, ${summary.cliSummary.libraryName}, and ${summary.cliSummary.componentDescriptors.join(", ")}.`,
)
console.log(`- Removed temporary verifier root: ${summary.tempRoot}.`)

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

function assertPackedTarball(packedTarball) {
	const tarballStat = lstatSync(packedTarball)
	assert.ok(tarballStat.isFile(), "npm pack output must be a tarball file.")
	assert.equal(
		tarballStat.isSymbolicLink(),
		false,
		"npm pack output must not be a symlink.",
	)

	const tarballRealPath = realpathSync(packedTarball)
	assertPathOutside(
		tarballRealPath,
		rootDir,
		`Packed tarball must be outside the repository: ${tarballRealPath}`,
	)
}

function writeConsumerProject(consumerDir, packedTarball) {
	const consumerPackageJson = {
		name: "rnskia-yoga-packed-codegen-autolinking-smoke",
		version: "0.0.0",
		private: true,
		type: "module",
		dependencies: {
			[packageName]: pathToFileURL(packedTarball).href,
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
			"@react-native-community/cli": exampleDependencyVersion(
				"@react-native-community/cli",
			),
		},
	}

	writeJson(path.join(consumerDir, "package.json"), consumerPackageJson)
	writeFileSync(path.join(consumerDir, "index.js"), "export default null\n")
}

function assertPackedPackageInstall(consumerDir) {
	const packageRoot = path.join(consumerDir, "node_modules", packageName)
	const packageStat = lstatSync(packageRoot)
	assert.equal(
		packageStat.isSymbolicLink(),
		false,
		"Packed package install resolved to a symlink.",
	)
	assert.ok(
		packageStat.isDirectory(),
		"Packed package install must be an extracted directory.",
	)

	const installedRealPath = realpathSync(packageRoot)
	assertPathOutside(
		installedRealPath,
		rootDir,
		`Packed package install resolved inside the repository: ${installedRealPath}`,
	)

	const installedPackageJson = readJson(path.join(packageRoot, "package.json"))
	assert.equal(
		installedPackageJson.name,
		packageName,
		`Installed package name mismatch: ${installedPackageJson.name}`,
	)

	return {
		installedPackageJson,
		installedRealPath,
		packageRoot,
	}
}

function assertInstalledPackageCodegen(packageRoot, installedRealPath) {
	const installedPackageJson = readJson(path.join(packageRoot, "package.json"))
	const codegenConfig = requiredObject(
		installedPackageJson.codegenConfig,
		"Installed package.json must declare codegenConfig.",
	)
	assert.equal(
		codegenConfig.name,
		"RNSkiaYogaSpec",
		'Installed package.json codegenConfig.name must remain "RNSkiaYogaSpec".',
	)
	assert.equal(
		codegenConfig.type,
		"all",
		'Installed package.json codegenConfig.type must remain "all".',
	)
	assert.equal(
		codegenConfig.jsSrcsDir,
		"./src/specs",
		'Installed package.json codegenConfig.jsSrcsDir must remain "./src/specs".',
	)
	assert.equal(
		codegenConfig.android?.javaPackageName,
		"com.margelo.nitro.skiayoga",
		"Installed package.json codegenConfig.android.javaPackageName mismatch.",
	)
	assert.deepEqual(
		codegenConfig.ios?.componentProvider,
		{ SkiaYogaView: "SkiaYogaView" },
		"Installed package.json codegenConfig.ios.componentProvider mismatch.",
	)

	const codegenSrcDir = path.resolve(packageRoot, codegenConfig.jsSrcsDir)
	const codegenSrcRealPath = realpathSync(codegenSrcDir)
	assertPathInside(
		codegenSrcRealPath,
		installedRealPath,
		"Installed codegenConfig.jsSrcsDir must resolve inside the installed package.",
	)
	assertPathOutside(
		codegenSrcRealPath,
		rootDir,
		`Installed codegenConfig.jsSrcsDir must not resolve inside the repository: ${codegenSrcRealPath}`,
	)
	assertDirectory(
		codegenSrcRealPath,
		"Installed package.json codegenConfig.jsSrcsDir",
	)

	const codegenPackageDir = toPackagePath(
		path.relative(installedRealPath, codegenSrcRealPath),
	)
	const expectedAdmittedFiles = [
		`${codegenPackageDir}/NativeSkiaYoga.ts`,
		`${codegenPackageDir}/SkiaYogaViewNativeComponent.ts`,
	]
	const intentionallyIgnoredFiles = new Map([
		[
			`${codegenPackageDir}/SkiaYoga.nitro.ts`,
			"Nitrogen hybrid-object spec consumed by bun run specs, not React Native codegen.",
		],
		[
			`${codegenPackageDir}/commands.ts`,
			"Nitrogen command type support imported by SkiaYoga.nitro.ts.",
		],
		[
			`${codegenPackageDir}/style.ts`,
			"Nitrogen style type support imported by SkiaYoga.nitro.ts.",
		],
	])

	const sourceFiles = walkFiles(codegenSrcRealPath)
		.filter(isJavaScriptOrTypeScriptSource)
		.map((filePath) => toPackagePath(path.relative(installedRealPath, filePath)))
		.sort()
	const admittedFiles = sourceFiles
		.filter((filePath) =>
			filterJSFile(path.join(installedRealPath, filePath), null, null),
		)
		.sort()

	assert.deepEqual(
		admittedFiles,
		expectedAdmittedFiles,
		[
			"React Native codegen must admit only the installed package spec files.",
			`Installed package root: ${installedRealPath}`,
			`Configured directory: ${codegenConfig.jsSrcsDir}`,
			`Expected: ${expectedAdmittedFiles.join(", ")}`,
			`Actual: ${admittedFiles.join(", ")}`,
		].join("\n"),
	)
	assertIgnoredFilesAreDocumented(
		sourceFiles,
		expectedAdmittedFiles,
		intentionallyIgnoredFiles,
		installedRealPath,
	)

	const schema = combineSchemasInFileList(
		[codegenSrcRealPath],
		null,
		null,
		codegenConfig.name,
	)

	assert.equal(
		schema.libraryName,
		codegenConfig.name,
		"Installed RN codegen schema libraryName must come from installed package.json codegenConfig.name.",
	)
	assert.deepEqual(
		Object.keys(schema.modules).sort(),
		["NativeSkiaYoga", "SkiaYogaView"],
		"Installed RN codegen schema must expose exactly the current package modules.",
	)
	assertNativeSkiaYogaModule(schema.modules.NativeSkiaYoga)
	assertSkiaYogaViewModule(schema.modules.SkiaYogaView)

	return {
		admittedFiles,
		codegenSrcDir: codegenSrcRealPath,
		ignoredFiles: [...intentionallyIgnoredFiles.keys()],
	}
}

function assertReactNativeCliAutolinkingMetadata(
	consumerDir,
	packageRoot,
	installedRealPath,
) {
	const cliResult = run(
		process.execPath,
		[path.join(consumerDir, "node_modules", "react-native", "cli.js"), "config"],
		{ cwd: consumerDir, timeout: 120_000 },
	)
	const config = parseCliConfig(cliResult.stdout)
	assert.equal(
		realpathSync(config.root),
		realpathSync(consumerDir),
		"React Native CLI config must be read from the temporary consumer.",
	)
	assertPathOutside(
		realpathSync(config.root),
		rootDir,
		"React Native CLI consumer root must be outside the repository.",
	)

	const dependency = config.dependencies?.[packageName]
	assert.ok(
		dependency,
		`React Native CLI config did not include dependency ${packageName}.`,
	)
	assert.equal(
		realpathSync(dependency.root),
		installedRealPath,
		"React Native CLI dependency root must resolve to the installed package.",
	)
	assert.equal(
		realpathSync(dependency.root),
		realpathSync(packageRoot),
		"React Native CLI dependency root must match node_modules package root.",
	)
	assertPathOutside(
		realpathSync(dependency.root),
		rootDir,
		"React Native CLI dependency root must not resolve inside the repository.",
	)

	const ios = requiredObject(
		dependency.platforms?.ios,
		"React Native CLI config must include iOS metadata for the installed package.",
	)
	const android = requiredObject(
		dependency.platforms?.android,
		"React Native CLI config must include Android metadata for the installed package.",
	)

	const expectedPodspecPath = path.join(packageRoot, "RNSkiaYoga.podspec")
	const iosPodspecPath = requiredString(
		ios.podspecPath,
		"React Native CLI iOS metadata must include podspecPath.",
	)
	assert.equal(
		realpathSync(iosPodspecPath),
		realpathSync(expectedPodspecPath),
		"React Native CLI iOS podspecPath must resolve to the installed package podspec.",
	)
	assertPathInside(
		realpathSync(iosPodspecPath),
		installedRealPath,
		"React Native CLI iOS podspecPath must stay inside the installed package.",
	)
	assert.equal(
		path.basename(iosPodspecPath),
		"RNSkiaYoga.podspec",
		"React Native CLI iOS podspecPath must resolve RNSkiaYoga.podspec.",
	)

	const expectedAndroidSourceDir = path.join(packageRoot, "android")
	const androidSourceDir = requiredString(
		android.sourceDir,
		"React Native CLI Android metadata must include sourceDir.",
	)
	assert.equal(
		realpathSync(androidSourceDir),
		realpathSync(expectedAndroidSourceDir),
		"React Native CLI Android sourceDir must resolve to the installed package android directory.",
	)
	assertPathInside(
		realpathSync(androidSourceDir),
		installedRealPath,
		"React Native CLI Android sourceDir must stay inside the installed package.",
	)
	assert.equal(
		android.packageImportPath,
		"import com.margelo.nitro.skiayoga.SkiaYogaPackage;",
		"React Native CLI Android packageImportPath mismatch.",
	)
	assert.equal(
		android.packageInstance,
		"new SkiaYogaPackage()",
		"React Native CLI Android packageInstance mismatch.",
	)
	assert.equal(
		android.libraryName,
		"RNSkiaYogaSpec",
		"React Native CLI Android libraryName must match codegenConfig.name.",
	)
	assert.deepEqual(
		android.componentDescriptors,
		["SkiaYogaViewComponentDescriptor"],
		"React Native CLI Android componentDescriptors mismatch.",
	)
	assert.equal(
		android.cmakeListsPath,
		path.join(
			realpathSync(expectedAndroidSourceDir),
			"build",
			"generated",
			"source",
			"codegen",
			"jni",
			"CMakeLists.txt",
		),
		"React Native CLI Android cmakeListsPath must be derived from the installed package android source directory.",
	)

	return {
		androidSourceDir,
		componentDescriptors: android.componentDescriptors,
		iosPodspecPath,
		libraryName: android.libraryName,
		packageInstance: android.packageInstance,
	}
}

function assertNativeSkiaYogaModule(nativeModule) {
	assert.equal(
		nativeModule?.type,
		"NativeModule",
		"NativeSkiaYoga must be emitted as a NativeModule.",
	)
	assert.equal(
		nativeModule.moduleName,
		"SkiaYoga",
		'NativeSkiaYoga must load the native TurboModule named "SkiaYoga".',
	)
	assert.deepEqual(
		nativeModule.aliasMap,
		{},
		"NativeSkiaYoga must not emit unexpected aliases.",
	)
	assert.deepEqual(
		nativeModule.enumMap,
		{},
		"NativeSkiaYoga must not emit unexpected enums.",
	)

	const methods = nativeModule.spec?.methods ?? []
	assert.deepEqual(
		methods.map((method) => method.name),
		["install"],
		"NativeSkiaYoga must expose only install() in the RN codegen schema.",
	)

	const installMethod = methods[0]
	assert.equal(
		installMethod.optional,
		false,
		"NativeSkiaYoga.install must be required.",
	)
	assert.equal(
		installMethod.typeAnnotation?.type,
		"FunctionTypeAnnotation",
		"NativeSkiaYoga.install must be emitted as a function.",
	)
	assert.deepEqual(
		installMethod.typeAnnotation.params,
		[],
		"NativeSkiaYoga.install must not accept parameters.",
	)
	assert.equal(
		installMethod.typeAnnotation.returnTypeAnnotation?.type,
		"VoidTypeAnnotation",
		"NativeSkiaYoga.install must return void.",
	)
}

function assertSkiaYogaViewModule(componentModule) {
	assert.equal(
		componentModule?.type,
		"Component",
		"SkiaYogaView must be emitted as a component.",
	)
	assert.deepEqual(
		Object.keys(componentModule.components ?? {}),
		["SkiaYogaView"],
		"SkiaYogaView module must contain exactly the SkiaYogaView component.",
	)

	const component = componentModule.components.SkiaYogaView
	assert.deepEqual(
		component.extendsProps,
		[
			{
				type: "ReactNativeBuiltInType",
				knownTypeName: "ReactNativeCoreViewProps",
			},
		],
		"SkiaYogaView must extend React Native core ViewProps.",
	)
	assert.deepEqual(
		component.events,
		[],
		"SkiaYogaView must not emit unexpected events.",
	)
	assert.deepEqual(
		component.commands,
		[],
		"SkiaYogaView must not emit unexpected commands.",
	)

	const props = component.props ?? []
	assert.deepEqual(
		props.map((prop) => prop.name),
		["colorSpace", "debug", "opaque", "pointerEvents"],
		"SkiaYogaView must expose exactly the expected package props.",
	)

	assertProp(props[0], {
		defaultValue: null,
		name: "colorSpace",
		optional: true,
		type: "StringTypeAnnotation",
	})
	assertProp(props[1], {
		defaultValue: false,
		name: "debug",
		optional: true,
		type: "BooleanTypeAnnotation",
	})
	assertProp(props[2], {
		defaultValue: false,
		name: "opaque",
		optional: true,
		type: "BooleanTypeAnnotation",
	})
	assertProp(props[3], {
		defaultValue: "auto",
		name: "pointerEvents",
		optional: true,
		options: ["auto", "none", "box-none", "box-only"],
		type: "StringEnumTypeAnnotation",
	})
}

function assertProp(prop, expected) {
	assert.equal(prop.name, expected.name, `${expected.name} prop name mismatch.`)
	assert.equal(
		prop.optional,
		expected.optional,
		`${expected.name} optional marker mismatch.`,
	)
	assert.equal(
		prop.typeAnnotation?.type,
		expected.type,
		`${expected.name} type annotation mismatch.`,
	)
	assert.deepEqual(
		prop.typeAnnotation.default,
		expected.defaultValue,
		`${expected.name} default value mismatch.`,
	)

	if (expected.options) {
		assert.deepEqual(
			prop.typeAnnotation.options,
			expected.options,
			`${expected.name} enum options mismatch.`,
		)
	}
}

function assertIgnoredFilesAreDocumented(
	allSourceFiles,
	expectedFiles,
	ignoredFiles,
	installedRealPath,
) {
	for (const filePath of ignoredFiles.keys()) {
		assert.ok(
			allSourceFiles.includes(filePath),
			`Documented ignored installed codegen source file is missing: ${filePath}`,
		)
	}

	const classifiedFiles = new Set([...expectedFiles, ...ignoredFiles.keys()])
	const unclassifiedFiles = allSourceFiles.filter(
		(filePath) => !classifiedFiles.has(filePath),
	)
	if (unclassifiedFiles.length > 0) {
		throw new Error(
			[
				"Every JS/TS file under installed package codegenConfig.jsSrcsDir must be admitted or intentionally ignored.",
				...unclassifiedFiles.map((filePath) => `- ${filePath}`),
			].join("\n"),
		)
	}

	const ignoredButAdmitted = [...ignoredFiles.keys()].filter((filePath) =>
		filterJSFile(path.join(installedRealPath, filePath), null, null),
	)
	if (ignoredButAdmitted.length > 0) {
		throw new Error(
			[
				"Documented ignored installed files were admitted by React Native codegen.",
				...ignoredButAdmitted.map(
					(filePath) =>
						`- ${filePath}: ${ignoredFiles.get(filePath)}`,
				),
			].join("\n"),
		)
	}
}

function parseCliConfig(stdout) {
	const trimmed = stdout.trim()
	const jsonStart = trimmed.indexOf("{")
	const jsonEnd = trimmed.lastIndexOf("}")
	if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
		throw new Error(`React Native CLI config did not print JSON:\n${stdout}`)
	}

	return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1))
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

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
	writeFileSync(filePath, `${JSON.stringify(value, null, "\t")}\n`)
}

function requiredObject(value, message) {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(message)
	}
	return value
}

function requiredString(value, message) {
	if (typeof value !== "string" || value.length === 0) {
		throw new Error(message)
	}
	return value
}

function assertDirectory(dir, configName) {
	if (!existsSync(dir) || !statSync(dir).isDirectory()) {
		throw new Error(
			`${configName} must point at an existing directory: ${dir}`,
		)
	}
}

function assertPathInside(candidatePath, parentPath, message) {
	if (!isPathInside(candidatePath, parentPath)) {
		throw new Error(message)
	}
}

function assertPathOutside(candidatePath, parentPath, message) {
	if (isPathInside(candidatePath, parentPath)) {
		throw new Error(message)
	}
}

function walkFiles(dir) {
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

function isJavaScriptOrTypeScriptSource(filePath) {
	return /\.[cm]?[jt]sx?$/.test(filePath) && !filePath.endsWith(".d.ts")
}

function projectPath(...segments) {
	return path.join(rootDir, ...segments)
}

function toPackagePath(filePath) {
	return filePath.split(path.sep).join("/")
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

function run(command, args, options) {
	const result = spawnSync(command, args, {
		...options,
		encoding: "utf8",
		env: {
			...process.env,
			CI: "1",
			NO_COLOR: "1",
		},
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
