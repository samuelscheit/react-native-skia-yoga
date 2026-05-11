#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")

const nativeCommandBindingCases = [
	{
		initialValue: 4,
		lateValue: 8,
		nextValue: 6,
		path: ["blur"],
		plainValue: 2,
		type: "blurMaskFilter",
	},
	{
		initialValue: 12,
		lateValue: 22,
		nextValue: 18,
		path: ["radius"],
		plainValue: 7,
		type: "circle",
	},
	{
		baseProps: { path: { id: "trim-end-path" } },
		initialValue: 0.75,
		lateValue: 0.25,
		nextValue: 0.5,
		path: ["trimEnd"],
		plainValue: 1,
		type: "path",
	},
	{
		baseProps: { path: { id: "trim-start-path" } },
		initialValue: 0.1,
		lateValue: 0.4,
		nextValue: 0.25,
		path: ["trimStart"],
		plainValue: 0,
		type: "path",
	},
	{
		initialValue: 5,
		lateValue: 11,
		nextValue: 9,
		path: ["cornerRadius"],
		plainValue: 3,
		type: "rrect",
	},
]

const jsCommandBindingCases = [
	{
		cleanupKind: "plain",
		cleanupValue: 11,
		description: "native-disabled command prop",
		expectedKey: "radius",
		initialValue: 5,
		lateValue: 13,
		nativeCommandBindingsEnabled: false,
		nextValue: 9,
		path: ["radius"],
		props(harness, sharedValue) {
			return harness.makeVmValue("({ radius: bindings.value })", {
				value: sharedValue,
			})
		},
		cleanupProps(harness) {
			return harness.makeVmValue("({ radius: 11 })")
		},
		type: "circle",
	},
	{
		cleanupKind: "plain",
		cleanupValue: false,
		description: "unsupported-native top-level command prop",
		expectedKey: "rasterize",
		initialValue: true,
		lateValue: true,
		nativeCommandBindingsEnabled: true,
		nextValue: false,
		path: ["rasterize"],
		props(harness, sharedValue) {
			return harness.makeVmValue("({ rasterize: bindings.value })", {
				value: sharedValue,
			})
		},
		cleanupProps(harness) {
			return harness.makeVmValue("({ rasterize: false })")
		},
		type: "group",
	},
	{
		cleanupKind: "delete",
		cleanupPath: ["sampling"],
		cleanupValue: undefined,
		description: "top-level opaque image.sampling command prop",
		expectedKey: "sampling",
		initialValue: { filter: 1, mipmap: 2 },
		lateValue: { filter: 2, mipmap: 0 },
		nativeCommandBindingsEnabled: true,
		nextValue: { filter: 0, mipmap: 1 },
		path: ["sampling"],
		props(harness, sharedValue) {
			return harness.makeVmValue("({ sampling: bindings.value })", {
				value: sharedValue,
			})
		},
		cleanupProps(harness) {
			return harness.makeVmValue("({})")
		},
		type: "image",
	},
	{
		cleanupKind: "plain",
		cleanupValue: 7,
		description: "nested object command prop",
		expectedKey: "from.x",
		initialValue: 1,
		lateValue: 12,
		nativeCommandBindingsEnabled: true,
		nextValue: 4,
		path: ["from", "x"],
		props(harness, sharedValue) {
			return harness.makeVmValue(
				"({ from: { x: bindings.value, y: 2 }, to: { x: 10, y: 20 } })",
				{ value: sharedValue },
			)
		},
		cleanupProps(harness) {
			return harness.makeVmValue(
				"({ from: { x: 7, y: 2 }, to: { x: 10, y: 20 } })",
			)
		},
		type: "line",
	},
	{
		cleanupKind: "delete",
		cleanupPath: ["stroke"],
		cleanupValue: undefined,
		description: "post-096 nested path.stroke field",
		expectedKey: "stroke.miter_limit",
		initialValue: 3,
		lateValue: 15,
		nativeCommandBindingsEnabled: true,
		nextValue: 8,
		path: ["stroke", "miter_limit"],
		props(harness, sharedValue) {
			return harness.makeVmValue(
				"({ path: { id: 'stroke-path' }, stroke: { width: 2, miter_limit: bindings.value, precision: 0.5 } })",
				{ value: sharedValue },
			)
		},
		cleanupProps(harness) {
			return harness.makeVmValue("({ path: { id: 'stroke-path' } })")
		},
		type: "path",
	},
	{
		cleanupKind: "unmount",
		description: "nested-array command prop leaf",
		expectedKey: "points.0.x",
		initialValue: 2,
		lateValue: 14,
		nativeCommandBindingsEnabled: true,
		nextValue: 6,
		path: ["points", "0", "x"],
		props(harness, sharedValue) {
			return harness.makeVmValue(
				"({ pointMode: 'points', points: [{ x: bindings.value, y: 3 }, { x: 5, y: 7 }] })",
				{ value: sharedValue },
			)
		},
		type: "points",
	},
]

