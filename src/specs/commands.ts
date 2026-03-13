import type {
	SkFont,
	SkImage,
	SkParagraph,
	SkParagraphStyle,
	SkPath,
	SkPoint,
	SkTextStyle,
	StrokeOpts,
} from "@shopify/react-native-skia"
import type { CustomType } from "react-native-nitro-modules"

export type NodeType =
	| "rect"
	| "rrect"
	| "text"
	| "group"
	| "blurMaskFilter"
	| "image"
	| "path"
	| "paragraph"
	| "circle"
	| "line"
	| "oval"
	| "points"

export type BlurStyleName = "normal" | "solid" | "outer" | "inner"

export type ImageFit = "cover" | "contain" | "fill" | "fitHeight" | "fitWidth" | "none" | "scaleDown"

export type PointModeName = "points" | "lines" | "polygon"

export type PathFillType = "winding" | "evenOdd" | "inverseWinding" | "inverseEvenOdd"

export type SkFontNative = CustomType<
	SkFont,
	"SkFont",
	{
		include: "JSIConverter+SkFont.hpp"
		canBePassedByReference: true
	}
>

export type SkImageNative = CustomType<
	SkImage,
	"sk_sp<SkImage>",
	{
		include: "JSIConverter+SkImage.hpp"
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

export type SkParagraphNative = CustomType<
	SkParagraph,
	"std::shared_ptr<RNSkia::JsiSkParagraph>",
	{
		include: "JSIConverter+SkParagraph.hpp"
		canBePassedByReference: true
	}
>

export type SkTextStyleNative = CustomType<
	SkTextStyle,
	"skia::textlayout::TextStyle",
	{
		include: "JSIConverter+SkTextStyle.hpp"
	}
>

export type SkParagraphStyleNative = CustomType<
	SkParagraphStyle,
	"skia::textlayout::ParagraphStyle",
	{
		include: "JSIConverter+SkParagraphStyle.hpp"
	}
>

export type SamplingOptionsNative = CustomType<
	object,
	"SkSamplingOptions",
	{
		include: "JSIConverter+SkSamplingOptions.hpp"
	}
>

export type StrokeOptsNative = CustomType<
	StrokeOpts,
	"RNSkia::StrokeOpts",
	{
		include: "JSIConverter+StrokeOpts.hpp"
	}
>

export interface EmptyCommandPayload {
	noop?: boolean
}

export interface RoundedRectCommandPayload {
	cornerRadius?: number
}

export interface TextCommandPayload {
	font?: SkFontNative
	text?: string
	textStyle?: SkTextStyleNative
}

export interface ParagraphCommandPayload {
	paragraph?: SkParagraphNative | null
	paragraphStyle?: SkParagraphStyleNative
	text?: string
}

export interface PathCommandPayload {
	fillType?: PathFillType
	path: SkPathNative
	stroke?: StrokeOptsNative
	trimEnd?: number
	trimStart?: number
}

export interface LineCommandPayload {
	from: SkPoint
	to: SkPoint
}

export interface PointsCommandPayload {
	pointMode?: PointModeName
	points: SkPoint[]
}

export interface BlurMaskFilterCommandPayload {
	blur?: number
	blurStyle?: BlurStyleName
	respectCTM?: boolean
}

export interface CircleCommandPayload {
	radius?: number
}

export interface ImageCommandPayload {
	fit?: ImageFit
	image?: SkImageNative | null
	sampling?: SamplingOptionsNative
}

export interface GroupCommand {
	group: EmptyCommandPayload
}

export interface RectCommand {
	rect: EmptyCommandPayload
}

export interface RoundedRectCommand {
	rrect: RoundedRectCommandPayload
}

export interface TextCommand {
	text: TextCommandPayload
}

export interface ParagraphCommand {
	paragraph: ParagraphCommandPayload
}

export interface PathCommand {
	path: PathCommandPayload
}

export interface LineCommand {
	line: LineCommandPayload
}

export interface PointsCommand {
	points: PointsCommandPayload
}

export interface BlurMaskFilterCommand {
	blurMaskFilter: BlurMaskFilterCommandPayload
}

export interface OvalCommand {
	oval: EmptyCommandPayload
}

export interface CircleCommand {
	circle: CircleCommandPayload
}

export interface ImageCommand {
	image: ImageCommandPayload
}

export type NodeCommand =
	| RectCommand
	| RoundedRectCommand
	| TextCommand
	| GroupCommand
	| BlurMaskFilterCommand
	| ImageCommand
	| PathCommand
	| ParagraphCommand
	| CircleCommand
	| LineCommand
	| OvalCommand
	| PointsCommand
