import { NativeModules } from "react-native"
import { NitroModules } from "react-native-nitro-modules"
import type { SkiaYoga as SkiaYogaType, YogaNode } from "./specs/SkiaYoga.nitro"

console.log("SkiaYogaModule", NativeModules.SkiaYogaModule)
console.log("NativeModules", NativeModules)

if (!NativeModules.SkiaYogaModule) {
	console.error("SkiaYogaModule is not available. Make sure you have linked the SkiaYoga native module correctly.")
}

NativeModules.SkiaYogaModule?.install?.()

export const SkiaYoga = NitroModules.createHybridObject<SkiaYogaType>("SkiaYoga")

// @ts-ignore
globalThis.SkiaYoga = SkiaYoga

export interface YogaNodeFinal extends YogaNode {
	setProps(props: any): void
	draw(): any
}

export * from "./Reconciler"

export function createYogaNode(): YogaNodeFinal {
	const node = NitroModules.createHybridObject<YogaNode>("YogaNode")

	return node as YogaNodeFinal
}
