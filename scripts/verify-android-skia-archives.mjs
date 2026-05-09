#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

const rootDir = path.resolve(import.meta.dirname, "..")
const expectedAndroidAbis = ["arm64-v8a", "x86_64", "x86", "armeabi-v7a"]
const expectedSkiaArchiveBasenames = [
	"libjsonreader.a",
	"libskia.a",
	"libskottie.a",
	"libskparagraph.a",
	"libsksg.a",
	"libskshaper.a",
	"libskunicode_core.a",
	"libskunicode_icu.a",
	"libsvg.a",
]
const expectedCMakeArchiveCandidateDirs = [
	"${NODE_MODULES_DIR}/react-native-skia-android/libs/${ANDROID_ABI}",
	"${RN_SKIA_DIR}/libs/android/${ANDROID_ABI}",
]

verifyCurrentOptionalArchiveLayout()
verifyCMakeArchiveDiscovery()

console.log("Android RN Skia archive verifier passed:")
console.log("- Current optional package archives are complete under node_modules/react-native-skia-android/libs for all expected Android ABIs.")
console.log("- android/CMakeLists.txt prefers the optional package archive layout, keeps the legacy fallback, validates expected archive basenames, and fails clearly when no complete layout exists.")

function verifyCurrentOptionalArchiveLayout() {
	const archiveRoot = projectPath("node_modules/react-native-skia-android/libs")
	const failures = []

	for (const abi of expectedAndroidAbis) {
		const archiveDir = path.join(archiveRoot, abi)
		const attempt = inspectArchiveDirectory(archiveDir)

		if (!attempt.exists) {
			failures.push(formatArchiveAttempt(abi, attempt, "optional package archive directory is missing"))
			continue
		}

		if (attempt.missingExpectedArchiveBasenames.length > 0) {
			failures.push(formatArchiveAttempt(abi, attempt, "optional package archive directory is incomplete"))
		}
	}

	if (failures.length > 0) {
		throw new Error([
			"Current RN Skia Android optional-package archive layout is invalid.",
			`Expected archive basenames per ABI: ${expectedSkiaArchiveBasenames.join(", ")}`,
			...failures,
		].join("\n"))
	}
}

function verifyCMakeArchiveDiscovery() {
	const cmakePath = projectPath("android/CMakeLists.txt")
	const cmakeSource = readFileSync(cmakePath, "utf8")
	const cmakeExpectedArchiveBasenames = extractCMakeSetList(
		cmakeSource,
		"RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES",
	)
	const cmakeArchiveCandidateDirs = extractCMakeSetList(
		cmakeSource,
		"RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIRS",
	)

	assertExactList(
		cmakeExpectedArchiveBasenames,
		expectedSkiaArchiveBasenames,
		"android/CMakeLists.txt RN_SKIA_EXPECTED_ANDROID_ARCHIVE_BASENAMES",
	)
	assertExactList(
		cmakeArchiveCandidateDirs,
		expectedCMakeArchiveCandidateDirs,
		"android/CMakeLists.txt RN_SKIA_ANDROID_ARCHIVE_CANDIDATE_DIRS",
	)

	assertContains(
		cmakeSource,
		"RN_SKIA_MISSING_ANDROID_ARCHIVES",
		"android/CMakeLists.txt must track missing archive basenames for each candidate directory.",
	)
	assertContains(
		cmakeSource,
		"message(FATAL_ERROR",
		"android/CMakeLists.txt must fail clearly when no complete RN Skia Android archive layout exists.",
	)
	assertContains(
		cmakeSource,
		"Expected archive basenames:",
		"android/CMakeLists.txt fatal error must include expected archive basenames.",
	)
	assertContains(
		cmakeSource,
		"Checked archive directories:",
		"android/CMakeLists.txt fatal error must include checked archive directories.",
	)
	assertContains(
		cmakeSource,
		"target_link_libraries(${PACKAGE_NAME} \"${RN_SKIA_ANDROID_ARCHIVE}\")",
		"android/CMakeLists.txt must link the validated RN Skia Android archives.",
	)
	assertNotContains(
		cmakeSource,
		"file(GLOB skiaLibraries \"${RN_SKIA_DIR}/libs/android/${ANDROID_ABI}/*.a\")",
		"android/CMakeLists.txt must not rely on the stale single legacy archive glob.",
	)
}

function inspectArchiveDirectory(archiveDir) {
	if (!existsSync(archiveDir) || !statSync(archiveDir).isDirectory()) {
		return {
			dir: archiveDir,
			exists: false,
			archiveBasenames: [],
			missingExpectedArchiveBasenames: expectedSkiaArchiveBasenames,
			extraArchiveBasenames: [],
		}
	}

	const archiveBasenames = readdirSync(archiveDir)
		.filter((entryName) => entryName.endsWith(".a") && statSync(path.join(archiveDir, entryName)).isFile())
		.sort()
	const missingExpectedArchiveBasenames = expectedSkiaArchiveBasenames.filter((archiveBasename) => !archiveBasenames.includes(archiveBasename))
	const extraArchiveBasenames = archiveBasenames.filter((archiveBasename) => !expectedSkiaArchiveBasenames.includes(archiveBasename))

	return {
		dir: archiveDir,
		exists: true,
		archiveBasenames,
		missingExpectedArchiveBasenames,
		extraArchiveBasenames,
	}
}

