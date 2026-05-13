#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")

verifyYogaCanvasGestureWiring()
verifyInteractionRegistryConfigAndCleanup()
verifyInteractionRegistryHitSlopValidation()
verifyUseCanvasGesturesPressRuntime()
verifyUseCanvasGesturesPanRuntime()
verifyUseCanvasGesturesCancellationRuntime()
verifyUseCanvasGesturesFailuresAndExternalComposition()

console.log("Gesture interaction runtime verifier passed:")
console.log(
	"- YogaCanvas source still creates a YogaInteractionRegistry and passes gesture/interactions/node into useCanvasGestures.",
)
console.log(
	"- YogaInteractionRegistry normalizes and finite-validates hitSlop, pointerEvents, preciseHit, event tags, dispatch order, and handler cleanup.",
)
console.log(
	"- useCanvasGestures press flow dispatches pressIn/pressOut/press through runOnJS with hit-test filtering and state transitions.",
)
console.log(
	"- useCanvasGestures pan flow applies the threshold, constructs pan payloads, dispatches panStart/panUpdate/panEnd, and resets state.",
)
console.log(
	"- useCanvasGestures cancellation paths dispatch cancelled pan/pressOut events and fail the gesture state manager.",
)
console.log(
	"- useCanvasGestures failure paths and external Gesture.Simultaneous composition are covered with local stubs.",
)

function verifyYogaCanvasGestureWiring() {
	const sourceFile = ts.createSourceFile(
		projectPath("src/YogaCanvas.tsx"),
		readFileSync(projectPath("src/YogaCanvas.tsx"), "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	)
	let createsInteractionRegistry = false
	let wiresUseCanvasGestures = false
	let gestureDetectorUsesCanvasGesture = false

	walkTs(sourceFile, (node) => {
		if (
			ts.isNewExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "YogaInteractionRegistry"
		) {
			createsInteractionRegistry = true
		}

		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === "useCanvasGestures"
		) {
			const firstArg = node.arguments[0]
			if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
				wiresUseCanvasGestures =
					objectPropertyIdentifier(firstArg, "externalGesture") ===
						"gesture" &&
					objectPropertyIdentifier(firstArg, "interactions") ===
						"interactions" &&
					objectPropertyIdentifier(firstArg, "node") === "node"
			}
		}

		if (
			ts.isJsxOpeningElement(node) &&
			ts.isIdentifier(node.tagName) &&
			node.tagName.text === "GestureDetector"
		) {
			for (const attribute of node.attributes.properties) {
				if (!ts.isJsxAttribute(attribute)) {
					continue
				}
				if (attribute.name.text !== "gesture") {
					continue
				}
				const initializer = attribute.initializer
				if (
					initializer &&
					ts.isJsxExpression(initializer) &&
					initializer.expression &&
					ts.isIdentifier(initializer.expression) &&
					initializer.expression.text === "canvasGesture"
				) {
					gestureDetectorUsesCanvasGesture = true
				}
			}
		}
	})

	assert.equal(
		createsInteractionRegistry,
		true,
		"YogaCanvas should create a YogaInteractionRegistry instance.",
	)
	assert.equal(
		wiresUseCanvasGestures,
		true,
		"YogaCanvas should pass gesture, interactions, and node into useCanvasGestures.",
	)
	assert.equal(
		gestureDetectorUsesCanvasGesture,
		true,
		"YogaCanvas should pass the useCanvasGestures result to GestureDetector.",
	)
}

