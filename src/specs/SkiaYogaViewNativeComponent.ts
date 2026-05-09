import { codegenNativeComponent } from "react-native"
import type { CodegenTypes, ViewProps } from "react-native"

// @ts-ignore - pointerEvents needs to be redeclared for codegen to emit native bindings
export interface SkiaYogaViewNativeProps extends ViewProps {
	colorSpace?: string
	debug?: boolean
	opaque?: boolean
	pointerEvents?: CodegenTypes.WithDefault<"auto" | "none" | "box-none" | "box-only", "auto">
}

export default codegenNativeComponent<SkiaYogaViewNativeProps>("SkiaYogaView")
