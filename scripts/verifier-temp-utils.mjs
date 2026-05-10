import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	realpathSync,
} from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

export const verifierTempParentEnv = "RNSKIA_YOGA_VERIFY_TEMP_PARENT"

export function defaultVerifierTempParent() {
	return existsSync("/tmp") ? "/tmp" : tmpdir()
}

export function getVerifierTempParent() {
	const configuredParent = process.env[verifierTempParentEnv]
	if (configuredParent == null || configuredParent.trim() === "") {
		return defaultVerifierTempParent()
	}

	if (!path.isAbsolute(configuredParent)) {
		throw new Error(
			`${verifierTempParentEnv} must be an absolute path: ${configuredParent}`,
		)
	}

	mkdirSync(configuredParent, { recursive: true })
	const stats = lstatSync(configuredParent)
	if (!stats.isDirectory()) {
		throw new Error(
			`${verifierTempParentEnv} must point at a directory: ${configuredParent}`,
		)
	}

	return realpathSync(configuredParent)
}

export function createVerifierTempDir(prefix) {
	return mkdtempSync(path.join(getVerifierTempParent(), prefix))
}

export function formatVerifierTempDiagnostics(paths = []) {
	const diagnostics = [
		`${verifierTempParentEnv}: ${process.env[verifierTempParentEnv] ?? "(not set; using standalone default)"}`,
	]

	try {
		diagnostics.push(`resolved temp parent: ${getVerifierTempParent()}`)
	} catch (error) {
		diagnostics.push(`resolved temp parent: ${error.message}`)
	}

	for (const { label, targetPath } of paths) {
		diagnostics.push(formatPathDiagnostic(label, targetPath))
	}

	return diagnostics.join("\n")
}

export function formatPathDiagnostic(label, targetPath) {
	if (typeof targetPath !== "string" || targetPath.length === 0) {
		return `${label}: (missing path value)`
	}

	if (!existsSync(targetPath)) {
		return `${label}: ${targetPath} (missing)`
	}

	const stats = lstatSync(targetPath)
	const type = stats.isDirectory()
		? "directory"
		: stats.isFile()
			? "file"
			: stats.isSymbolicLink()
				? "symlink"
				: "other"
	const details = [`${label}: ${targetPath} (${type})`]
	if (stats.isDirectory()) {
		const entries = readdirSync(targetPath).sort()
		details.push(
			`entries: ${entries.length === 0 ? "(empty)" : entries.slice(0, 20).join(", ")}`,
		)
	}
	return details.join("; ")
}
