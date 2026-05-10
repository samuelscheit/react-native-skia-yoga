#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const rootRequire = createRequire(import.meta.url)
const exampleRequire = createRequire(path.join(exampleDir, "package.json"))
const { transformSync } = rootRequire("@babel/core")
const transformTypescriptPlugin = rootRequire("@babel/plugin-transform-typescript")
const workletsPlugin = rootRequire("react-native-worklets/plugin")
const ignoredAstKeys = new Set([
	"comments",
	"end",
	"extra",
	"leadingComments",
	"loc",
	"range",
	"start",
	"trailingComments",
])

verifyPublicImportIsLazy()
verifyNativeSkiaYogaDirectImportIsLazy()
verifyCreateYogaNodeAccessIsLazyAndCached()
verifyCreateYogaNodeWorkletsTransformUsesLazyAccessor()
verifyCreateYogaNodeExampleWorkletsTransformUsesLazyAccessor()
verifyYogaCanvasRuntimeCreatesRootNodeLazily()
verifyExplicitAccessIsLazyAndIdempotent()
verifyMissingNativeErrorIsDeferredAndClear()

console.log("SkiaYogaObject lazy-init verifier passed:")
console.log("- Importing the public source entrypoint did not box NitroModules.")
console.log("- Importing the public source entrypoint did not look up/install native bindings.")
console.log("- Importing the public source entrypoint did not create native hybrid objects.")
console.log("- Importing the public source entrypoint registered only the SkiaYogaView native component.")
console.log("- Direct NativeSkiaYoga deep import deferred TurboModule lookup until install().")
console.log("- Import-only access did not log or mutate globalThis.SkiaYoga.")
console.log("- Explicit createYogaNode() access boxed NitroModules once and created YogaNode objects at call time.")
console.log("- Worklets transform kept createYogaNode() on lazyNitroModulesBox.current.unbox().")
console.log("- Example Babel/Expo transform kept createYogaNode() on lazyNitroModulesBox.current.unbox().")
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
	assertPublicImportGraphLoaded(harness)
	assert.deepEqual(
		harness.calls.codegenNativeComponent,
		["SkiaYogaView"],
		'importing the public source entrypoint should register only codegenNativeComponent("SkiaYogaView")',
	)
	assert.equal(
		harness.calls.reactReconciler,
		1,
		"importing the public source entrypoint should initialize the real Reconciler host config once",
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

function verifyNativeSkiaYogaDirectImportIsLazy() {
	const harness = createHarness()
	const nativeSkiaYoga = harness.loadProjectModule("src/specs/NativeSkiaYoga.ts")

	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"direct NativeSkiaYoga import must not call TurboModuleRegistry.getEnforcing",
	)
	assert.equal(
		typeof nativeSkiaYoga.default?.install,
		"function",
		"direct NativeSkiaYoga import should expose the generated install() method",
	)
	assert.deepEqual(
		harness.calls.getEnforcing,
		[],
		"reading NativeSkiaYoga.install must not look up the TurboModule before explicit invocation",
	)

	nativeSkiaYoga.default.install()

	assert.deepEqual(
		harness.calls.getEnforcing,
		["SkiaYoga"],
		"NativeSkiaYoga.install() should look up the SkiaYoga TurboModule exactly once",
	)
	assert.equal(
		harness.calls.install,
		1,
		"NativeSkiaYoga.install() should delegate to the native TurboModule install method",
	)

	const missingHarness = createHarness({
		getEnforcing() {
			throw new Error("native module unavailable")
		},
	})
	const missingNativeSkiaYoga = missingHarness.loadProjectModule(
		"src/specs/NativeSkiaYoga.ts",
	)

	assert.deepEqual(
		missingHarness.calls.getEnforcing,
		[],
		"missing native availability must not be checked during direct NativeSkiaYoga import",
	)
	assert.throws(
		() => missingNativeSkiaYoga.default.install(),
		/native module unavailable/,
		"missing native availability should throw only when NativeSkiaYoga.install() is called",
	)
	assert.deepEqual(
		missingHarness.calls.getEnforcing,
		["SkiaYoga"],
		"missing native availability should be checked exactly once during explicit NativeSkiaYoga.install() access",
	)
	assert.equal(
		missingHarness.calls.install,
		0,
		"missing TurboModule should not attempt to install native bindings",
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

function verifyCreateYogaNodeWorkletsTransformUsesLazyAccessor() {
	const utilPath = projectPath("src/util.ts")
	const transformed = transformSync(readFileSync(utilPath, "utf8"), {
		ast: true,
		babelrc: false,
		code: true,
		configFile: false,
		filename: utilPath,
		plugins: [transformTypescriptPlugin, workletsPlugin],
		sourceType: "module",
	})

	assert.ok(
		transformed?.ast,
		"Worklets transform should produce an AST for src/util.ts",
	)

	assertCreateYogaNodeWorkletsTransformUsesLazyAccessor(
		transformed.ast,
		`${utilPath}.root-worklet.js`,
		"root Worklets transform",
	)
}

function verifyCreateYogaNodeExampleWorkletsTransformUsesLazyAccessor() {
	const utilPath = projectPath("src/util.ts")
	const exampleBabel = exampleRequire("@babel/core")
	const transformed = exampleBabel.transformSync(
		readFileSync(utilPath, "utf8"),
		{
			ast: true,
			babelrc: false,
			code: true,
			configFile: path.join(exampleDir, "babel.config.js"),
			cwd: exampleDir,
			filename: utilPath,
			root: exampleDir,
			sourceType: "module",
		},
	)

	assert.ok(
		transformed?.ast,
		"Example Babel/Expo transform should produce an AST for src/util.ts",
	)

	assertCreateYogaNodeWorkletsTransformUsesLazyAccessor(
		transformed.ast,
		`${utilPath}.example-worklet.js`,
		"example Babel/Expo transform",
	)
}

function assertCreateYogaNodeWorkletsTransformUsesLazyAccessor(
	ast,
	workletFilename,
	contextDescription,
) {
	const closureKeys = findCreateYogaNodeClosureKeys(ast)

	assert.ok(
		closureKeys.includes("lazyNitroModulesBox"),
		`${contextDescription} createYogaNode.__closure must capture lazyNitroModulesBox`,
	)
	assert.equal(
		closureKeys.includes("NitroModules"),
		false,
		`${contextDescription} createYogaNode.__closure must not capture NitroModules directly`,
	)
	assert.deepEqual(
		closureKeys,
		["lazyNitroModulesBox"],
		`${contextDescription} createYogaNode.__closure should only capture the lazy NitroModules box accessor`,
	)

	const workletCode = findCreateYogaNodeWorkletCode(ast)
	const workletAst = parseTransformedJavaScript(workletCode, workletFilename)

	assert.equal(
		containsIdentifier(workletAst, "NitroModules"),
		false,
		`${contextDescription} createYogaNode worklet body must not reference NitroModules directly`,
	)
	assert.equal(
		containsLazyNitroModulesBoxUnboxCall(workletAst),
		true,
		`${contextDescription} createYogaNode worklet body must use lazyNitroModulesBox.current.unbox()`,
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
	assertPublicImportGraphLoaded(harness)
	assert.deepEqual(
		harness.calls.codegenNativeComponent,
		["SkiaYogaView"],
		'importing the public source entrypoint before YogaCanvas render should register only codegenNativeComponent("SkiaYogaView")',
	)
	assert.equal(
		harness.calls.reactReconciler,
		1,
		"importing the public source entrypoint before YogaCanvas render should initialize the real Reconciler host config once",
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
		harness.calls.codegenNativeComponent,
		["SkiaYogaView"],
		"YogaCanvas render should not register additional native components",
	)
	assert.equal(
		harness.calls.reconcilerCreateContainer,
		1,
		"YogaCanvas root creation should create a reconciler container once",
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
		reactReconciler: 0,
		reconcilerCreateContainer: 0,
	}
	const moduleCache = new Map()
	const loadedProjectModules = new Set()
	const global = {
		clearInterval() {},
		clearTimeout() {},
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
		queueMicrotask() {},
		requestAnimationFrame() {
			return 1
		},
		cancelAnimationFrame() {},
		setInterval() {
			return 1
		},
		setTimeout() {
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
			{
				BlurStyle: {
					Inner: 3,
					Normal: 0,
					Outer: 2,
					Solid: 1,
				},
				FillType: {
					EvenOdd: 1,
					InverseEvenOdd: 3,
					InverseWinding: 2,
					Winding: 0,
				},
				PointMode: {
					Lines: 1,
					Points: 0,
					Polygon: 2,
				},
			},
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
				Gesture: {
					Manual() {
						return createGestureMock("manual")
					},
					Simultaneous(...gestures) {
						return createGestureMock("simultaneous", gestures)
					},
				},
				GestureDetector({ children }) {
					return children
				},
			},
		],
		[
			"react-native-reanimated",
			{
				isSharedValue,
				runOnJS(callback) {
					return callback
				},
				useSharedValue(value) {
					return { value }
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
		[
			"react-native-worklets",
			{
				createSynchronizable(value) {
					return {
						value,
						setBlocking(nextValue) {
							this.value = nextValue
						},
					}
				},
				executeOnUIRuntimeSync(callback) {
					return (...args) => callback(...args)
				},
				runOnJS(callback) {
					return callback
				},
			},
		],
		[
			"react-reconciler",
			function createReactReconciler(config) {
				calls.reactReconciler += 1
				assert.equal(
					typeof config.createInstance,
					"function",
					"real Reconciler module should pass a host config with createInstance",
				)
				return {
					createContainer() {
						calls.reconcilerCreateContainer += 1
						return {}
					},
					flushPassiveEffects() {},
					flushSyncWork() {},
					updateContainer() {},
					updateContainerSync() {},
				}
			},
		],
		[
			"react-reconciler/constants",
			{
				DefaultEventPriority: 1,
			},
		],
	])

	function loadProjectModule(relativePath) {
		return loadModule(projectPath(relativePath))
	}

	function loadModule(filePath) {
		const normalizedPath = normalizePath(filePath)
		if (moduleCache.has(normalizedPath)) {
			return moduleCache.get(normalizedPath).exports
		}

		loadedProjectModules.add(normalizedPath)
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
		loadedProjectModules,
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

function assertPublicImportGraphLoaded(harness) {
	for (const relativePath of [
		"src/YogaCanvas.tsx",
		"src/Reconciler.ts",
		"src/SkiaYogaObject.ts",
		"src/interactivity.ts",
		"src/nativeId.ts",
		"src/specs/SkiaYoga.nitro.ts",
		"src/specs/SkiaYogaViewNativeComponent.ts",
		"src/specs/commands.ts",
		"src/useCanvasGestures.ts",
		"src/util.ts",
	]) {
		assert.equal(
			harness.loadedProjectModules.has(projectPath(relativePath)),
			true,
			`public source entrypoint should load the real ${relativePath} module`,
		)
	}
	assert.equal(
		harness.loadedProjectModules.has(projectPath("src/specs/NativeSkiaYoga.ts")),
		false,
		"public source entrypoint must not load the generated NativeSkiaYoga runtime spec",
	)
}

function createGestureMock(kind, gestures = []) {
	return {
		gestures,
		handlers: {},
		kind,
		manualActivation(value) {
			this.manualActivationValue = value
			return this
		},
		shouldCancelWhenOutside(value) {
			this.shouldCancelWhenOutsideValue = value
			return this
		},
		onTouchesDown(handler) {
			this.handlers.touchesDown = handler
			return this
		},
		onTouchesMove(handler) {
			this.handlers.touchesMove = handler
			return this
		},
		onTouchesUp(handler) {
			this.handlers.touchesUp = handler
			return this
		},
		onTouchesCancelled(handler) {
			this.handlers.touchesCancelled = handler
			return this
		},
	}
}

function isSharedValue(value) {
	return typeof value === "object" && value !== null && "value" in value
}

function normalizePath(filePath) {
	return path.resolve(filePath)
}

function projectPath(...segments) {
	return normalizePath(path.join(rootDir, ...segments))
}

function findCreateYogaNodeClosureKeys(ast) {
	let closureKeys

	walkAst(ast, (node) => {
		if (closureKeys != null || node.type !== "AssignmentExpression") {
			return
		}
		if (!isStaticMemberExpression(node.left, "createYogaNode", "__closure")) {
			return
		}

		assert.equal(
			node.right.type,
			"ObjectExpression",
			"transformed createYogaNode.__closure must be assigned an object literal",
		)
		closureKeys = getObjectExpressionKeys(node.right).sort()
	})

	assert.ok(
		closureKeys,
		"Worklets transform should assign createYogaNode.__closure",
	)

	return closureKeys
}

function findCreateYogaNodeWorkletCode(ast) {
	const candidates = []

	walkAst(ast, (node) => {
		if (
			node.type !== "ObjectProperty" ||
			getStaticPropertyName(node.key) !== "code" ||
			node.value.type !== "StringLiteral" ||
			!node.value.value.includes("createYogaNode")
		) {
			return
		}

		candidates.push(node.value.value)
	})

	assert.equal(
		candidates.length,
		1,
		"Worklets transform should emit one createYogaNode initData code string",
	)

	return candidates[0]
}

function parseTransformedJavaScript(code, filename) {
	const parsed = transformSync(code, {
		ast: true,
		babelrc: false,
		code: false,
		configFile: false,
		filename,
		sourceType: "script",
	})

	assert.ok(parsed?.ast, `Babel should parse transformed JavaScript for ${filename}`)

	return parsed.ast
}

function containsIdentifier(ast, name) {
	let found = false

	walkAst(ast, (node) => {
		if (node.type === "Identifier" && node.name === name) {
			found = true
		}
	})

	return found
}

function containsLazyNitroModulesBoxUnboxCall(ast) {
	let found = false

	walkAst(ast, (node) => {
		if (
			node.type === "CallExpression" &&
			isLazyNitroModulesBoxUnboxCallee(node.callee)
		) {
			found = true
		}
	})

	return found
}

function isLazyNitroModulesBoxUnboxCallee(node) {
	if (!isStaticMemberProperty(node, "unbox")) {
		return false
	}

	const currentAccess = node.object
	return (
		isStaticMemberProperty(currentAccess, "current") &&
		currentAccess.object.type === "Identifier" &&
		currentAccess.object.name === "lazyNitroModulesBox"
	)
}

function isStaticMemberExpression(node, objectName, propertyName) {
	return (
		isStaticMemberProperty(node, propertyName) &&
		node.object.type === "Identifier" &&
		node.object.name === objectName
	)
}

function isStaticMemberProperty(node, propertyName) {
	if (node?.type !== "MemberExpression") {
		return false
	}

	return getStaticPropertyName(node.property, node.computed) === propertyName
}

function getObjectExpressionKeys(node) {
	return node.properties.map((property) => {
		assert.equal(
			property.type,
			"ObjectProperty",
			"transformed createYogaNode.__closure must only use object properties",
		)

		const key = getStaticPropertyName(property.key, property.computed)
		assert.ok(
			key,
			"transformed createYogaNode.__closure must use static property names",
		)

		return key
	})
}

function getStaticPropertyName(node, computed = false) {
	if (node.type === "Identifier" && !computed) {
		return node.name
	}
	if (node.type === "StringLiteral") {
		return node.value
	}

	return undefined
}

function walkAst(value, visitor) {
	if (value == null || typeof value !== "object") {
		return
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			walkAst(item, visitor)
		}
		return
	}
	if (typeof value.type !== "string") {
		return
	}

	visitor(value)

	for (const [key, child] of Object.entries(value)) {
		if (ignoredAstKeys.has(key)) {
			continue
		}

		if (Array.isArray(child)) {
			for (const item of child) {
				walkAst(item, visitor)
			}
		} else {
			walkAst(child, visitor)
		}
	}
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
