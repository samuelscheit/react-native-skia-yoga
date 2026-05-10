#!/usr/bin/env node

import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const exampleDir = path.join(rootDir, "example")
const timeoutMs = 180_000
const tempParentDir = existsSync("/tmp") ? "/tmp" : tmpdir()
const outputDir = mkdtempSync(path.join(tempParentDir, "rnskia-example-export."))

let activeChild = null
let outputCleaned = false

process.once("SIGINT", () => {
	terminateActiveChild("SIGTERM")
	cleanupOutputDir()
	process.exit(130)
})

process.once("SIGTERM", () => {
	terminateActiveChild("SIGTERM")
	cleanupOutputDir()
	process.exit(143)
})

try {
	assertOutsideRepository(outputDir)

	console.log(`Running Expo iOS export with a ${timeoutMs / 1000}s timeout.`)
	console.log(`Temporary output: ${outputDir}`)

	await runBounded(
		"bun",
		[
			"--bun",
			"./node_modules/.bin/expo",
			"export",
			"--platform",
			"ios",
			"--output-dir",
			outputDir,
			"--no-bytecode",
			"--no-minify",
		],
		{
			cwd: exampleDir,
			timeoutMs,
		},
	)
} finally {
	cleanupOutputDir()
}

console.log("Example bundle export verifier passed:")
console.log("- expo export completed for iOS.")
console.log("- Temporary export output was cleaned up.")

function runBounded(command, args, options) {
	return new Promise((resolve, reject) => {
		let timedOut = false
		let timeout = null
		let killTimeout = null
		const child = spawn(command, args, {
			cwd: options.cwd,
			detached: process.platform !== "win32",
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
				reject(new Error(`${command} ${args.join(" ")} timed out after ${options.timeoutMs / 1000}s.`))
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

function cleanupOutputDir() {
	if (outputCleaned) {
		return
	}

	outputCleaned = true
	rmSync(outputDir, { recursive: true, force: true })
}

function assertOutsideRepository(targetDir) {
	const rootRealPath = `${realpathSync(rootDir)}${path.sep}`
	const targetRealPath = `${realpathSync(targetDir)}${path.sep}`

	if (targetRealPath.startsWith(rootRealPath)) {
		throw new Error(`Export output must be outside the repository: ${targetDir}`)
	}
}
