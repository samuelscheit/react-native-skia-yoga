#!/usr/bin/env node

import { spawn } from "node:child_process"
import {
	existsSync,
	lstatSync,
	mkdtempSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
} from "node:fs"
import path from "node:path"
import { performance } from "node:perf_hooks"
import {
	defaultVerifierTempParent,
	formatPathDiagnostic,
	verifierTempParentEnv,
} from "./verifier-temp-utils.mjs"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const defaultTimeoutMs = 600_000
const startedAtMs = Date.now()
const startedAt = new Date(startedAtMs)
const matrixTempParentDir = mkdtempSync(
	path.join(defaultVerifierTempParent(), "rnskia-feasible-matrix-"),
)
assertMatrixTempParent(matrixTempParentDir)

const tempParentDirs = [matrixTempParentDir]

const tempArtifactPrefixes = [
	"rnskia-example-export.",
	"rnskia-example-native-generation-",
	"rnskia-package-codegen-autolinking-",
	"rnskia-package-consumer-",
	"rnskia-package-lifecycle-",
	"rnskia-package-typescript-consumer-",
	"rnskia-rnsk-yoga-view-runtime-",
	"rnskia-yoganode-hit-testing-",
	"rnskia-yoganode-jsi-raw-methods-",
	"rnskia-yoganode-lifetime-",
	"rnskia-yoganode-runtime-",
]

const trackedWorkspaceArtifacts = [
	{
		kind: "generated native folder",
		relativePath: "example/ios",
	},
	{
		kind: "generated native folder",
		relativePath: "example/android",
	},
	{
		kind: "Expo metadata directory",
		relativePath: "example/.expo",
	},
	{
		kind: "TypeScript build info",
		relativePath: "tsconfig.tsbuildinfo",
	},
	{
		kind: "example TypeScript build info",
		relativePath: "example/tsconfig.tsbuildinfo",
	},
]

const matrixCommands = [
	npmScript("check:package-codegen-autolinking"),
	npmScript("check:package-typescript-consumer"),
	npmScript("check:package-surface", { timeoutMs: 300_000 }),
	npmScript("check:package-lifecycle"),
	npmScript("check:install-isolation", { timeoutMs: 120_000 }),
	npmScript("check:rn-codegen-schema", { timeoutMs: 180_000 }),
	{
		args: [
			"node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js",
			"src/specs/NativeSkiaYoga.ts",
			"src/specs/SkiaYogaViewNativeComponent.ts",
		],
		command: process.execPath,
		cwd: rootDir,
		label:
			"node node_modules/@react-native/codegen/lib/cli/parser/parser-cli.js src/specs/NativeSkiaYoga.ts src/specs/SkiaYogaViewNativeComponent.ts",
		timeoutMs: 180_000,
	},
	npmScript("check:skia-yoga-object-lazy-init"),
	npmScript("check:reconciler-animated-bindings", { timeoutMs: 180_000 }),
	npmScript("check:gesture-interaction-runtime", { timeoutMs: 180_000 }),
	npmScript("check:yogacanvas-lifecycle-runtime", { timeoutMs: 180_000 }),
	npmScript("check:rn-skia-imports", { timeoutMs: 120_000 }),
	npmScript("check:android-skia-archives", { timeoutMs: 120_000 }),
	npmScript("check:yoganode-native-lifetime", { timeoutMs: 180_000 }),
	npmScript("check:yoganode-native-runtime", { timeoutMs: 300_000 }),
	npmScript("check:yoganode-native-hit-testing", { timeoutMs: 300_000 }),
	npmScript("check:yoganode-jsi-raw-methods", { timeoutMs: 300_000 }),
	npmScript("check:rnsk-yoga-view-runtime", { timeoutMs: 300_000 }),
	npmScript("typecheck"),
	npmScript("lint-ci"),
	{
		args: ["run", "typecheck"],
		command: "bun",
		cwd: exampleDir,
		label: "cd example && bun run typecheck",
		note:
			"Implemented as a structured spawn with cwd=example, preserving the shell command's working-directory behavior without shell interpolation.",
		timeoutMs: 300_000,
	},
	{
		args: ["run", "specs"],
		command: "bun",
		cwd: rootDir,
		label: "bun run specs",
		timeoutMs: 300_000,
	},
	npmScript("check:example-bundle", { timeoutMs: 300_000 }),
	npmScript("check:example-native-generation", { timeoutMs: 420_000 }),
	{
		args: [
			"scripts/verify-example-native-generation.mjs",
			"--probe-preserve-local-artifacts",
		],
		command: process.execPath,
		cwd: rootDir,
		label:
			"node scripts/verify-example-native-generation.mjs --probe-preserve-local-artifacts",
		timeoutMs: 420_000,
	},
]

