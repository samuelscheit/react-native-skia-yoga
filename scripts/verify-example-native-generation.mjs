#!/usr/bin/env node

import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
	symlinkSync,
	writeFileSync,
} from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"

const checkoutRootDir = path.resolve(import.meta.dirname, "..")
const checkoutExampleDir = path.join(checkoutRootDir, "example")
const packageName = "react-native-skia-yoga"
const timeoutMs = 300_000
const metadataTimeoutMs = 120_000
const tempParentDir = existsSync("/tmp") ? "/tmp" : tmpdir()
const preserveLocalProbeArg = "--probe-preserve-local-artifacts"

const sourceEntriesToCopy = [
	".eslintrc.js",
	".gitignore",
	"README.md",
	"RNSkiaYoga.podspec",
	"android",
	"babel.config.js",
	"bun.lock",
	"cpp",
	"example",
	"index.d.ts",
	"ios",
	"jsx-dev-runtime.d.ts",
	"jsx-dev-runtime.js",
	"jsx-runtime.d.ts",
	"jsx-runtime.js",
	"nitro.json",
	"nitrogen",
	"package.json",
	"react-native.config.js",
	"src",
	"tsconfig.json",
]

const excludedCopyPrefixes = [
	".git",
	".vscode",
	"node_modules",
	"worker-progress",
	"example/.expo",
	"example/android",
	"example/ios",
	"example/node_modules",
]

let activeChild = null
let activeWorkspace = null

assertRunningUnderNode()
assertAllowedArgs()

process.once("SIGINT", () => {
	terminateActiveChild("SIGTERM")
	cleanupActiveWorkspace()
	process.exit(130)
})

process.once("SIGTERM", () => {
	terminateActiveChild("SIGTERM")
	cleanupActiveWorkspace()
	process.exit(143)
})

if (process.argv.includes(preserveLocalProbeArg)) {
	await runLocalArtifactPreservationProbe()
} else {
	await runExampleNativeGenerationVerifier()
}

