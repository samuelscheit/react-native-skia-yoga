#!/usr/bin/env node

import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const rootDir = path.resolve(import.meta.dirname, "..")
const publicTransformOperationInventory =
	extractPublicTransformOperationInventory()
const nestedTransformBindingCases = [
	{
		initialValue: 0.1,
		key: "rotateX",
		lateValue: 0.9,
		nextValue: 0.2,
		typeName: "TransformRotateX",
	},
	{
		initialValue: 0.15,
		key: "rotateY",
		lateValue: 0.95,
		nextValue: 0.25,
		typeName: "TransformRotateY",
	},
	{
		initialValue: 0.2,
		key: "rotateZ",
		lateValue: 1,
		nextValue: 0.3,
		typeName: "TransformRotateZ",
	},
	{
		initialValue: 1.1,
		key: "scale",
		lateValue: 1.9,
		nextValue: 1.4,
		typeName: "TransformScale",
	},
	{
		initialValue: 1.2,
		key: "scaleX",
		lateValue: 2,
		nextValue: 1.5,
		typeName: "TransformScaleX",
	},
	{
		initialValue: 1.3,
		key: "scaleY",
		lateValue: 2.1,
		nextValue: 1.6,
		typeName: "TransformScaleY",
	},
	{
		initialValue: 4,
		key: "translateX",
		lateValue: 14,
		nextValue: 8,
		typeName: "TransformTranslateX",
	},
	{
		initialValue: 5,
		key: "translateY",
		lateValue: 15,
		nextValue: 9,
		typeName: "TransformTranslateY",
	},
	{
		initialValue: 0.05,
		key: "skewX",
		lateValue: 0.75,
		nextValue: 0.15,
		typeName: "TransformSkewX",
	},
	{
		initialValue: 0.075,
		key: "skewY",
		lateValue: 0.8,
		nextValue: 0.175,
		typeName: "TransformSkewY",
	},
]
assertTransformOperationCaseTableMatchesInventory(
	"Reconciler nested style.transform cases",
	nestedTransformBindingCases,
)

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
		assertCommandData(commandData, value) {
			assertParagraphTextStyleCommandData(
				commandData,
				{
					text: "dynamic nested paragraph color",
					textStyle: {
						color: value,
						fontSize: 16,
					},
				},
				"paragraph.paragraphStyle.textStyle.color should rebuild the full paragraph command payload shape",
			)
		},
		cleanupKind: "plain",
		cleanupValue: "#1d4ed8",
		description: "nested paragraph textStyle color leaf",
		expectedKey: "paragraphStyle.textStyle.color",
		initialValue: "#16a34a",
		lateValue: "#ef4444",
		nativeCommandBindingsEnabled: true,
		nextValue: "#f97316",
		path: ["paragraphStyle", "textStyle", "color"],
		props(harness, sharedValue) {
			return harness.makeVmValue(
				"({ text: 'dynamic nested paragraph color', paragraphStyle: { textStyle: { color: bindings.value, fontSize: 16 } } })",
				{ value: sharedValue },
			)
		},
		cleanupProps(harness) {
			return harness.makeVmValue(
				"({ text: 'dynamic nested paragraph color', paragraphStyle: { textStyle: { color: '#1d4ed8', fontSize: 16 } } })",
			)
		},
		type: "paragraph",
	},
	{
		assertCommandData(commandData, value) {
			assertParagraphTextStyleCommandData(
				commandData,
				{
					text: "dynamic nested paragraph font size",
					textStyle: {
						color: "#f8fafc",
						fontSize: value,
					},
				},
				"paragraph.paragraphStyle.textStyle.fontSize should rebuild the full paragraph command payload shape",
			)
		},
		cleanupKind: "delete",
		cleanupPath: ["paragraphStyle", "textStyle", "fontSize"],
		cleanupValue: undefined,
		description: "nested paragraph textStyle fontSize leaf",
		expectedKey: "paragraphStyle.textStyle.fontSize",
		initialValue: 14,
		lateValue: 22,
		nativeCommandBindingsEnabled: true,
		nextValue: 18,
		path: ["paragraphStyle", "textStyle", "fontSize"],
		props(harness, sharedValue) {
			return harness.makeVmValue(
				"({ text: 'dynamic nested paragraph font size', paragraphStyle: { textStyle: { color: '#f8fafc', fontSize: bindings.value } } })",
				{ value: sharedValue },
			)
		},
		cleanupProps(harness) {
			return harness.makeVmValue(
				"({ text: 'dynamic nested paragraph font size', paragraphStyle: { textStyle: { color: '#f8fafc' } } })",
			)
		},
		type: "paragraph",
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
verifyTransformStyleSharedValuesUseJsStyleDelivery()
verifyStyleLayerSharedValueUsesJsStyleDelivery()
verifyWholeStyleSharedValueUsesJsStyleDelivery()
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
	`- JS command listener path covers native-disabled, unsupported-native, top-level opaque image.sampling, nested object, post-096 stroke, nested paragraph textStyle, and nested-array command props: ${formatJsCommandBindingCaseList(jsCommandBindingCases)}.`,
)
console.log(
	"- Animated style listeners update host styles, invalidate, and toggle continuous redraw state.",
)
console.log(
	`- Dynamic style.transform SharedValue leaves for every public transform operation (${formatTransformOperationKeys(
		publicTransformOperationInventory,
	)}) and whole SharedValue<Transform> use JS style listeners, resolve initial snapshots, rebuild host styles on update, invalidate, clean up, and avoid native command mirrors.`,
)
console.log(
	"- Top-level style.layer SharedValue listeners resolve initial SkPaint snapshots, rebuild full styles on updates, invalidate, clean up, and avoid native command mirrors.",
)
console.log(
	"- Whole SharedValue<YogaNodeStyle> listeners resolve and update full style payloads through the same JS style delivery path.",
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
	assert.ok(
		valuePath.length > 0,
		"native binding case path should not be empty",
	)
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

function assertParagraphTextStyleCommandData(commandData, expected, message) {
	assert.deepEqual(
		Object.keys(commandData).sort(),
		["paragraph", "paragraphStyle", "text"],
		`${message}: paragraph command data keys`,
	)
	assert.equal(
		commandData.paragraph,
		undefined,
		`${message}: paragraph host object should remain omitted`,
	)
	assert.equal(commandData.text, expected.text, `${message}: text`)
	assert.equal(
		isPlainVerifierObject(commandData.paragraphStyle),
		true,
		`${message}: paragraphStyle should be an object`,
	)
	assert.deepEqual(
		Object.keys(commandData.paragraphStyle).sort(),
		["textStyle"],
		`${message}: paragraphStyle keys`,
	)
	assert.equal(
		isPlainVerifierObject(commandData.paragraphStyle.textStyle),
		true,
		`${message}: nested textStyle should be an object`,
	)
	assert.deepEqual(
		Object.keys(commandData.paragraphStyle.textStyle).sort(),
		Object.keys(expected.textStyle).sort(),
		`${message}: nested textStyle keys`,
	)
	for (const [key, value] of Object.entries(expected.textStyle)) {
		assert.equal(
			commandData.paragraphStyle.textStyle[key],
			value,
			`${message}: nested textStyle.${key}`,
		)
	}
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
	testCase.assertCommandData?.(
		last(node.commands).data,
		testCase.initialValue,
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
	testCase.assertCommandData?.(last(node.commands).data, testCase.nextValue)
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

function verifyTransformStyleSharedValuesUseJsStyleDelivery() {
	verifyNestedTransformLeavesUseJsStyleDelivery()
	verifyWholeTransformSharedValueUsesJsStyleDelivery()
}

function verifyNestedTransformLeavesUseJsStyleDelivery() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const sharedValues = Object.fromEntries(
		nestedTransformBindingCases.map((testCase) => [
			testCase.key,
			harness.makeSharedValue(
				testCase.initialValue,
				`style.transform.${testCase.key}`,
			),
		]),
	)
	const style = harness.makeVmValue(
		`({
			height: 20,
			transform: [
${formatNestedTransformVmEntries()}
				{ translateX: 11 },
			],
			width: 40,
		})`,
		sharedValues,
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
		"nested style.transform SharedValue leaves should use JS style listeners rather than native command mirrors",
	)
	for (const testCase of nestedTransformBindingCases) {
		assert.equal(
			sharedValues[testCase.key].listenerCount(),
			1,
			`nested style.transform ${testCase.key} should register a SharedValue listener`,
		)
	}
	assert.deepEqual(
		harness.calls.uiRuntimeCalls.map((call) => call.args[1]),
		nestedTransformBindingCases.map(
			(testCase, index) => `transform.${index}.${testCase.key}`,
		),
		"nested style.transform SharedValue listeners should be keyed by transform entry paths",
	)
	assert.equal(
		last(node.commands).data.rasterize,
		true,
		"group command props should still be applied while style.transform bindings are active",
	)
	for (const [index, testCase] of nestedTransformBindingCases.entries()) {
		assert.equal(
			last(node.styles).transform[index][testCase.key],
			testCase.initialValue,
			`nested style.transform ${testCase.key} should resolve the initial SharedValue snapshot`,
		)
	}
	assert.equal(
		last(node.styles).transform[nestedTransformBindingCases.length]
			.translateX,
		11,
		"nested style.transform static entries should remain in the style payload",
	)
	assert.equal(
		last(node.styles).height,
		20,
		"nested style.transform should preserve static sibling style fields initially",
	)
	assert.equal(
		calls.invalidations.length,
		0,
		"initial nested style.transform listener setup should not invalidate",
	)

	const expectedValues = new Map(
		nestedTransformBindingCases.map((testCase) => [
			testCase.key,
			testCase.initialValue,
		]),
	)
	for (const [index, testCase] of nestedTransformBindingCases.entries()) {
		sharedValues[testCase.key].emit(testCase.nextValue)
		expectedValues.set(testCase.key, testCase.nextValue)

		assert.deepEqual(
			last(harness.calls.runOnJSCalls).args,
			[`transform.${index}.${testCase.key}`, testCase.nextValue],
			`nested style.transform ${testCase.key} updates should bridge their own transform entry key through runOnJS`,
		)
		for (const [
			expectedIndex,
			expectedCase,
		] of nestedTransformBindingCases.entries()) {
			assert.equal(
				last(node.styles).transform[expectedIndex][expectedCase.key],
				expectedValues.get(expectedCase.key),
				`nested style.transform ${testCase.key} updates should preserve ${expectedCase.key} snapshots`,
			)
		}
		assert.equal(
			last(node.styles).transform[nestedTransformBindingCases.length]
				.translateX,
			11,
			`nested style.transform ${testCase.key} updates should preserve static transform entries`,
		)
		assert.equal(
			last(node.styles).width,
			40,
			`nested style.transform ${testCase.key} updates should preserve static sibling style fields`,
		)
		assert.equal(
			calls.invalidations.length,
			index + 1,
			`nested style.transform ${testCase.key} updates should invalidate the container`,
		)
		assert.equal(
			harness.calls.setBlocking.length,
			0,
			"nested style.transform updates should not use native mirror setBlocking updates",
		)
	}

	const styleCallsAfterEmit = node.styles.length
	const runOnJsCallsAfterEmit = harness.calls.runOnJSCalls.length
	config.commitUpdate(
		node,
		"group",
		{ rasterize: true, style },
		{
			rasterize: false,
			style: {
				transform: [{ translateX: 1 }, { scale: 1 }],
				width: 24,
			},
		},
		null,
	)

	for (const testCase of nestedTransformBindingCases) {
		assert.equal(
			sharedValues[testCase.key].listenerCount(),
			0,
			`commitUpdate should remove the nested style.transform ${testCase.key} listener`,
		)
	}
	assert.deepEqual(
		harness.calls.sharedRemoveListener.map((call) => call.had),
		nestedTransformBindingCases.map(() => true),
		"nested style.transform cleanup should remove existing SharedValue listener ids",
	)
	assert.equal(
		last(node.commands).data.rasterize,
		false,
		"commitUpdate should still update command props while nested style.transform cleanup runs",
	)
	assert.deepEqual(
		last(node.styles),
		{
			transform: [{ translateX: 1 }, { scale: 1 }],
			width: 24,
		},
		"commitUpdate should apply the cleaned transform style after removing nested style.transform listeners",
	)

	for (const testCase of nestedTransformBindingCases) {
		sharedValues[testCase.key].emit(testCase.lateValue)
	}

	assert.equal(
		node.styles.length,
		styleCallsAfterEmit + 1,
		"removed nested style.transform listeners should not rebuild styles after cleanup",
	)
	assert.equal(
		calls.invalidations.length,
		nestedTransformBindingCases.length,
		"removed nested style.transform listeners should not invalidate after cleanup",
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		runOnJsCallsAfterEmit,
		"removed nested style.transform listeners should not bridge through runOnJS after cleanup",
	)
}

function verifyWholeTransformSharedValueUsesJsStyleDelivery() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const initialTransform = [
		{ translateX: 2 },
		{ translateY: 3 },
		{ scale: 1.1 },
	]
	const nextTransform = [{ translateX: 6 }, { rotateZ: 0.25 }, { scale: 1.5 }]
	const lateTransform = [{ translateX: 12 }, { scale: 2 }]
	const transform = harness.makeSharedValue(
		initialTransform,
		"style.transform",
	)
	const style = harness.makeVmValue(
		`({
			opacity: 0.8,
			transform: bindings.transform,
			width: 60,
		})`,
		{ transform },
	)
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: true,
	})

	const node = config.createInstance(
		"rect",
		{
			style,
		},
		container,
	)

	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		"whole style.transform SharedValue should use JS style listeners rather than native command mirrors",
	)
	assert.equal(
		transform.listenerCount(),
		1,
		"whole style.transform SharedValue should register one listener",
	)
	assert.equal(
		only(harness.calls.uiRuntimeCalls).args[1],
		"transform",
		"whole style.transform SharedValue should use the top-level transform listener key",
	)
	assert.deepEqual(
		last(node.styles).transform,
		initialTransform,
		"whole style.transform SharedValue should resolve the initial transform snapshot",
	)
	assert.equal(
		last(node.styles).opacity,
		0.8,
		"whole style.transform SharedValue should preserve static sibling style fields initially",
	)
	assert.equal(
		calls.invalidations.length,
		0,
		"initial whole style.transform listener setup should not invalidate",
	)

	transform.emit(nextTransform)

	assert.deepEqual(
		only(harness.calls.runOnJSCalls).args,
		["transform", nextTransform],
		"whole style.transform updates should bridge the top-level transform key and full transform array",
	)
	assert.deepEqual(
		last(node.styles).transform,
		nextTransform,
		"whole style.transform updates should rebuild the host style with the latest transform array",
	)
	assert.equal(
		last(node.styles).width,
		60,
		"whole style.transform updates should preserve static sibling style fields",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"whole style.transform updates should invalidate the container",
	)
	assert.equal(
		harness.calls.setBlocking.length,
		0,
		"whole style.transform updates should not use native mirror setBlocking updates",
	)

	const styleCallsAfterEmit = node.styles.length
	const runOnJsCallsAfterEmit = harness.calls.runOnJSCalls.length
	config.commitUpdate(
		node,
		"rect",
		{ style },
		{
			style: {
				opacity: 0.4,
				transform: [{ translateY: 5 }],
			},
		},
		null,
	)

	assert.equal(
		transform.listenerCount(),
		0,
		"commitUpdate should remove the whole style.transform listener",
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		"whole style.transform cleanup should remove an existing SharedValue listener id",
	)
	assert.deepEqual(
		last(node.styles),
		{
			opacity: 0.4,
			transform: [{ translateY: 5 }],
		},
		"commitUpdate should apply the replacement static transform style after whole-transform cleanup",
	)

	transform.emit(lateTransform)

	assert.equal(
		node.styles.length,
		styleCallsAfterEmit + 1,
		"removed whole style.transform listener should not rebuild styles after cleanup",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"removed whole style.transform listener should not invalidate after cleanup",
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		runOnJsCallsAfterEmit,
		"removed whole style.transform listener should not bridge through runOnJS after cleanup",
	)
}

