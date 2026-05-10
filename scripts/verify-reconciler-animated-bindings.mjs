#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")

verifyYogaCanvasAnimationBindingModeMapping()
verifyNativeCommandBindingMirrorsSharedValue()
verifyJsCommandBindingModeRunsCommandUpdateCallback()
verifyStyleAnimatedListenerUpdatesStyleAndContinuousRedraw()
verifyNativeBindingRefCountsAndDetachCleanup()
verifyClearContainerCleansSubtreeAndRootChildren()

console.log("Reconciler animated binding verifier passed:")
console.log(
	'- YogaCanvas still maps animationBindingMode="native" to native Reconciler command bindings.',
)
console.log(
	"- Native command binding mode mirrors supported SharedValue command props through Synchronizable.setBlocking.",
)
console.log(
	"- JS command binding mode updates host commands through SharedValue listener callbacks and invalidates.",
)
console.log(
	"- Animated style listeners update host styles, invalidate, and toggle continuous redraw state.",
)
console.log(
	"- Shared native bindings are ref-counted across nodes and detach cleanup removes only the final listener.",
)
console.log(
	"- clearContainer recursively removes animated listeners, unregisters interactions, and clears root children.",
)

function verifyYogaCanvasAnimationBindingModeMapping() {
	const sourceFile = ts.createSourceFile(
		projectPath("src/YogaCanvas.tsx"),
		readFileSync(projectPath("src/YogaCanvas.tsx"), "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	)
	let foundNativeBindingMode = false

	walkTs(sourceFile, (node) => {
		if (!ts.isPropertyAssignment(node)) {
			return
		}
		if (propertyNameText(node.name) !== "nativeCommandBindingsEnabled") {
			return
		}

		const initializer = skipParentheses(node.initializer)
		if (
			ts.isBinaryExpression(initializer) &&
			initializer.operatorToken.kind ===
				ts.SyntaxKind.EqualsEqualsEqualsToken &&
			ts.isIdentifier(initializer.left) &&
			initializer.left.text === "animationBindingMode" &&
			ts.isStringLiteral(initializer.right) &&
			initializer.right.text === "native"
		) {
			foundNativeBindingMode = true
		}
	})

	assert.equal(
		foundNativeBindingMode,
		true,
		'YogaCanvas should pass nativeCommandBindingsEnabled: animationBindingMode === "native" into the Reconciler root container.',
	)
}

function verifyNativeCommandBindingMirrorsSharedValue() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const radius = harness.makeSharedValue(12, "native.radius")
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: true,
	})

	const node = config.createInstance("circle", { radius }, container)
	const mirror = only(harness.calls.createSynchronizable).mirror
	const firstCommand = only(node.commands)

	assert.equal(
		radius.listenerCount(),
		1,
		"native binding should register one SharedValue listener",
	)
	assert.equal(
		harness.calls.sharedAddListener.length,
		1,
		"native binding should call SharedValue.addListener once",
	)
	assert.equal(
		firstCommand.type,
		"circle",
		"native binding should still set the circle host command",
	)
	assert.equal(
		firstCommand.data.radius,
		mirror,
		"native binding should pass the Synchronizable mirror to the native command payload",
	)
	assertToggle(
		calls.nativeAnimationActive,
		0,
		node,
		true,
		"native binding should mark the node as natively animated",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"activating native animation should invalidate once",
	)

	radius.emit(18)

	assert.equal(
		harness.calls.setBlocking.length,
		1,
		"SharedValue emits should update the native mirror with setBlocking",
	)
	assert.equal(
		only(harness.calls.setBlocking).mirror,
		mirror,
		"SharedValue emits should update the original mirror object",
	)
	assert.equal(
		mirror.value,
		18,
		"setBlocking should store the latest native mirror value",
	)
	assert.equal(
		node.commands.length,
		1,
		"native mirror emits should not rebuild host commands on JS",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"native mirror emits should not invalidate through the JS listener path",
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		0,
		"native mirror emits should not bridge through runOnJS",
	)

	config.commitUpdate(node, "circle", { radius }, { radius: 7 }, null)

	assert.equal(
		radius.listenerCount(),
		0,
		"commitUpdate to a plain command prop should remove the native listener",
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		"native listener cleanup should remove an existing SharedValue listener id",
	)
	assertToggle(
		calls.nativeAnimationActive,
		1,
		node,
		false,
		"commitUpdate should mark the native animation inactive",
	)
	assert.equal(
		calls.invalidations.length,
		2,
		"deactivating native animation should invalidate once",
	)
	assert.equal(
		last(node.commands).data.radius,
		7,
		"commitUpdate should apply the resolved plain command prop",
	)

	const setBlockingCalls = harness.calls.setBlocking.length
	const commandCalls = node.commands.length
	radius.emit(22)

	assert.equal(
		harness.calls.setBlocking.length,
		setBlockingCalls,
		"removed native listeners should not receive later SharedValue emits",
	)
	assert.equal(
		node.commands.length,
		commandCalls,
		"removed native bindings should not rebuild commands after cleanup",
	)
}