let activeChild = null
let activeCommandLabel = null

process.once("SIGINT", () => {
	terminateActiveChild("SIGTERM")
	const cleanupResult = cleanupNewArtifacts(initialCleanupSnapshot)
	printCleanupResult(cleanupResult)
	const matrixTempCleanupResult = cleanupMatrixTempParent()
	printMatrixTempCleanupResult(matrixTempCleanupResult)
	process.exit(130)
})

process.once("SIGTERM", () => {
	terminateActiveChild("SIGTERM")
	const cleanupResult = cleanupNewArtifacts(initialCleanupSnapshot)
	printCleanupResult(cleanupResult)
	const matrixTempCleanupResult = cleanupMatrixTempParent()
	printMatrixTempCleanupResult(matrixTempCleanupResult)
	process.exit(143)
})

const initialCleanupSnapshot = snapshotArtifacts()

let matrixError = null
let cleanupResult = null
let matrixTempCleanupResult = null

try {
	printHeader()
	await runMatrix()
} catch (error) {
	matrixError = error
} finally {
	cleanupResult = cleanupNewArtifacts(initialCleanupSnapshot)
	printCleanupResult(cleanupResult)
	matrixTempCleanupResult = cleanupMatrixTempParent()
	printMatrixTempCleanupResult(matrixTempCleanupResult)
}

if (
	matrixError !== null ||
	cleanupResult.errors.length > 0 ||
	matrixTempCleanupResult.errors.length > 0
) {
	if (matrixError !== null) {
		console.error("")
		console.error(`Feasible matrix failed: ${matrixError.message}`)
	}
	if (cleanupResult.errors.length > 0) {
		console.error("")
		console.error("Cleanup errors:")
		for (const error of cleanupResult.errors) {
			console.error(`- ${error}`)
		}
	}
	if (matrixTempCleanupResult.errors.length > 0) {
		console.error("")
		console.error("Matrix temp parent cleanup errors:")
		for (const error of matrixTempCleanupResult.errors) {
			console.error(`- ${error}`)
		}
	}
	process.exit(1)
}

console.log("")
console.log("Feasible local matrix verifier passed.")
console.log(
	"Proof boundary: feasible local package/source/example metadata checks only; this does not prove CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.",
)

function npmScript(scriptName, options = {}) {
	return {
		args: ["run", scriptName],
		command: "npm",
		cwd: rootDir,
		label: `npm run ${scriptName}`,
		timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
	}
}

function printHeader() {
	console.log("Feasible local matrix verifier")
	console.log(`Started: ${startedAt.toISOString()}`)
	console.log(`Root: ${rootDir}`)
	console.log("")
	console.log("Proof boundary:")
	console.log("- Runs only the accepted feasible local package/source/example metadata checks.")
	console.log("- Does not claim CocoaPods install, Gradle build, simulator/device launch, native app runtime, UI-runtime Worklets execution, or RNGH native delivery.")
	console.log("")
	console.log("Cleanup accounting:")
	console.log("- Pre-existing tracked artifacts are preserved.")
	console.log(
		"- Child verifiers receive a matrix-owned temp parent through an explicit environment variable.",
	)
	console.log(
		"- Newly created tracked artifacts are removed only from constrained known paths and the matrix-owned temp parent.",
	)
	console.log(`- ${verifierTempParentEnv}: ${matrixTempParentDir}`)
	console.log("- Shared system temp roots are not scanned or cleaned by this matrix run.")
	printPreExistingArtifacts(initialCleanupSnapshot)
	console.log("")
	console.log(`Commands: ${matrixCommands.length}`)
}

