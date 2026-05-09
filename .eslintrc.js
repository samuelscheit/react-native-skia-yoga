const path = require("node:path")

const reactNativeEslintConfigDir = path.dirname(
	require.resolve("@react-native/eslint-config/package.json"),
)
const reactNativeTypeScriptParser = require.resolve("@typescript-eslint/parser", {
	paths: [reactNativeEslintConfigDir],
})

module.exports = {
	root: true,
	extends: ["@react-native"],
	env: {
		es2022: true,
	},
	parserOptions: {
		ecmaVersion: 2022,
		sourceType: "module",
	},
	ignorePatterns: [
		"node_modules/",
		"example/node_modules/",
		"lib/",
		"coverage/",
		"android/build/",
		"example/android/",
		"example/ios/",
		"nitrogen/generated/",
		"worker-progress/",
	],
	overrides: [
		{
			files: ["*.d.ts", "**/*.d.ts"],
			parser: reactNativeTypeScriptParser,
			rules: {
				"@typescript-eslint/no-unused-vars": "off",
				"no-undef": "off",
			},
		},
		{
			files: ["*.ts", "*.tsx", "**/*.ts", "**/*.tsx"],
			parser: reactNativeTypeScriptParser,
		},
		{
			files: ["example/app/(tabs)/**/*.tsx", "example/types/**/*.tsx"],
			rules: {
				// Example screens and typecheck fixtures intentionally keep
				// inline style objects visible as part of the documentation.
				"react-native/no-inline-styles": "off",
			},
		},
		{
			files: [
				".eslintrc.js",
				"**/*.config.js",
				"jsx-dev-runtime.js",
				"jsx-runtime.js",
				"react-native.config.js",
			],
			env: {
				node: true,
			},
		},
		{
			files: [
				".eslintrc.js",
				"babel.config.js",
				"example/metro.config.js",
				"jsx-dev-runtime.js",
				"jsx-runtime.js",
				"react-native.config.js",
			],
			parserOptions: {
				sourceType: "script",
			},
		},
		{
			files: ["scripts/**/*.mjs"],
			env: {
				node: true,
			},
			parserOptions: {
				sourceType: "module",
			},
		},
		{
			files: ["example/babel.config.js"],
			parserOptions: {
				sourceType: "module",
			},
		},
	],
}
