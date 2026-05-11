#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import {
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import {
	createVerifierTempDir,
	formatVerifierTempDiagnostics,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const rootPackageJson = readPackageJson(path.join(rootDir, "package.json"))
const examplePackageJson = readPackageJson(
	path.join(rootDir, "example", "package.json"),
)

const tempRoot = createVerifierTempDir("rnskia-package-typescript-consumer-")

try {
	const tarballDir = path.join(tempRoot, "tarball")
	const consumerDir = path.join(tempRoot, "consumer")
	mkdirSync(tarballDir, { recursive: true })
	mkdirSync(path.join(consumerDir, "src"), { recursive: true })

	const packedTarball = packPackage(tarballDir)
	const consumerDependencySummary = writeConsumerProject(
		consumerDir,
		packedTarball,
	)

	run(
		"npm",
		[
			"install",
			"--ignore-scripts",
			"--no-audit",
			"--no-fund",
			"--package-lock=false",
			"--prefer-offline",
			"--legacy-peer-deps",
		],
		{ cwd: consumerDir, timeout: 300_000 },
	)

	const packedDependencySummary = assertPackedPackageInstall(consumerDir)

	run(
		process.execPath,
		[
			path.join(
				consumerDir,
				"node_modules",
				"typescript",
				"lib",
				"tsc.js",
			),
			"-p",
			"tsconfig.json",
			"--noEmit",
		],
		{ cwd: consumerDir, timeout: 120_000 },
	)

	run(
		process.execPath,
		[
			path.join(
				consumerDir,
				"node_modules",
				"typescript",
				"lib",
				"tsc.js",
			),
			"-p",
			"tsconfig.package-exports.json",
			"--noEmit",
		],
		{ cwd: consumerDir, timeout: 120_000 },
	)

	console.log("Packed package TypeScript consumer verifier passed:")
	console.log("- npm pack created a real tarball outside the repository.")
	console.log(
		"- A temporary consumer installed react-native-skia-yoga from that tarball.",
	)
	console.log(
		"- Consumer TypeScript used jsx: react-jsx and jsxImportSource: react-native-skia-yoga.",
	)
	console.log(
		"- Public package entrypoints and lowercase intrinsic JSX compiled from the installed package.",
	)
	console.log(
		"- Packed consumer JSX compiled representative dynamic SharedValue command props plus canonical style.antiAlias, static style.layer Skia.Paint(), dynamic style.layer SharedValue<SkPaint>, dynamic style.opacity, and whole SharedValue<YogaNodeStyle> authoring.",
	)
	console.log(
		"- Packed consumer TypeScript accepted legacy style.antiaAlias while canonical style.antiAlias remains the preferred public authoring key.",
	)
	console.log(
		"- Packed consumer TypeScript still rejected unsupported nested image.sampling SharedValue leaves while sampling remains opaque.",
	)
	console.log(
		"- Packed consumer TypeScript accepted simple text.textStyle color/fontSize authoring and rejected rich text.textStyle fontFamilies, fontFeatures, fontStyle, letterSpacing, and fontVariations authoring while preserving rich paragraphStyle text styling.",
	)
	console.log(
		"- Packed consumer TypeScript accepted static and dynamic nested paragraphStyle.textStyle CSS color/fontSize authoring.",
	)
	console.log(
		"- Public package boundary rejected internal top-level exports such as reconciler, NodeCommand, createYogaNode, and SkiaYoga.",
	)
	console.log(
		"- Package exports boundary preserved root/JSX runtime imports and rejected representative src/specs deep imports under TypeScript moduleResolution: Bundler.",
	)
	const consumerDevDependencies =
		consumerDependencySummary.devDependencies.join(", ")
	const packedReactReconciler = packedDependencySummary["react-reconciler"]
	const packedReactReconcilerTypes =
		packedDependencySummary["@types/react-reconciler"]
	console.log(
		[
			`- Temporary consumer devDependencies: ${consumerDevDependencies}`,
			"(no @types/react-reconciler).",
		].join(" "),
	)
	console.log(
		`- Packed dependency react-reconciler: ${packedReactReconciler}.`,
	)
	console.log(
		`- Packed dependency @types/react-reconciler: ${packedReactReconcilerTypes}.`,
	)
} finally {
	rmSync(tempRoot, { recursive: true, force: true })
}

function packPackage(tarballDir) {
	const packResult = run(
		"npm",
		[
			"pack",
			"--json",
			"--ignore-scripts",
			"--pack-destination",
			tarballDir,
		],
		{
			cwd: rootDir,
			diagnostics: () =>
				formatVerifierTempDiagnostics([
					{
						label: "typescript consumer temp root",
						targetPath: tempRoot,
					},
					{
						label: "npm pack tarball directory",
						targetPath: tarballDir,
					},
				]),
			timeout: 120_000,
		},
	)
	const packManifest = JSON.parse(packResult.stdout.trim())
	if (!Array.isArray(packManifest) || packManifest.length === 0) {
		throw new Error(
			"npm pack --json --ignore-scripts returned no manifest entries.",
		)
	}

	const filename = packManifest[0]?.filename
	if (typeof filename !== "string" || filename.length === 0) {
		throw new Error("npm pack manifest did not include a tarball filename.")
	}

	return path.join(tarballDir, filename)
}

function writeConsumerProject(consumerDir, packedTarball) {
	const consumerPackageJson = {
		name: "rnskia-yoga-packed-typescript-consumer-smoke",
		version: "0.0.0",
		private: true,
		type: "module",
		dependencies: {
			[rootPackageJson.name]: pathToFileURL(packedTarball).href,
			"@shopify/react-native-skia": exampleDependencyVersion(
				"@shopify/react-native-skia",
			),
			react: exampleDependencyVersion("react"),
			"react-native": exampleDependencyVersion("react-native"),
			"react-native-gesture-handler": exampleDependencyVersion(
				"react-native-gesture-handler",
			),
			"react-native-nitro-modules": exampleDependencyVersion(
				"react-native-nitro-modules",
			),
			"react-native-reanimated": exampleDependencyVersion(
				"react-native-reanimated",
			),
			"react-native-worklets": exampleDependencyVersion(
				"react-native-worklets",
			),
		},
		devDependencies: {
			"@types/react": exampleDependencyVersion("@types/react"),
			typescript: exampleDependencyVersion("typescript"),
		},
	}

	const tsconfig = {
		compilerOptions: {
			allowSyntheticDefaultImports: true,
			esModuleInterop: true,
			forceConsistentCasingInFileNames: true,
			jsx: "react-jsx",
			jsxImportSource: rootPackageJson.name,
			lib: ["ES2022", "DOM"],
			module: "ESNext",
			moduleResolution: "Node",
			noEmit: true,
			skipLibCheck: true,
			strict: true,
			target: "ES2022",
			types: ["react"],
		},
		include: [
			"src/packed-package-smoke.tsx",
			"src/public-boundary-negative.ts",
		],
	}

	const packageExportsTsconfig = {
		compilerOptions: {
			allowSyntheticDefaultImports: true,
			esModuleInterop: true,
			forceConsistentCasingInFileNames: true,
			jsx: "react-jsx",
			jsxImportSource: rootPackageJson.name,
			lib: ["ES2022", "DOM"],
			module: "ESNext",
			moduleResolution: "Bundler",
			noEmit: true,
			resolvePackageJsonExports: true,
			skipLibCheck: true,
			strict: true,
			target: "ES2022",
			types: ["react"],
		},
		include: [
			"src/packed-package-smoke.tsx",
			"src/package-exports-boundary.ts",
		],
	}

	assertNoPathShortcuts(tsconfig, "Consumer tsconfig")
	assertNoPathShortcuts(
		packageExportsTsconfig,
		"Package exports boundary tsconfig",
	)
	assertConsumerDevDependencyAbsent(
		consumerPackageJson,
		"@types/react-reconciler",
	)

	writeJson(path.join(consumerDir, "package.json"), consumerPackageJson)
	writeJson(path.join(consumerDir, "tsconfig.json"), tsconfig)
	writeJson(
		path.join(consumerDir, "tsconfig.package-exports.json"),
		packageExportsTsconfig,
	)
	writeFileSync(
		path.join(consumerDir, "src", "packed-package-smoke.tsx"),
		consumerSource(),
	)
	writeFileSync(
		path.join(consumerDir, "src", "public-boundary-negative.ts"),
		consumerBoundarySource(),
	)
	writeFileSync(
		path.join(consumerDir, "src", "package-exports-boundary.ts"),
		consumerPackageExportsBoundarySource(),
	)

	return {
		devDependencies: Object.keys(
			consumerPackageJson.devDependencies,
		).sort(),
	}
}

function consumerSource() {
	return `import * as React from "react"
import { Skia, type FilterMode, type SamplingOptions, type SkPaint, type SkPath } from "@shopify/react-native-skia"
import type { SharedValue } from "react-native-reanimated"
import {
\tYogaCanvas,
\ttype YogaCanvasProfileSample,
\ttype YogaIntrinsicElements,
\ttype YogaNodeStyle,
} from "react-native-skia-yoga"
import { Fragment as YogaDevRuntimeFragment } from "react-native-skia-yoga/jsx-dev-runtime"
import { Fragment as YogaRuntimeFragment } from "react-native-skia-yoga/jsx-runtime"

const rootStyle: YogaNodeStyle = {
\talignItems: "center",
\tbackgroundColor: "#0f172a",
\tflex: 1,
\tjustifyContent: "center",
\tpadding: 12,
}

const panelStyle: YogaNodeStyle = {
\talignItems: "center",
\tbackgroundColor: "#1d4ed8",
\tborderRadius: 12,
\tflexDirection: "row",
\tgap: 8,
\theight: 72,
\tpadding: 8,
\twidth: 180,
}

const legacyAntiAliasStyle: YogaNodeStyle = {
\tantiaAlias: true,
}

const layerPaint = Skia.Paint()
layerPaint.setAlphaf(0.75)

const interactiveGroupProps: YogaIntrinsicElements["group"] = {
\thitSlop: 8,
\tonPress() {},
\tpreciseHit: true,
\tstyle: { layer: layerPaint, opacity: 0.9 },
}

const sharedCircleRadius = null as unknown as SharedValue<number>
const sharedRoundedRectCornerRadius = null as unknown as SharedValue<number>
const sharedBlur = null as unknown as SharedValue<number>
const sharedPathTrimStart = null as unknown as SharedValue<number>
const sharedPathTrimEnd = null as unknown as SharedValue<number>
const sharedStrokeMiterLimit = null as unknown as SharedValue<number>
const sharedLineFromX = null as unknown as SharedValue<number>
const sharedPointX = null as unknown as SharedValue<number>
const sharedParagraphTextStyleColor = null as unknown as SharedValue<string>
const sharedParagraphTextStyleFontSize = null as unknown as SharedValue<number>
const sharedSampling = null as unknown as SharedValue<SamplingOptions>
const sharedSamplingFilter = null as unknown as SharedValue<FilterMode>
const sharedLayerPaint = null as unknown as SharedValue<SkPaint>
const sharedLayerOpacity = null as unknown as SharedValue<number>
const sharedWholeStyle = null as unknown as SharedValue<YogaNodeStyle>
const compileOnlyPath = null as unknown as SkPath

const dynamicPathProps: YogaIntrinsicElements["path"] = {
\tpath: compileOnlyPath,
\tstroke: { miter_limit: sharedStrokeMiterLimit },
\tstyle: { height: 24, width: 48 },
\ttrimEnd: sharedPathTrimEnd,
\ttrimStart: sharedPathTrimStart,
}

const richParagraphProps: YogaIntrinsicElements["paragraph"] = {
\tparagraphStyle: {
\t\tcolor: "#f8fafc",
\t\tfontFamilies: ["Inter", "System"],
\t\tfontFeatures: [{ name: "kern", value: 1 }],
\t\tfontSize: 16,
\t\tfontStyle: {},
\t\tletterSpacing: 0.25,
\t\ttextStyle: {
\t\t\tfontFeatures: [{ name: "liga", value: 0 }],
\t\t\tletterSpacing: 0.5,
\t\t},
\t},
\tstyle: { height: 32, width: 140 },
\ttext: "rich paragraph",
}

const nestedParagraphTextStyleProps: YogaIntrinsicElements["paragraph"] = {
\tparagraphStyle: {
\t\ttextStyle: {
\t\t\tcolor: "#00ff00",
\t\t\tfontSize: 16,
\t\t},
\t},
\tstyle: { height: 32, width: 140 },
\ttext: "nested paragraph color",
}

const dynamicNestedParagraphTextStyleProps: YogaIntrinsicElements["paragraph"] = {
\tparagraphStyle: {
\t\ttextStyle: {
\t\t\tcolor: sharedParagraphTextStyleColor,
\t\t\tfontSize: sharedParagraphTextStyleFontSize,
\t\t},
\t},
\tstyle: { height: 32, width: 140 },
\ttext: "dynamic nested paragraph color",
}

const dynamicLayerGroupProps: YogaIntrinsicElements["group"] = {
\tstyle: {
\t\tlayer: sharedLayerPaint,
\t\topacity: sharedLayerOpacity,
\t},
}

const unsupportedNestedSamplingProps: YogaIntrinsicElements["image"] = {
\t// @ts-expect-error nested image.sampling SharedValue leaves are not part of the opaque SamplingOptions contract.
\tsampling: { filter: sharedSamplingFilter },
}

const unsupportedTextFontVariationsElement = (
\t// @ts-expect-error fontVariations is not a public Yoga textStyle authoring field.
\t<text text="unsupported" textStyle={{ fontVariations: [{ axis: "wght", value: 700 }] }} />
)

const unsupportedTextFontFamiliesElement = (
\t// @ts-expect-error fontFamilies is not a public simple text.textStyle authoring field.
\t<text text="unsupported" textStyle={{ fontFamilies: ["Inter"] }} />
)

const unsupportedTextFontFeaturesElement = (
\t// @ts-expect-error fontFeatures is not a public simple text.textStyle authoring field.
\t<text text="unsupported" textStyle={{ fontFeatures: [{ name: "kern", value: 1 }] }} />
)

const unsupportedTextFontStyleElement = (
\t// @ts-expect-error fontStyle is not a public simple text.textStyle authoring field.
\t<text text="unsupported" textStyle={{ fontStyle: {} }} />
)

const unsupportedTextLetterSpacingElement = (
\t// @ts-expect-error letterSpacing is not a public simple text.textStyle authoring field.
\t<text text="unsupported" textStyle={{ letterSpacing: 1 }} />
)

const unsupportedParagraphFlattenedFontVariationsElement = (
\t// @ts-expect-error fontVariations is not a public flattened Yoga paragraphStyle authoring field.
\t<paragraph text="unsupported" paragraphStyle={{ fontVariations: [{ axis: "wght", value: 700 }] }} />
)

const unsupportedParagraphNestedFontVariationsElement = (
\t// @ts-expect-error fontVariations is not a public nested Yoga paragraphStyle.textStyle authoring field.
\t<paragraph text="unsupported" paragraphStyle={{ textStyle: { fontVariations: [{ axis: "wght", value: 700 }] } }} />
)

function handleProfileSample(sample: YogaCanvasProfileSample) {
\treturn sample.avgDrawMs + sample.avgPresentMs + sample.frames
}

export function PackedPackageSmoke() {
\treturn (
\t\t<YogaCanvas
\t\t\tdebug={false}
\t\t\tonProfileSample={handleProfileSample}
\t\t\tprofilingEnabled
\t\t\tstyle={{ flex: 1 }}
\t\t>
\t\t\t<>
\t\t\t\t<rect style={rootStyle}>
\t\t\t\t\t<group {...interactiveGroupProps}>
\t\t\t\t\t\t<rrect
\t\t\t\t\t\t\tcornerRadius={sharedRoundedRectCornerRadius}
\t\t\t\t\t\t\tstyle={panelStyle}
\t\t\t\t\t\t>
\t\t\t\t\t\t\t<circle
\t\t\t\t\t\t\t\tradius={sharedCircleRadius}
\t\t\t\t\t\t\t\tstyle={{
\t\t\t\t\t\t\t\t\tbackgroundColor: "#14b8a6",
\t\t\t\t\t\t\t\t\theight: 32,
\t\t\t\t\t\t\t\t\tantiAlias: false,
\t\t\t\t\t\t\t\t\twidth: 32,
\t\t\t\t\t\t\t\t}}
\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t<text
\t\t\t\t\t\t\t\tstyle={{ height: 24, width: 84 }}
\t\t\t\t\t\t\t\ttext="packed"
\t\t\t\t\t\t\t\ttextStyle={{ color: "white", fontSize: 14 }}
\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t<paragraph {...richParagraphProps} />
\t\t\t\t\t\t\t<paragraph {...nestedParagraphTextStyleProps} />
\t\t\t\t\t\t\t<paragraph {...dynamicNestedParagraphTextStyleProps} />
\t\t\t\t\t\t\t<blurMaskFilter blur={sharedBlur} />
\t\t\t\t\t\t\t<path {...dynamicPathProps} />
\t\t\t\t\t\t\t<line
\t\t\t\t\t\t\t\tfrom={{ x: sharedLineFromX, y: 0 }}
\t\t\t\t\t\t\t\tto={{ x: 48, y: 12 }}
\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t<points
\t\t\t\t\t\t\t\tpointMode="points"
\t\t\t\t\t\t\t\tpoints={[{ x: sharedPointX, y: 0 }]}
\t\t\t\t\t\t\t/>
\t\t\t\t\t\t\t<group {...dynamicLayerGroupProps}>
\t\t\t\t\t\t\t\t<rect style={sharedWholeStyle} />
\t\t\t\t\t\t\t</group>
\t\t\t\t\t\t\t<image sampling={sharedSampling} />
\t\t\t\t\t\t</rrect>
\t\t\t\t\t</group>
\t\t\t\t</rect>
\t\t\t</>
\t\t</YogaCanvas>
\t)
}

const smokeElement: React.JSX.Element = <PackedPackageSmoke />
const devRuntimeFragment = YogaDevRuntimeFragment
const runtimeFragment = YogaRuntimeFragment

void smokeElement
void devRuntimeFragment
void runtimeFragment
void unsupportedNestedSamplingProps
void unsupportedTextFontVariationsElement
void unsupportedTextFontFamiliesElement
void unsupportedTextFontFeaturesElement
void unsupportedTextFontStyleElement
void unsupportedTextLetterSpacingElement
void unsupportedParagraphFlattenedFontVariationsElement
void unsupportedParagraphNestedFontVariationsElement
void legacyAntiAliasStyle
`
}

function consumerBoundarySource() {
	return `import * as PublicRuntime from "react-native-skia-yoga"
import type * as PublicTypes from "react-native-skia-yoga"

type PublicStyle = PublicTypes.YogaNodeStyle
type PublicIntrinsicGroup = PublicTypes.YogaIntrinsicElements["group"]

void PublicRuntime.YogaCanvas

// @ts-expect-error reconciler is an internal renderer implementation detail.
void PublicRuntime.reconciler
// @ts-expect-error createYogaNode is an internal native object factory.
void PublicRuntime.createYogaNode
// @ts-expect-error SkiaYoga is an internal native hybrid object.
void PublicRuntime.SkiaYoga
// @ts-expect-error YogaInteractionRegistry is internal canvas event plumbing.
void PublicRuntime.YogaInteractionRegistry
// @ts-expect-error NodeCommandKind is an internal command transport enum.
void PublicRuntime.NodeCommandKind

// @ts-expect-error YogaNodeFinal is internal native node plumbing.
type HiddenYogaNodeFinal = PublicTypes.YogaNodeFinal
// @ts-expect-error NodeCommand is an internal command transport union.
type HiddenNodeCommand = PublicTypes.NodeCommand
// @ts-expect-error NodeCommandNative is an internal Nitro command transport custom type.
type HiddenNodeCommandNative = PublicTypes.NodeCommandNative
// @ts-expect-error PathCommandPayload is an internal command transport payload.
type HiddenPathCommandPayload = PublicTypes.PathCommandPayload
// @ts-expect-error CircleCommandPayload is an internal command transport payload.
type HiddenCircleCommandPayload = PublicTypes.CircleCommandPayload
// @ts-expect-error YogaRootContainer is internal renderer state.
type HiddenYogaRootContainer = PublicTypes.YogaRootContainer
// @ts-expect-error SkiaYogaHostContext is internal renderer state.
type HiddenHostContext = PublicTypes.SkiaYogaHostContext
// @ts-expect-error YogaNodeInteractionConfig is internal native hit-test config.
type HiddenInteractionConfig = PublicTypes.YogaNodeInteractionConfig
// @ts-expect-error YogaNormalizedHitSlop is an internal normalized shape.
type HiddenNormalizedHitSlop = PublicTypes.YogaNormalizedHitSlop

const publicStyle: PublicStyle = { flex: 1 }
const publicGroupProps: PublicIntrinsicGroup = { pointerEvents: "auto" }

void publicStyle
void publicGroupProps
`
}

function consumerPackageExportsBoundarySource() {
	return `import { YogaCanvas } from "react-native-skia-yoga"
import type { YogaNodeStyle } from "react-native-skia-yoga"
import { Fragment as YogaDevRuntimeFragment } from "react-native-skia-yoga/jsx-dev-runtime"
import { Fragment as YogaRuntimeFragment } from "react-native-skia-yoga/jsx-runtime"

// @ts-expect-error src/specs/commands is physically published for codegen but is not an exported package subpath.
import type * as SpecCommands from "react-native-skia-yoga/src/specs/commands"
// @ts-expect-error src/specs/SkiaYoga.nitro is physically published for codegen but is not an exported package subpath.
import type * as NitroSpec from "react-native-skia-yoga/src/specs/SkiaYoga.nitro"
// @ts-expect-error src/specs/NativeSkiaYoga is physically published for codegen but is not an exported package subpath.
import type * as NativeSkiaYogaSpec from "react-native-skia-yoga/src/specs/NativeSkiaYoga"
// @ts-expect-error src/specs/SkiaYogaViewNativeComponent is physically published for codegen but is not an exported package subpath.
import type * as ViewSpec from "react-native-skia-yoga/src/specs/SkiaYogaViewNativeComponent"

const style: YogaNodeStyle = { flex: 1 }
const canvas = YogaCanvas
const devRuntimeFragment = YogaDevRuntimeFragment
const runtimeFragment = YogaRuntimeFragment

void style
void canvas
void devRuntimeFragment
void runtimeFragment
`
}

function assertPackedPackageInstall(consumerDir) {
	const packageRoot = path.join(
		consumerDir,
		"node_modules",
		rootPackageJson.name,
	)
	const packageStat = lstatSync(packageRoot)
	if (packageStat.isSymbolicLink()) {
		throw new Error("Packed package install resolved to a symlink.")
	}

	const installedRealPath = realpathSync(packageRoot)
	if (isPathInside(installedRealPath, rootDir)) {
		throw new Error(
			`Packed package install resolved inside the repository: ${installedRealPath}`,
		)
	}

	const installedPackageJson = readPackageJson(
		path.join(packageRoot, "package.json"),
	)
	if (installedPackageJson.name !== rootPackageJson.name) {
		throw new Error(
			`Installed package name mismatch: ${installedPackageJson.name}`,
		)
	}

	return {
		"react-reconciler": assertPublishedDependency(
			installedPackageJson,
			"react-reconciler",
		),
		"@types/react-reconciler": assertPublishedDependency(
			installedPackageJson,
			"@types/react-reconciler",
		),
	}
}

function exampleDependencyVersion(name) {
	const dependencySections = [
		examplePackageJson.dependencies,
		examplePackageJson.devDependencies,
	]

	for (const section of dependencySections) {
		const version = section?.[name]
		if (typeof version === "string" && version.length > 0) {
			return version
		}
	}

	throw new Error(`Example package.json does not declare ${name}.`)
}

function assertConsumerDevDependencyAbsent(consumerPackageJson, name) {
	if (
		Object.prototype.hasOwnProperty.call(
			consumerPackageJson.devDependencies ?? {},
			name,
		)
	) {
		throw new Error(
			`Temporary consumer must not declare ${name}; the packed package must provide its own type contract.`,
		)
	}
}

function assertNoPathShortcuts(tsconfig, label) {
	if (
		Object.prototype.hasOwnProperty.call(
			tsconfig.compilerOptions,
			"paths",
		) ||
		Object.prototype.hasOwnProperty.call(
			tsconfig.compilerOptions,
			"baseUrl",
		)
	) {
		throw new Error(`${label} must not use paths or baseUrl shortcuts.`)
	}
}

function assertPublishedDependency(packageJson, name) {
	const version = packageJson.dependencies?.[name]
	if (typeof version === "string" && version.length > 0) {
		return version
	}

	throw new Error(`Packed package.json must declare dependency ${name}.`)
}

function writeJson(filePath, value) {
	writeFileSync(filePath, `${JSON.stringify(value, null, "\t")}\n`)
}

function readPackageJson(filePath) {
	return JSON.parse(readFileSync(filePath, "utf8"))
}

function run(command, args, options) {
	const { diagnostics, ...spawnOptions } = options
	const result = spawnSync(command, args, {
		...spawnOptions,
		encoding: "utf8",
	})

	if (result.error) {
		throw new Error(`Failed to run ${command}: ${result.error.message}`)
	}

	if (result.status !== 0) {
		const stdout = result.stdout.trim()
		const stderr = result.stderr.trim()
		throw new Error(
			[
				`${command} ${args.join(" ")} failed with exit code ${result.status}.`,
				diagnostics ? `diagnostics:\n${diagnostics()}` : "",
				stdout ? `stdout:\n${stdout}` : "",
				stderr ? `stderr:\n${stderr}` : "",
			]
				.filter(Boolean)
				.join("\n\n"),
		)
	}

	return result
}

function isPathInside(candidatePath, parentPath) {
	const relativePath = path.relative(parentPath, candidatePath)
	return (
		relativePath === "" ||
		(Boolean(relativePath) &&
			!relativePath.startsWith("..") &&
			!path.isAbsolute(relativePath))
	)
}
