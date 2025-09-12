import type { CustomType, HybridObject } from "react-native-nitro-modules";
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

type YogaNodeImplementation = CustomType<
  YogaNode,
  'const std::shared_ptr<margelo::nitro::RNSkiaYoga::YogaNode>& ',
  { include: 'YogaNode.hpp' }
>

export interface YogaNode extends HybridObject<{ ios: "c++"; android: "c++" }> {
	setStyle(style: NodeStyle): void
	setType(type: NodeType): void
	insertChild(child: YogaNodeImplementation, index?: number | YogaNodeImplementation): void
	removeChild(child: YogaNodeImplementation): void
	removeAllChildren(): void
	getComputedLayout(): YogaNodeLayout

	children: YogaNode[]
}
