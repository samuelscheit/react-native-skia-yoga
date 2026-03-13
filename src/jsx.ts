import type {
	BlurStyle,
	FillType,
	Fit,
	PointMode,
	SamplingOptions,
	SkFont,
	SkImage,
	SkParagraph,
	SkParagraphStyle,
	SkPath,
	SkPoint,
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

export interface YogaStyleProps {
	style?: YogaNodeStyle
}

export interface YogaContainerProps extends YogaStyleProps {
	children?: YogaElementChildren
}

export interface YogaGroupProps extends YogaContainerProps {}

export interface YogaRectProps extends YogaContainerProps {}

export interface YogaRoundedRectProps extends YogaContainerProps {
	cornerRadius?: YogaAnimatedProp<number>
}

export interface YogaCircleProps extends YogaContainerProps {
	radius?: YogaAnimatedProp<number>
}

export interface YogaOvalProps extends YogaContainerProps {}

export interface YogaTextProps extends YogaStyleProps {
	font?: YogaAnimatedProp<SkFont>
	text?: YogaAnimatedProp<string>
	textStyle?: YogaAnimatedProp<YogaTextStyle>
}

export interface YogaParagraphProps extends YogaStyleProps {
	paragraph?: YogaAnimatedProp<SkParagraph | null>
	paragraphStyle?: YogaAnimatedProp<YogaParagraphStyle>
	text?: YogaAnimatedProp<string>
}

export interface YogaPathProps extends YogaContainerProps {
	fillType?: YogaAnimatedProp<YogaPathFillType>
	path: YogaAnimatedProp<SkPath>
	stroke?: YogaAnimatedProp<StrokeOpts>
	trimEnd?: YogaAnimatedProp<number>
	trimStart?: YogaAnimatedProp<number>
}

export interface YogaLineProps extends YogaContainerProps {
	from: YogaAnimatedProp<SkPoint>
	to: YogaAnimatedProp<SkPoint>
}

export interface YogaPointsProps extends YogaContainerProps {
	pointMode?: YogaAnimatedProp<YogaPointMode>
	points: YogaAnimatedProp<SkPoint[]>
}

export interface YogaImageProps extends YogaContainerProps {
	fit?: YogaAnimatedProp<Fit>
	image?: YogaAnimatedProp<SkImage | null>
	sampling?: YogaAnimatedProp<SamplingOptions>
}

export interface YogaBlurMaskFilterProps extends YogaContainerProps {
	blur?: YogaAnimatedProp<number>
	blurStyle?: YogaAnimatedProp<YogaBlurStyle>
	respectCTM?: YogaAnimatedProp<boolean>
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
