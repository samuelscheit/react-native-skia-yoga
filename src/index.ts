import type {
	NodeCommand,
	YogaNode,
} from "./specs/SkiaYoga.nitro"
import type { YogaNodeInteractionConfig } from "./interactivity"
export { SkiaYoga } from "./SkiaYogaObject"

export interface YogaNodeFinal extends YogaNode {
	setCommand(command: NodeCommand): void
	draw(): any
	getChildren(): YogaNodeFinal[]
	hitTest(x: number, y: number): number
	setInteractionConfig(config: YogaNodeInteractionConfig): void
}

export * from "./interactivity"
export * from "./Reconciler"
export * from "./jsx"
export * from "./util"
export * from "./YogaCanvas"
