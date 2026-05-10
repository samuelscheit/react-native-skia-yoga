#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import {
	existsSync,
	lstatSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
} from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const expoCacheDir = path.join(exampleDir, ".expo")
const exampleRequire = createRequire(path.join(exampleDir, "package.json"))
const packageName = "react-native-skia-yoga"
const timeoutMs = 300_000
const expoCacheExistedAtStart = existsSync(expoCacheDir)

const nativeDirs = [
	{
		name: "iOS",
		path: path.join(exampleDir, "ios"),
		relativePath: "example/ios",
		markers: ["Podfile", ".xcode.env"],
	},
	{
		name: "Android",
		path: path.join(exampleDir, "android"),
		relativePath: "example/android",
		markers: ["settings.gradle", "app/build.gradle", "gradle.properties"],
	},
]

let activeChild = null
let cleaned = false
const cleanupAllowedPaths = new Set()
let summary = null

assertRunningUnderNode()

process.once("SIGINT", () => {
	terminateActiveChild("SIGTERM")
	cleanupNativeDirs()
	process.exit(130)
})

process.once("SIGTERM", () => {
	terminateActiveChild("SIGTERM")
	cleanupNativeDirs()
	process.exit(143)
})

try {
	prepareCleanNativeState()
	markNativeDirsWorkerOwned()
	await runExpoPrebuild()

	const iosSummary = assertGeneratedIosProject()
	const androidSummary = assertGeneratedAndroidProject()
	const rnCliSummary = assertReactNativeCliConfig()
	const expoIosSummary = assertExpoReactNativeConfig("ios")
	const expoAndroidSummary = assertExpoReactNativeConfig("android")

	summary = {
		androidSummary,
		expoAndroidSummary,
		expoIosSummary,
		iosSummary,
		rnCliSummary,
	}
} finally {
	cleanupNativeDirs()
}

console.log("Example native generation verifier passed:")
console.log(
	`- Expo prebuild ran through Node (${process.execPath}) with --no-install --clean --platform all.`,
)
console.log(
	`- Generated iOS project was NUL-free and parser-readable: ${summary.iosSummary.pbxprojPath}`,
)
console.log(
	`- Generated Android project files and metadata were present: ${summary.androidSummary.sourceDir}`,
)
console.log(
	`- React Native CLI config resolved ${packageName} iOS podspec: ${summary.rnCliSummary.iosPodspecPath}`,
)
console.log(
	`- React Native CLI config resolved ${summary.rnCliSummary.packageInstance}, ${summary.rnCliSummary.libraryName}, and ${summary.rnCliSummary.componentDescriptors.join(", ")}.`,
)
console.log(
	`- Expo react-native-config resolved ${packageName} for iOS and Android, including ${summary.expoAndroidSummary.libraryName}.`,
)
console.log("- Removed generated example/ios and example/android.")
if (!expoCacheExistedAtStart) {
	console.log("- Removed generated example/.expo cache.")
}

function assertRunningUnderNode() {
	assert.ok(process.versions.node, "Verifier must run under Node.js.")
	assert.equal(
		process.versions.bun,
		undefined,
		"Verifier must not run under Bun; run it with node.",
	)
	assert.match(
		path.basename(process.execPath),
		/^node(?:\.exe)?$/,
		`Verifier must use a Node executable, received: ${process.execPath}`,
	)
}

function prepareCleanNativeState() {
	for (const nativeDir of nativeDirs) {
		if (assertNativeDirCanBeRemoved(nativeDir)) {
			cleanupAllowedPaths.add(nativeDir.path)
			rmSync(nativeDir.path, { recursive: true, force: true })
		}
	}
}

