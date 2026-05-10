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
verifyReconcilerWorkletsTransformPreservesAnimatedBindings()
verifyReconcilerExampleWorkletsTransformPreservesAnimatedBindings()
verifyUseCanvasGesturesWorkletsTransformPreservesGestureCallbacks()
verifyUseCanvasGesturesExampleWorkletsTransformPreservesGestureCallbacks()
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
console.log("- Worklets transform preserved Reconciler animated listener/native binding worklets.")
console.log("- Example Babel/Expo transform preserved Reconciler animated listener/native binding worklets.")
console.log("- Worklets transform preserved YogaCanvas gesture callback worklets and runOnJS dispatches.")
console.log("- Example Babel/Expo transform preserved YogaCanvas gesture callback worklets and runOnJS dispatches.")
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
	const { ast, filePath: utilPath } =
		transformProjectFileWithRootWorklets("src/util.ts")

	assertCreateYogaNodeWorkletsTransformUsesLazyAccessor(
		ast,
		`${utilPath}.root-worklet.js`,
		"root Worklets transform",
	)
}

function verifyCreateYogaNodeExampleWorkletsTransformUsesLazyAccessor() {
	const { ast, filePath: utilPath } =
		transformProjectFileWithExampleBabel("src/util.ts")

	assertCreateYogaNodeWorkletsTransformUsesLazyAccessor(
		ast,
		`${utilPath}.example-worklet.js`,
		"example Babel/Expo transform",
	)
}

function verifyReconcilerWorkletsTransformPreservesAnimatedBindings() {
	const { ast, filePath: reconcilerPath } =
		transformProjectFileWithRootWorklets("src/Reconciler.ts")

	assertReconcilerWorkletsTransformPreservesAnimatedBindings(
		ast,
		`${reconcilerPath}.root-worklet.js`,
		"root Worklets transform",
	)
}

function verifyReconcilerExampleWorkletsTransformPreservesAnimatedBindings() {
	const { ast, filePath: reconcilerPath } =
		transformProjectFileWithExampleBabel("src/Reconciler.ts")

	assertReconcilerWorkletsTransformPreservesAnimatedBindings(
		ast,
		`${reconcilerPath}.example-worklet.js`,
		"example Babel/Expo transform",
	)
}

function verifyUseCanvasGesturesWorkletsTransformPreservesGestureCallbacks() {
	const { ast, filePath: gesturesPath } = transformProjectFileWithRootWorklets(
		"src/useCanvasGestures.ts",
	)

	assertUseCanvasGesturesWorkletsTransformPreservesGestureCallbacks(
		ast,
		`${gesturesPath}.root-worklet.js`,
		"root Worklets transform",
	)
}

function verifyUseCanvasGesturesExampleWorkletsTransformPreservesGestureCallbacks() {
	const { ast, filePath: gesturesPath } = transformProjectFileWithExampleBabel(
		"src/useCanvasGestures.ts",
	)

	assertUseCanvasGesturesWorkletsTransformPreservesGestureCallbacks(
		ast,
		`${gesturesPath}.example-worklet.js`,
		"example Babel/Expo transform",
	)
}

function transformProjectFileWithRootWorklets(relativePath) {
	const filePath = projectPath(relativePath)
	const transformed = transformSync(readFileSync(filePath, "utf8"), {
		ast: true,
		babelrc: false,
		code: true,
		configFile: false,
		filename: filePath,
		plugins: [transformTypescriptPlugin, workletsPlugin],
		sourceType: "module",
	})

	assert.ok(
		transformed?.ast,
		`Worklets transform should produce an AST for ${relativePath}`,
	)

	return {
		ast: transformed.ast,
		filePath,
	}
}