function verifyInteractionRegistryConfigAndCleanup() {
	const harness = createGestureHarness()
	const { YogaInteractionRegistry } = harness.loadProjectModule(
		"src/interactivity.ts",
	)
	const registry = new YogaInteractionRegistry()
	const configs = []
	const calls = []
	const node = {
		setInteractionConfig(config) {
			configs.push(cloneInteractionConfig(config))
		},
	}
	const otherNode = {
		setInteractionConfig(config) {
			configs.push({
				...cloneInteractionConfig(config),
				otherNode: true,
			})
		},
	}
	const pointerEvent = makeExpectedPointerEvent(1, 10, 12)
	const panEvent = makeExpectedPanEvent(1, 16, 18, {
		changeX: 4,
		changeY: 6,
		translationX: 6,
		translationY: 8,
	})
	const handlers = {
		onPanEnd(event) {
			calls.push({ event, type: "panEnd" })
		},
		onPanStart(event) {
			calls.push({ event, type: "panStart" })
		},
		onPanUpdate(event) {
			calls.push({ event, type: "panUpdate" })
		},
		onPress(event) {
			calls.push({ event, type: "press" })
		},
		onPressIn(event) {
			calls.push({ event, type: "pressIn" })
		},
		onPressOut(event) {
			calls.push({ event, type: "pressOut" })
		},
	}

	registry.configureNode(node, {
		...handlers,
		hitSlop: {
			bottom: 6,
			horizontal: 3,
			left: 1,
			right: 5,
			top: 2,
			vertical: 4,
		},
		pointerEvents: "box-none",
		preciseHit: true,
	})

	assert.deepEqual(
		configs[0],
		{
			eventTag: 1,
			hitSlop: {
				bottom: 10,
				left: 4,
				right: 8,
				top: 6,
			},
			pointerEvents: "box-none",
			preciseHit: true,
		},
		"configureNode should register handlers and normalize object hitSlop.",
	)

	registry.dispatchPressIn(1, pointerEvent)
	registry.dispatchPress(1, pointerEvent)
	registry.dispatchPressOut(1, pointerEvent)
	registry.dispatchPanStart(1, panEvent)
	registry.dispatchPanUpdate(1, panEvent)
	registry.dispatchPanEnd(1, panEvent)
	registry.dispatchPress(999, pointerEvent)

	assert.deepEqual(
		calls.map((entry) => entry.type),
		["pressIn", "press", "pressOut", "panStart", "panUpdate", "panEnd"],
		"registry dispatch methods should call matching handlers in caller order and ignore unknown tags.",
	)
	assert.equal(
		calls.every((entry) => entry.event === pointerEvent || entry.event === panEvent),
		true,
		"registry dispatch should pass the original event object to handlers.",
	)

	registry.configureNode(node, {
		hitSlop: 2,
		onPress: "not a function",
		pointerEvents: "none",
	})

	assert.deepEqual(
		configs[1],
		{
			eventTag: 0,
			hitSlop: {
				bottom: 2,
				left: 2,
				right: 2,
				top: 2,
			},
			pointerEvents: "none",
			preciseHit: false,
		},
		"configureNode without function handlers should clear eventTag while preserving pointer config.",
	)

	registry.dispatchPress(1, pointerEvent)
	assert.deepEqual(
		calls.map((entry) => entry.type),
		["pressIn", "press", "pressOut", "panStart", "panUpdate", "panEnd"],
		"reconfiguring with no handlers should remove stale press handlers.",
	)

	registry.configureNode(node, {
		hitSlop: {
			vertical: 1,
		},
		onPress: handlers.onPress,
		preciseHit: true,
	})

	assert.deepEqual(
		configs[2],
		{
			eventTag: 1,
			hitSlop: {
				bottom: 1,
				left: 0,
				right: 0,
				top: 1,
			},
			pointerEvents: "auto",
			preciseHit: true,
		},
		"reconfiguring the same node should reuse its event tag and default pointerEvents to auto.",
	)

	registry.configureNode(otherNode, {
		onPress: handlers.onPress,
	})

	assert.equal(
		configs[3]?.eventTag,
		2,
		"configureNode should allocate a distinct event tag for a second node.",
	)
	assert.deepEqual(
		configs[3],
		{
			eventTag: 2,
			hitSlop: {
				bottom: 0,
				left: 0,
				right: 0,
				top: 0,
			},
			otherNode: true,
			pointerEvents: "auto",
			preciseHit: false,
		},
		"configureNode should default omitted hitSlop to empty insets.",
	)

	registry.unregisterNode(node)
	assert.deepEqual(
		configs[4],
		{
			eventTag: 0,
			hitSlop: {
				bottom: 0,
				left: 0,
				right: 0,
				top: 0,
			},
			pointerEvents: "auto",
			preciseHit: false,
		},
		"unregisterNode should reset native interaction config.",
	)

	registry.dispatchPress(1, pointerEvent)
	registry.dispatchPress(2, pointerEvent)

	assert.deepEqual(
		calls.map((entry) => entry.type),
		[
			"pressIn",
			"press",
			"pressOut",
			"panStart",
			"panUpdate",
			"panEnd",
			"press",
		],
		"unregisterNode should remove the first node handlers without disturbing the second node.",
	)
}

