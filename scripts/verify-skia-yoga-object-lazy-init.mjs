#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")

verifyPublicImportIsLazy()
verifyCreateYogaNodeAccessIsLazyAndCached()
verifyYogaCanvasRuntimeCreatesRootNodeLazily()
verifyExplicitAccessIsLazyAndIdempotent()
verifyMissingNativeErrorIsDeferredAndClear()

console.log("SkiaYogaObject lazy-init verifier passed:")
console.log("- Importing the public source entrypoint did not box NitroModules.")
console.log("- Importing the public source entrypoint did not look up/install native bindings.")
console.log("- Importing the public source entrypoint did not create native hybrid objects.")
console.log("- Import-only access did not log or mutate globalThis.SkiaYoga.")
console.log("- Explicit createYogaNode() access boxed NitroModules once and created YogaNode objects at call time.")
console.log("- YogaCanvas runtime root creation still creates a YogaNode object lazily.")
console.log("- Explicit getSkiaYoga() access installed and created the native object exactly once.")
console.log("- Native-missing failures are reported when getSkiaYoga() is called.")

function verifyPublicImportIsLazy() {
	const harness = createHarness()
	const publicEntrypoint = harness.loadProjectModule("src/index.ts")

	assert.equal(
		typeof publicEntrypoint.YogaCanvas,
		"function",
		"public source entrypoint should still export YogaCanvas",
	)
	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"importing the public source entrypoint must not call TurboModuleRegistry.getEnforcing",
	)
	assert.equal(
		harness.calls.nitroBox,
		0,
		"importing the public source entrypoint must not call NitroModules.box",
	)
	assert.equal(
		harness.calls.nitroUnbox,
		0,
		"importing the public source entrypoint must not unbox NitroModules",
	)
	assert.equal(
		harness.calls.install,
		0,
		"importing the public source entrypoint must not install native bindings",
	)
	assert.deepEqual(
		harness.calls.createHybridObject,
		[],
		"importing the public source entrypoint must not create native hybrid objects",
	)
	assert.deepEqual(
		harness.calls.consoleLog,
		[],
		"importing the public source entrypoint must not log SkiaYoga initialization",
	)
	assert.equal(
		hasOwn(harness.global, "SkiaYoga"),
		false,
		"importing the public source entrypoint must not write globalThis.SkiaYoga",
	)
}

function verifyCreateYogaNodeAccessIsLazyAndCached() {
	const harness = createHarness({
		createHybridObject: createNativeObject,
	})
	const util = harness.loadProjectModule("src/util.ts")

	assert.equal(
		typeof util.createYogaNode,
		"function",
		"util should export createYogaNode",
	)
	assert.equal(
		harness.calls.nitroBox,
		0,
		"importing util directly must not call NitroModules.box",
	)
	assert.equal(
		harness.calls.nitroUnbox,
		0,
		"importing util directly must not unbox NitroModules",
	)
	assert.deepEqual(
		harness.calls.createHybridObject,
		[],
		"importing util directly must not create native hybrid objects",
	)

	const first = util.createYogaNode()
	const second = util.createYogaNode()

	assert.notEqual(first, second, "createYogaNode should create a new YogaNode per call")
	assert.equal(first.nativeName, "YogaNode", "first createYogaNode call should create a YogaNode")
	assert.equal(second.nativeName, "YogaNode", "second createYogaNode call should create a YogaNode")
	assert.equal(
		harness.calls.nitroBox,
		1,
		"createYogaNode should lazily box NitroModules exactly once across repeated calls",
	)
	assert.equal(
		harness.calls.nitroUnbox,
		2,
		"createYogaNode should unbox once per explicit node creation",
	)
	assert.deepEqual(
		harness.calls.createHybridObject,
		["YogaNode", "YogaNode"],
		"createYogaNode should create YogaNode hybrid objects at explicit call time",
	)
	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"createYogaNode should not look up the SkiaYoga TurboModule",
	)
	assert.equal(
		harness.calls.install,
		0,
		"createYogaNode should not install SkiaYoga native bindings",
	)
	assert.equal(
		hasOwn(harness.global, "SkiaYoga"),
		false,
		"createYogaNode should not write globalThis.SkiaYoga",
	)
}

function verifyYogaCanvasRuntimeCreatesRootNodeLazily() {
	const harness = createHarness({
		createHybridObject: createNativeObject,
	})
	const publicEntrypoint = harness.loadProjectModule("src/index.ts")

	assert.equal(
		harness.calls.nitroBox,
		0,
		"importing the public source entrypoint before YogaCanvas render must not call NitroModules.box",
	)

	publicEntrypoint.YogaCanvas({
		children: null,
	})

	assert.equal(
		harness.calls.nitroBox,
		1,
		"YogaCanvas root creation should lazily box NitroModules exactly once",
	)
	assert.equal(
		harness.calls.nitroUnbox,
		1,
		"YogaCanvas root creation should unbox NitroModules once",
	)
	assert.deepEqual(
		harness.calls.createHybridObject,
		["YogaNode"],
		"YogaCanvas root creation should create a YogaNode hybrid object at render time",
	)
	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"YogaCanvas root creation should not look up SkiaYoga until explicit SkiaYoga access",
	)
	assert.equal(
		harness.calls.install,
		0,
		"YogaCanvas root creation should not install SkiaYoga native bindings",
	)
}