function verifyJsCommandBindingModeRunsCommandUpdateCallback() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const radius = harness.makeSharedValue(5, "js.radius")
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: false,
	})

	const node = config.createInstance("circle", { radius }, container)

	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		"JS binding mode should not create a native Synchronizable mirror for supported command props",
	)
	assert.equal(
		radius.listenerCount(),
		1,
		"JS binding mode should register a SharedValue listener",
	)
	assert.equal(
		last(node.commands).data.radius,
		5,
		"JS binding mode should resolve the initial command prop value",
	)
	assert.equal(
		calls.nativeAnimationActive.length,
		0,
		"JS binding mode should not mark the node as natively animated",
	)
	assert.equal(
		calls.invalidations.length,
		0,
		"initial JS command binding should not invalidate",
	)

	radius.emit(9)

	assert.deepEqual(
		only(harness.calls.runOnJSCalls).args,
		["radius", 9],
		"JS SharedValue command updates should bridge listener key and value through runOnJS",
	)
	assert.equal(
		last(node.commands).data.radius,
		9,
		"JS SharedValue command updates should rebuild the host command with the latest value",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"JS SharedValue command updates should invalidate the container",
	)

	const commandCallsAfterEmit = node.commands.length
	config.commitUpdate(node, "circle", { radius }, { radius: 11 }, null)

	assert.equal(
		radius.listenerCount(),
		0,
		"commitUpdate to a plain command prop should remove the JS listener",
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		"JS listener cleanup should remove an existing SharedValue listener id",
	)
	assert.equal(
		last(node.commands).data.radius,
		11,
		"commitUpdate should apply the resolved plain JS-mode command prop",
	)

	radius.emit(13)

	assert.equal(
		node.commands.length,
		commandCallsAfterEmit + 1,
		"removed JS listeners should not rebuild commands after cleanup",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"removed JS listeners should not invalidate after cleanup",
	)
}

function verifyStyleAnimatedListenerUpdatesStyleAndContinuousRedraw() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const translateX = harness.makeSharedValue(4, "style.translateX")
	const style = harness.makeVmValue(
		`({
			matrix: { source: "manual" },
			transform: [{ translateX: bindings.translateX }, { translateY: 2 }],
		})`,
		{ translateX },
	)
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: true,
	})

	const node = config.createInstance(
		"group",
		{
			rasterize: true,
			style,
		},
		container,
	)

	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		"style SharedValues should use JS listeners rather than native command mirrors",
	)
	assert.equal(
		translateX.listenerCount(),
		1,
		"animated style should register a SharedValue listener",
	)
	assert.equal(
		last(node.commands).data.rasterize,
		true,
		"group command props should still be applied while style bindings are active",
	)
	assert.equal(
		last(node.styles).transform[0].translateX,
		4,
		"animated style should resolve the initial SharedValue snapshot",
	)
	assert.equal(
		last(node.styles).matrix.source,
		"manual",
		"non-animated matrix style objects should remain in the style payload",
	)
	assertToggle(
		calls.continuousRedraw,
		0,
		node,
		true,
		"object matrix style should enable continuous redraw",
	)
	assert.equal(
		calls.invalidations.length,
		0,
		"initial continuous redraw activation is tracked by callback, not by Reconciler invalidation",
	)

	translateX.emit(6)

	assert.deepEqual(
		only(harness.calls.runOnJSCalls).args,
		["transform.0.translateX", 6],
		"style SharedValue updates should bridge the nested listener key through runOnJS",
	)
	assert.equal(
		last(node.styles).transform[0].translateX,
		6,
		"style SharedValue updates should rebuild the host style with the latest value",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"style SharedValue updates should invalidate the container",
	)

	const styleCallsAfterEmit = node.styles.length
	config.commitUpdate(
		node,
		"group",
		{ rasterize: true, style },
		{ rasterize: false, style: {} },
		null,
	)

	assert.equal(
		translateX.listenerCount(),
		0,
		"commitUpdate should remove the old style listener",
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		"style listener cleanup should remove an existing SharedValue listener id",
	)
	assertToggle(
		calls.continuousRedraw,
		1,
		node,
		false,
		"removing object matrix style should disable continuous redraw",
	)
	assert.equal(
		last(node.commands).data.rasterize,
		false,
		"commitUpdate should still update command props while style cleanup runs",
	)
	assert.deepEqual(
		last(node.styles),
		{},
		"commitUpdate should apply the next resolved style",
	)

	translateX.emit(8)

	assert.equal(
		node.styles.length,
		styleCallsAfterEmit + 1,
		"removed style listeners should not rebuild styles after cleanup",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"removed style listeners should not invalidate after cleanup",
	)
}