function verifyInteractionRegistryHitSlopValidation() {
	const harness = createGestureHarness()
	const { YogaInteractionRegistry } = harness.loadProjectModule(
		"src/interactivity.ts",
	)
	const registry = new YogaInteractionRegistry()
	const configs = []
	const calls = []
	const node = {
		setInteractionConfig(config) {
			configs.push(cloneInteractionConfig(config))
		},
	}
	const invalidNode = {
		setInteractionConfig(config) {
			configs.push({
				...cloneInteractionConfig(config),
				invalidNode: true,
			})
		},
	}
	const otherNode = {
		setInteractionConfig(config) {
			configs.push({
				...cloneInteractionConfig(config),
				otherNode: true,
			})
		},
	}
	const pointerEvent = makeExpectedPointerEvent(1, 10, 12)

	registry.configureNode(node, {
		hitSlop: {
			bottom: 4,
			horizontal: 5,
			left: 1,
			right: 2,
			top: 3,
			vertical: 6,
		},
		onPress() {
			calls.push("original")
		},
		pointerEvents: "box-only",
		preciseHit: true,
	})

	assert.deepEqual(
		configs[0],
		{
			eventTag: 1,
			hitSlop: {
				bottom: 10,
				left: 6,
				right: 7,
				top: 9,
			},
			pointerEvents: "box-only",
			preciseHit: true,
		},
		"valid object hitSlop should validate leaves and combined edge-axis values.",
	)

	const combinedOverflow = 2e38
	const invalidCases = [
		{ hitSlop: Number.NaN, label: "scalar NaN" },
		{ hitSlop: Infinity, label: "scalar Infinity" },
		{ hitSlop: -Infinity, label: "scalar -Infinity" },
		{ hitSlop: Number.MAX_VALUE, label: "scalar native-float overflow" },
		{ hitSlop: "4", label: "scalar string" },
		{ hitSlop: true, label: "scalar boolean" },
		{ hitSlop: [], label: "array" },
		{ hitSlop: () => 4, label: "function" },
		{ hitSlop: Symbol("hitSlop"), label: "symbol" },
		{ hitSlop: { left: Number.NaN }, label: "object left NaN" },
		{ hitSlop: { right: Infinity }, label: "object right Infinity" },
		{ hitSlop: { top: -Infinity }, label: "object top -Infinity" },
		{
			hitSlop: { bottom: Number.MAX_VALUE },
			label: "object bottom native-float overflow",
		},
		{ hitSlop: { left: "4" }, label: "object left string" },
		{ hitSlop: { right: false }, label: "object right boolean" },
		{ hitSlop: { horizontal: [] }, label: "object horizontal array" },
		{ hitSlop: { horizontal: Infinity }, label: "object horizontal Infinity" },
		{ hitSlop: { vertical: -Infinity }, label: "object vertical -Infinity" },
		{
			hitSlop: { horizontal: combinedOverflow, left: combinedOverflow },
			label: "object horizontal combined native-float overflow",
		},
		{
			hitSlop: { top: -combinedOverflow, vertical: -combinedOverflow },
			label: "object vertical combined native-float overflow",
		},
	]

	for (const invalidCase of invalidCases) {
		assert.throws(
			() =>
				registry.configureNode(invalidNode, {
					hitSlop: invalidCase.hitSlop,
					onPress() {
						calls.push(invalidCase.label)
					},
					pointerEvents: "none",
					preciseHit: false,
				}),
			/finite native float/,
			`${invalidCase.label} should reject before native forwarding.`,
		)
		assert.equal(
			configs.length,
			1,
			`${invalidCase.label} should not call setInteractionConfig.`,
		)
	}

	assert.throws(
		() =>
			registry.configureNode(node, {
				hitSlop: Number.NaN,
				onPress() {
					calls.push("invalid replacement")
				},
			}),
		/finite native float/,
		"reconfiguring an existing node with invalid hitSlop should reject.",
	)
	assert.equal(
		configs.length,
		1,
		"invalid hitSlop should preserve the previous native config snapshot.",
	)

	registry.dispatchPress(1, pointerEvent)
	assert.deepEqual(
		calls,
		["original"],
		"invalid hitSlop should preserve existing JS handlers.",
	)

	registry.configureNode(otherNode, {
		onPress() {
			calls.push("other")
		},
	})
	assert.deepEqual(
		configs[1],
		{
			eventTag: 2,
			hitSlop: {
				bottom: 0,
				left: 0,
				right: 0,
				top: 0,
			},
			otherNode: true,
			pointerEvents: "auto",
			preciseHit: false,
		},
		"invalid hitSlop should not consume event tags and omitted hitSlop should stay empty.",
	)
}

