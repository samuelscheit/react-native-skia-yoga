import { TurboModuleRegistry } from "react-native"
import { NitroModules } from "react-native-nitro-modules"
import type { Spec } from "./specs/NativeSkiaYoga"
import type { SkiaYoga as SkiaYogaType } from "./specs/SkiaYoga.nitro"

let turboModule: Spec | undefined
try {
	turboModule = TurboModuleRegistry.getEnforcing<Spec>("SkiaYoga")
} catch (e) {
	throw new Error(
		"SkiaYoga TurboModule is not available. Make sure you have linked the react-native-skia-yoga native module correctly. " +
			e,
	)
}

turboModule.install()

console.log("react-native-skia-yoga initialized")

export const SkiaYoga =
	NitroModules.createHybridObject<SkiaYogaType>("SkiaYoga")

// @ts-ignore
globalThis.SkiaYoga = SkiaYoga