function assertNativeDirCanBeRemoved(nativeDir) {
	if (!existsSync(nativeDir.path)) {
		return false
	}

	assertPathInside(nativeDir.path, exampleDir, `${nativeDir.relativePath} path`)

	const nativeDirStat = lstatSync(nativeDir.path)
	assert.equal(
		nativeDirStat.isSymbolicLink(),
		false,
		`${nativeDir.relativePath} must not be a symlink.`,
	)
	assert.ok(
		nativeDirStat.isDirectory(),
		`${nativeDir.relativePath} must be a directory if it exists.`,
	)

	assertNoTrackedFiles(nativeDir.relativePath)

	const entries = readdirSync(nativeDir.path)
	if (entries.length === 0) {
		return true
	}

	const hasGeneratedMarkers = nativeDir.markers.every((marker) =>
		existsSync(path.join(nativeDir.path, marker)),
	)
	assert.ok(
		hasGeneratedMarkers,
		[
			`Refusing to remove ambiguous pre-existing ${nativeDir.relativePath}.`,
			`Expected generated-native markers: ${nativeDir.markers.join(", ")}`,
		].join(" "),
	)

	return true
}

function markNativeDirsWorkerOwned() {
	for (const nativeDir of nativeDirs) {
		cleanupAllowedPaths.add(nativeDir.path)
	}
}

function assertNoTrackedFiles(relativePath) {
	const result = spawnSync("git", ["ls-files", "--", relativePath], {
		cwd: rootDir,
		encoding: "utf8",
	})
	if (result.error) {
		throw result.error
	}
	assert.equal(
		result.status,
		0,
		`git ls-files failed for ${relativePath}: ${result.stderr}`,
	)
	assert.equal(
		result.stdout.trim(),
		"",
		`Refusing to remove tracked generated-native files under ${relativePath}.`,
	)
}

async function runExpoPrebuild() {
	const expoCliPath = exampleRequire.resolve("@expo/cli")
	assertPathInside(expoCliPath, path.join(exampleDir, "node_modules"), "@expo/cli")

	console.log(`Running Expo prebuild through Node with a ${timeoutMs / 1000}s timeout.`)
	await runBounded(
		process.execPath,
		[expoCliPath, "prebuild", "--no-install", "--clean", "--platform", "all"],
		{
			cwd: exampleDir,
			env: verifierEnv(),
			timeoutMs,
		},
	)
}

function assertGeneratedIosProject() {
	const iosDir = path.join(exampleDir, "ios")
	assertDirectory(iosDir, "generated example/ios")

	const pbxprojPath = findPbxproj(iosDir)
	const pbxproj = readFileSync(pbxprojPath)
	const nulCount = pbxproj.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0)
	assert.equal(nulCount, 0, "Generated project.pbxproj must contain zero NUL bytes.")

	parsePbxproj(pbxprojPath)

	const podfile = readText(path.join(iosDir, "Podfile"))
	assert.match(
		podfile,
		/expo-modules-autolinking/,
		"Generated iOS Podfile must use Expo autolinking.",
	)
	assert.match(
		podfile,
		/react-native-config/,
		"Generated iOS Podfile must ask Expo autolinking for React Native config.",
	)

	assertFile(path.join(iosDir, "Podfile.properties.json"), "iOS Podfile properties")
	assertFile(
		path.join(iosDir, "reactnativeskiayogaexample", "Info.plist"),
		"iOS Info.plist",
	)
	assertFile(
		path.join(iosDir, "reactnativeskiayogaexample", "Supporting", "Expo.plist"),
		"iOS Expo.plist",
	)

	return {
		pbxprojPath,
		size: pbxproj.length,
	}
}

function findPbxproj(iosDir) {
	const projectDirs = readdirSync(iosDir)
		.filter((entry) => entry.endsWith(".xcodeproj"))
		.map((entry) => path.join(iosDir, entry))
		.filter((entryPath) => statSync(entryPath).isDirectory())
	assert.deepEqual(
		projectDirs.map((entryPath) => path.basename(entryPath)),
		["reactnativeskiayogaexample.xcodeproj"],
		"Generated iOS project directory mismatch.",
	)

	const pbxprojPath = path.join(projectDirs[0], "project.pbxproj")
	assertFile(pbxprojPath, "generated iOS project.pbxproj")
	return pbxprojPath
}

