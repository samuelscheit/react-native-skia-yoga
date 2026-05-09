#!/usr/bin/env node

import { accessSync, constants, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"

const rootDir = path.resolve(import.meta.dirname, "..")
const tmpDir = mkdtempSync(path.join(tmpdir(), "rnskia-package-lifecycle-"))

try {
	const verifierEnv = createBunHiddenEnv()

	assertBunUnavailable(verifierEnv)

	const dryRun = run("npm", ["pack", "--dry-run", "--json"], {
		cwd: rootDir,
		env: verifierEnv,
	})
	const dryRunManifest = JSON.parse(dryRun.stdout.trim())
	if (!Array.isArray(dryRunManifest) || dryRunManifest.length === 0) {
		throw new Error("npm pack --dry-run --json returned no manifest entries.")
	}

	const packedEntry = dryRunManifest[0]
	assertNoPackedScripts(packedEntry)

	const packedTarball = path.join(tmpDir, packedEntry.filename)
	run("npm", ["pack", "--pack-destination", tmpDir], {
		cwd: rootDir,
		env: verifierEnv,
	})

	const packedPackageJson = JSON.parse(
		run("tar", ["-xOf", packedTarball, "package/package.json"], {
			cwd: rootDir,
			env: verifierEnv,
		}).stdout,
	)
	assertNoLifecycleHooks(packedPackageJson)

	const consumerDir = mkdtempSync(path.join(tmpdir(), "rnskia-package-consumer-"))
	try {
		run("npm", ["init", "-y"], {
			cwd: consumerDir,
			env: verifierEnv,
		})
		run("npm", ["install", "--ignore-scripts=false", packedTarball], {
			cwd: consumerDir,
			env: verifierEnv,
		})
	} finally {
		rmSync(consumerDir, { recursive: true, force: true })
	}

	console.log("Package lifecycle verifier passed:")
	console.log("- Verifier PATH shim exposes node/npm/tar while keeping bun unavailable.")
	console.log("- npm pack --dry-run --json kept private scripts out of the tarball manifest.")
	console.log("- Packed package.json has no root preinstall, install, or postinstall hooks.")
	console.log("- Temporary consumer install succeeded with lifecycle scripts enabled and Bun hidden from PATH.")
} finally {
	rmSync(tmpDir, { recursive: true, force: true })
}

function assertNoPackedScripts(manifestEntry) {
	const packedScripts = (manifestEntry.files ?? [])
		.map((entry) => entry.path)
		.filter((filePath) => filePath.startsWith("scripts/"))

	if (packedScripts.length > 0) {
		throw new Error(`Private scripts should not be published: ${packedScripts.join(", ")}`)
	}
}

function assertNoLifecycleHooks(packageJson) {
	const scripts = packageJson.scripts ?? {}
	for (const hook of ["preinstall", "install", "postinstall"]) {
		if (Object.prototype.hasOwnProperty.call(scripts, hook)) {
			throw new Error(`Packed package.json still exposes lifecycle hook: ${hook}`)
		}
	}
}

function run(command, args, options) {
	const result = spawnSync(command, args, {
		...options,
		encoding: "utf8",
	})

	if (result.error) {
		throw new Error(`Failed to run ${command}: ${result.error.message}`)
	}

	if (result.status !== 0) {
		const stdout = result.stdout.trim()
		const stderr = result.stderr.trim()
		throw new Error([
			`${command} ${args.join(" ")} failed with exit code ${result.status}.`,
			stdout ? `stdout:\n${stdout}` : "",
			stderr ? `stderr:\n${stderr}` : "",
		].filter(Boolean).join("\n\n"))
	}

	return result
}

function createBunHiddenEnv() {
	const binDir = path.join(tmpDir, "bin")
	mkdirSync(binDir, { recursive: true })

	for (const command of ["node", "npm", "tar"]) {
		symlinkSync(resolveCommand(command), path.join(binDir, command))
	}

	return {
		...process.env,
		PATH: [binDir, ...pathSegmentsWithoutCommand("bun")].join(path.delimiter),
	}
}

function assertBunUnavailable(env) {
	const result = spawnSync("bun", ["--version"], {
		env,
		encoding: "utf8",
	})

	if (result.error?.code === "ENOENT") {
		return
	}

	const stdout = result.stdout?.trim()
	const stderr = result.stderr?.trim()
	throw new Error([
		"Expected bun to be unavailable in the package lifecycle verifier PATH.",
		result.error ? `error: ${result.error.message}` : "",
		typeof result.status === "number" ? `exit code: ${result.status}` : "",
		stdout ? `stdout:\n${stdout}` : "",
		stderr ? `stderr:\n${stderr}` : "",
	].filter(Boolean).join("\n\n"))
}

function resolveCommand(command) {
	if (command === "node") {
		return process.execPath
	}

	const result = spawnSync("which", [command], {
		encoding: "utf8",
	})

	if (result.error) {
		throw new Error(`Failed to resolve ${command}: ${result.error.message}`)
	}
	if (result.status !== 0) {
		throw new Error(`Failed to resolve ${command}: ${result.stderr.trim()}`)
	}

	const resolved = result.stdout.trim().split(/\r?\n/)[0]
	if (!path.isAbsolute(resolved)) {
		throw new Error(`Resolved ${command} to a non-absolute path: ${resolved}`)
	}
	return resolved
}

function pathSegmentsWithoutCommand(command) {
	return (process.env.PATH ?? "")
		.split(path.delimiter)
		.filter((segment) => segment.length > 0 && !hasExecutable(path.join(segment, command)))
}

function hasExecutable(filePath) {
	try {
		accessSync(filePath, constants.X_OK)
		return true
	} catch {
		return false
	}
}
