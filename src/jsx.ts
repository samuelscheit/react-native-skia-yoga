import type {
	BlurStyle,
	FillType,
	Fit,
	PointMode,
	SamplingOptions,
	SkFont,
	SkImage,
	SkMatrix,
	SkParagraph,
	SkParagraphStyle,
	SkPaint,
	SkPath,
	SkPoint,
	SkRect,
	SkRRect,
	SkTextStyle,
	StrokeOpts,
} from "@shopify/react-native-skia"
import type { ReactNode } from "react"
import type { SharedValue } from "react-native-reanimated"
import type {
	BlurStyleName,
	PathFillType,
	PointModeName,
} from "./specs/SkiaYoga.nitro"
import type { NodeStyle } from "./specs/style"

export type YogaElementChildren = ReactNode
export type YogaNodeStyle = NodeStyle
type YogaTextColor = string | NonNullable<SkTextStyle["color"]>

export type YogaBlurStyle = BlurStyle | BlurStyleName
export type YogaPathFillType = FillType | PathFillType
export type YogaPointMode = PointMode | PointModeName

export type YogaTextStyle = Omit<
	SkTextStyle,
	"backgroundColor" | "color" | "decorationColor" | "foregroundColor"
> & {
	backgroundColor?: string | NonNullable<SkTextStyle["backgroundColor"]>
	color?: YogaTextColor
	decorationColor?: YogaTextColor
	foregroundColor?: YogaTextColor
}

export type YogaParagraphStyle = YogaTextStyle & SkParagraphStyle
export type YogaAnimatedProp<T> = T | SharedValue<T>
type YogaOpaqueValue =
	| SkFont
	| SkImage
	| SkMatrix
	| SkPaint
	| SkParagraph
	| SkPath
	| SkRect
	| SkRRect
	| SamplingOptions

export type YogaDeepAnimated<T> =
	T extends string | number | boolean | null | undefined
		? T | SharedValue<T>
		: T extends YogaOpaqueValue
			? T | SharedValue<T>
			: T extends readonly (infer U)[]
				? YogaDeepAnimated<U>[] | SharedValue<T>
				: T extends object
					? { [K in keyof T]: YogaDeepAnimated<T[K]> } | SharedValue<T>
					: T | SharedValue<T>

export type YogaAnimatedPoint = {
	x: YogaAnimatedProp<number>
	y: YogaAnimatedProp<number>
}

export type YogaAnimatedStrokeOpts = {
	[K in keyof StrokeOpts]: YogaDeepAnimated<StrokeOpts[K]>
}

export type YogaAnimatedTextStyleProps = {
	[K in keyof YogaTextStyle]: YogaDeepAnimated<YogaTextStyle[K]>
}

export type YogaAnimatedParagraphStyleProps = {
	[K in keyof YogaParagraphStyle]: YogaDeepAnimated<YogaParagraphStyle[K]>
}

export interface YogaStyleProps {
	style?: YogaDeepAnimated<YogaNodeStyle>
}

export interface YogaContainerProps extends YogaStyleProps {
	children?: YogaElementChildren
}

export interface YogaGroupProps extends YogaContainerProps {}

export interface YogaRectProps extends YogaContainerProps {}

export interface YogaRoundedRectProps extends YogaContainerProps {
	cornerRadius?: YogaDeepAnimated<number>
}

export interface YogaCircleProps extends YogaContainerProps {
	radius?: YogaDeepAnimated<number>
}

export interface YogaOvalProps extends YogaContainerProps {}

export interface YogaTextProps extends YogaStyleProps {
	font?: YogaDeepAnimated<SkFont>
	text?: YogaDeepAnimated<string>
	textStyle?: YogaAnimatedTextStyleProps | YogaAnimatedProp<YogaTextStyle>
}

export interface YogaParagraphProps extends YogaStyleProps {
	paragraph?: YogaDeepAnimated<SkParagraph | null>
	paragraphStyle?: YogaAnimatedParagraphStyleProps | YogaAnimatedProp<YogaParagraphStyle>
	text?: YogaDeepAnimated<string>
}

export interface YogaPathProps extends YogaContainerProps {
	fillType?: YogaDeepAnimated<YogaPathFillType>
	path: YogaDeepAnimated<SkPath>
	stroke?: YogaAnimatedStrokeOpts | YogaAnimatedProp<StrokeOpts>
	trimEnd?: YogaDeepAnimated<number>
	trimStart?: YogaDeepAnimated<number>
}

export interface YogaLineProps extends YogaContainerProps {
	from: YogaAnimatedPoint | YogaAnimatedProp<SkPoint>
	to: YogaAnimatedPoint | YogaAnimatedProp<SkPoint>
}

export interface YogaPointsProps extends YogaContainerProps {
	pointMode?: YogaDeepAnimated<YogaPointMode>
	points: YogaAnimatedPoint[] | YogaAnimatedProp<SkPoint[]>
}

export interface YogaImageProps extends YogaContainerProps {
	fit?: YogaDeepAnimated<Fit>
	image?: YogaDeepAnimated<SkImage | null>
	sampling?: YogaDeepAnimated<SamplingOptions>
}

export interface YogaBlurMaskFilterProps extends YogaContainerProps {
	blur?: YogaDeepAnimated<number>
	blurStyle?: YogaDeepAnimated<YogaBlurStyle>
	respectCTM?: YogaDeepAnimated<boolean>
}

export interface YogaIntrinsicElements {
	blurMaskFilter: YogaBlurMaskFilterProps
	circle: YogaCircleProps
	group: YogaGroupProps
	image: YogaImageProps
	line: YogaLineProps
	oval: YogaOvalProps
	paragraph: YogaParagraphProps
	path: YogaPathProps
	points: YogaPointsProps
	rect: YogaRectProps
	rrect: YogaRoundedRectProps
	text: YogaTextProps
}

declare global {
	namespace JSX {
		interface IntrinsicElements extends YogaIntrinsicElements {}
	}

	namespace React {
		namespace JSX {
			interface IntrinsicElements extends YogaIntrinsicElements {}
		}
	}
}