function verifyNativeBindingRefCountsAndDetachCleanup() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const sharedRadius = harness.makeSharedValue(2, "shared.native.radius")
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: true,
	})

	const firstNode = config.createInstance(
		"circle",
		{ radius: sharedRadius },
		container,
	)
	const secondNode = config.createInstance(
		"circle",
		{ radius: sharedRadius },
		container,
	)
	const mirror = only(harness.calls.createSynchronizable).mirror

	assert.equal(
		harness.calls.sharedAddListener.length,
		1,
		"shared native bindings should register only one SharedValue listener",
	)
	assert.equal(
		last(firstNode.commands).data.radius,
		mirror,
		"first node should receive the shared native mirror",
	)
	assert.equal(
		last(secondNode.commands).data.radius,
		mirror,
		"second node should receive the shared native mirror",
	)
	assertToggle(
		calls.nativeAnimationActive,
		0,
		firstNode,
		true,
		"first node should become natively animated",
	)
	assertToggle(
		calls.nativeAnimationActive,
		1,
		secondNode,
		true,
		"second node should become natively animated",
	)

	config.detachDeletedInstance(firstNode)

	assert.equal(
		sharedRadius.listenerCount(),
		1,
		"detaching one node should keep the shared native listener while another node still references it",
	)
	assert.equal(
		harness.calls.sharedRemoveListener.length,
		0,
		"detaching one of two shared native bindings should not remove the SharedValue listener",
	)
	assertToggle(
		calls.nativeAnimationActive,
		2,
		firstNode,
		false,
		"detaching the first node should mark it inactive",
	)
	assert.equal(
		calls.unregistered[0]?.node,
		firstNode,
		"detachDeletedInstance should unregister the first node from interactions",
	)

	sharedRadius.emit(3)

	assert.equal(
		only(harness.calls.setBlocking).nextValue,
		3,
		"the shared native listener should keep updating the mirror after one node is detached",
	)

	config.detachDeletedInstance(secondNode)

	assert.equal(
		sharedRadius.listenerCount(),
		0,
		"detaching the final native binding should remove the SharedValue listener",
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		"final native binding cleanup should remove an existing SharedValue listener id",
	)
	assertToggle(
		calls.nativeAnimationActive,
		3,
		secondNode,
		false,
		"detaching the final node should mark it inactive",
	)
	assert.equal(
		calls.unregistered[1]?.node,
		secondNode,
		"detachDeletedInstance should unregister the second node from interactions",
	)

	sharedRadius.emit(4)

	assert.equal(
		harness.calls.setBlocking.length,
		1,
		"removed final native listeners should not update the mirror after cleanup",
	)
}

function verifyClearContainerCleansSubtreeAndRootChildren() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const childRadius = harness.makeSharedValue(1, "clear.child.radius")
	const { calls, container, rootNode } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: false,
	})
	const parentStyle = harness.makeVmValue(
		`({ matrix: { source: "manual" } })`,
	)
	const parentNode = config.createInstance(
		"group",
		{
			style: parentStyle,
		},
		container,
	)
	const childNode = config.createInstance(
		"circle",
		{ radius: childRadius },
		container,
	)

	config.appendInitialChild(parentNode, childNode)
	config.appendChildToContainer(container, parentNode)

	assert.deepEqual(
		rootNode.getChildren(),
		[parentNode],
		"test setup should attach parent to root",
	)
	assert.deepEqual(
		parentNode.getChildren(),
		[childNode],
		"test setup should attach child to parent",
	)
	assert.equal(
		childRadius.listenerCount(),
		1,
		"test setup should register the child JS listener",
	)

	config.clearContainer(container)

	assert.deepEqual(
		rootNode.getChildren(),
		[],
		"clearContainer should remove all root children",
	)
	assert.equal(
		only(harness.calls.removeAllChildren).node,
		rootNode,
		"clearContainer should delegate to the root node removeAllChildren host command",
	)
	assert.equal(
		childRadius.listenerCount(),
		0,
		"clearContainer should recursively remove child SharedValue listeners",
	)
	assertToggle(
		calls.continuousRedraw,
		0,
		parentNode,
		true,
		"test setup should enable parent continuous redraw",
	)
	assertToggle(
		calls.continuousRedraw,
		1,
		parentNode,
		false,
		"clearContainer should disable parent continuous redraw",
	)
	assert.deepEqual(
		calls.unregistered.map((entry) => entry.node),
		[parentNode, childNode],
		"clearContainer should unregister each cleaned node from interactions",
	)

	const commandCalls = childNode.commands.length
	const invalidations = calls.invalidations.length
	childRadius.emit(2)

	assert.equal(
		childNode.commands.length,
		commandCalls,
		"clearContainer cleanup should prevent later child command updates",
	)
	assert.equal(
		calls.invalidations.length,
		invalidations,
		"clearContainer cleanup should prevent later child invalidations",
	)
}