function verifyExplicitAccessIsLazyAndIdempotent() {
	const hybridObject = { nativeName: "SkiaYoga" }
	const harness = createHarness({
		createHybridObject(name) {
			return { ...hybridObject, nativeName: name }
		},
	})
	const skiaYogaObject = harness.loadProjectModule("src/SkiaYogaObject.ts")

	assert.equal(
		typeof skiaYogaObject.getSkiaYoga,
		"function",
		"SkiaYogaObject should export the explicit getSkiaYoga accessor",
	)
	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"importing SkiaYogaObject directly must not call TurboModuleRegistry.getEnforcing",
	)

	const first = skiaYogaObject.getSkiaYoga()
	const second = skiaYogaObject.getSkiaYoga()

	assert.equal(first, second, "getSkiaYoga should return the cached hybrid object")
	assert.equal(first.nativeName, "SkiaYoga", "getSkiaYoga should create the SkiaYoga hybrid object")
	assert.deepEqual(
		harness.calls.getEnforcing,
		["SkiaYoga"],
		"getSkiaYoga should look up the SkiaYoga TurboModule exactly once",
	)
	assert.equal(
		harness.calls.install,
		1,
		"getSkiaYoga should install native bindings exactly once",
	)
	assert.deepEqual(
		harness.calls.createHybridObject,
		["SkiaYoga"],
		"getSkiaYoga should create the SkiaYoga hybrid object exactly once",
	)
	assert.deepEqual(
		harness.calls.consoleLog,
		[],
		"getSkiaYoga should not log initialization",
	)
	assert.equal(
		hasOwn(harness.global, "SkiaYoga"),
		false,
		"getSkiaYoga should not write globalThis.SkiaYoga",
	)
}

function verifyMissingNativeErrorIsDeferredAndClear() {
	const harness = createHarness({
		getEnforcing() {
			throw new Error("native module unavailable")
		},
	})
	const skiaYogaObject = harness.loadProjectModule("src/SkiaYogaObject.ts")

	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"missing native availability must not be checked during import",
	)
	assert.throws(
		() => skiaYogaObject.getSkiaYoga(),
		/SkiaYoga TurboModule is not available.*linked.*YogaCanvas.*native module unavailable/s,
		"missing native availability should throw a clear error during explicit native access",
	)
	assert.deepEqual(
		harness.calls.getEnforcing,
		["SkiaYoga"],
		"missing native availability should be checked exactly once per explicit access",
	)
	assert.equal(
		harness.calls.install,
		0,
		"missing TurboModule should not attempt to install native bindings",
	)
	assert.deepEqual(
		harness.calls.createHybridObject,
		[],
		"missing TurboModule should not create the SkiaYoga hybrid object",
	)
	assert.equal(
		hasOwn(harness.global, "SkiaYoga"),
		false,
		"missing native access should not write globalThis.SkiaYoga",
	)
}