function printPreExistingArtifacts(snapshot) {
	if (snapshot.artifacts.size === 0) {
		console.log("- Pre-existing tracked artifacts: none")
		return
	}

	console.log("- Pre-existing tracked artifacts preserved:")
	for (const artifact of [...snapshot.artifacts.values()].sort(compareArtifacts)) {
		console.log(`  - ${artifact.description}`)
	}
}

async function runMatrix() {
	const commandResults = []
	const matrixStart = performance.now()

	for (const [index, commandConfig] of matrixCommands.entries()) {
		const commandNumber = index + 1
		const commandStart = performance.now()
		console.log("")
		console.log(`[${commandNumber}/${matrixCommands.length}] START ${commandConfig.label}`)
		console.log(`cwd: ${relativeCwd(commandConfig.cwd)}`)
		if (commandConfig.note) {
			console.log(`note: ${commandConfig.note}`)
		}

		try {
			await runCommand(commandConfig)
			const durationMs = performance.now() - commandStart
			commandResults.push({
				durationMs,
				label: commandConfig.label,
				status: "passed",
			})
			console.log(
				`[${commandNumber}/${matrixCommands.length}] PASS ${commandConfig.label} (${formatDuration(durationMs)})`,
			)
		} catch (error) {
			const durationMs = performance.now() - commandStart
			commandResults.push({
				durationMs,
				label: commandConfig.label,
				status: "failed",
			})
			console.error(
				`[${commandNumber}/${matrixCommands.length}] FAIL ${commandConfig.label} (${formatDuration(durationMs)})`,
			)
			console.error(`cwd: ${commandConfig.cwd}`)
			console.error(`command: ${formatSpawn(commandConfig)}`)
			throw error
		}
	}

	const totalDurationMs = performance.now() - matrixStart
	console.log("")
	console.log("Command summary:")
	for (const result of commandResults) {
		console.log(
			`- ${result.status.toUpperCase()} ${result.label} (${formatDuration(result.durationMs)})`,
		)
	}
	console.log(`Total command duration: ${formatDuration(totalDurationMs)}`)
}

