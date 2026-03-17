import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent"
import type { ViewProps } from "react-native"
import type { WithDefault } from "react-native/Libraries/Types/CodegenTypes"

// @ts-ignore - pointerEvents needs to be redeclared for codegen to emit native bindings
export interface SkiaYogaViewNativeProps extends ViewProps {
	colorSpace?: string
	debug?: boolean
	opaque?: boolean
	pointerEvents?: WithDefault<"auto" | "none" | "box-none" | "box-only", "auto">
}

export default codegenNativeComponent<SkiaYogaViewNativeProps>("SkiaYogaView")