function verifyUseCanvasGesturesPressRuntime() {
	const harness = createGestureHarness()
	const interactions = harness.makeInteractions()
	const hitTests = []
	const hitResults = [17, 0, 17]
	const node = {
		hitTest(x, y) {
			hitTests.push({ x, y })
			return hitResults.shift() ?? 17
		},
	}
	const gesture = harness.renderUseCanvasGestures({
		interactions,
		node,
	})
	const stateManager = harness.makeStateManager()

	gesture.callbacks.onTouchesDown(
		harness.makeTouchEvent(10, 10),
		stateManager,
	)
	gesture.callbacks.onTouchesMove(harness.makeTouchEvent(12, 10))
	gesture.callbacks.onTouchesMove(harness.makeTouchEvent(11, 10))
	gesture.callbacks.onTouchesUp(harness.makeTouchEvent(11, 10), stateManager)

	assert.deepEqual(
		gesture.chain,
		[
			["manualActivation", true],
			["shouldCancelWhenOutside", false],
			["onTouchesDown"],
			["onTouchesMove"],
			["onTouchesUp"],
			["onTouchesCancelled"],
		],
		"useCanvasGestures should configure the manual gesture chain.",
	)
	assert.deepEqual(
		stateManager.calls,
		["begin", "activate", "end"],
		"press flow should begin, activate, and end the gesture state manager.",
	)
	assert.deepEqual(
		hitTests,
		[
			{ x: 10, y: 10 },
			{ x: 12, y: 10 },
			{ x: 11, y: 10 },
		],
		"press flow should hit-test down and below-threshold move transitions.",
	)
	assert.deepEqual(
		interactions.events.map((entry) => entry.type),
		["pressIn", "pressOut", "pressIn", "press", "pressOut"],
		"press flow should dispatch press enter/leave/press/out in order.",
	)
	assert.deepEqual(
		harness.calls.runOnJSCalls.map((entry) => entry.args[0]),
		[17, 17, 17, 17, 17],
		"press flow should bridge every dispatch through runOnJS with the active tag.",
	)
	assertPointerEvent(interactions.events[0], {
		absoluteX: 110,
		absoluteY: 210,
		target: 17,
		x: 10,
		y: 10,
	})
	assertPointerEvent(interactions.events[1], {
		absoluteX: 112,
		absoluteY: 210,
		target: 17,
		x: 12,
		y: 10,
	})
	assertPointerEvent(interactions.events[3], {
		absoluteX: 111,
		absoluteY: 210,
		target: 17,
		x: 11,
		y: 10,
	})
	assertPointerEvent(interactions.events[4], {
		absoluteX: 111,
		absoluteY: 210,
		target: 17,
		x: 11,
		y: 10,
	})
}

