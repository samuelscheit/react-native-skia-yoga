import { TurboModuleRegistry } from "react-native"
import { NitroModules } from "react-native-nitro-modules"
import type { Spec } from "./specs/NativeSkiaYoga"
import type { SkiaYoga as SkiaYogaType, YogaNode } from "./specs/SkiaYoga.nitro"

let turboModule: Spec | undefined
try {
  turboModule = TurboModuleRegistry.getEnforcing<Spec>('SkiaYoga')
} catch (e) {
  throw new Error("SkiaYogaModule TurboModule is not available. Make sure you have linked the react-native-skia-yoga native module correctly. "+e)
}

turboModule.install()

console.log("react-native-skia-yoga initialized")

// NativeModules.SkiaYogaModule?.install?.()

export const SkiaYoga = NitroModules.createHybridObject<SkiaYogaType>("SkiaYoga")

// @ts-ignore
globalThis.SkiaYoga = SkiaYoga

export interface YogaNodeFinal extends YogaNode {
	setProps(props: any): void
	draw(): any
	getChildren(): YogaNodeFinal[]
}

export * from "./Reconciler"
export * from "./util"
export * from "./YogaCanvas"