function parsePbxproj(pbxprojPath) {
	let xcode
	try {
		xcode = exampleRequire("xcode")
	} catch (error) {
		if (error?.code === "MODULE_NOT_FOUND") {
			console.log("- Skipped project.pbxproj parser check because xcode is not installed.")
			return
		}
		throw error
	}

	const project = xcode.project(pbxprojPath)
	project.parseSync()
	const nativeTargets = Object.values(project.pbxNativeTargetSection()).filter(
		(value) => value && typeof value === "object" && value.isa === "PBXNativeTarget",
	)
	assert.ok(
		nativeTargets.length > 0,
		"Generated project.pbxproj parser result must include at least one native target.",
	)
}

function assertGeneratedAndroidProject() {
	const androidDir = path.join(exampleDir, "android")
	assertDirectory(androidDir, "generated example/android")

	const settingsGradle = readText(path.join(androidDir, "settings.gradle"))
	assert.match(
		settingsGradle,
		/expo-autolinking-settings/,
		"Generated Android settings.gradle must use Expo autolinking settings.",
	)
	assert.match(
		settingsGradle,
		/expoAutolinking\.rnConfigCommand/,
		"Generated Android settings.gradle must use Expo RN config autolinking.",
	)
	assert.match(
		settingsGradle,
		/rootProject\.name = 'react-native-skia-yoga-example'/,
		"Generated Android settings.gradle must keep the example project name.",
	)

	const appBuildGradlePath = path.join(androidDir, "app", "build.gradle")
	const appBuildGradle = readText(appBuildGradlePath)
	assert.match(
		appBuildGradle,
		/namespace 'com\.flam3rboy\.reactnativeskiayogaexample'/,
		"Generated Android app namespace mismatch.",
	)
	assert.match(
		appBuildGradle,
		/applicationId 'com\.flam3rboy\.reactnativeskiayogaexample'/,
		"Generated Android app applicationId mismatch.",
	)
	assert.match(
		appBuildGradle,
		/autolinkLibrariesWithApp\(\)/,
		"Generated Android app build.gradle must autolink libraries.",
	)

	const gradleProperties = readText(path.join(androidDir, "gradle.properties"))
	assert.match(
		gradleProperties,
		/^newArchEnabled=true$/m,
		"Generated Android gradle.properties must keep newArchEnabled=true.",
	)
	assert.match(
		gradleProperties,
		/^hermesEnabled=true$/m,
		"Generated Android gradle.properties must keep hermesEnabled=true.",
	)

	assertFile(
		path.join(androidDir, "app", "src", "main", "AndroidManifest.xml"),
		"AndroidManifest.xml",
	)
	assertFile(path.join(androidDir, "gradlew"), "Android Gradle wrapper")

	return {
		sourceDir: androidDir,
	}
}

function assertReactNativeCliConfig() {
	const cliPath = exampleRequire.resolve("@react-native-community/cli/build/bin")
	const config = parseJsonOutput(
		runCaptured(process.execPath, [cliPath, "config"], {
			cwd: exampleDir,
			env: verifierEnv(),
			timeout: 120_000,
		}).stdout,
	)

	assert.equal(
		realpathSync(config.root),
		realpathSync(exampleDir),
		"React Native CLI config root must be the example directory.",
	)
	assert.equal(
		realpathSync(config.project?.ios?.sourceDir),
		realpathSync(path.join(exampleDir, "ios")),
		"React Native CLI config must point at generated example/ios.",
	)
	assert.equal(
		config.project?.ios?.xcodeProject?.name,
		"reactnativeskiayogaexample.xcodeproj",
		"React Native CLI config must report the generated iOS Xcode project.",
	)
	assert.equal(
		realpathSync(config.project?.android?.sourceDir),
		realpathSync(path.join(exampleDir, "android")),
		"React Native CLI config must point at generated example/android.",
	)
	assert.equal(
		config.project?.android?.applicationId,
		"com.flam3rboy.reactnativeskiayogaexample",
		"React Native CLI config must report the generated Android applicationId.",
	)

	const dependency = assertDependency(config, "React Native CLI config")
	const ios = requiredObject(
		dependency.platforms?.ios,
		"React Native CLI config must include iOS metadata for react-native-skia-yoga.",
	)
	const android = requiredObject(
		dependency.platforms?.android,
		"React Native CLI config must include Android metadata for react-native-skia-yoga.",
	)

	const iosPodspecPath = assertIosPodspec(ios, "React Native CLI config")
	const androidSummary = assertAndroidAutolinking(android, "React Native CLI config")

	return {
		...androidSummary,
		iosPodspecPath,
	}
}

