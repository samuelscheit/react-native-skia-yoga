import type {
	NodeCommand,
	YogaNode,
} from "./specs/SkiaYoga.nitro"
import type { YogaNodeInteractionConfig } from "./interactivity"

export interface YogaNodeFinal extends YogaNode {
	setCommand(command: NodeCommand): void
	draw(): any
	getChildren(): YogaNodeFinal[]
	hitTest(x: number, y: number): number
	setInteractionConfig(config: YogaNodeInteractionConfig): void
}