async function runExampleNativeGenerationVerifier() {
	const workspace = createTempWorkspace()
	activeWorkspace = workspace

	let summary = null
	try {
		await runExpoPrebuild(workspace)

		const iosSummary = assertGeneratedIosProject(workspace)
		const androidSummary = assertGeneratedAndroidProject(workspace)
		const rnCliSummary = assertReactNativeCliConfig(workspace)
		const expoIosSummary = assertExpoReactNativeConfig(workspace, "ios")
		const expoAndroidSummary = assertExpoReactNativeConfig(workspace, "android")

		summary = {
			androidSummary,
			expoAndroidSummary,
			expoIosSummary,
			iosSummary,
			rnCliSummary,
			workspaceRoot: workspace.rootDir,
		}
	} finally {
		cleanupWorkspace(workspace)
		activeWorkspace = null
	}

	console.log("Example native generation verifier passed:")
	console.log(
		`- Expo prebuild ran through Node (${process.execPath}) with --no-install --clean --platform all in an isolated temporary workspace.`,
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
	console.log(
		`- Removed temporary native-generation workspace: ${summary.workspaceRoot}`,
	)
	console.log(
		"- The launched checkout's example/ios, example/android, and example/.expo paths were not used as generation targets.",
	)
}

async function runLocalArtifactPreservationProbe() {
	const fixtures = createSentinelFixtures()

	try {
		await runExampleNativeGenerationVerifier()
		assertSentinelFixturesPreserved(fixtures)
	} finally {
		cleanupSentinelFixtures(fixtures)
	}

	console.log("Local native artifact preservation probe passed:")
	for (const fixture of fixtures) {
		console.log(`- Preserved and removed probe-owned sentinel under ${fixture.relativePath}.`)
	}
}

function createTempWorkspace() {
	const rootDir = mkdtempSync(
		path.join(tempParentDir, "rnskia-example-native-generation-"),
	)
	const workspace = {
		exampleDir: path.join(rootDir, "example"),
		exampleRequire: null,
		rootDir,
	}

	try {
		copyCheckoutSource(rootDir)
		linkRootNodeModules(rootDir)
		linkExampleNodeModules(rootDir)

		const examplePackageJson = path.join(workspace.exampleDir, "package.json")
		assertFile(examplePackageJson, "temporary example package.json")
		workspace.exampleRequire = createRequire(examplePackageJson)

		assertTempPackageLink(workspace)
		assert.equal(
			existsSync(path.join(workspace.exampleDir, "ios")),
			false,
			"Temporary workspace must start without example/ios.",
		)
		assert.equal(
			existsSync(path.join(workspace.exampleDir, "android")),
			false,
			"Temporary workspace must start without example/android.",
		)
		assert.equal(
			existsSync(path.join(workspace.exampleDir, ".expo")),
			false,
			"Temporary workspace must not copy launched-checkout example/.expo.",
		)

		return workspace
	} catch (error) {
		cleanupWorkspace(workspace)
		throw error
	}
}

function copyCheckoutSource(tempRootDir) {
	for (const entry of sourceEntriesToCopy) {
		const sourcePath = path.join(checkoutRootDir, entry)
		if (!existsSync(sourcePath)) {
			continue
		}

		cpSync(sourcePath, path.join(tempRootDir, entry), {
			dereference: false,
			errorOnExist: false,
			filter: shouldCopySourcePath,
			force: true,
			recursive: true,
		})
	}
}

function shouldCopySourcePath(sourcePath) {
	const relativePath = normalizeRelativePath(
		path.relative(checkoutRootDir, sourcePath),
	)
	if (relativePath === "") {
		return true
	}
	if (relativePath.endsWith(".tgz")) {
		return false
	}
	if (relativePath.endsWith("tsconfig.tsbuildinfo")) {
		return false
	}
	return !excludedCopyPrefixes.some(
		(prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
	)
}

function linkRootNodeModules(tempRootDir) {
	const sourceNodeModules = path.join(checkoutRootDir, "node_modules")
	assertDirectory(sourceNodeModules, "root node_modules")
	symlinkSync(
		realpathSync(sourceNodeModules),
		path.join(tempRootDir, "node_modules"),
		"dir",
	)
}

function linkExampleNodeModules(tempRootDir) {
	const sourceNodeModules = path.join(checkoutExampleDir, "node_modules")
	assertDirectory(sourceNodeModules, "example node_modules")

	const sourceNodeModulesRealPath = realpathSync(sourceNodeModules)
	const targetNodeModules = path.join(tempRootDir, "example", "node_modules")
	mkdirSync(targetNodeModules, { recursive: true })

	for (const entry of readdirSync(sourceNodeModulesRealPath).sort()) {
		const sourceEntry = path.join(sourceNodeModulesRealPath, entry)
		const targetEntry = path.join(targetNodeModules, entry)

		if (entry === packageName) {
			linkTempPackageRoot(tempRootDir, targetEntry)
			continue
		}

		if (entry.startsWith("@") && statSync(sourceEntry).isDirectory()) {
			mkdirSync(targetEntry, { recursive: true })
			for (const scopedEntry of readdirSync(sourceEntry).sort()) {
				symlinkDependency(
					path.join(sourceEntry, scopedEntry),
					path.join(targetEntry, scopedEntry),
				)
			}
			continue
		}

		symlinkDependency(sourceEntry, targetEntry)
	}

	const packageLinkPath = path.join(targetNodeModules, packageName)
	if (!existsSync(packageLinkPath)) {
		linkTempPackageRoot(tempRootDir, packageLinkPath)
	}
}

function symlinkDependency(sourcePath, targetPath) {
	const realSourcePath = realpathSync(sourcePath)
	const sourceStat = statSync(realSourcePath)
	symlinkSync(
		realSourcePath,
		targetPath,
		sourceStat.isDirectory() ? "dir" : "file",
	)
}

function linkTempPackageRoot(tempRootDir, targetPath) {
	symlinkSync(
		path.relative(path.dirname(targetPath), tempRootDir),
		targetPath,
		"dir",
	)
}

function assertTempPackageLink(workspace) {
	const packageLinkPath = path.join(
		workspace.exampleDir,
		"node_modules",
		packageName,
	)
	assert.equal(
		realpathSync(packageLinkPath),
		realpathSync(workspace.rootDir),
		`Temporary example node_modules/${packageName} must point at the temporary package root.`,
	)
}

async function runExpoPrebuild(workspace) {
	const expoCliPath = workspace.exampleRequire.resolve("@expo/cli")
	assertNodeModulePath(expoCliPath, "@expo/cli")
	assertTempPackageLink(workspace)

	console.log(`Running Expo prebuild through Node with a ${timeoutMs / 1000}s timeout.`)
	console.log(`- Temporary workspace: ${workspace.rootDir}`)
	await runBounded(
		process.execPath,
		[expoCliPath, "prebuild", "--no-install", "--clean", "--platform", "all"],
		{
			cwd: workspace.exampleDir,
			env: verifierEnv(),
			timeoutMs,
		},
	)
}

function assertGeneratedIosProject(workspace) {
	const iosDir = path.join(workspace.exampleDir, "ios")
	assertDirectory(iosDir, "generated temporary example/ios")

	const pbxprojPath = findPbxproj(iosDir)
	const pbxproj = readFileSync(pbxprojPath)
	const nulCount = pbxproj.reduce((count, byte) => count + (byte === 0 ? 1 : 0), 0)
	assert.equal(nulCount, 0, "Generated project.pbxproj must contain zero NUL bytes.")

	parsePbxproj(workspace, pbxprojPath)

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

function parsePbxproj(workspace, pbxprojPath) {
	let xcode
	try {
		xcode = workspace.exampleRequire("xcode")
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

function assertGeneratedAndroidProject(workspace) {
	const androidDir = path.join(workspace.exampleDir, "android")
	assertDirectory(androidDir, "generated temporary example/android")

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

function assertReactNativeCliConfig(workspace) {
	const cliPath = workspace.exampleRequire.resolve("@react-native-community/cli/build/bin")
	assertNodeModulePath(cliPath, "@react-native-community/cli")
	const config = parseJsonOutput(
		runCaptured(process.execPath, [cliPath, "config"], {
			cwd: workspace.exampleDir,
			env: verifierEnv(),
			timeout: metadataTimeoutMs,
		}).stdout,
	)

	assert.equal(
		realpathSync(config.root),
		realpathSync(workspace.exampleDir),
		"React Native CLI config root must be the temporary example directory.",
	)
	assert.equal(
		realpathSync(config.project?.ios?.sourceDir),
		realpathSync(path.join(workspace.exampleDir, "ios")),
		"React Native CLI config must point at generated temporary example/ios.",
	)
	assert.equal(
		config.project?.ios?.xcodeProject?.name,
		"reactnativeskiayogaexample.xcodeproj",
		"React Native CLI config must report the generated iOS Xcode project.",
	)
	assert.equal(
		realpathSync(config.project?.android?.sourceDir),
		realpathSync(path.join(workspace.exampleDir, "android")),
		"React Native CLI config must point at generated temporary example/android.",
	)
	assert.equal(
		config.project?.android?.applicationId,
		"com.flam3rboy.reactnativeskiayogaexample",
		"React Native CLI config must report the generated Android applicationId.",
	)

	const dependency = assertDependency(config, "React Native CLI config", workspace)
	const ios = requiredObject(
		dependency.platforms?.ios,
		"React Native CLI config must include iOS metadata for react-native-skia-yoga.",
	)
	const android = requiredObject(
		dependency.platforms?.android,
		"React Native CLI config must include Android metadata for react-native-skia-yoga.",
	)

	const iosPodspecPath = assertIosPodspec(
		ios,
		"React Native CLI config",
		workspace,
	)
	const androidSummary = assertAndroidAutolinking(
		android,
		"React Native CLI config",
		workspace,
	)

	return {
		...androidSummary,
		iosPodspecPath,
	}
}

function assertExpoReactNativeConfig(workspace, platform) {
	const autolinkingCliPath = workspace.exampleRequire.resolve(
		"expo-modules-autolinking/bin/expo-modules-autolinking",
	)
	assertNodeModulePath(autolinkingCliPath, "expo-modules-autolinking")
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
			cwd: workspace.exampleDir,
			env: verifierEnv(),
			timeout: metadataTimeoutMs,
		},
	).stdout
	const config = parseJsonOutput(output)

	assert.equal(
		realpathSync(config.root),
		realpathSync(workspace.exampleDir),
		`Expo react-native-config ${platform} root must be the temporary example directory.`,
	)
	assert.equal(
		config.project?.[platform]?.sourceDir,
		sourceDir,
		`Expo react-native-config ${platform} project sourceDir mismatch.`,
	)

	const dependency = assertDependency(
		config,
		`Expo react-native-config ${platform}`,
		workspace,
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
				workspace,
			),
		}
	}

	return assertAndroidAutolinking(
		platformConfig,
		"Expo react-native-config Android",
		workspace,
	)
}

function assertDependency(config, label, workspace) {
	const dependency = config.dependencies?.[packageName]
	assert.ok(dependency, `${label} did not include ${packageName}.`)
	assert.equal(
		dependency.name,
		packageName,
		`${label} dependency name mismatch.`,
	)
	if (typeof dependency.root === "string") {
		assert.equal(
			realpathSync(dependency.root),
			realpathSync(workspace.rootDir),
			`${label} dependency root must resolve to the temporary package root.`,
		)
	}
	return dependency
}

function assertIosPodspec(ios, label, workspace) {
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
	assertPathInside(
		podspecPath,
		workspace.rootDir,
		`${label} iOS podspecPath`,
	)
	return podspecPath
}

function assertAndroidAutolinking(android, label, workspace) {
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
	assertPathInside(sourceDir, workspace.rootDir, `${label} Android sourceDir`)
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

function createSentinelFixtures() {
	const sentinelName = "__rnskia_native_generation_preservation_sentinel__"
	const fixtures = [
		{
			dir: path.join(checkoutExampleDir, "ios"),
			relativePath: "example/ios",
		},
		{
			dir: path.join(checkoutExampleDir, "android"),
			relativePath: "example/android",
		},
		{
			dir: path.join(checkoutExampleDir, ".expo"),
			relativePath: "example/.expo",
		},
	]

	const createdFixtures = []
	try {
		for (const fixture of fixtures) {
			const existedAtStart = existsSync(fixture.dir)
			const entriesAtStart = existedAtStart
				? listDirectoryEntries(fixture.dir, sentinelName)
				: []
			const sentinelDir = path.join(fixture.dir, sentinelName)
			assert.equal(
				existsSync(sentinelDir),
				false,
				`Refusing to reuse existing sentinel fixture at ${sentinelDir}.`,
			)

			mkdirSync(sentinelDir, { recursive: true })
			const sentinelFile = path.join(sentinelDir, "keep.txt")
			const contents = `${fixture.relativePath} sentinel ${Date.now()}\n`
			writeFileSync(sentinelFile, contents)

			createdFixtures.push({
				...fixture,
				contents,
				entriesAtStart,
				existedAtStart,
				sentinelDir,
				sentinelFile,
				sentinelName,
			})
		}
	} catch (error) {
		cleanupSentinelFixtures(createdFixtures)
		throw error
	}

	return createdFixtures
}

function assertSentinelFixturesPreserved(fixtures) {
	for (const fixture of fixtures) {
		assertFile(fixture.sentinelFile, `${fixture.relativePath} sentinel`)
		assert.equal(
			readFileSync(fixture.sentinelFile, "utf8"),
			fixture.contents,
			`${fixture.relativePath} sentinel content must be preserved.`,
		)
		assert.deepEqual(
			listDirectoryEntries(fixture.dir, fixture.sentinelName),
			fixture.entriesAtStart,
			`${fixture.relativePath} non-sentinel entries must not change.`,
		)
	}
}

function cleanupSentinelFixtures(fixtures) {
	for (const fixture of fixtures) {
		rmSync(fixture.sentinelDir, { recursive: true, force: true })
		if (!fixture.existedAtStart && existsSync(fixture.dir)) {
			const remainingEntries = readdirSync(fixture.dir)
			if (remainingEntries.length === 0) {
				rmSync(fixture.dir, { recursive: true, force: true })
			}
		}
	}
}

function listDirectoryEntries(dir, ignoredEntryName) {
	if (!existsSync(dir)) {
		return []
	}
	return readdirSync(dir)
		.filter((entry) => entry !== ignoredEntryName)
		.sort()
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

function cleanupActiveWorkspace() {
	if (activeWorkspace !== null) {
		cleanupWorkspace(activeWorkspace)
		activeWorkspace = null
	}
}

function cleanupWorkspace(workspace) {
	if (workspace?.rootDir === undefined) {
		return
	}
	assertPathInside(workspace.rootDir, tempParentDir, "temporary workspace")
	rmSync(workspace.rootDir, { recursive: true, force: true })
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

function assertNodeModulePath(modulePath, label) {
	assert.ok(
		modulePath.includes(`${path.sep}node_modules${path.sep}`),
		`${label} must resolve through node_modules: ${modulePath}`,
	)
}

function assertPathInside(targetPath, parentPath, label) {
	const parentRealPath = `${realpathSync(parentPath)}${path.sep}`
	const targetStat = lstatSync(targetPath)
	const targetRealPath = `${realpathSync(targetPath)}${targetStat.isDirectory() ? path.sep : ""}`
	assert.ok(
		targetRealPath === parentRealPath || targetRealPath.startsWith(parentRealPath),
		`${label} must be inside ${parentPath}: ${targetPath}`,
	)
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

function assertAllowedArgs() {
	const allowedArgs = new Set([preserveLocalProbeArg])
	for (const arg of process.argv.slice(2)) {
		assert.ok(
			allowedArgs.has(arg),
			`Unsupported argument ${arg}. Supported argument: ${preserveLocalProbeArg}`,
		)
	}
}

function normalizeRelativePath(relativePath) {
	return relativePath.split(path.sep).join("/")
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