function createReconcilerHarness() {
	const calls = {
		createContainer: [],
		createHybridObject: [],
		createSynchronizable: [],
		executeOnUIRuntimeSync: [],
		insertChild: [],
		reactReconcilerConfigs: [],
		removeAllChildren: [],
		removeChild: [],
		runOnJS: [],
		runOnJSCalls: [],
		setBlocking: [],
		setCommand: [],
		setStyle: [],
		sharedAddListener: [],
		sharedRemoveListener: [],
		uiRuntimeCalls: [],
	}
	const moduleCache = new Map()
	let nextNodeId = 1

	const global = {
		clearTimeout() {},
		console,
		queueMicrotask(fn) {
			fn()
		},
		setTimeout() {
			return 1
		},
	}
	global.globalThis = global
	const context = vm.createContext(global)

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
			"react-native-reanimated",
			{
				isSharedValue(value) {
					return Boolean(value?.__isVerifierSharedValue)
				},
			},
		],
		[
			"react-native-nitro-modules",
			{
				NitroModules: {
					box(value) {
						return {
							unbox() {
								return value
							},
						}
					},
					createHybridObject(name) {
						calls.createHybridObject.push(name)
						assert.equal(
							name,
							"YogaNode",
							"Reconciler verifier should only request YogaNode hybrid objects",
						)
						return makeYogaNode(name)
					},
				},
			},
		],
		[
			"react-native-worklets",
			{
				createSynchronizable(value) {
					const mirror = {
						__isVerifierSynchronizable: true,
						value,
						setBlocking(nextValue) {
							calls.setBlocking.push({ mirror, nextValue })
							mirror.value = nextValue
						},
					}
					calls.createSynchronizable.push({ mirror, value })
					return mirror
				},
				executeOnUIRuntimeSync(callback) {
					calls.executeOnUIRuntimeSync.push(callback)
					return (...args) => {
						calls.uiRuntimeCalls.push({ args, callback })
						return callback(...args)
					}
				},
				runOnJS(callback) {
					calls.runOnJS.push(callback)
					return (...args) => {
						calls.runOnJSCalls.push({ args, callback })
						return callback(...args)
					}
				},
			},
		],
		[
			"react-reconciler",
			function createReactReconciler(config) {
				calls.reactReconcilerConfigs.push(config)
				return {
					__hostConfig: config,
					createContainer(containerInfo) {
						calls.createContainer.push(containerInfo)
						return { containerInfo }
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

	function loadReconcilerHostConfig() {
		loadProjectModule("src/Reconciler.ts")
		return only(calls.reactReconcilerConfigs)
	}

	function loadProjectModule(relativePath) {
		return loadModule(projectPath(relativePath))
	}

	function loadModule(filePath) {
		const normalizedPath = path.resolve(filePath)
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
		const moduleFunction = script.runInContext(context)
		moduleFunction(
			module.exports,
			(specifier) => requireFrom(normalizedPath, specifier),
			module,
			normalizedPath,
			path.dirname(normalizedPath),
		)

		return module.exports
	}

	function makeVmValue(expression, bindings = {}) {
		global.bindings = bindings
		try {
			return vm.runInContext(expression, context)
		} finally {
			delete global.bindings
		}
	}

	function requireFrom(parentPath, specifier) {
		if (externalModules.has(specifier)) {
			return externalModules.get(specifier)
		}

		if (specifier.startsWith(".")) {
			return loadModule(resolveProjectSpecifier(parentPath, specifier))
		}

		throw new Error(
			`Unexpected external import while verifying Reconciler animated bindings: ${specifier}`,
		)
	}

	function makeSharedValue(initialValue, label) {
		const listeners = new Map()
		return {
			__isVerifierSharedValue: true,
			label,
			value: initialValue,
			addListener(id, listener) {
				assert.equal(
					listeners.has(id),
					false,
					`SharedValue ${label} should not reuse listener id ${id}`,
				)
				listeners.set(id, listener)
				calls.sharedAddListener.push({
					id,
					label,
					listener,
					shared: this,
				})
			},
			emit(nextValue) {
				this.value = nextValue
				for (const listener of [...listeners.values()]) {
					listener(nextValue)
				}
			},
			listenerCount() {
				return listeners.size
			},
			removeListener(id) {
				const had = listeners.delete(id)
				calls.sharedRemoveListener.push({
					had,
					id,
					label,
					shared: this,
				})
			},
		}
	}

	function makeRootContainer({ nativeCommandBindingsEnabled }) {
		const rootNode = makeYogaNode("RootYogaNode")
		const containerCalls = {
			continuousRedraw: [],
			invalidations: [],
			nativeAnimationActive: [],
			unregistered: [],
			configured: [],
		}
		const container = {
			interactions: {
				configureNode(node, props) {
					containerCalls.configured.push({ node, props })
				},
				unregisterNode(node) {
					containerCalls.unregistered.push({ node })
				},
			},
			invalidate() {
				containerCalls.invalidations.push({})
			},
			nativeCommandBindingsEnabled,
			node: rootNode,
			setContinuousRedraw(node, enabled) {
				containerCalls.continuousRedraw.push({ enabled, node })
			},
			setNativeAnimationActive(node, enabled) {
				containerCalls.nativeAnimationActive.push({ enabled, node })
			},
		}

		return {
			calls: containerCalls,
			container,
			rootNode,
		}
	}

	function makeYogaNode(nativeName) {
		const node = {
			children: [],
			commands: [],
			id: nextNodeId,
			nativeName,
			styles: [],
			getChildren() {
				return [...node.children]
			},
			insertChild(child, beforeChildOrIndex) {
				const existingIndex = node.children.indexOf(child)
				if (existingIndex >= 0) {
					node.children.splice(existingIndex, 1)
				}

				if (typeof beforeChildOrIndex === "number") {
					node.children.splice(beforeChildOrIndex, 0, child)
				} else if (
					beforeChildOrIndex &&
					node.children.includes(beforeChildOrIndex)
				) {
					node.children.splice(
						node.children.indexOf(beforeChildOrIndex),
						0,
						child,
					)
				} else {
					node.children.push(child)
				}

				calls.insertChild.push({
					beforeChildOrIndex,
					child,
					parent: node,
				})
			},
			removeAllChildren() {
				node.children = []
				calls.removeAllChildren.push({ node })
			},
			removeChild(child) {
				node.children = node.children.filter((entry) => entry !== child)
				calls.removeChild.push({ child, parent: node })
			},
			setCommand(command) {
				node.commands.push(command)
				calls.setCommand.push({ command, node })
			},
			setStyle(style) {
				node.styles.push(style)
				calls.setStyle.push({ node, style })
			},
		}
		nextNodeId += 1
		return node
	}

	return {
		calls,
		loadReconcilerHostConfig,
		makeRootContainer,
		makeSharedValue,
		makeVmValue,
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

function assertToggle(entries, index, node, enabled, message) {
	const entry = entries[index]
	assert.ok(entry, `${message}: missing toggle at index ${index}`)
	assert.equal(entry.node, node, `${message}: toggled the wrong node`)
	assert.equal(entry.enabled, enabled, message)
}

function only(items) {
	assert.equal(items.length, 1, "expected exactly one item")
	return items[0]
}

function last(items) {
	assert.ok(items.length > 0, "expected at least one item")
	return items[items.length - 1]
}

function walkTs(node, visitor) {
	visitor(node)
	ts.forEachChild(node, (child) => walkTs(child, visitor))
}

function skipParentheses(node) {
	let current = node
	while (ts.isParenthesizedExpression(current)) {
		current = current.expression
	}
	return current
}

function propertyNameText(name) {
	if (
		ts.isIdentifier(name) ||
		ts.isStringLiteral(name) ||
		ts.isNumericLiteral(name)
	) {
		return name.text
	}
	return undefined
}

function projectPath(...segments) {
	return path.resolve(rootDir, ...segments)
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
