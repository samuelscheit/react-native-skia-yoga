import type { HybridObject } from "react-native-nitro-modules"
import type { NodeCommandNative } from "./commands"
import type { NodeStyle } from "./style"
export { NodeCommandKind } from "./commands"

export type {
    BlurMaskFilterCommand,
    BlurMaskFilterCommandPayload,
    BlurStyleName,
    CircleCommand,
    CircleCommandPayload,
    GroupCommand,
    GroupCommandPayload,
    ImageCommand,
    ImageCommandPayload,
    ImageFit,
    LineCommand,
    LineCommandPayload,
    NodeCommand,
    NodeCommandNative,
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
    TextCommandPayload
} from "./commands"

export interface SkiaYoga extends HybridObject<{ ios: "c++"; android: "c++" }> {
	attachViewRoot(nativeId: number, root: YogaNode): void
	detachViewRoot(nativeId: number): void
	requestViewRender(nativeId: number): void
	setViewAnimating(nativeId: number, animating: boolean): void
	consumeViewProfileSample(nativeId: number): string
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
	setCommand(command: NodeCommandNative): void
	setStyle(style: NodeStyle): void
	insertChild(child: YogaNode, index?: number | YogaNode): void
	removeChild(child: YogaNode): void
	removeAllChildren(): void
	computeLayout(width?: number, height?: number): void
	layout: YogaNodeLayout
}
