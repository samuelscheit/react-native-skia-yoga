import type {
	BlendMode,
	SkMatrix,
	SkPaint,
	SkPath,
	SkPoint,
	SkRect,
	SkRRect,
	StrokeCap,
	StrokeJoin
} from "@shopify/react-native-skia"
import type { CustomType } from "react-native-nitro-modules"

export type Align =
	| "auto"
	| "flex-start"
	| "center"
	| "flex-end"
	| "stretch"
	| "bseline"
	| "space-between"
	| "space-around"
	| "space-evenly"

export type JustifyContent =
	| "flex-start"
	| "center"
	| "flex-end"
	| "space-between"
	| "space-around"
	| "space-evenly"

export type BoxSizing = "border-box" | "content-box"

export type Direction = "inherit" | "ltr" | "rtl"

export type Display = "flex" | "none" | "contents"

export type FlexDirection = "column" | "column-reverse" | "row" | "row-reverse"

export type FlexWrap = "wrap" | "nowrap" | "wrap-reverse"

export type Overflow = "visible" | "hidden" | "scroll"

export type Position = "static" | "relative" | "absolute"

export type Percentage = string // `${number}%`; // string templates not supported by nitro

export type SkColorNative = CustomType<
	SkPaint,
	"SkPaint",
	{
		include: "JSIConverter+SkPaint.hpp"
		canBePassedByReference: true
	}
>

export type SkMatrixNative = CustomType<
	SkMatrix,
	"shared_ptr<SkMatrix>",
	{
		include: "JSIConverter+SkMatrix.hpp"
		canBePassedByReference: true
	}
>

export type SkRRectNative = CustomType<
	SkRRect,
	"SkRRect",
	{
		include: "JSIConverter+SkRRect.hpp"
		canBePassedByReference: true
	}
>

export type SkRectNative = CustomType<
	SkRect,
	"SkRect",
	{
		include: "JSIConverter+SkRect.hpp"
		canBePassedByReference: true
	}
>

export type SkPathNative = CustomType<
	SkPath,
	"SkPath",
	{
		include: "JSIConverter+SkPath.hpp"
		canBePassedByReference: true
	}
>

export type SkPaintNative = CustomType<
	SkPaint,
	"shared_ptr<SkPaint>",
	{
		include: "JSIConverter+SkPaint.hpp"
		canBePassedByReference: true
	}
>

export type TransformRotateX = { rotateX: number }
export type TransformRotateY = { rotateY: number }
export type TransformRotateZ = { rotateZ: number }
export type TransformScale = { scale: number }
export type TransformScaleX = { scaleX: number }
export type TransformScaleY = { scaleY: number }
export type TransformTranslateX = { translateX: number }
export type TransformTranslateY = { translateY: number }
export type TransformSkewX = { skewX: number }
export type TransformSkewY = { skewY: number }

export type Transform = (
  | TransformRotateX
  | TransformRotateY
  | TransformRotateZ
  | TransformScale
  | TransformScaleX
  | TransformScaleY
  | TransformTranslateX
  | TransformTranslateY
  | TransformSkewX
  | TransformSkewY
)[]

export type NodeStyle = {
	/* Flexbox and layout properties */
	alignContent?: Align
	alignItems?: Align
	alignSelf?: Align
	aspectRatio?: number
	borderBottomWidth?: number
	borderEndWidth?: number
	borderLeftWidth?: number
	borderRightWidth?: number
	borderStartWidth?: number
	borderTopWidth?: number
	borderWidth?: number
	borderHorizontalWidth?: number
	borderVerticalWidth?: number
	bottom?: number | Percentage
	boxSizing?: BoxSizing
	direction?: Direction
	display?: Display
	end?: number | Percentage
	flex?: number
	flexBasis?: number | "auto" | Percentage
	flexDirection?: FlexDirection
	rowGap?: number
	gap?: number
	columnGap?: number
	flexGrow?: number
	flexShrink?: number
	flexWrap?: FlexWrap
	height?: number | "auto" | Percentage
	justifyContent?: JustifyContent
	left?: number | Percentage
	margin?: number | "auto" | Percentage
	marginBottom?: number | "auto" | Percentage
	marginEnd?: number | "auto" | Percentage
	marginLeft?: number | "auto" | Percentage
	marginRight?: number | "auto" | Percentage
	marginStart?: number | "auto" | Percentage
	marginTop?: number | "auto" | Percentage
	marginHorizontal?: number | "auto" | Percentage // horizontal
	marginVertical?: number | "auto" | Percentage // vertical
	maxHeight?: number | Percentage
	maxWidth?: number | Percentage
	minHeight?: number | Percentage
	minWidth?: number | Percentage
	overflow?: Overflow
	padding?: number | Percentage
	paddingBottom?: number | Percentage
	paddingEnd?: number | Percentage
	paddingLeft?: number | Percentage
	paddingRight?: number | Percentage
	paddingStart?: number | Percentage
	paddingTop?: number | Percentage
	paddingHorizontal?: number | Percentage // horizontal
	paddingVertical?: number | Percentage // vertical
	position?: Position
	right?: number | Percentage
	start?: number | Percentage
	top?: number | Percentage
	insetHorizontal?: number | Percentage // horizontal
	insetVertical?: number | Percentage // vertical
	inset?: number | Percentage
	width?: number | "auto" | Percentage
	/* End of flexbox and layout properties */

	/* Skia Paint properties */
	backgroundColor?: string | SkColorNative // mapped to SkPaint color
	/** alias for clip */
	borderRadius?: number
	borderBottomLeftRadius?: number | SkPoint
	borderBottomRightRadius?: number | SkPoint
	borderTopLeftRadius?: number | SkPoint
	borderTopRightRadius?: number | SkPoint
	strokeCap?: StrokeCap
	strokeJoin?: StrokeJoin
	strokeMiter?: number

	/** Unfortunately Skia does not support both fill and stroke color for objects (TODO: add a hack to redraw everything twice if it has both border and fill color) */
	// borderColor?: string | SkColorNative // mapped to SkPaint
	// borderStyle?: "solid" | "dashed" | "dotted"
	blendMode?: BlendMode
	antiaAlias?: boolean // mapped to SkPaint antialias
	dither?: boolean // mapped to SkPaint dithering
	opacity?: number // mapped to SkPaint alpha
	/* End of Skia specific properties */

	/* Skia transform properties */
	transform?: Transform
	origin?: [number, number]
	matrix?: SkMatrixNative
	clip?: SkPathNative | SkRRectNative | SkRectNative
	invertClip?: boolean
	layer?: SkColorNative
}
