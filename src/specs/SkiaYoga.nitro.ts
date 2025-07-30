import type { HybridObject } from "react-native-nitro-modules";
import type { NodeStyle } from "./style";

export interface SkiaYoga extends HybridObject<{ ios: 'c++', android: 'c++' }> {

	addNumbers(a: number, b: number): number;
}


export interface YogaNode extends HybridObject<{ ios: 'c++', android: 'c++' }> {

	setStyle(style: NodeStyle): void;
}