function verifyUseCanvasGesturesPanRuntime() {
	const harness = createGestureHarness()
	const interactions = harness.makeInteractions()
	const node = {
		hitTest() {
			return 31
		},
	}
	const gesture = harness.renderUseCanvasGestures({
		interactions,
		node,
	})
	const stateManager = harness.makeStateManager()

	gesture.callbacks.onTouchesDown(
		harness.makeTouchEvent(20, 20),
		stateManager,
	)
	gesture.callbacks.onTouchesMove(harness.makeTouchEvent(23, 20))
	gesture.callbacks.onTouchesMove(harness.makeTouchEvent(27, 24))
	gesture.callbacks.onTouchesUp(harness.makeTouchEvent(28, 25), stateManager)

	assert.deepEqual(
		stateManager.calls,
		["begin", "activate", "end"],
		"pan flow should begin, activate, and end the gesture state manager.",
	)
	assert.deepEqual(
		interactions.events.map((entry) => entry.type),
		["pressIn", "pressOut", "panStart", "panUpdate", "panUpdate", "panEnd"],
		"pan flow should dispatch pressOut before panStart and pan updates before panEnd.",
	)
	assertPointerEvent(interactions.events[1], {
		absoluteX: 123,
		absoluteY: 220,
		target: 31,
		x: 23,
		y: 20,
	})
	assertPanEvent(interactions.events[2], {
		absoluteX: 123,
		absoluteY: 220,
		cancelled: false,
		changeX: 3,
		changeY: 0,
		target: 31,
		translationX: 3,
		translationY: 0,
		x: 23,
		y: 20,
	})
	assertPanEvent(interactions.events[3], {
		absoluteX: 123,
		absoluteY: 220,
		cancelled: false,
		changeX: 3,
		changeY: 0,
		target: 31,
		translationX: 3,
		translationY: 0,
		x: 23,
		y: 20,
	})
	assertPanEvent(interactions.events[4], {
		absoluteX: 127,
		absoluteY: 224,
		cancelled: false,
		changeX: 4,
		changeY: 4,
		target: 31,
		translationX: 7,
		translationY: 4,
		x: 27,
		y: 24,
	})
	assertPanEvent(interactions.events[5], {
		absoluteX: 128,
		absoluteY: 225,
		cancelled: false,
		changeX: 1,
		changeY: 1,
		target: 31,
		translationX: 8,
		translationY: 5,
		x: 28,
		y: 25,
	})
	assert.equal(
		harness.calls.runOnJSCalls.length,
		6,
		"pan flow should dispatch each press/pan callback through runOnJS.",
	)

	gesture.callbacks.onTouchesMove(harness.makeTouchEvent(40, 40))
	assert.equal(
		interactions.events.length,
		6,
		"pan flow should clear activeTag after up so later moves do not dispatch.",
	)
}

function verifyUseCanvasGesturesCancellationRuntime() {
	const panHarness = createGestureHarness()
	const panInteractions = panHarness.makeInteractions()
	const panGesture = panHarness.renderUseCanvasGestures({
		interactions: panInteractions,
		node: {
			hitTest() {
				return 43
			},
		},
	})
	const panStateManager = panHarness.makeStateManager()

	panGesture.callbacks.onTouchesDown(
		panHarness.makeTouchEvent(30, 30),
		panStateManager,
	)
	panGesture.callbacks.onTouchesMove(panHarness.makeTouchEvent(33, 30))
	panGesture.callbacks.onTouchesCancelled(
		panHarness.makeTouchEvent(36, 31),
		panStateManager,
	)

	assert.deepEqual(
		panStateManager.calls,
		["begin", "activate", "fail"],
		"pan cancellation should fail the active gesture instead of ending it.",
	)
	assert.deepEqual(
		panInteractions.events.map((entry) => entry.type),
		["pressIn", "pressOut", "panStart", "panUpdate", "panEnd"],
		"pan cancellation should finish with a panEnd dispatch.",
	)
	assertPanEvent(panInteractions.events[4], {
		absoluteX: 136,
		absoluteY: 231,
		cancelled: true,
		changeX: 3,
		changeY: 1,
		target: 43,
		translationX: 6,
		translationY: 1,
		x: 36,
		y: 31,
	})

	const eventsAfterCancel = panInteractions.events.length
	const upAfterCancelStateManager = panHarness.makeStateManager()
	panGesture.callbacks.onTouchesUp(
		panHarness.makeTouchEvent(36, 31),
		upAfterCancelStateManager,
	)

	assert.deepEqual(
		upAfterCancelStateManager.calls,
		["fail"],
		"up after cancellation should see no active tag and fail.",
	)
	assert.equal(
		panInteractions.events.length,
		eventsAfterCancel,
		"up after cancellation should not dispatch stale pan events.",
	)

	const pressHarness = createGestureHarness()
	const pressInteractions = pressHarness.makeInteractions()
	const pressGesture = pressHarness.renderUseCanvasGestures({
		interactions: pressInteractions,
		node: {
			hitTest() {
				return 44
			},
		},
	})
	const pressStateManager = pressHarness.makeStateManager()

	pressGesture.callbacks.onTouchesDown(
		pressHarness.makeTouchEvent(50, 50),
		pressStateManager,
	)
	pressGesture.callbacks.onTouchesCancelled(
		pressHarness.makeTouchEvent(50, 50),
		pressStateManager,
	)

	assert.deepEqual(
		pressStateManager.calls,
		["begin", "activate", "fail"],
		"press cancellation should fail the active gesture.",
	)
	assert.deepEqual(
		pressInteractions.events.map((entry) => entry.type),
		["pressIn", "pressOut"],
		"press cancellation before pan start should dispatch only pressOut after pressIn.",
	)
	assertPointerEvent(pressInteractions.events[1], {
		absoluteX: 150,
		absoluteY: 250,
		target: 44,
		x: 50,
		y: 50,
	})
}

