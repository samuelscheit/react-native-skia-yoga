import { TurboModuleRegistry } from "react-native"
import { NitroModules } from "react-native-nitro-modules"
import type { Spec } from "./specs/NativeSkiaYoga"
import type { SkiaYoga as SkiaYogaType } from "./specs/SkiaYoga.nitro"

let nativeBindingsInstalled = false
let skiaYoga: SkiaYogaType | undefined

export function getSkiaYoga(): SkiaYogaType {
	if (skiaYoga) {
		return skiaYoga
	}

	ensureNativeBindingsInstalled()

	try {
		skiaYoga = NitroModules.createHybridObject<SkiaYogaType>("SkiaYoga")
		return skiaYoga
	} catch (error) {
		throw new Error(
			"SkiaYoga hybrid object could not be created. Make sure react-native-skia-yoga native bindings are installed before using YogaCanvas. " +
				formatError(error),
		)
	}
}

function ensureNativeBindingsInstalled() {
	if (nativeBindingsInstalled) {
		return
	}

	const turboModule = getTurboModule()

	try {
		turboModule.install()
		nativeBindingsInstalled = true
	} catch (error) {
		throw new Error(
			"SkiaYoga native bindings could not be installed. Make sure you have linked the react-native-skia-yoga native module correctly before using YogaCanvas. " +
				formatError(error),
		)
	}
}

function getTurboModule(): Spec {
	try {
		return TurboModuleRegistry.getEnforcing<Spec>("SkiaYoga")
	} catch (error) {
		throw new Error(
			"SkiaYoga TurboModule is not available. Make sure you have linked the react-native-skia-yoga native module correctly before using YogaCanvas. " +
				formatError(error),
		)
	}
}

function formatError(error: unknown) {
	if (error instanceof Error) {
		return error.message
	}

	return String(error)
}