function transformProjectFileWithExampleBabel(relativePath) {
	const filePath = projectPath(relativePath)
	const exampleBabel = exampleRequire("@babel/core")
	const transformed = exampleBabel.transformSync(
		readFileSync(filePath, "utf8"),
		{
			ast: true,
			babelrc: false,
			code: true,
			configFile: path.join(exampleDir, "babel.config.js"),
			cwd: exampleDir,
			filename: filePath,
			root: exampleDir,
			sourceType: "module",
		},
	)

	assert.ok(
		transformed?.ast,
		`Example Babel/Expo transform should produce an AST for ${relativePath}`,
	)

	return {
		ast: transformed.ast,
		filePath,
	}
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

function assertReconcilerWorkletsTransformPreservesAnimatedBindings(
	ast,
	workletFilename,
	contextDescription,
) {
	const worklets = collectTransformedWorklets(ast, contextDescription)

	assertWorkletNames(
		worklets,
		["ReconcilerTs1", "ReconcilerTs2", "ReconcilerTs3", "ReconcilerTs4"],
		`${contextDescription} Reconciler transform`,
	)
	assert.equal(
		countIdentifierCalleeCalls(ast, "executeOnUIRuntimeSync"),
		4,
		`${contextDescription} Reconciler transform should keep four executeOnUIRuntimeSync call sites`,
	)

	for (const workletName of ["ReconcilerTs1", "ReconcilerTs2"]) {
		const remover = getRequiredTransformedWorklet(
			worklets,
			workletName,
			contextDescription,
		)
		assertWorkletClosureKeys(
			remover,
			[],
			contextDescription,
			`${workletName} remove-listener worklet`,
		)

		const removerAst = parseRequiredWorkletCode(remover, workletFilename)
		assertWorkletFunctionParams(
			removerAst,
			workletName,
			["sharedValue", "listenerId"],
			contextDescription,
		)
		assert.equal(
			countStaticMemberCalls(removerAst, "sharedValue", "removeListener"),
			1,
			`${contextDescription} ${workletName} should remove exactly one SharedValue listener`,
		)
		assert.equal(
			containsIdentifier(removerAst, "runOnJS"),
			false,
			`${contextDescription} ${workletName} should not bridge to JS while removing listeners`,
		)
	}

	const listenerUpdate = getRequiredTransformedWorklet(
		worklets,
		"ReconcilerTs3",
		contextDescription,
	)
	assertWorkletClosureKeys(
		listenerUpdate,
		["runOnJS"],
		contextDescription,
		"animated listener update worklet",
	)
	const listenerUpdateAst = parseRequiredWorkletCode(
		listenerUpdate,
		workletFilename,
	)
	assertWorkletFunctionParams(
		listenerUpdateAst,
		"ReconcilerTs3",
		["sharedValue", "listenerKey", "currentListenerId", "onUpdateOnJS"],
		contextDescription,
	)
	assert.equal(
		containsStaticMemberCall(listenerUpdateAst, "sharedValue", "addListener"),
		true,
		`${contextDescription} animated listener update worklet should preserve sharedValue.addListener`,
	)
	assert.equal(
		containsRunOnJSCallbackCall(listenerUpdateAst, "onUpdateOnJS", [
			"listenerKey",
			"nextValue",
		]),
		true,
		`${contextDescription} animated listener update worklet should bridge listener updates through runOnJS(onUpdateOnJS)`,
	)

	const nativeBinding = getRequiredTransformedWorklet(
		worklets,
		"ReconcilerTs4",
		contextDescription,
	)
	assertWorkletClosureKeys(
		nativeBinding,
		[],
		contextDescription,
		"native binding mirror worklet",
	)
	const nativeBindingAst = parseRequiredWorkletCode(
		nativeBinding,
		workletFilename,
	)
	assertWorkletFunctionParams(
		nativeBindingAst,
		"ReconcilerTs4",
		["sharedValue", "mirror", "currentListenerId"],
		contextDescription,
	)
	assert.equal(
		containsStaticMemberCall(nativeBindingAst, "sharedValue", "addListener"),
		true,
		`${contextDescription} native binding mirror worklet should preserve sharedValue.addListener`,
	)
	assert.equal(
		containsStaticMemberCall(nativeBindingAst, "mirror", "setBlocking"),
		true,
		`${contextDescription} native binding mirror worklet should preserve mirror.setBlocking(nextValue)`,
	)
	assert.equal(
		containsIdentifier(nativeBindingAst, "runOnJS"),
		false,
		`${contextDescription} native binding mirror worklet should not capture or call runOnJS`,
	)
}

function assertUseCanvasGesturesWorkletsTransformPreservesGestureCallbacks(
	ast,
	workletFilename,
	contextDescription,
) {
	const worklets = collectTransformedWorklets(ast, contextDescription)

	assertWorkletNames(
		worklets,
		[
			"getPrimaryTouch",
			"makePanEvent",
			"makePointerEvent",
			"useCanvasGesturesTs4",
			"useCanvasGesturesTs5",
			"useCanvasGesturesTs6",
			"useCanvasGesturesTs7",
		],
		`${contextDescription} useCanvasGestures transform`,
	)
	assertGestureBuilderFactory(
		ast,
		"onTouchesDown",
		"useCanvasGesturesTs7",
		contextDescription,
	)
	assertGestureBuilderFactory(
		ast,
		"onTouchesMove",
		"useCanvasGesturesTs6",
		contextDescription,
	)
	assertGestureBuilderFactory(
		ast,
		"onTouchesUp",
		"useCanvasGesturesTs5",
		contextDescription,
	)
	assertGestureBuilderFactory(
		ast,
		"onTouchesCancelled",
		"useCanvasGesturesTs4",
		contextDescription,
	)

	const primaryTouch = getRequiredTransformedWorklet(
		worklets,
		"getPrimaryTouch",
		contextDescription,
	)
	assertWorkletClosureKeys(
		primaryTouch,
		[],
		contextDescription,
		"getPrimaryTouch worklet",
	)
	const primaryTouchAst = parseRequiredWorkletCode(
		primaryTouch,
		workletFilename,
	)
	assert.equal(
		containsStaticMemberPropertyName(primaryTouchAst, "changedTouches"),
		true,
		`${contextDescription} getPrimaryTouch worklet should preserve changedTouches access`,
	)
	assert.equal(
		containsStaticMemberPropertyName(primaryTouchAst, "allTouches"),
		true,
		`${contextDescription} getPrimaryTouch worklet should preserve allTouches fallback access`,
	)

	const pointerEvent = getRequiredTransformedWorklet(
		worklets,
		"makePointerEvent",
		contextDescription,
	)
	assertWorkletClosureKeys(
		pointerEvent,
		["getPrimaryTouch"],
		contextDescription,
		"makePointerEvent worklet",
	)
	const pointerEventAst = parseRequiredWorkletCode(
		pointerEvent,
		workletFilename,
	)
	assert.equal(
		containsIdentifierCalleeCall(pointerEventAst, "getPrimaryTouch"),
		true,
		`${contextDescription} makePointerEvent worklet should call getPrimaryTouch from its closure`,
	)
	assert.equal(
		containsIdentifier(pointerEventAst, "runOnJS"),
		false,
		`${contextDescription} makePointerEvent helper worklet should stay UI-only`,
	)

	const panEvent = getRequiredTransformedWorklet(
		worklets,
		"makePanEvent",
		contextDescription,
	)
	assertWorkletClosureKeys(
		panEvent,
		["getPrimaryTouch"],
		contextDescription,
		"makePanEvent worklet",
	)
	const panEventAst = parseRequiredWorkletCode(panEvent, workletFilename)
	assert.equal(
		containsIdentifierCalleeCall(panEventAst, "getPrimaryTouch"),
		true,
		`${contextDescription} makePanEvent worklet should call getPrimaryTouch from its closure`,
	)
	for (const fieldName of ["changeX", "translationX", "cancelled"]) {
		assert.equal(
			containsIdentifier(panEventAst, fieldName),
			true,
			`${contextDescription} makePanEvent worklet should preserve ${fieldName} in pan event payload`,
		)
	}

	const touchesDown = getRequiredTransformedWorklet(
		worklets,
		"useCanvasGesturesTs7",
		contextDescription,
	)
	assertWorkletClosureKeys(
		touchesDown,
		[
			"activeTag",
			"dispatchPressIn",
			"getPrimaryTouch",
			"lastX",
			"lastY",
			"makePointerEvent",
			"node",
			"panStarted",
			"pressedInside",
			"runOnJS",
			"startX",
			"startY",
		],
		contextDescription,
		"onTouchesDown worklet",
	)
	const touchesDownAst = parseRequiredWorkletCode(
		touchesDown,
		workletFilename,
	)
	assertWorkletFunctionParams(
		touchesDownAst,
		"useCanvasGesturesTs7",
		["event", "stateManager"],
		contextDescription,
	)
	assert.equal(
		containsStaticMemberCall(touchesDownAst, "node", "hitTest"),
		true,
		`${contextDescription} onTouchesDown worklet should preserve node.hitTest`,
	)
	assert.equal(
		containsStaticMemberCall(touchesDownAst, "stateManager", "activate"),
		true,
		`${contextDescription} onTouchesDown worklet should preserve stateManager.activate`,
	)
	assert.equal(
		containsRunOnJSCallbackCall(touchesDownAst, "dispatchPressIn", [
			"tag",
			"pressInEvent",
		]),
		true,
		`${contextDescription} onTouchesDown worklet should dispatch press-in through runOnJS`,
	)

	const touchesMove = getRequiredTransformedWorklet(
		worklets,
		"useCanvasGesturesTs6",
		contextDescription,
	)
	assertWorkletClosureKeys(
		touchesMove,
		[
			"PAN_START_DISTANCE_SQUARED",
			"activeTag",
			"dispatchPanStart",
			"dispatchPanUpdate",
			"dispatchPressIn",
			"dispatchPressOut",
			"getPrimaryTouch",
			"lastX",
			"lastY",
			"makePanEvent",
			"makePointerEvent",
			"node",
			"panStarted",
			"pressedInside",
			"runOnJS",
			"startX",
			"startY",
		],
		contextDescription,
		"onTouchesMove worklet",
	)
	const touchesMoveAst = parseRequiredWorkletCode(
		touchesMove,
		workletFilename,
	)
	assertWorkletFunctionParams(
		touchesMoveAst,
		"useCanvasGesturesTs6",
		["event"],
		contextDescription,
	)
	assert.equal(
		containsIdentifier(touchesMoveAst, "PAN_START_DISTANCE_SQUARED"),
		true,
		`${contextDescription} onTouchesMove worklet should preserve pan-start threshold use`,
	)
	assert.equal(
		containsStaticMemberCall(touchesMoveAst, "node", "hitTest"),
		true,
		`${contextDescription} onTouchesMove worklet should preserve node.hitTest for hover-in/out`,
	)
	for (const [callbackName, argumentNames] of [
		["dispatchPressOut", ["tag", "pressOutEvent"]],
		["dispatchPanStart", ["tag", "panStartEvent"]],
		["dispatchPressIn", ["tag", "nextEvent"]],
		["dispatchPressOut", ["tag", "nextEvent"]],
		["dispatchPanUpdate", ["tag", "panUpdateEvent"]],
	]) {
		assert.equal(
			containsRunOnJSCallbackCall(
				touchesMoveAst,
				callbackName,
				argumentNames,
			),
			true,
			`${contextDescription} onTouchesMove worklet should preserve runOnJS(${callbackName})(${argumentNames.join(", ")})`,
		)
	}

	const touchesUp = getRequiredTransformedWorklet(
		worklets,
		"useCanvasGesturesTs5",
		contextDescription,
	)
	assertWorkletClosureKeys(
		touchesUp,
		[
			"activeTag",
			"dispatchPanEnd",
			"dispatchPress",
			"dispatchPressOut",
			"lastX",
			"lastY",
			"makePanEvent",
			"makePointerEvent",
			"panStarted",
			"pressedInside",
			"runOnJS",
			"startX",
			"startY",
		],
		contextDescription,
		"onTouchesUp worklet",
	)
	const touchesUpAst = parseRequiredWorkletCode(touchesUp, workletFilename)
	assertWorkletFunctionParams(
		touchesUpAst,
		"useCanvasGesturesTs5",
		["event", "stateManager"],
		contextDescription,
	)
	for (const [callbackName, argumentNames] of [
		["dispatchPanEnd", ["tag", "panEndEvent"]],
		["dispatchPress", ["tag", "pressEvent"]],
		["dispatchPressOut", ["tag", "pressEvent"]],
	]) {
		assert.equal(
			containsRunOnJSCallbackCall(touchesUpAst, callbackName, argumentNames),
			true,
			`${contextDescription} onTouchesUp worklet should preserve runOnJS(${callbackName})(${argumentNames.join(", ")})`,
		)
	}
	assert.equal(
		containsStaticMemberCall(touchesUpAst, "stateManager", "end"),
		true,
		`${contextDescription} onTouchesUp worklet should preserve stateManager.end`,
	)

	const touchesCancelled = getRequiredTransformedWorklet(
		worklets,
		"useCanvasGesturesTs4",
		contextDescription,
	)
	assertWorkletClosureKeys(
		touchesCancelled,
		[
			"activeTag",
			"dispatchPanEnd",
			"dispatchPressOut",
			"lastX",
			"lastY",
			"makePanEvent",
			"makePointerEvent",
			"panStarted",
			"pressedInside",
			"runOnJS",
			"startX",
			"startY",
		],
		contextDescription,
		"onTouchesCancelled worklet",
	)
	const touchesCancelledAst = parseRequiredWorkletCode(
		touchesCancelled,
		workletFilename,
	)
	assertWorkletFunctionParams(
		touchesCancelledAst,
		"useCanvasGesturesTs4",
		["event", "stateManager"],
		contextDescription,
	)
	for (const [callbackName, argumentNames] of [
		["dispatchPanEnd", ["tag", "panCancelEvent"]],
		["dispatchPressOut", ["tag", "pressOutEvent"]],
	]) {
		assert.equal(
			containsRunOnJSCallbackCall(
				touchesCancelledAst,
				callbackName,
				argumentNames,
			),
			true,
			`${contextDescription} onTouchesCancelled worklet should preserve runOnJS(${callbackName})(${argumentNames.join(", ")})`,
		)
	}
	assert.equal(
		containsIdentifierCalleeCallWithBooleanArgument(
			touchesCancelledAst,
			"makePanEvent",
			true,
		),
		true,
		`${contextDescription} onTouchesCancelled worklet should preserve cancelled pan event creation`,
	)
	assert.equal(
		containsStaticMemberCall(touchesCancelledAst, "stateManager", "fail"),
		true,
		`${contextDescription} onTouchesCancelled worklet should preserve stateManager.fail`,
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

function collectTransformedWorklets(ast, contextDescription) {
	const codeByInitDataName = new Map()
	const worklets = new Map()

	walkAst(ast, (node) => {
		if (
			node.type === "VariableDeclarator" &&
			node.id.type === "Identifier" &&
			node.init?.type === "ObjectExpression"
		) {
			const code = getObjectStringProperty(node.init, "code")
			if (code != null) {
				codeByInitDataName.set(node.id.name, code)
			}
		}

		if (node.type !== "AssignmentExpression") {
			return
		}

		const closureWorkletName = getStaticMemberExpressionObjectName(
			node.left,
			"__closure",
		)
		if (closureWorkletName) {
			assert.equal(
				node.right.type,
				"ObjectExpression",
				`${contextDescription} ${closureWorkletName}.__closure must be assigned an object literal`,
			)
			getTransformedWorkletRecord(worklets, closureWorkletName).closureKeys =
				getObjectExpressionKeys(
					node.right,
					`${contextDescription} ${closureWorkletName}.__closure`,
				).sort()
			return
		}

		const hashWorkletName = getStaticMemberExpressionObjectName(
			node.left,
			"__workletHash",
		)
		if (hashWorkletName) {
			assert.equal(
				node.right.type,
				"NumericLiteral",
				`${contextDescription} ${hashWorkletName}.__workletHash must be numeric`,
			)
			getTransformedWorkletRecord(worklets, hashWorkletName).hash =
				node.right.value
			return
		}

		const initDataWorkletName = getStaticMemberExpressionObjectName(
			node.left,
			"__initData",
		)
		if (initDataWorkletName) {
			assert.equal(
				node.right.type,
				"Identifier",
				`${contextDescription} ${initDataWorkletName}.__initData must reference a generated init-data object`,
			)
			getTransformedWorkletRecord(worklets, initDataWorkletName).initDataName =
				node.right.name
		}
	})

	for (const worklet of worklets.values()) {
		if (worklet.initDataName) {
			worklet.code = codeByInitDataName.get(worklet.initDataName)
		}
	}

	return worklets
}

function getTransformedWorkletRecord(worklets, workletName) {
	if (!worklets.has(workletName)) {
		worklets.set(workletName, {
			code: undefined,
			closureKeys: undefined,
			hash: undefined,
			initDataName: undefined,
			name: workletName,
		})
	}

	return worklets.get(workletName)
}

function assertWorkletNames(worklets, expectedNames, contextDescription) {
	assert.deepEqual(
		[...worklets.keys()].sort(),
		[...expectedNames].sort(),
		`${contextDescription} should emit exactly the expected transformed worklet markers`,
	)
}

function getRequiredTransformedWorklet(
	worklets,
	workletName,
	contextDescription,
) {
	const worklet = worklets.get(workletName)

	assert.ok(
		worklet,
		`${contextDescription} should emit transformed markers for ${workletName}`,
	)
	assert.ok(
		worklet.closureKeys,
		`${contextDescription} ${workletName} should assign __closure`,
	)
	assert.equal(
		typeof worklet.hash,
		"number",
		`${contextDescription} ${workletName} should assign __workletHash`,
	)
	assert.equal(
		typeof worklet.code,
		"string",
		`${contextDescription} ${workletName} should assign __initData.code`,
	)

	return worklet
}

function assertWorkletClosureKeys(
	worklet,
	expectedKeys,
	contextDescription,
	workletDescription,
) {
	assert.deepEqual(
		worklet.closureKeys,
		[...expectedKeys].sort(),
		`${contextDescription} ${workletDescription} should capture only the expected closure values`,
	)
}

function parseRequiredWorkletCode(worklet, workletFilename) {
	assert.equal(
		typeof worklet.code,
		"string",
		`${worklet.name} should have transformed worklet code`,
	)

	return parseTransformedJavaScript(
		worklet.code,
		`${workletFilename}.${worklet.name}.js`,
	)
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

function containsIdentifierCalleeCall(ast, calleeName) {
	let found = false

	walkAst(ast, (node) => {
		if (
			node.type === "CallExpression" &&
			node.callee.type === "Identifier" &&
			node.callee.name === calleeName
		) {
			found = true
		}
	})

	return found
}

function containsIdentifierCalleeCallWithBooleanArgument(
	ast,
	calleeName,
	booleanValue,
) {
	let found = false

	walkAst(ast, (node) => {
		if (
			node.type !== "CallExpression" ||
			node.callee.type !== "Identifier" ||
			node.callee.name !== calleeName
		) {
			return
		}

		if (
			node.arguments.some(
				(argumentNode) =>
					argumentNode.type === "BooleanLiteral" &&
					argumentNode.value === booleanValue,
			)
		) {
			found = true
		}
	})

	return found
}

function countIdentifierCalleeCalls(ast, calleeName) {
	let count = 0

	walkAst(ast, (node) => {
		if (node.type === "CallExpression" && isNamedCallee(node.callee, calleeName)) {
			count += 1
		}
	})

	return count
}

function isNamedCallee(node, calleeName) {
	if (node.type === "Identifier") {
		return node.name === calleeName
	}

	if (isStaticMemberProperty(node, calleeName)) {
		return true
	}

	if (node.type === "SequenceExpression") {
		return node.expressions.some((expression) =>
			isNamedCallee(expression, calleeName),
		)
	}

	return false
}

function containsStaticMemberCall(ast, objectName, propertyName) {
	return countStaticMemberCalls(ast, objectName, propertyName) > 0
}

function countStaticMemberCalls(ast, objectName, propertyName) {
	let count = 0

	walkAst(ast, (node) => {
		if (
			node.type === "CallExpression" &&
			isStaticMemberExpression(node.callee, objectName, propertyName)
		) {
			count += 1
		}
	})

	return count
}

function containsStaticMemberPropertyName(ast, propertyName) {
	let found = false

	walkAst(ast, (node) => {
		if (isStaticMemberProperty(node, propertyName)) {
			found = true
		}
	})

	return found
}

function containsRunOnJSCallbackCall(ast, callbackName, expectedArgumentNames) {
	let found = false

	walkAst(ast, (node) => {
		if (node.type !== "CallExpression") {
			return
		}

		const runOnJSCall = node.callee
		if (
			runOnJSCall.type !== "CallExpression" ||
			runOnJSCall.callee.type !== "Identifier" ||
			runOnJSCall.callee.name !== "runOnJS"
		) {
			return
		}

		const callbackArgument = runOnJSCall.arguments[0]
		if (
			callbackArgument?.type !== "Identifier" ||
			callbackArgument.name !== callbackName
		) {
			return
		}

		if (
			expectedArgumentNames &&
			!identifierArgumentsEqual(node.arguments, expectedArgumentNames)
		) {
			return
		}

		found = true
	})

	return found
}

function identifierArgumentsEqual(argumentNodes, expectedNames) {
	if (argumentNodes.length !== expectedNames.length) {
		return false
	}

	return argumentNodes.every((argumentNode, index) => {
		return (
			argumentNode.type === "Identifier" &&
			argumentNode.name === expectedNames[index]
		)
	})
}

function assertWorkletFunctionParams(
	ast,
	functionName,
	expectedParamNames,
	contextDescription,
) {
	const declaration = findFunctionDeclaration(ast, functionName)

	assert.ok(
		declaration,
		`${contextDescription} should emit a ${functionName} function in worklet code`,
	)
	assert.deepEqual(
		declaration.params.map(getFunctionParamName),
		expectedParamNames,
		`${contextDescription} ${functionName} worklet should preserve its parameter list`,
	)
}

function findFunctionDeclaration(ast, functionName) {
	let declaration

	walkAst(ast, (node) => {
		if (
			declaration == null &&
			node.type === "FunctionDeclaration" &&
			node.id?.name === functionName
		) {
			declaration = node
		}
	})

	return declaration
}

function getFunctionParamName(param) {
	assert.equal(
		param.type,
		"Identifier",
		"transformed worklet function params should stay identifiers",
	)

	return param.name
}

function assertGestureBuilderFactory(
	ast,
	methodName,
	expectedWorkletName,
	contextDescription,
) {
	const workletNames = []

	walkAst(ast, (node) => {
		if (
			node.type !== "CallExpression" ||
			!isStaticMemberProperty(node.callee, methodName)
		) {
			return
		}

		const workletName = getFactoryCallWorkletName(node.arguments[0])
		if (workletName) {
			workletNames.push(workletName)
		}
	})

	assert.deepEqual(
		workletNames,
		[expectedWorkletName],
		`${contextDescription} ${methodName} should receive a transformed ${expectedWorkletName} worklet factory call`,
	)
}

function getFactoryCallWorkletName(node) {
	if (node?.type !== "CallExpression") {
		return undefined
	}

	const callee = node.callee
	if (
		callee.type !== "FunctionExpression" ||
		callee.id?.type !== "Identifier"
	) {
		return undefined
	}

	const factoryName = callee.id.name
	return factoryName.endsWith("Factory")
		? factoryName.slice(0, -"Factory".length)
		: undefined
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

function getStaticMemberExpressionObjectName(node, propertyName) {
	if (!isStaticMemberProperty(node, propertyName)) {
		return undefined
	}

	return node.object.type === "Identifier" ? node.object.name : undefined
}

function isStaticMemberProperty(node, propertyName) {
	if (node?.type !== "MemberExpression") {
		return false
	}

	return getStaticPropertyName(node.property, node.computed) === propertyName
}

function getObjectExpressionKeys(node, contextDescription = "object expression") {
	return node.properties.map((property) => {
		assert.equal(
			property.type,
			"ObjectProperty",
			`${contextDescription} must only use object properties`,
		)

		const key = getStaticPropertyName(property.key, property.computed)
		assert.ok(
			key,
			`${contextDescription} must use static property names`,
		)

		return key
	})
}

function getObjectStringProperty(node, propertyName) {
	for (const property of node.properties) {
		if (
			property.type === "ObjectProperty" &&
			getStaticPropertyName(property.key, property.computed) === propertyName &&
			property.value.type === "StringLiteral"
		) {
			return property.value.value
		}
	}

	return undefined
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