function formatArchiveAttempt(abi, attempt, reason) {
	return [
		`- ${abi}: ${reason}`,
		`  directory: ${path.relative(rootDir, attempt.dir)}`,
		`  archives found: ${attempt.archiveBasenames.length}`,
		`  matched basenames: ${attempt.archiveBasenames.length > 0 ? attempt.archiveBasenames.join(", ") : "none"}`,
		`  missing expected archives: ${attempt.missingExpectedArchiveBasenames.length > 0 ? attempt.missingExpectedArchiveBasenames.join(", ") : "none"}`,
		`  extra archives: ${attempt.extraArchiveBasenames.length > 0 ? attempt.extraArchiveBasenames.join(", ") : "none"}`,
	].join("\n")
}

function assertContains(source, expected, message) {
	if (!source.includes(expected)) {
		throw new Error(message)
	}
}

function assertNotContains(source, unexpected, message) {
	if (source.includes(unexpected)) {
		throw new Error(message)
	}
}

function assertExactList(actual, expected, listName) {
	if (actual.length === expected.length && actual.every((value, index) => value === expected[index])) {
		return
	}

	throw new Error([
		`${listName} must match the expected list exactly.`,
		`Expected: ${formatList(expected)}`,
		`Actual: ${formatList(actual)}`,
	].join("\n"))
}

function extractCMakeSetList(source, variableName) {
	for (const command of parseCMakeCommands(source)) {
		if (command.name.toLowerCase() !== "set") {
			continue
		}

		const args = parseCMakeArguments(command.body)
		if (args[0] === variableName) {
			return args.slice(1)
		}
	}

	throw new Error(`android/CMakeLists.txt must define ${variableName} with set(${variableName} ...).`)
}

function parseCMakeCommands(source) {
	const commentStrippedSource = stripCMakeLineComments(source)
	const commands = []
	const commandStartPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g
	let match

	while ((match = commandStartPattern.exec(commentStrippedSource)) !== null) {
		const bodyStart = commandStartPattern.lastIndex
		let depth = 1
		let inQuote = false
		let escaped = false

		for (let index = bodyStart; index < commentStrippedSource.length; index += 1) {
			const char = commentStrippedSource[index]

			if (inQuote) {
				if (escaped) {
					escaped = false
				} else if (char === "\\") {
					escaped = true
				} else if (char === "\"") {
					inQuote = false
				}
				continue
			}

			if (char === "\"") {
				inQuote = true
			} else if (char === "(") {
				depth += 1
			} else if (char === ")") {
				depth -= 1
				if (depth === 0) {
					commands.push({
						name: match[1],
						body: commentStrippedSource.slice(bodyStart, index),
					})
					commandStartPattern.lastIndex = index + 1
					break
				}
			}
		}
	}

	return commands
}

function parseCMakeArguments(body) {
	const args = []
	let token = ""
	let readingToken = false
	let inQuote = false
	let escaped = false

	for (let index = 0; index < body.length; index += 1) {
		const char = body[index]

		if (inQuote) {
			readingToken = true
			if (escaped) {
				token += char
				escaped = false
			} else if (char === "\\") {
				escaped = true
			} else if (char === "\"") {
				inQuote = false
			} else {
				token += char
			}
			continue
		}

		if (/\s/.test(char)) {
			if (readingToken) {
				args.push(token)
				token = ""
				readingToken = false
			}
		} else if (char === "\"") {
			inQuote = true
			readingToken = true
		} else {
			token += char
			readingToken = true
		}
	}

	if (inQuote) {
		throw new Error("Unable to parse android/CMakeLists.txt: unterminated quoted CMake argument.")
	}
	if (readingToken) {
		args.push(token)
	}

	return args
}

function stripCMakeLineComments(source) {
	let stripped = ""
	let inQuote = false
	let escaped = false

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index]

		if (inQuote) {
			stripped += char
			if (escaped) {
				escaped = false
			} else if (char === "\\") {
				escaped = true
			} else if (char === "\"") {
				inQuote = false
			}
			continue
		}

		if (char === "\"") {
			inQuote = true
			stripped += char
		} else if (char === "#") {
			while (index < source.length && source[index] !== "\n") {
				index += 1
			}
			if (index < source.length) {
				stripped += "\n"
			}
		} else {
			stripped += char
		}
	}

	return stripped
}

function formatList(values) {
	return values.length > 0 ? values.map((value) => `"${value}"`).join(", ") : "empty"
}

function projectPath(relativePath) {
	return path.join(rootDir, relativePath)
}
