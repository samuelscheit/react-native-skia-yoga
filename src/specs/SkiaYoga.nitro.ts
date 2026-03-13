import type { HybridObject } from "react-native-nitro-modules";
import type { NodeCommand } from "./commands";
import type { NodeStyle } from "./style";

export type {
	BlurMaskFilterCommand,
	BlurMaskFilterCommandPayload,
	BlurStyleName,
	CircleCommand,
	CircleCommandPayload,
	GroupCommand,
	ImageCommand,
	ImageCommandPayload,
	ImageFit,
	LineCommand,
	LineCommandPayload,
	NodeCommand,
	NodeType,
	ParagraphCommand,
	ParagraphCommandPayload,
	PathCommand,
	PathCommandPayload,
	PathFillType,
	PointModeName,
	PointsCommand,
	PointsCommandPayload,
	RectCommand,
	RoundedRectCommand,
	RoundedRectCommandPayload,
	TextCommand,
	TextCommandPayload,
} from "./commands";

export interface SkiaYoga extends HybridObject<{ ios: "c++"; android: "c++" }> {
}

export interface YogaNodeLayout {
	left: number
	right: number
	top: number
	bottom: number
	width: number
	height: number
}


export interface YogaNode extends HybridObject<{ ios: "c++"; android: "c++" }> {
	setCommand(command: NodeCommand): void
	setStyle(style: NodeStyle): void
	insertChild(child: YogaNode, index?: number | YogaNode): void
	removeChild(child: YogaNode): void
	removeAllChildren(): void
	computeLayout(width?: number, height?: number): void
	layout: YogaNodeLayout
}