function verifyUseCanvasGesturesFailuresAndExternalComposition() {
	const harness = createGestureHarness()
	const interactions = harness.makeInteractions()
	const hitTests = []
	const gesture = harness.renderUseCanvasGestures({
		interactions,
		node: {
			hitTest(x, y) {
				hitTests.push({ x, y })
				return 0
			},
		},
	})
	const noTouchStateManager = harness.makeStateManager()
	const multiTouchStateManager = harness.makeStateManager()
	const missStateManager = harness.makeStateManager()
	const inactiveUpStateManager = harness.makeStateManager()
	const inactiveCancelStateManager = harness.makeStateManager()

	gesture.callbacks.onTouchesDown(
		harness.makeTouchEvent(null, null, {
			allTouches: [],
			changedTouches: [],
		}),
		noTouchStateManager,
	)
	gesture.callbacks.onTouchesDown(
		harness.makeTouchEvent(5, 5, {
			allTouches: [harness.makeTouch(5, 5), harness.makeTouch(6, 6)],
		}),
		multiTouchStateManager,
	)
	gesture.callbacks.onTouchesDown(harness.makeTouchEvent(7, 8), missStateManager)
	gesture.callbacks.onTouchesUp(
		harness.makeTouchEvent(7, 8),
		inactiveUpStateManager,
	)
	gesture.callbacks.onTouchesCancelled(
		harness.makeTouchEvent(7, 8),
		inactiveCancelStateManager,
	)

	assert.deepEqual(
		noTouchStateManager.calls,
		["fail"],
		"touch down without a primary touch should fail.",
	)
	assert.deepEqual(
		multiTouchStateManager.calls,
		["fail"],
		"touch down with multiple touches should fail before hit-testing.",
	)
	assert.deepEqual(
		missStateManager.calls,
		["fail"],
		"touch down outside an interactive tag should fail.",
	)
	assert.deepEqual(
		inactiveUpStateManager.calls,
		["fail"],
		"inactive touch up should fail.",
	)
	assert.deepEqual(
		inactiveCancelStateManager.calls,
		["fail"],
		"inactive touch cancellation should fail.",
	)
	assert.deepEqual(
		hitTests,
		[{ x: 7, y: 8 }],
		"failure paths should hit-test only the single-touch miss case.",
	)
	assert.deepEqual(
		interactions.events,
		[],
		"failure paths should not dispatch interaction callbacks.",
	)

	const externalHarness = createGestureHarness()
	const externalGesture = { kind: "external-pan" }
	const composed = externalHarness.renderUseCanvasGestures({
		externalGesture,
		interactions: externalHarness.makeInteractions(),
		node: {
			hitTest() {
				return 1
			},
		},
	})

	assert.equal(
		composed.kind,
		"Simultaneous",
		"useCanvasGestures should compose external gestures with Gesture.Simultaneous.",
	)
	assert.equal(
		composed.gestures[0],
		externalHarness.calls.manualGestures[0],
		"external composition should keep the internal manual gesture first.",
	)
	assert.equal(
		composed.gestures[1],
		externalGesture,
		"external composition should include the provided external gesture.",
	)
}