function verifyStyleLayerSharedValueUsesJsStyleDelivery() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const initialLayerPaint = { id: "initial-layer-paint" }
	const nextLayerPaint = { id: "next-layer-paint" }
	const lateLayerPaint = { id: "late-layer-paint" }
	const layer = harness.makeSharedValue(initialLayerPaint, "style.layer")
	const opacity = harness.makeSharedValue(0.25, "style.opacity")
	const style = harness.makeVmValue(
		`({
			layer: bindings.layer,
			opacity: bindings.opacity,
			width: 48,
		})`,
		{ layer, opacity },
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
		"style.layer SharedValue should use JS style listeners rather than native command mirrors",
	)
	assert.equal(
		layer.listenerCount(),
		1,
		"style.layer should register one SharedValue listener",
	)
	assert.equal(
		opacity.listenerCount(),
		1,
		"style.opacity should register one SharedValue listener",
	)
	assert.deepEqual(
		harness.calls.uiRuntimeCalls.map((call) => call.args[1]),
		["layer", "opacity"],
		"style SharedValue listeners should be keyed by top-level style property names",
	)
	assert.equal(
		last(node.commands).data.rasterize,
		true,
		"group command props should still be applied while style.layer binding is active",
	)
	assert.equal(
		last(node.styles).layer,
		initialLayerPaint,
		"style.layer should resolve the initial opaque SkPaint snapshot",
	)
	assert.equal(
		last(node.styles).opacity,
		0.25,
		"style.opacity should resolve the initial scalar snapshot beside style.layer",
	)
	assert.equal(
		last(node.styles).width,
		48,
		"static style fields should remain in the initial style payload",
	)
	assert.equal(
		calls.nativeAnimationActive.length,
		0,
		"style.layer should not mark the node as natively animated",
	)
	assert.equal(
		calls.invalidations.length,
		0,
		"initial style.layer listener setup should not invalidate",
	)

	layer.emit(nextLayerPaint)

	assert.deepEqual(
		only(harness.calls.runOnJSCalls).args,
		["layer", nextLayerPaint],
		"style.layer updates should bridge the top-level listener key and opaque paint value through runOnJS",
	)
	assert.equal(
		node.styles.length,
		2,
		"style.layer updates should call setStyle once after the initial style",
	)
	assert.equal(
		last(node.styles).layer,
		nextLayerPaint,
		"style.layer updates should rebuild the host style with the latest opaque paint value",
	)
	assert.equal(
		last(node.styles).opacity,
		0.25,
		"style.layer updates should rebuild the full style through getResolvedStyle, preserving sibling animated snapshots",
	)
	assert.equal(
		last(node.styles).width,
		48,
		"style.layer updates should preserve static style fields in the rebuilt style",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"style.layer updates should invalidate the container",
	)
	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		"style.layer updates should still avoid native command mirrors",
	)
	assert.equal(
		harness.calls.setBlocking.length,
		0,
		"style.layer updates should not use native mirror setBlocking updates",
	)

	opacity.emit(0.5)

	assert.deepEqual(
		last(harness.calls.runOnJSCalls).args,
		["opacity", 0.5],
		"style.opacity companion updates should bridge their own top-level listener key",
	)
	assert.equal(
		last(node.styles).layer,
		nextLayerPaint,
		"style.opacity updates should preserve the last style.layer opaque paint snapshot",
	)
	assert.equal(
		last(node.styles).opacity,
		0.5,
		"style.opacity updates should rebuild the host style with the latest scalar value",
	)
	assert.equal(
		calls.invalidations.length,
		2,
		"style.opacity updates should invalidate through the same style listener path",
	)

	const styleCallsAfterEmit = node.styles.length
	const runOnJsCallsAfterEmit = harness.calls.runOnJSCalls.length
	config.commitUpdate(
		node,
		"group",
		{ rasterize: true, style },
		{ rasterize: false, style: {} },
		null,
	)

	assert.equal(
		layer.listenerCount(),
		0,
		"commitUpdate should remove the style.layer listener",
	)
	assert.equal(
		opacity.listenerCount(),
		0,
		"commitUpdate should remove the style.opacity listener",
	)
	assert.deepEqual(
		harness.calls.sharedRemoveListener.map((call) => call.had),
		[true, true],
		"style.layer cleanup should remove existing SharedValue listener ids",
	)
	assert.equal(
		last(node.commands).data.rasterize,
		false,
		"commitUpdate should still update command props while style.layer cleanup runs",
	)
	assert.deepEqual(
		last(node.styles),
		{},
		"commitUpdate should apply the cleaned style after removing style.layer listeners",
	)

	layer.emit(lateLayerPaint)
	opacity.emit(0.75)

	assert.equal(
		node.styles.length,
		styleCallsAfterEmit + 1,
		"removed style.layer and style.opacity listeners should not rebuild styles after cleanup",
	)
	assert.equal(
		calls.invalidations.length,
		2,
		"removed style.layer and style.opacity listeners should not invalidate after cleanup",
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		runOnJsCallsAfterEmit,
		"removed style.layer and style.opacity listeners should not bridge through runOnJS after cleanup",
	)
}

