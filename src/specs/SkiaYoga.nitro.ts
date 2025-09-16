import type { HybridObject } from "react-native-nitro-modules";
import type { NodeStyle } from "./style";

export interface SkiaYoga extends HybridObject<{ ios: "c++"; android: "c++" }> {
	addNumbers(a: number, b: number): number
}

export type NodeType = "rect" | "text" | "group" | "image" | "path" | "paragraph";

export interface YogaNodeLayout {
	left: number
	right: number
	top: number
	bottom: number
	width: number
	height: number
}


export interface YogaNode extends HybridObject<{ ios: "c++"; android: "c++" }> {
	setStyle(style: NodeStyle): void
	setType(type: NodeType): void
	insertChild(child: YogaNode, index?: number | YogaNode): void
	removeChild(child: YogaNode): void
	removeAllChildren(): void
	computeLayout(width?: number, height?: number): void
	layout: YogaNodeLayout

	children: YogaNode[]

}