function createGestureHarness() {
	const calls = {
		manualGestures: [],
		runOnJS: [],
		runOnJSCalls: [],
		sharedValues: [],
		simultaneous: [],
		useCallback: [],
		useMemo: [],
	}
	const moduleCache = new Map()
	const global = {
		console,
	}
	global.globalThis = global
	const context = vm.createContext(global)
	const externalModules = new Map([
		[
			"react",
			{
				useCallback(callback, deps) {
					calls.useCallback.push({ callback, deps })
					return callback
				},
				useMemo(callback, deps) {
					calls.useMemo.push({ callback, deps })
					return callback()
				},
			},
		],
		[
			"react-native-gesture-handler",
			{
				Gesture: {
					Manual() {
						const gesture = makeManualGesture()
						calls.manualGestures.push(gesture)
						return gesture
					},
					Simultaneous(...gestures) {
						const composition = {
							gestures,
							kind: "Simultaneous",
						}
						calls.simultaneous.push(composition)
						return composition
					},
				},
			},
		],
		[
			"react-native-reanimated",
			{
				runOnJS(callback) {
					calls.runOnJS.push(callback)
					return (...args) => {
						calls.runOnJSCalls.push({ args, callback })
						return callback(...args)
					}
				},
				useSharedValue(value) {
					const sharedValue = { value }
					calls.sharedValues.push(sharedValue)
					return sharedValue
				},
			},
		],
	])

	function makeManualGesture() {
		const gesture = {
			callbacks: {},
			chain: [],
			kind: "Manual",
			manualActivation(value) {
				gesture.chain.push(["manualActivation", value])
				return gesture
			},
			onTouchesCancelled(callback) {
				gesture.chain.push(["onTouchesCancelled"])
				gesture.callbacks.onTouchesCancelled = callback
				return gesture
			},
			onTouchesDown(callback) {
				gesture.chain.push(["onTouchesDown"])
				gesture.callbacks.onTouchesDown = callback
				return gesture
			},
			onTouchesMove(callback) {
				gesture.chain.push(["onTouchesMove"])
				gesture.callbacks.onTouchesMove = callback
				return gesture
			},
			onTouchesUp(callback) {
				gesture.chain.push(["onTouchesUp"])
				gesture.callbacks.onTouchesUp = callback
				return gesture
			},
			shouldCancelWhenOutside(value) {
				gesture.chain.push(["shouldCancelWhenOutside", value])
				return gesture
			},
		}
		return gesture
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

	function requireFrom(parentPath, specifier) {
		if (externalModules.has(specifier)) {
			return externalModules.get(specifier)
		}

		if (specifier.startsWith(".")) {
			return loadModule(resolveProjectSpecifier(parentPath, specifier))
		}

		throw new Error(
			`Unexpected external import while verifying gesture interaction runtime: ${specifier}`,
		)
	}

	function renderUseCanvasGestures(options) {
		const gesturesModule = loadProjectModule("src/useCanvasGestures.ts")
		const createCanvasGesture = gesturesModule.useCanvasGestures
		const gesture = createCanvasGesture(options)
		const internalGesture = calls.manualGestures[calls.manualGestures.length - 1]
		for (const callbackName of [
			"onTouchesDown",
			"onTouchesMove",
			"onTouchesUp",
			"onTouchesCancelled",
		]) {
			assert.equal(
				typeof internalGesture.callbacks[callbackName],
				"function",
				`useCanvasGestures should register ${callbackName}.`,
			)
		}
		return gesture
	}

	function makeInteractions() {
		const events = []
		return {
			dispatchPanEnd(tag, event) {
				events.push({ event, tag, type: "panEnd" })
			},
			dispatchPanStart(tag, event) {
				events.push({ event, tag, type: "panStart" })
			},
			dispatchPanUpdate(tag, event) {
				events.push({ event, tag, type: "panUpdate" })
			},
			dispatchPress(tag, event) {
				events.push({ event, tag, type: "press" })
			},
			dispatchPressIn(tag, event) {
				events.push({ event, tag, type: "pressIn" })
			},
			dispatchPressOut(tag, event) {
				events.push({ event, tag, type: "pressOut" })
			},
			events,
		}
	}

	function makeStateManager() {
		const callsForStateManager = []
		return {
			activate() {
				callsForStateManager.push("activate")
			},
			begin() {
				callsForStateManager.push("begin")
			},
			calls: callsForStateManager,
			end() {
				callsForStateManager.push("end")
			},
			fail() {
				callsForStateManager.push("fail")
			},
		}
	}

	function makeTouch(x, y, options = {}) {
		return {
			absoluteX: options.absoluteX ?? x + 100,
			absoluteY: options.absoluteY ?? y + 200,
			x,
			y,
		}
	}

	function makeTouchEvent(x, y, options = {}) {
		const touch =
			x == null || y == null
				? undefined
				: makeTouch(x, y, {
						absoluteX: options.absoluteX,
						absoluteY: options.absoluteY,
					})
		const allTouches =
			options.allTouches ?? (touch ? [touch] : [])
		const changedTouches =
			options.changedTouches ?? (touch ? [touch] : [])
		return {
			allTouches,
			changedTouches,
		}
	}

	return {
		calls,
		loadProjectModule,
		makeInteractions,
		makeStateManager,
		makeTouch,
		makeTouchEvent,
		renderUseCanvasGestures,
	}
}

function assertPointerEvent(entry, expected) {
	assert.deepEqual(
		pickPointerEvent(entry),
		{
			event: expected,
			tag: expected.target,
		},
		`${entry?.type ?? "unknown"} should dispatch the expected pointer payload.`,
	)
}

function assertPanEvent(entry, expected) {
	assert.deepEqual(
		pickPanEvent(entry),
		{
			event: expected,
			tag: expected.target,
		},
		`${entry?.type ?? "unknown"} should dispatch the expected pan payload.`,
	)
}

function pickPointerEvent(entry) {
	return {
		event: {
			absoluteX: entry.event.absoluteX,
			absoluteY: entry.event.absoluteY,
			target: entry.event.target,
			x: entry.event.x,
			y: entry.event.y,
		},
		tag: entry.tag,
	}
}

function pickPanEvent(entry) {
	return {
		event: {
			absoluteX: entry.event.absoluteX,
			absoluteY: entry.event.absoluteY,
			cancelled: entry.event.cancelled,
			changeX: entry.event.changeX,
			changeY: entry.event.changeY,
			target: entry.event.target,
			translationX: entry.event.translationX,
			translationY: entry.event.translationY,
			x: entry.event.x,
			y: entry.event.y,
		},
		tag: entry.tag,
	}
}

function makeExpectedPointerEvent(target, x, y) {
	return {
		absoluteX: x + 100,
		absoluteY: y + 200,
		target,
		x,
		y,
	}
}

function makeExpectedPanEvent(target, x, y, overrides = {}) {
	return {
		...makeExpectedPointerEvent(target, x, y),
		cancelled: false,
		changeX: 0,
		changeY: 0,
		translationX: 0,
		translationY: 0,
		...overrides,
	}
}

function cloneInteractionConfig(config) {
	return {
		eventTag: config.eventTag,
		hitSlop: {
			bottom: config.hitSlop.bottom,
			left: config.hitSlop.left,
			right: config.hitSlop.right,
			top: config.hitSlop.top,
		},
		pointerEvents: config.pointerEvents,
		preciseHit: config.preciseHit,
	}
}

function objectPropertyIdentifier(objectLiteral, propertyName) {
	for (const property of objectLiteral.properties) {
		if (ts.isShorthandPropertyAssignment(property)) {
			if (property.name.text === propertyName) {
				return property.name.text
			}
			continue
		}

		if (ts.isPropertyAssignment(property)) {
			if (propertyNameText(property.name) !== propertyName) {
				continue
			}
			if (ts.isIdentifier(property.initializer)) {
				return property.initializer.text
			}
		}
	}
	return undefined
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

function walkTs(node, visitor) {
	visitor(node)
	ts.forEachChild(node, (child) => walkTs(child, visitor))
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