function assertExpoReactNativeConfig(platform) {
	const autolinkingCliPath = exampleRequire.resolve(
		"expo-modules-autolinking/bin/expo-modules-autolinking",
	)
	const sourceDir = platform === "ios" ? "ios" : "android"
	const output = runCaptured(
		process.execPath,
		[
			autolinkingCliPath,
			"react-native-config",
			"--platform",
			platform,
			"--source-dir",
			sourceDir,
			"--json",
			"--project-root",
			".",
		],
		{
			cwd: exampleDir,
			env: verifierEnv(),
			timeout: 120_000,
		},
	).stdout
	const config = parseJsonOutput(output)

	assert.equal(
		realpathSync(config.root),
		realpathSync(exampleDir),
		`Expo react-native-config ${platform} root must be the example directory.`,
	)
	assert.equal(
		config.project?.[platform]?.sourceDir,
		sourceDir,
		`Expo react-native-config ${platform} project sourceDir mismatch.`,
	)

	const dependency = assertDependency(
		config,
		`Expo react-native-config ${platform}`,
	)
	const platformConfig = requiredObject(
		dependency.platforms?.[platform],
		`Expo react-native-config must include ${platform} metadata for react-native-skia-yoga.`,
	)

	if (platform === "ios") {
		return {
			iosPodspecPath: assertIosPodspec(
				platformConfig,
				"Expo react-native-config iOS",
			),
		}
	}

	return assertAndroidAutolinking(
		platformConfig,
		"Expo react-native-config Android",
	)
}

function assertDependency(config, label) {
	const dependency = config.dependencies?.[packageName]
	assert.ok(dependency, `${label} did not include ${packageName}.`)
	assert.equal(
		dependency.name,
		packageName,
		`${label} dependency name mismatch.`,
	)
	return dependency
}

function assertIosPodspec(ios, label) {
	const podspecPath = requiredString(
		ios.podspecPath,
		`${label} iOS metadata must include podspecPath.`,
	)
	assert.equal(
		path.basename(podspecPath),
		"RNSkiaYoga.podspec",
		`${label} iOS podspecPath must resolve RNSkiaYoga.podspec.`,
	)
	assertFile(podspecPath, `${label} iOS podspecPath`)
	return podspecPath
}

function assertAndroidAutolinking(android, label) {
	const sourceDir = requiredString(
		android.sourceDir,
		`${label} Android metadata must include sourceDir.`,
	)
	assert.equal(
		path.basename(sourceDir),
		"android",
		`${label} Android sourceDir must point at an android directory.`,
	)
	assertDirectory(sourceDir, `${label} Android sourceDir`)
	assert.equal(
		android.packageImportPath,
		"import com.margelo.nitro.skiayoga.SkiaYogaPackage;",
		`${label} Android packageImportPath mismatch.`,
	)
	assert.equal(
		android.packageInstance,
		"new SkiaYogaPackage()",
		`${label} Android packageInstance mismatch.`,
	)
	assert.equal(
		android.libraryName,
		"RNSkiaYogaSpec",
		`${label} Android libraryName must be RNSkiaYogaSpec.`,
	)
	assert.deepEqual(
		android.componentDescriptors,
		["SkiaYogaViewComponentDescriptor"],
		`${label} Android componentDescriptors mismatch.`,
	)

	return {
		componentDescriptors: android.componentDescriptors,
		libraryName: android.libraryName,
		packageInstance: android.packageInstance,
		sourceDir,
	}
}

function runCaptured(command, args, options) {
	const result = spawnSync(command, args, {
		cwd: options.cwd,
		encoding: "utf8",
		env: options.env,
		timeout: options.timeout,
	})
	if (result.error) {
		throw result.error
	}
	if (result.status !== 0) {
		throw new Error(
			[
				`${command} ${args.join(" ")} failed with exit code ${result.status}.`,
				result.stderr,
				result.stdout,
			].join("\n"),
		)
	}
	return result
}