function createHarness(options = {}) {
	const calls = {
		codegenNativeComponent: [],
		consoleError: [],
		consoleLog: [],
		createHybridObject: [],
		getEnforcing: [],
		install: 0,
		nitroBox: 0,
		nitroUnbox: 0,
	}
	const moduleCache = new Map()
	const global = {
		clearInterval() {},
		console: {
			error(...args) {
				calls.consoleError.push(args)
			},
			log(...args) {
				calls.consoleLog.push(args)
			},
		},
		performance: {
			now() {
				return 0
			},
		},
		setInterval() {
			return 1
		},
	}
	global.globalThis = global

	const turboModule = {
		install() {
			calls.install += 1
			if (options.install) {
				return options.install()
			}
			return undefined
		},
	}
	const externalModules = new Map([
		[
			"@shopify/react-native-skia",
			{},
		],
		[
			"react",
			{
				__esModule: true,
				default: {
					createElement(type, props, ...children) {
						return { children, props, type }
					},
				},
				useCallback(callback) {
					return callback
				},
				useEffect() {},
				useLayoutEffect() {},
				useMemo(factory) {
					return factory()
				},
				useRef(initialValue) {
					return { current: initialValue }
				},
			},
		],
		[
			"react-native",
			{
				TurboModuleRegistry: {
					getEnforcing(name) {
						calls.getEnforcing.push(name)
						if (options.getEnforcing) {
							return options.getEnforcing(name)
						}
						return turboModule
					},
				},
				codegenNativeComponent(name) {
					calls.codegenNativeComponent.push(name)
					return name
				},
			},
		],
		[
			"react-native-gesture-handler",
			{
				GestureDetector({ children }) {
					return children
				},
			},
		],
		[
			"react-native-nitro-modules",
			{
				NitroModules: {
					box(value) {
						calls.nitroBox += 1
						return {
							unbox() {
								calls.nitroUnbox += 1
								return value
							},
						}
					},
					createHybridObject(name) {
						calls.createHybridObject.push(name)
						if (options.createHybridObject) {
							return options.createHybridObject(name)
						}
						return { nativeName: name }
					},
				},
			},
		],
	])

	const projectStubs = new Map([
		[
			projectPath("src/Reconciler.ts"),
			{
				reconciler: {
					createContainer() {
						return {}
					},
					flushPassiveEffects() {},
					flushSyncWork() {},
					updateContainer() {},
					updateContainerSync() {},
				},
			},
		],
		[
			projectPath("src/interactivity.ts"),
			{
				YogaInteractionRegistry: class YogaInteractionRegistry {},
			},
		],
		[
			projectPath("src/specs/SkiaYoga.nitro.ts"),
			{
				NodeCommandKind: {
					Group: "Group",
				},
			},
		],
		[
			projectPath("src/specs/SkiaYogaViewNativeComponent.ts"),
			{
				__esModule: true,
				default: "SkiaYogaViewNativeComponent",
			},
		],
		[
			projectPath("src/useCanvasGestures.ts"),
			{
				useCanvasGestures() {
					return {}
				},
			},
		],
	])

	function loadProjectModule(relativePath) {
		return loadModule(projectPath(relativePath))
	}

	function loadModule(filePath) {
		const normalizedPath = normalizePath(filePath)
		if (projectStubs.has(normalizedPath)) {
			return projectStubs.get(normalizedPath)
		}
		if (moduleCache.has(normalizedPath)) {
			return moduleCache.get(normalizedPath).exports
		}

		const code = readFileSync(normalizedPath, "utf8")
		const compiled = ts.transpileModule(code, {
			compilerOptions: {
				esModuleInterop: true,
				jsx: ts.JsxEmit.React,
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
			},
			fileName: normalizedPath,
			reportDiagnostics: true,
		})
		const diagnostics = compiled.diagnostics ?? []
		if (diagnostics.length > 0) {
			throw new Error(
				`Failed to transpile ${path.relative(rootDir, normalizedPath)}:\n` +
					ts.formatDiagnosticsWithColorAndContext(
						diagnostics,
						typescriptDiagnosticHost,
					),
			)
		}

		const module = { exports: {} }
		moduleCache.set(normalizedPath, module)

		const script = new vm.Script(
			`(function(exports, require, module, __filename, __dirname) {\n${compiled.outputText}\n})`,
			{
				filename: normalizedPath,
			},
		)
		const moduleFunction = script.runInNewContext(global)
		moduleFunction(
			module.exports,
			(specifier) => requireFrom(normalizedPath, specifier),
			module,
			normalizedPath,
			path.dirname(normalizedPath),
		)

		return module.exports
	}

	function requireFrom(parentPath, specifier) {
		if (externalModules.has(specifier)) {
			return externalModules.get(specifier)
		}

		if (specifier.startsWith(".")) {
			return loadModule(resolveProjectSpecifier(parentPath, specifier))
		}

		throw new Error(
			`Unexpected external import while verifying lazy init: ${specifier}`,
		)
	}

	return {
		calls,
		global,
		loadProjectModule,
	}
}

function resolveProjectSpecifier(parentPath, specifier) {
	const basePath = path.resolve(path.dirname(parentPath), specifier)
	const candidates = [
		basePath,
		`${basePath}.ts`,
		`${basePath}.tsx`,
		`${basePath}.js`,
		`${basePath}.mjs`,
		path.join(basePath, "index.ts"),
		path.join(basePath, "index.tsx"),
	]
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate
		}
	}

	throw new Error(
		`Could not resolve ${specifier} from ${path.relative(rootDir, parentPath)}`,
	)
}

function hasOwn(value, property) {
	return Object.prototype.hasOwnProperty.call(value, property)
}

function createNativeObject(name) {
	return {
		getChildren() {
			return []
		},
		nativeName: name,
		setCommand() {},
		setStyle() {},
	}
}

function normalizePath(filePath) {
	return path.resolve(filePath)
}

function projectPath(...segments) {
	return normalizePath(path.join(rootDir, ...segments))
}

const typescriptDiagnosticHost = {
	getCanonicalFileName(fileName) {
		return fileName
	},
	getCurrentDirectory() {
		return rootDir
	},
	getNewLine() {
		return "\n"
	},
}
