import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"

export function assertStyleCornerRadiusCaseTableMatchesInventory(
	rootDir,
	label,
	cases,
) {
	const caseKeys = cases.map(({ key }) => key)
	const sourceInventory = extractStyleCornerRadiusSourceInventory(rootDir)

	assert.deepEqual(
		sourceInventory.nodeStyle,
		caseKeys,
		`${label} must match the SkPoint-capable corner-radius keys in src/specs/style.ts NodeStyle.`,
	)
	assert.deepEqual(
		sourceInventory.jsxKeyUnion,
		caseKeys,
		`${label} must match YogaStyleCornerRadiusKey in src/jsx.ts.`,
	)
	assert.deepEqual(
		sourceInventory.reconcilerNestedRoots,
		caseKeys,
		`${label} must match the corner-radius entries in Reconciler styleNestedRoots.`,
	)
	assert.deepEqual(
		sourceInventory.reconcilerScalarKeys,
		caseKeys,
		`${label} must match Reconciler scalarCornerRadiusKeys.`,
	)
}

export function formatStyleCornerRadiusKeys(cases) {
	return cases.map(({ key }) => key).join(", ")
}

function extractStyleCornerRadiusSourceInventory(rootDir) {
	return {
		jsxKeyUnion: extractStringLiteralTypeAliasKeys(
			rootDir,
			projectPath(rootDir, "src", "jsx.ts"),
			"YogaStyleCornerRadiusKey",
		),
		nodeStyle: extractNodeStyleCornerRadiusKeys(rootDir),
		reconcilerNestedRoots: filterStyleCornerRadiusKeys(
			extractNewSetStringKeys(
				rootDir,
				projectPath(rootDir, "src", "Reconciler.ts"),
				"styleNestedRoots",
			),
		),
		reconcilerScalarKeys: extractStringArrayVariableKeys(
			rootDir,
			projectPath(rootDir, "src", "Reconciler.ts"),
			"scalarCornerRadiusKeys",
		),
	}
}