verifyYogaCanvasAnimationBindingModeMapping()
verifyNativeCommandBindingWhitelistMatchesCases()
verifyNativeCommandBindingMirrorsSharedValue()
verifyJsCommandBindingModeRunsCommandUpdateCallbacks()
verifyStyleAnimatedListenerUpdatesStyleAndContinuousRedraw()
verifyNativeBindingRefCountsAndDetachCleanup()
verifyClearContainerCleansSubtreeAndRootChildren()

console.log("Reconciler animated binding verifier passed:")
console.log(
	'- YogaCanvas still maps animationBindingMode="native" to native Reconciler command bindings.',
)
console.log(
	`- Reconciler supportsNativeCommandBinding(...) whitelist matches verifier cases: ${formatNativeBindingCaseList(nativeCommandBindingCases)}.`,
)
console.log(
	`- Native command binding mode mirrors all whitelisted SharedValue command props (${formatNativeBindingCaseList(nativeCommandBindingCases)}) through Synchronizable.setBlocking.`,
)
console.log(
	`- JS command listener path covers native-disabled, unsupported-native, top-level opaque image.sampling, nested object, post-096 stroke, and nested-array command props: ${formatJsCommandBindingCaseList(jsCommandBindingCases)}.`,
)
console.log(
	"- Animated style listeners update host styles, invalidate, and toggle continuous redraw state.",
)
console.log(
	"- Shared native binding ref-count cleanup is exercised through shared circle.radius mirror reuse.",
)
console.log(
	"- clearContainer recursively removes animated listeners, unregisters interactions, and clears root children.",
)
console.log(
	"- Proof boundary: Node VM source-level Reconciler stubs only; excludes UI-runtime Worklets execution, real Reanimated delivery, actual native bridge delivery, C++ conversion, platform app runtime, image loading/decoding, exact render fidelity, Nitro registry install, and React Native runtime integration.",
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

function extractNativeCommandBindingWhitelist() {
	const sourceFile = ts.createSourceFile(
		projectPath("src/Reconciler.ts"),
		readFileSync(projectPath("src/Reconciler.ts"), "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	)
	let declaration

	walkTs(sourceFile, (node) => {
		if (
			ts.isFunctionDeclaration(node) &&
			node.name?.text === "supportsNativeCommandBinding"
		) {
			declaration = node
		}
	})

	assert.ok(
		declaration?.body,
		"Reconciler should define supportsNativeCommandBinding(...) with a body",
	)

	let hasSingleSegmentGuard = false
	let foundSwitch = false
	let hasDefaultFalse = false
	const bindings = []

	for (const statement of declaration.body.statements) {
		if (
			ts.isIfStatement(statement) &&
			isSingleSegmentPathGuard(statement.expression) &&
			statementReturnsFalse(statement.thenStatement)
		) {
			hasSingleSegmentGuard = true
			continue
		}

		if (!ts.isSwitchStatement(statement)) {
			continue
		}

		assert.equal(
			isIdentifierNamed(statement.expression, "type"),
			true,
			"supportsNativeCommandBinding(...) should switch on type",
		)
		foundSwitch = true

		for (const clause of statement.caseBlock.clauses) {
			if (ts.isDefaultClause(clause)) {
				assert.equal(
					clause.statements.length,
					1,
					"supportsNativeCommandBinding(...) default clause should only return false",
				)
				assert.equal(
					statementReturnsFalse(clause.statements[0]),
					true,
					"supportsNativeCommandBinding(...) default clause should return false",
				)
				hasDefaultFalse = true
				continue
			}

			assert.ok(
				ts.isStringLiteral(clause.expression),
				"supportsNativeCommandBinding(...) case labels should be string literals",
			)
			assert.equal(
				clause.statements.length,
				1,
				`supportsNativeCommandBinding(...) ${clause.expression.text} case should only return path comparisons`,
			)
			const [returnStatement] = clause.statements
			assert.ok(
				ts.isReturnStatement(returnStatement) &&
					returnStatement.expression,
				`supportsNativeCommandBinding(...) ${clause.expression.text} case should return a path comparison`,
			)

			const pathKeys = extractNativeBindingPathKeys(
				returnStatement.expression,
				clause.expression.text,
			)
			for (const pathKey of pathKeys) {
				bindings.push({
					path: [pathKey],
					type: clause.expression.text,
				})
			}
		}
	}

	assert.equal(
		hasSingleSegmentGuard,
		true,
		"supportsNativeCommandBinding(...) should reject nested command paths before the whitelist switch",
	)
	assert.equal(
		foundSwitch,
		true,
		"supportsNativeCommandBinding(...) should use a type switch that the verifier can compare",
	)
	assert.equal(
		hasDefaultFalse,
		true,
		"supportsNativeCommandBinding(...) should default unsupported types to false",
	)

	return sortNativeBindingCases(bindings)
}

function extractNativeBindingPathKeys(expression, type) {
	const current = skipExpressionWrappers(expression)

	if (
		ts.isBinaryExpression(current) &&
		current.operatorToken.kind === ts.SyntaxKind.BarBarToken
	) {
		return [
			...extractNativeBindingPathKeys(current.left, type),
			...extractNativeBindingPathKeys(current.right, type),
		]
	}

	if (!ts.isBinaryExpression(current)) {
		throw new Error(
			`Unsupported supportsNativeCommandBinding(...) return shape for ${type}. Expected path[0] string comparisons.`,
		)
	}

	const operator = current.operatorToken.kind
	if (
		operator !== ts.SyntaxKind.EqualsEqualsEqualsToken &&
		operator !== ts.SyntaxKind.EqualsEqualsToken
	) {
		throw new Error(
			`Unsupported supportsNativeCommandBinding(...) comparison operator for ${type}.`,
		)
	}

	const leftPathKey = extractPathZeroStringComparison(
		current.left,
		current.right,
	)
	if (leftPathKey) {
		return [leftPathKey]
	}

	const rightPathKey = extractPathZeroStringComparison(
		current.right,
		current.left,
	)
	if (rightPathKey) {
		return [rightPathKey]
	}

	throw new Error(
		`Unsupported supportsNativeCommandBinding(...) path comparison for ${type}.`,
	)
}

function extractPathZeroStringComparison(pathExpression, valueExpression) {
	const pathNode = skipExpressionWrappers(pathExpression)
	const valueNode = skipExpressionWrappers(valueExpression)

	if (!ts.isStringLiteral(valueNode)) {
		return undefined
	}

	if (
		!ts.isElementAccessExpression(pathNode) ||
		!isIdentifierNamed(pathNode.expression, "path") ||
		!pathNode.argumentExpression ||
		!ts.isNumericLiteral(pathNode.argumentExpression) ||
		pathNode.argumentExpression.text !== "0"
	) {
		return undefined
	}

	return valueNode.text
}

function isSingleSegmentPathGuard(expression) {
	const current = skipExpressionWrappers(expression)
	if (!ts.isBinaryExpression(current)) {
		return false
	}
	if (
		current.operatorToken.kind !== ts.SyntaxKind.ExclamationEqualsToken &&
		current.operatorToken.kind !==
			ts.SyntaxKind.ExclamationEqualsEqualsToken
	) {
		return false
	}

	return (
		(isPathLengthAccess(current.left) &&
			isNumericLiteralText(current.right, "1")) ||
		(isPathLengthAccess(current.right) &&
			isNumericLiteralText(current.left, "1"))
	)
}

function isPathLengthAccess(node) {
	const current = skipExpressionWrappers(node)
	return (
		ts.isPropertyAccessExpression(current) &&
		isIdentifierNamed(current.expression, "path") &&
		current.name.text === "length"
	)
}

function isNumericLiteralText(node, text) {
	const current = skipExpressionWrappers(node)
	return ts.isNumericLiteral(current) && current.text === text
}

function statementReturnsFalse(statement) {
	if (!statement) {
		return false
	}

	if (ts.isReturnStatement(statement)) {
		return isFalseLiteral(statement.expression)
	}

	if (ts.isBlock(statement)) {
		return (
			statement.statements.length === 1 &&
			statementReturnsFalse(statement.statements[0])
		)
	}

	return false
}

function isFalseLiteral(node) {
	return skipExpressionWrappers(node)?.kind === ts.SyntaxKind.FalseKeyword
}

function isIdentifierNamed(node, name) {
	const current = skipExpressionWrappers(node)
	return ts.isIdentifier(current) && current.text === name
}

function verifyNativeCommandBindingWhitelistMatchesCases() {
	const whitelist = extractNativeCommandBindingWhitelist()
	assert.deepEqual(
		formatNativeBindingCaseList(whitelist),
		formatNativeBindingCaseList(nativeCommandBindingCases),
		"native command binding verifier cases should match supportsNativeCommandBinding(...) whitelist",
	)
}

function makeNativeBindingProps(testCase, value) {
	const props = { ...(testCase.baseProps ?? {}) }
	setValueAtPath(props, testCase.path, value)
	return props
}

function setValueAtPath(target, valuePath, value) {
	assert.ok(valuePath.length > 0, "native binding case path should not be empty")
	let current = target
	for (const segment of valuePath.slice(0, -1)) {
		if (!isPlainVerifierObject(current[segment])) {
			current[segment] = {}
		}
		current = current[segment]
	}
	current[valuePath[valuePath.length - 1]] = value
}

function getValueAtPath(target, valuePath) {
	let current = target
	for (const segment of valuePath) {
		assert.ok(
			current != null,
			`expected command payload path ${valuePath.join(".")} to exist`,
		)
		current = current[segment]
	}
	return current
}

function isPlainVerifierObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function verifyNativeCommandBindingMirrorsSharedValue() {
	for (const testCase of nativeCommandBindingCases) {
		verifyNativeCommandBindingCaseMirrorsSharedValue(testCase)
	}
}

function verifyNativeCommandBindingCaseMirrorsSharedValue(testCase) {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const label = formatNativeBindingCase(testCase)
	const sharedValue = harness.makeSharedValue(
		testCase.initialValue,
		`native.${label}`,
	)
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: true,
	})
	const propsWithSharedValue = makeNativeBindingProps(testCase, sharedValue)
	const propsWithPlainValue = makeNativeBindingProps(
		testCase,
		testCase.plainValue,
	)

	const node = config.createInstance(
		testCase.type,
		propsWithSharedValue,
		container,
	)
	const createdMirror = only(harness.calls.createSynchronizable)
	const mirror = createdMirror.mirror
	const firstCommand = only(node.commands)

	assert.equal(
		sharedValue.listenerCount(),
		1,
		`${label} native binding should register one SharedValue listener`,
	)
	assert.equal(
		harness.calls.sharedAddListener.length,
		1,
		`${label} native binding should call SharedValue.addListener once`,
	)
	assert.equal(
		createdMirror.value,
		testCase.initialValue,
		`${label} native binding should seed Synchronizable from the SharedValue snapshot`,
	)
	assert.equal(
		mirror.value,
		testCase.initialValue,
		`${label} native binding should expose the initial SharedValue snapshot on the mirror`,
	)
	assert.equal(
		firstCommand.type,
		testCase.type,
		`${label} native binding should still set the host command`,
	)
	assert.equal(
		getValueAtPath(firstCommand.data, testCase.path),
		mirror,
		`${label} native binding should pass the Synchronizable mirror to the native command payload`,
	)
	assertToggle(
		calls.nativeAnimationActive,
		0,
		node,
		true,
		`${label} native binding should mark the node as natively animated`,
	)
	assert.equal(
		calls.invalidations.length,
		1,
		`${label} activating native animation should invalidate once`,
	)

	sharedValue.emit(testCase.nextValue)

	assert.equal(
		harness.calls.setBlocking.length,
		1,
		`${label} SharedValue emits should update the native mirror with setBlocking`,
	)
	assert.equal(
		only(harness.calls.setBlocking).mirror,
		mirror,
		`${label} SharedValue emits should update the original mirror object`,
	)
	assert.equal(
		only(harness.calls.setBlocking).nextValue,
		testCase.nextValue,
		`${label} SharedValue emits should pass the latest value to setBlocking`,
	)
	assert.equal(
		mirror.value,
		testCase.nextValue,
		`${label} setBlocking should store the latest native mirror value`,
	)
	assert.equal(
		node.commands.length,
		1,
		`${label} native mirror emits should not rebuild host commands on JS`,
	)
	assert.equal(
		calls.invalidations.length,
		1,
		`${label} native mirror emits should not invalidate through the JS listener path`,
	)
	assert.equal(
		harness.calls.runOnJS.length,
		0,
		`${label} native mirror emits should not create runOnJS bridges`,
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		0,
		`${label} native mirror emits should not bridge through runOnJS`,
	)

	config.commitUpdate(
		node,
		testCase.type,
		propsWithSharedValue,
		propsWithPlainValue,
		null,
	)

	assert.equal(
		sharedValue.listenerCount(),
		0,
		`${label} commitUpdate to a plain command prop should remove the native listener`,
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		`${label} native listener cleanup should remove an existing SharedValue listener id`,
	)
	assertToggle(
		calls.nativeAnimationActive,
		1,
		node,
		false,
		`${label} commitUpdate should mark the native animation inactive`,
	)
	assert.equal(
		calls.invalidations.length,
		2,
		`${label} deactivating native animation should invalidate once`,
	)
	assert.equal(
		getValueAtPath(last(node.commands).data, testCase.path),
		testCase.plainValue,
		`${label} commitUpdate should apply the resolved plain command prop`,
	)

	const setBlockingCalls = harness.calls.setBlocking.length
	const commandCalls = node.commands.length
	sharedValue.emit(testCase.lateValue)

	assert.equal(
		harness.calls.setBlocking.length,
		setBlockingCalls,
		`${label} removed native listeners should not receive later SharedValue emits`,
	)
	assert.equal(
		node.commands.length,
		commandCalls,
		`${label} removed native bindings should not rebuild commands after cleanup`,
	)
}

function verifyJsCommandBindingModeRunsCommandUpdateCallbacks() {
	for (const testCase of jsCommandBindingCases) {
		verifyJsCommandBindingCaseRunsCommandUpdateCallback(testCase)
	}
}

function verifyJsCommandBindingCaseRunsCommandUpdateCallback(testCase) {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const label = formatJsCommandBindingCase(testCase)
	const sharedValue = harness.makeSharedValue(
		testCase.initialValue,
		`js.${label}`,
	)
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: testCase.nativeCommandBindingsEnabled,
	})
	const propsWithSharedValue = testCase.props(harness, sharedValue)

	const node = config.createInstance(
		testCase.type,
		propsWithSharedValue,
		container,
	)

	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		`${label} should not create a native Synchronizable mirror`,
	)
	assert.equal(
		sharedValue.listenerCount(),
		1,
		`${label} should register one SharedValue listener`,
	)
	assert.equal(
		harness.calls.sharedAddListener.length,
		1,
		`${label} should call SharedValue.addListener once`,
	)
	assert.equal(
		harness.calls.uiRuntimeCalls[0]?.args[1],
		testCase.expectedKey,
		`${label} should register the listener under the expected command key`,
	)
	assert.equal(
		getValueAtPath(last(node.commands).data, testCase.path),
		testCase.initialValue,
		`${label} should resolve the initial command prop value`,
	)
	assert.equal(
		calls.nativeAnimationActive.length,
		0,
		`${label} should not mark the node as natively animated`,
	)
	assert.equal(
		calls.invalidations.length,
		0,
		`${label} initial JS command binding should not invalidate`,
	)

	sharedValue.emit(testCase.nextValue)

	assert.deepEqual(
		only(harness.calls.runOnJSCalls).args,
		[testCase.expectedKey, testCase.nextValue],
		`${label} SharedValue command updates should bridge listener key and value through runOnJS`,
	)
	assert.equal(
		getValueAtPath(last(node.commands).data, testCase.path),
		testCase.nextValue,
		`${label} SharedValue command updates should rebuild the host command with the latest value`,
	)
	assert.equal(
		calls.invalidations.length,
		1,
		`${label} SharedValue command updates should invalidate the container`,
	)
	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		`${label} should still avoid native mirrors after SharedValue emits`,
	)
	assert.equal(
		harness.calls.setBlocking.length,
		0,
		`${label} should not use native mirror setBlocking updates`,
	)

	const commandCallsAfterEmit = node.commands.length
	const runOnJsCallsAfterEmit = harness.calls.runOnJSCalls.length

	if (testCase.cleanupKind === "unmount") {
		config.detachDeletedInstance(node)

		assert.equal(
			sharedValue.listenerCount(),
			0,
			`${label} unmount cleanup should remove the JS listener`,
		)
		assert.equal(
			only(harness.calls.sharedRemoveListener).had,
			true,
			`${label} unmount cleanup should remove an existing SharedValue listener id`,
		)
		assert.equal(
			calls.unregistered[0]?.node,
			node,
			`${label} unmount cleanup should unregister the node from interactions`,
		)
		assert.equal(
			node.commands.length,
			commandCallsAfterEmit,
			`${label} unmount cleanup should not apply another command`,
		)
	} else {
		const cleanupProps = testCase.cleanupProps(harness)
		config.commitUpdate(
			node,
			testCase.type,
			propsWithSharedValue,
			cleanupProps,
			null,
		)

		assert.equal(
			sharedValue.listenerCount(),
			0,
			`${label} commitUpdate cleanup should remove the JS listener`,
		)
		assert.equal(
			only(harness.calls.sharedRemoveListener).had,
			true,
			`${label} JS listener cleanup should remove an existing SharedValue listener id`,
		)
		assert.equal(
			getValueAtPath(
				last(node.commands).data,
				testCase.cleanupPath ?? testCase.path,
			),
			testCase.cleanupValue,
			`${label} commitUpdate should apply the cleaned JS-mode command prop`,
		)
		assert.equal(
			node.commands.length,
			commandCallsAfterEmit + 1,
			`${label} commitUpdate cleanup should apply exactly one command update`,
		)
	}

	const commandCallsAfterCleanup = node.commands.length
	const invalidationsAfterCleanup = calls.invalidations.length
	sharedValue.emit(testCase.lateValue)

	assert.equal(
		node.commands.length,
		commandCallsAfterCleanup,
		`${label} removed JS listeners should not rebuild commands after cleanup`,
	)
	assert.equal(
		calls.invalidations.length,
		invalidationsAfterCleanup,
		`${label} removed JS listeners should not invalidate after cleanup`,
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		runOnJsCallsAfterEmit,
		`${label} removed JS listeners should not bridge through runOnJS after cleanup`,
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

function formatNativeBindingCase(testCase) {
	return `${testCase.type}.${testCase.path.join(".")}`
}

function formatNativeBindingCaseList(cases) {
	return sortNativeBindingCases(cases).map(formatNativeBindingCase).join(", ")
}

function formatJsCommandBindingCase(testCase) {
	return `${testCase.type}.${testCase.path.join(".")} (${testCase.description})`
}

function formatJsCommandBindingCaseList(cases) {
	return cases.map(formatJsCommandBindingCase).join(", ")
}

function sortNativeBindingCases(cases) {
	return [...cases].sort((left, right) =>
		formatNativeBindingCase(left).localeCompare(formatNativeBindingCase(right)),
	)
}

function walkTs(node, visitor) {
	visitor(node)
	ts.forEachChild(node, (child) => walkTs(child, visitor))
}

function skipExpressionWrappers(node) {
	let current = node
	while (current) {
		if (
			ts.isParenthesizedExpression(current) ||
			ts.isNonNullExpression(current)
		) {
			current = current.expression
			continue
		}

		if (
			ts.isAsExpression(current) ||
			ts.isTypeAssertionExpression(current)
		) {
			current = current.expression
			continue
		}

		break
	}
	return current
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