function verifyWholeStyleSharedValueUsesJsStyleDelivery() {
	const harness = createReconcilerHarness()
	const config = harness.loadReconcilerHostConfig()
	const initialLayerPaint = { id: "whole-initial-layer-paint" }
	const nextLayerPaint = { id: "whole-next-layer-paint" }
	const lateLayerPaint = { id: "whole-late-layer-paint" }
	const initialStyle = {
		height: 24,
		layer: initialLayerPaint,
		opacity: 0.2,
		width: 64,
	}
	const nextStyle = {
		height: 28,
		layer: nextLayerPaint,
		opacity: 0.6,
		width: 72,
	}
	const lateStyle = {
		height: 32,
		layer: lateLayerPaint,
		opacity: 0.9,
		width: 80,
	}
	const wholeStyle = harness.makeSharedValue(
		initialStyle,
		"style.whole-node-style",
	)
	const { calls, container } = harness.makeRootContainer({
		nativeCommandBindingsEnabled: true,
	})

	const node = config.createInstance(
		"rect",
		{
			style: wholeStyle,
		},
		container,
	)

	assert.equal(
		harness.calls.createSynchronizable.length,
		0,
		"whole style SharedValue should use JS style listeners rather than native command mirrors",
	)
	assert.equal(
		wholeStyle.listenerCount(),
		1,
		"whole style SharedValue should register one listener",
	)
	assert.equal(
		only(harness.calls.uiRuntimeCalls).args[1],
		"",
		"whole style SharedValue should use the root style listener key",
	)
	assert.deepEqual(
		last(node.styles),
		initialStyle,
		"whole style SharedValue should resolve the initial YogaNodeStyle snapshot",
	)
	assert.equal(
		calls.invalidations.length,
		0,
		"initial whole style listener setup should not invalidate",
	)

	wholeStyle.emit(nextStyle)

	assert.deepEqual(
		only(harness.calls.runOnJSCalls).args,
		["", nextStyle],
		"whole style SharedValue updates should bridge the root style listener key and full style payload",
	)
	assert.deepEqual(
		last(node.styles),
		nextStyle,
		"whole style SharedValue updates should replace the host style with the latest YogaNodeStyle snapshot",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"whole style SharedValue updates should invalidate the container",
	)
	assert.equal(
		harness.calls.setBlocking.length,
		0,
		"whole style SharedValue updates should not use native mirror setBlocking updates",
	)

	const styleCallsAfterEmit = node.styles.length
	const runOnJsCallsAfterEmit = harness.calls.runOnJSCalls.length
	config.commitUpdate(
		node,
		"rect",
		{ style: wholeStyle },
		{ style: { opacity: 0.8 } },
		null,
	)

	assert.equal(
		wholeStyle.listenerCount(),
		0,
		"commitUpdate should remove the whole style SharedValue listener",
	)
	assert.equal(
		only(harness.calls.sharedRemoveListener).had,
		true,
		"whole style SharedValue cleanup should remove an existing listener id",
	)
	assert.deepEqual(
		last(node.styles),
		{ opacity: 0.8 },
		"commitUpdate should apply the replacement static style after whole-style cleanup",
	)

	wholeStyle.emit(lateStyle)

	assert.equal(
		node.styles.length,
		styleCallsAfterEmit + 1,
		"removed whole style SharedValue listener should not rebuild styles after cleanup",
	)
	assert.equal(
		calls.invalidations.length,
		1,
		"removed whole style SharedValue listener should not invalidate after cleanup",
	)
	assert.equal(
		harness.calls.runOnJSCalls.length,
		runOnJsCallsAfterEmit,
		"removed whole style SharedValue listener should not bridge through runOnJS after cleanup",
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
		formatNativeBindingCase(left).localeCompare(
			formatNativeBindingCase(right),
		),
	)
}