function runCommand(commandConfig) {
	return new Promise((resolve, reject) => {
		let timedOut = false
		let timeout = null
		let killTimeout = null

		const child = spawn(commandConfig.command, commandConfig.args, {
			cwd: commandConfig.cwd,
			detached: process.platform !== "win32",
			env: {
				...process.env,
				[verifierTempParentEnv]: matrixTempParentDir,
			},
			shell: false,
			stdio: "inherit",
		})

		activeChild = child
		activeCommandLabel = commandConfig.label

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
		}, commandConfig.timeoutMs ?? defaultTimeoutMs)
		timeout.unref()

		child.once("error", (error) => {
			clearTimers()
			activeChild = null
			activeCommandLabel = null
			reject(new Error(`Failed to start ${formatSpawn(commandConfig)}: ${error.message}`))
		})

		child.once("close", (code, signal) => {
			clearTimers()
			activeChild = null
			activeCommandLabel = null

			if (timedOut) {
				reject(
					new Error(
						`${commandConfig.label} timed out after ${formatDuration(commandConfig.timeoutMs ?? defaultTimeoutMs)}.`,
					),
				)
				return
			}

			if (code !== 0) {
				const detail = signal === null ? `exit code ${code}` : `signal ${signal}`
				reject(new Error(`${commandConfig.label} failed with ${detail}.`))
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

	if (activeCommandLabel !== null) {
		console.error(`Terminating active command: ${activeCommandLabel}`)
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

function snapshotArtifacts() {
	const artifacts = new Map()

	for (const artifact of scanTempArtifacts()) {
		artifacts.set(artifact.key, artifact)
	}
	for (const artifact of scanWorkspaceArtifacts()) {
		artifacts.set(artifact.key, artifact)
	}

	return {
		artifacts,
		startedAtMs,
	}
}

function scanTempArtifacts() {
	const artifacts = []

	for (const parentDir of tempParentDirs) {
		if (!existsSync(parentDir)) {
			continue
		}
		for (const entry of readdirSync(parentDir)) {
			if (!tempArtifactPrefixes.some((prefix) => entry.startsWith(prefix))) {
				continue
			}

			const artifactPath = path.join(parentDir, entry)
			let stats
			try {
				stats = lstatSync(artifactPath)
			} catch {
				continue
			}
			artifacts.push({
				description: `${artifactPath} (${stats.isDirectory() ? "directory" : "file"})`,
				key: normalizeArtifactPath(artifactPath),
				kind: "temp artifact",
				path: artifactPath,
				stats,
				type: stats.isDirectory() ? "directory" : "file",
			})
		}
	}

	return artifacts
}

function cleanupMatrixTempParent() {
	const errors = []
	let removed = false
	let beforeRemoval = null

	try {
		beforeRemoval = formatPathDiagnostic(
			"matrix temp parent before removal",
			matrixTempParentDir,
		)
		rmSync(matrixTempParentDir, { force: true, recursive: true })
		removed = true
	} catch (error) {
		errors.push(`${matrixTempParentDir}: ${error.message}`)
	}

	return {
		beforeRemoval,
		errors,
		removed,
	}
}

function scanWorkspaceArtifacts() {
	const artifacts = []

	for (const trackedArtifact of trackedWorkspaceArtifacts) {
		const artifactPath = path.join(rootDir, trackedArtifact.relativePath)
		if (!existsSync(artifactPath)) {
			continue
		}
		const stats = lstatSync(artifactPath)
		artifacts.push({
			description: `${trackedArtifact.relativePath} (${trackedArtifact.kind})`,
			key: normalizeArtifactPath(artifactPath),
			kind: trackedArtifact.kind,
			path: artifactPath,
			stats,
			type: stats.isDirectory() ? "directory" : "file",
		})
	}

	for (const entry of readdirSync(rootDir)) {
		if (!entry.endsWith(".tgz")) {
			continue
		}
		const artifactPath = path.join(rootDir, entry)
		const stats = lstatSync(artifactPath)
		artifacts.push({
			description: `${entry} (repo-root tarball)`,
			key: normalizeArtifactPath(artifactPath),
			kind: "repo-root tarball",
			path: artifactPath,
			stats,
			type: "file",
		})
	}

	return artifacts
}

function cleanupNewArtifacts(snapshot) {
	const after = snapshotArtifacts()
	const removed = []
	const preserved = []
	const errors = []

	for (const artifact of [...after.artifacts.values()].sort(compareArtifacts)) {
		if (snapshot.artifacts.has(artifact.key)) {
			preserved.push(artifact)
			continue
		}

		if (!isSafeNewArtifact(artifact, snapshot.startedAtMs)) {
			preserved.push(artifact)
			continue
		}

		try {
			rmSync(artifact.path, { force: true, recursive: true })
			removed.push(artifact)
		} catch (error) {
			errors.push(`${artifact.description}: ${error.message}`)
		}
	}

	const remaining = snapshotArtifacts()
	const remainingNew = [...remaining.artifacts.values()]
		.filter((artifact) => !snapshot.artifacts.has(artifact.key))
		.sort(compareArtifacts)

	return {
		errors,
		preserved,
		remainingNew,
		removed,
	}
}

function isSafeNewArtifact(artifact, snapshotStartedAtMs) {
	if (artifact.stats.mtimeMs + 2_000 < snapshotStartedAtMs) {
		return false
	}

	if (isSafeWorkspaceArtifact(artifact.path)) {
		return true
	}

	if (isSafeTempArtifact(artifact.path)) {
		return true
	}

	return false
}

function isSafeWorkspaceArtifact(artifactPath) {
	const normalized = normalizeArtifactPath(artifactPath)
	for (const trackedArtifact of trackedWorkspaceArtifacts) {
		if (
			normalized ===
			normalizeArtifactPath(path.join(rootDir, trackedArtifact.relativePath))
		) {
			return true
		}
	}

	return (
		path.dirname(normalized) === normalizeArtifactPath(rootDir) &&
		path.basename(normalized).endsWith(".tgz")
	)
}

function isSafeTempArtifact(artifactPath) {
	const normalized = normalizeArtifactPath(artifactPath)
	const basename = path.basename(normalized)
	if (!tempArtifactPrefixes.some((prefix) => basename.startsWith(prefix))) {
		return false
	}

	return tempParentDirs.some((parentDir) => {
		const normalizedParent = normalizeArtifactPath(parentDir)
		return path.dirname(normalized) === normalizedParent
	})
}

function printCleanupResult(result) {
	console.log("")
	console.log("Cleanup accounting result:")

	if (result.removed.length === 0) {
		console.log("- Removed newly created tracked artifacts: none")
	} else {
		console.log("- Removed newly created tracked artifacts:")
		for (const artifact of result.removed) {
			console.log(`  - ${artifact.description}`)
		}
	}

	const preservedNew = result.preserved.filter(
		(artifact) => !initialCleanupSnapshot.artifacts.has(artifact.key),
	)
	if (preservedNew.length > 0) {
		console.log("- Preserved new ambiguous artifacts:")
		for (const artifact of preservedNew) {
			console.log(`  - ${artifact.description}`)
		}
	}

	if (result.remainingNew.length === 0) {
		console.log("- Remaining new tracked artifacts after cleanup: none")
	} else {
		console.log("- Remaining new tracked artifacts after cleanup:")
		for (const artifact of result.remainingNew) {
			console.log(`  - ${artifact.description}`)
		}
	}
}

function printMatrixTempCleanupResult(result) {
	console.log("- Matrix temp parent cleanup:")
	if (result.beforeRemoval !== null) {
		console.log(`  - ${result.beforeRemoval}`)
	}
	if (result.removed) {
		console.log(`  - Removed ${matrixTempParentDir}`)
	}
	if (result.errors.length > 0) {
		for (const error of result.errors) {
			console.log(`  - Cleanup error: ${error}`)
		}
	}
}

function formatSpawn(commandConfig) {
	return [commandConfig.command, ...commandConfig.args].join(" ")
}

function formatDuration(durationMs) {
	if (durationMs < 1_000) {
		return `${Math.round(durationMs)}ms`
	}
	const seconds = durationMs / 1_000
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`
	}
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = Math.round(seconds % 60)
	return `${minutes}m ${remainingSeconds}s`
}

function relativeCwd(cwd) {
	const relative = path.relative(rootDir, cwd)
	return relative === "" ? "." : relative
}

function compareArtifacts(a, b) {
	return a.description.localeCompare(b.description)
}

function normalizeArtifactPath(artifactPath) {
	return path.resolve(artifactPath)
}

function assertMatrixTempParent(tempParentDir) {
	const stats = statSync(tempParentDir)
	if (!stats.isDirectory()) {
		throw new Error(`Matrix temp parent is not a directory: ${tempParentDir}`)
	}

	const realTempParentDir = realpathSync(tempParentDir)
	const realRootDir = realpathSync(rootDir)
	const relativePath = path.relative(realRootDir, realTempParentDir)
	if (
		relativePath === "" ||
		(Boolean(relativePath) &&
			!relativePath.startsWith("..") &&
			!path.isAbsolute(relativePath))
	) {
		throw new Error(
			`Matrix temp parent must not be inside the repository: ${realTempParentDir}`,
		)
	}
}