function extractNodeStyleCornerRadiusKeys(rootDir) {
	const stylePath = projectPath(rootDir, "src", "specs", "style.ts")
	const sourceFile = ts.createSourceFile(
		stylePath,
		readFileSync(stylePath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	)
	let nodeStyleDeclaration

	walkTs(sourceFile, (node) => {
		if (ts.isTypeAliasDeclaration(node) && node.name.text === "NodeStyle") {
			nodeStyleDeclaration = node
		}
	})

	assert.ok(
		nodeStyleDeclaration,
		"src/specs/style.ts should define a NodeStyle type alias.",
	)
	const nodeStyleType = skipTypeParentheses(nodeStyleDeclaration.type)
	assert.equal(
		ts.isTypeLiteralNode(nodeStyleType),
		true,
		"src/specs/style.ts NodeStyle should be a type literal.",
	)

	const keys = []
	for (const member of nodeStyleType.members) {
		if (!ts.isPropertySignature(member)) {
			continue
		}
		const key = propertyNameText(member.name)
		if (!key || !isStyleCornerRadiusKey(key)) {
			continue
		}
		assertCornerRadiusNodeStyleType(member, key)
		keys.push(key)
	}

	return keys
}

function assertCornerRadiusNodeStyleType(member, key) {
	assert.ok(
		member.type,
		`src/specs/style.ts NodeStyle.${key} should declare an explicit type.`,
	)
	const type = skipTypeParentheses(member.type)
	assert.equal(
		ts.isUnionTypeNode(type),
		true,
		`src/specs/style.ts NodeStyle.${key} should be a number | SkPoint union.`,
	)

	const members = type.types.map(skipTypeParentheses)
	assert.equal(
		members.some((entry) => entry.kind === ts.SyntaxKind.NumberKeyword),
		true,
		`src/specs/style.ts NodeStyle.${key} should accept number.`,
	)
	assert.equal(
		members.some(
			(entry) =>
				ts.isTypeReferenceNode(entry) &&
				ts.isIdentifier(entry.typeName) &&
				entry.typeName.text === "SkPoint",
		),
		true,
		`src/specs/style.ts NodeStyle.${key} should accept SkPoint.`,
	)
}

function extractStringLiteralTypeAliasKeys(rootDir, filePath, typeName) {
	const sourceFile = ts.createSourceFile(
		filePath,
		readFileSync(filePath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	)
	let declaration

	walkTs(sourceFile, (node) => {
		if (ts.isTypeAliasDeclaration(node) && node.name.text === typeName) {
			declaration = node
		}
	})

	assert.ok(
		declaration,
		`${path.relative(rootDir, filePath)} should define ${typeName}.`,
	)
	const union = skipTypeParentheses(declaration.type)
	assert.equal(
		ts.isUnionTypeNode(union),
		true,
		`${path.relative(rootDir, filePath)} ${typeName} should be a string literal union.`,
	)

	return union.types.map((typeNode) => {
		const literal = skipTypeParentheses(typeNode)
		assert.equal(
			ts.isLiteralTypeNode(literal) &&
				ts.isStringLiteral(literal.literal),
			true,
			`${path.relative(rootDir, filePath)} ${typeName} should only contain string literals.`,
		)
		return literal.literal.text
	})
}

function extractNewSetStringKeys(rootDir, filePath, variableName) {
	const initializer = extractVariableInitializer(rootDir, filePath, variableName)
	const expression = skipExpressionWrappers(initializer)
	assert.equal(
		ts.isNewExpression(expression) &&
			ts.isIdentifier(expression.expression) &&
			expression.expression.text === "Set",
		true,
		`${path.relative(rootDir, filePath)} ${variableName} should be initialized with new Set([...]).`,
	)
	assert.equal(
		expression.arguments?.length,
		1,
		`${path.relative(rootDir, filePath)} ${variableName} should pass one array literal to Set.`,
	)
	return extractStringArrayLiteralKeys(
		rootDir,
		expression.arguments[0],
		filePath,
		variableName,
	)
}

function extractStringArrayVariableKeys(rootDir, filePath, variableName) {
	return extractStringArrayLiteralKeys(
		rootDir,
		extractVariableInitializer(rootDir, filePath, variableName),
		filePath,
		variableName,
	)
}

function extractVariableInitializer(rootDir, filePath, variableName) {
	const sourceFile = ts.createSourceFile(
		filePath,
		readFileSync(filePath, "utf8"),
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	)
	let initializer

	walkTs(sourceFile, (node) => {
		if (ts.isVariableDeclaration(node) && node.name.getText() === variableName) {
			initializer = node.initializer
		}
	})

	assert.ok(
		initializer,
		`${path.relative(rootDir, filePath)} should define ${variableName}.`,
	)
	return initializer
}

function extractStringArrayLiteralKeys(rootDir, expression, filePath, label) {
	const arrayLiteral = skipExpressionWrappers(expression)
	assert.equal(
		ts.isArrayLiteralExpression(arrayLiteral),
		true,
		`${path.relative(rootDir, filePath)} ${label} should be an array literal.`,
	)
	return arrayLiteral.elements.map((element) => {
		const value = skipExpressionWrappers(element)
		assert.equal(
			ts.isStringLiteral(value),
			true,
			`${path.relative(rootDir, filePath)} ${label} should contain only string literals.`,
		)
		return value.text
	})
}

function filterStyleCornerRadiusKeys(keys) {
	return keys.filter(isStyleCornerRadiusKey)
}

function isStyleCornerRadiusKey(key) {
	return /^border(?:BottomLeft|BottomRight|TopLeft|TopRight)Radius$/.test(key)
}

function skipTypeParentheses(node) {
	let current = node
	while (ts.isParenthesizedTypeNode(current)) {
		current = current.type
	}
	return current
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

function walkTs(node, visitor) {
	visitor(node)
	ts.forEachChild(node, (child) => walkTs(child, visitor))
}

function projectPath(rootDir, ...segments) {
	return path.resolve(rootDir, ...segments)
}