function formatNestedTransformVmEntries() {
	return nestedTransformBindingCases
		.map(({ key }) => `				{ ${key}: bindings.${key} },`)
		.join("\n")
}

function extractPublicTransformOperationInventory() {
	const stylePath = projectPath("src", "specs", "style.ts")
	const sourceFile = ts.createSourceFile(
		stylePath,
		readFileSync(stylePath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	)
	const operationAliases = new Map()
	let transformDeclaration

	walkTs(sourceFile, (node) => {
		if (!ts.isTypeAliasDeclaration(node) || !hasExportModifier(node)) {
			return
		}

		if (node.name.text === "Transform") {
			transformDeclaration = node
			return
		}

		if (!node.name.text.startsWith("Transform")) {
			return
		}

		operationAliases.set(node.name.text, {
			key: extractTransformOperationKey(node),
			typeName: node.name.text,
		})
	})

	assert.ok(
		transformDeclaration,
		"src/specs/style.ts should export a Transform type alias.",
	)

	return extractTransformUnionTypeNames(transformDeclaration).map(
		(typeName) => {
			const operation = operationAliases.get(typeName)
			assert.ok(
				operation,
				`Transform union references ${typeName}, but no exported single-key numeric transform operation alias was found.`,
			)
			return operation
		},
	)
}

function extractTransformOperationKey(declaration) {
	const type = skipTypeParentheses(declaration.type)
	assert.equal(
		ts.isTypeLiteralNode(type),
		true,
		`${declaration.name.text} should be a single-property type literal.`,
	)
	assert.equal(
		type.members.length,
		1,
		`${declaration.name.text} should expose exactly one public transform operation key.`,
	)

	const [member] = type.members
	assert.equal(
		ts.isPropertySignature(member),
		true,
		`${declaration.name.text} should use a property signature.`,
	)
	const key = propertyNameText(member.name)
	assert.ok(
		key,
		`${declaration.name.text} should use an identifier or literal property key.`,
	)
	assert.equal(
		member.type?.kind,
		ts.SyntaxKind.NumberKeyword,
		`${declaration.name.text}.${key} should be a number leaf.`,
	)
	return key
}

function extractTransformUnionTypeNames(declaration) {
	const transformType = skipTypeParentheses(declaration.type)
	assert.equal(
		ts.isArrayTypeNode(transformType),
		true,
		"Transform should be an array type whose element is the public transform operation union.",
	)

	const elementType = skipTypeParentheses(transformType.elementType)
	assert.equal(
		ts.isUnionTypeNode(elementType),
		true,
		"Transform should expose a union of public transform operation aliases.",
	)

	return elementType.types.map((typeNode) => {
		const member = skipTypeParentheses(typeNode)
		assert.equal(
			ts.isTypeReferenceNode(member) && ts.isIdentifier(member.typeName),
			true,
			"Transform union members should be named transform operation aliases.",
		)
		return member.typeName.text
	})
}

function assertTransformOperationCaseTableMatchesInventory(label, cases) {
	assert.deepEqual(
		cases.map(({ key, typeName }) => ({ key, typeName })),
		publicTransformOperationInventory.map(({ key, typeName }) => ({
			key,
			typeName,
		})),
		`${label} must match the public Transform operation inventory in src/specs/style.ts.`,
	)
}

function formatTransformOperationKeys(inventory) {
	return inventory.map(({ key }) => key).join(", ")
}

function hasExportModifier(node) {
	return Boolean(
		node.modifiers?.some(
			(modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
		),
	)
}

function skipTypeParentheses(node) {
	let current = node
	while (ts.isParenthesizedTypeNode(current)) {
		current = current.type
	}
	return current
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
