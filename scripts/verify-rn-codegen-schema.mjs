#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const rootRequire = createRequire(import.meta.url)
const { combineSchemasInFileList } = rootRequire(
	"@react-native/codegen/lib/cli/combine/combine-js-to-schema",
)
const { filterJSFile } = rootRequire(
	"@react-native/codegen/lib/cli/combine/combine-utils",
)

const packageJson = readJson(projectPath("package.json"))
const codegenConfig = requiredObject(
	packageJson.codegenConfig,
	"package.json must declare codegenConfig.",
)
const codegenName = requiredString(
	codegenConfig.name,
	"package.json codegenConfig.name must be a string.",
)
const jsSrcsDir = requiredString(
	codegenConfig.jsSrcsDir,
	"package.json codegenConfig.jsSrcsDir must be a string.",
)
assert.equal(
	codegenConfig.type,
	"all",
	'package.json codegenConfig.type must remain "all" so both NativeModules and components are generated.',
)

const codegenSrcDir = path.resolve(rootDir, jsSrcsDir)
const codegenPackageDir = toPackagePath(path.relative(rootDir, codegenSrcDir))
assertPathWithinRoot(codegenSrcDir, "codegenConfig.jsSrcsDir")
assertDirectory(codegenSrcDir, "package.json codegenConfig.jsSrcsDir")

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

const sourceFiles = walkFiles(codegenSrcDir)
	.filter(isJavaScriptOrTypeScriptSource)
	.map((filePath) => toPackagePath(path.relative(rootDir, filePath)))
	.sort()
const admittedFiles = sourceFiles
	.filter((filePath) => filterJSFile(projectPath(filePath), null, null))
	.sort()

assert.deepEqual(
	admittedFiles,
	expectedAdmittedFiles,
	[
		"React Native codegen must admit only the current package spec files.",
		`Configured directory: ${jsSrcsDir}`,
		`Expected: ${expectedAdmittedFiles.join(", ")}`,
		`Actual: ${admittedFiles.join(", ")}`,
	].join("\n"),
)
assertIgnoredFilesAreDocumented(
	sourceFiles,
	expectedAdmittedFiles,
	intentionallyIgnoredFiles,
)

const schema = combineSchemasInFileList(
	[codegenSrcDir],
	null,
	null,
	codegenName,
)

assert.equal(
	schema.libraryName,
	codegenName,
	"React Native codegen schema libraryName must come from package.json codegenConfig.name.",
)
assert.deepEqual(
	Object.keys(schema.modules).sort(),
	["NativeSkiaYoga", "SkiaYogaView"],
	"React Native codegen schema must expose exactly the current package modules.",
)
assertNativeSkiaYogaModule(schema.modules.NativeSkiaYoga)
assertSkiaYogaViewModule(schema.modules.SkiaYogaView)

console.log("React Native codegen schema verifier passed:")
console.log(`- Used package.json codegenConfig.name: ${codegenName}.`)
console.log(`- Used package.json codegenConfig.jsSrcsDir: ${jsSrcsDir}.`)
console.log(
	`- Local @react-native/codegen admitted ${admittedFiles.length} package spec files.`,
)
console.log(
	"- NativeSkiaYoga is a NativeModule named SkiaYoga with install(): void.",
)
console.log(
	"- SkiaYogaView is a component with the expected props and ReactNativeCoreViewProps.",
)
console.log(
	`- Documented ${intentionallyIgnoredFiles.size} non-RN-codegen files under ${codegenPackageDir}.`,
)

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
	assert.equal(
		prop.name,
		expected.name,
		`${expected.name} prop name mismatch.`,
	)
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
) {
	for (const filePath of ignoredFiles.keys()) {
		assert.ok(
			allSourceFiles.includes(filePath),
			`Documented ignored codegen source file is missing: ${filePath}`,
		)
	}

	const classifiedFiles = new Set([...expectedFiles, ...ignoredFiles.keys()])
	const unclassifiedFiles = allSourceFiles.filter(
		(filePath) => !classifiedFiles.has(filePath),
	)
	if (unclassifiedFiles.length > 0) {
		throw new Error(
			[
				"Every JS/TS file under package.json codegenConfig.jsSrcsDir must be admitted or intentionally ignored.",
				...unclassifiedFiles.map((filePath) => `- ${filePath}`),
			].join("\n"),
		)
	}

	const ignoredButAdmitted = [...ignoredFiles.keys()].filter((filePath) =>
		filterJSFile(projectPath(filePath), null, null),
	)
	if (ignoredButAdmitted.length > 0) {
		throw new Error(
			[
				"Documented ignored files were admitted by React Native codegen.",
				...ignoredButAdmitted.map(
					(filePath) =>
						`- ${filePath}: ${ignoredFiles.get(filePath)}`,
				),
			].join("\n"),
		)
	}
}

function readJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"))
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

function assertPathWithinRoot(filePath, configName) {
	const relativePath = path.relative(rootDir, filePath)
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		throw new Error(`${configName} must resolve inside the package root.`)
	}
}

function assertDirectory(dir, configName) {
	if (!existsSync(dir) || !statSync(dir).isDirectory()) {
		throw new Error(
			`${configName} must point at an existing directory: ${dir}`,
		)
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
