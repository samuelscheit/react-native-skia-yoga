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

export interface EmptyCommandPayload {}

export enum NodeCommandKind {
	Rect = "rect",
	RoundedRect = "rrect",
	Text = "text",
	Group = "group",
	BlurMaskFilter = "blurMaskFilter",
	Image = "image",
	Path = "path",
	Paragraph = "paragraph",
	Circle = "circle",
	Line = "line",
	Oval = "oval",
	Points = "points",
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
	type: NodeCommandKind.Group
	data: EmptyCommandPayload
}

export interface RectCommand {
	type: NodeCommandKind.Rect
	data: EmptyCommandPayload
}

export interface RoundedRectCommand {
	type: NodeCommandKind.RoundedRect
	data: RoundedRectCommandPayload
}

export interface TextCommand {
	type: NodeCommandKind.Text
	data: TextCommandPayload
}

export interface ParagraphCommand {
	type: NodeCommandKind.Paragraph
	data: ParagraphCommandPayload
}

export interface PathCommand {
	type: NodeCommandKind.Path
	data: PathCommandPayload
}

export interface LineCommand {
	type: NodeCommandKind.Line
	data: LineCommandPayload
}

export interface PointsCommand {
	type: NodeCommandKind.Points
	data: PointsCommandPayload
}

export interface BlurMaskFilterCommand {
	type: NodeCommandKind.BlurMaskFilter
	data: BlurMaskFilterCommandPayload
}

export interface OvalCommand {
	type: NodeCommandKind.Oval
	data: EmptyCommandPayload
}

export interface CircleCommand {
	type: NodeCommandKind.Circle
	data: CircleCommandPayload
}

export interface ImageCommand {
	type: NodeCommandKind.Image
	data: ImageCommandPayload
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

export interface NodeCommandTransport {
	type: NodeCommandKind
	data: object
}

export type NodeCommandNative = CustomType<
	NodeCommandTransport,
	"margelo::nitro::RNSkiaYoga::NodeCommand",
	{
		include: "JSIConverter+NodeCommand.hpp"
	}
>
