import { NitroModules } from "react-native-nitro-modules"
import type { SkiaYoga as SkiaYogaType, YogaNode } from "./specs/SkiaYoga.nitro"

export const SkiaYoga = NitroModules.createHybridObject<SkiaYogaType>("SkiaYoga")

// @ts-ignore
globalThis.SkiaYoga = SkiaYoga

export interface YogaNodeFinal extends YogaNode {
	setProps(props: any): void
}

export * from "./Reconciler"

export function createYogaNode(): YogaNodeFinal {
	const node = NitroModules.createHybridObject<YogaNode>("YogaNode")

	return node as YogaNodeFinal
}