function runBounded(command, args, options) {
	return new Promise((resolve, reject) => {
		let timedOut = false
		let timeout = null
		let killTimeout = null
		const child = spawn(command, args, {
			cwd: options.cwd,
			detached: process.platform !== "win32",
			env: options.env,
			stdio: "inherit",
		})

		activeChild = child

		const clearTimers = () => {
			if (timeout !== null) {
				clearTimeout(timeout)
			}
			if (killTimeout !== null) {
				clearTimeout(killTimeout)
			}
		}

		timeout = setTimeout(() => {
			timedOut = true
			terminateActiveChild("SIGTERM")
			killTimeout = setTimeout(() => {
				terminateActiveChild("SIGKILL")
			}, 5_000)
			killTimeout.unref()
		}, options.timeoutMs)
		timeout.unref()

		child.once("error", (error) => {
			clearTimers()
			activeChild = null
			reject(new Error(`Failed to start ${command}: ${error.message}`))
		})

		child.once("close", (code, signal) => {
			clearTimers()
			activeChild = null

			if (timedOut) {
				reject(
					new Error(
						`${command} ${args.join(" ")} timed out after ${options.timeoutMs / 1000}s.`,
					),
				)
				return
			}

			if (code !== 0) {
				const detail = signal === null ? `exit code ${code}` : `signal ${signal}`
				reject(new Error(`${command} ${args.join(" ")} failed with ${detail}.`))
				return
			}

			resolve()
		})
	})
}

function terminateActiveChild(signal) {
	if (activeChild?.pid === undefined) {
		return
	}

	try {
		if (process.platform === "win32") {
			activeChild.kill(signal)
		} else {
			process.kill(-activeChild.pid, signal)
		}
	} catch (error) {
		if (error.code !== "ESRCH") {
			activeChild.kill(signal)
		}
	}
}

function cleanupNativeDirs() {
	if (cleaned) {
		return
	}

	cleaned = true
	for (const nativeDir of nativeDirs) {
		if (cleanupAllowedPaths.has(nativeDir.path)) {
			rmSync(nativeDir.path, { recursive: true, force: true })
		}
	}
	if (!expoCacheExistedAtStart) {
		rmSync(expoCacheDir, { recursive: true, force: true })
	}
}

function verifierEnv() {
	const env = {
		...process.env,
		CI: "1",
		EXPO_NO_TELEMETRY: "1",
		NO_COLOR: "1",
	}
	delete env.FORCE_COLOR
	return env
}

function parseJsonOutput(stdout) {
	const start = stdout.indexOf("{")
	const end = stdout.lastIndexOf("}")
	if (start === -1 || end === -1 || end < start) {
		throw new Error(`Expected JSON object in command output:\n${stdout}`)
	}
	return JSON.parse(stdout.slice(start, end + 1))
}

function readText(filePath) {
	assertFile(filePath, filePath)
	return readFileSync(filePath, "utf8")
}

function assertFile(filePath, label) {
	assert.ok(existsSync(filePath), `${label} must exist.`)
	assert.ok(statSync(filePath).isFile(), `${label} must be a file.`)
}

function assertDirectory(dirPath, label) {
	assert.ok(existsSync(dirPath), `${label} must exist.`)
	assert.ok(statSync(dirPath).isDirectory(), `${label} must be a directory.`)
}

function assertPathInside(targetPath, parentPath, label) {
	const parentRealPath = `${realpathSync(parentPath)}${path.sep}`
	const targetRealPath = `${realpathSync(targetPath)}${path.sep}`
	assert.ok(
		targetRealPath.startsWith(parentRealPath),
		`${label} must be inside ${parentPath}: ${targetPath}`,
	)
}

function requiredObject(value, message) {
	assert.ok(value && typeof value === "object" && !Array.isArray(value), message)
	return value
}

function requiredString(value, message) {
	assert.equal(typeof value, "string", message)
	assert.notEqual(value.length, 0, message)
	return value
}
