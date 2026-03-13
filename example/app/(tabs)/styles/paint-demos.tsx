import {
	BlendMode,
	Skia,
	StrokeCap,
	StrokeJoin,
} from "@shopify/react-native-skia"

import type { StylePropertySection } from "@/components/StyleShowcaseScreen"

import { previewFrame, sceneWithSingleBox, styleScene } from "./style-demo-builders"

const clipPath = (() => {
	const path = Skia.Path.MakeFromSVGString("M28 0 L56 18 L48 54 L8 54 L0 18 Z")

	if (!path) {
		throw new Error("Failed to create paint demo clip path")
	}

	return path
})()

const layerPaint = (() => {
	const paint = Skia.Paint()
	paint.setAlphaf(0.75)
	return paint
})()

const strokePath = clipPath

export const paintSections = [
	{
		description: "Paint, clipping, radii, and stroke-style control for Skia-backed nodes.",
		properties: [
			{
				example: 'backgroundColor: "rgba(56, 189, 248, 0.85)"',
				name: "backgroundColor",
				preview: sceneWithSingleBox({
					backgroundColor: "rgba(56, 189, 248, 0.85)",
				}),
			},
			{
				example: "borderRadius: 24",
				name: "borderRadius",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					borderRadius: 24,
				}),
			},
			{
				example: "borderBottomLeftRadius: 12",
				name: "borderBottomLeftRadius",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					borderBottomLeftRadius: 12,
				}),
			},
			{
				example: "borderBottomRightRadius: 28",
				name: "borderBottomRightRadius",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					borderBottomRightRadius: 28,
				}),
			},
			{
				example: "{ x: 32, y: 16 }",
				name: "borderTopLeftRadius",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					borderTopLeftRadius: { x: 32, y: 16 },
				}),
			},
			{
				example: "18",
				name: "borderTopRightRadius",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					borderTopRightRadius: 18,
				}),
			},
			{
				example: "StrokeCap.Round",
				name: "strokeCap",
				preview: styleScene(
					previewFrame(
						<path
							path={strokePath}
							stroke={{ width: 12 }}
							style={{
								backgroundColor: "#34d399",
								height: 56,
								strokeCap: StrokeCap.Round,
								width: 56,
							}}
						/>,
					),
				),
			},
			{
				example: "StrokeJoin.Round",
				name: "strokeJoin",
				preview: styleScene(
					previewFrame(
						<path
							path={strokePath}
							stroke={{ width: 12 }}
							style={{
								backgroundColor: "#34d399",
								height: 56,
								strokeJoin: StrokeJoin.Round,
								width: 56,
							}}
						/>,
					),
				),
			},
			{
				example: "strokeMiter: 8",
				name: "strokeMiter",
				preview: styleScene(
					previewFrame(
						<path
							path={strokePath}
							stroke={{ width: 12 }}
							style={{
								backgroundColor: "#34d399",
								height: 56,
								strokeMiter: 8,
								width: 56,
							}}
						/>,
					),
				),
			},
			{
				example: "BlendMode.Screen",
				name: "blendMode",
				preview: styleScene(
					previewFrame(
						<group
							style={{
								alignItems: "center",
								blendMode: BlendMode.Screen,
								height: 96,
								justifyContent: "center",
								width: 164,
							}}
						>
							<circle
								radius={26}
								style={{
									backgroundColor: "#7dd3fc",
									height: 52,
									left: 44,
									position: "absolute",
									top: 22,
									width: 52,
								}}
							/>
							<circle
								radius={26}
								style={{
									backgroundColor: "#f59e0b",
									height: 52,
									left: 68,
									position: "absolute",
									top: 22,
									width: 52,
								}}
							/>
						</group>,
					),
				),
			},
			{
				example: "antiaAlias: true",
				name: "antiaAlias",
				preview: sceneWithSingleBox({
					antiaAlias: true,
					backgroundColor: "#7dd3fc",
					transform: [{ rotateZ: 0.2 }],
				}),
			},
			{
				example: "dither: true",
				name: "dither",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					dither: true,
					opacity: 0.92,
				}),
			},
			{
				example: "opacity: 0.72",
				name: "opacity",
				preview: sceneWithSingleBox({
					backgroundColor: "#7dd3fc",
					opacity: 0.72,
				}),
			},
			{
				example: "clip: clipPath",
				name: "clip",
				preview: styleScene(
					previewFrame(
						<group
							style={{
								alignItems: "center",
								clip: clipPath,
								height: 92,
								justifyContent: "center",
								width: 92,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 96,
									transform: [{ rotateZ: 0.35 }],
									width: 96,
								}}
							/>
						</group>,
					),
				),
			},
			{
				example: "invertClip: true",
				name: "invertClip",
				preview: styleScene(
					previewFrame(
						<group
							style={{
								alignItems: "center",
								clip: clipPath,
								height: 92,
								invertClip: true,
								justifyContent: "center",
								width: 92,
							}}
						>
							<rect
								style={{
									backgroundColor: "#fca5a5",
									height: 96,
									width: 96,
								}}
							/>
						</group>,
					),
				),
			},
			{
				example: "layer: Skia.Paint()",
				name: "layer",
				preview: styleScene(
					previewFrame(
						<group
							style={{
								alignItems: "center",
								gap: 10,
								justifyContent: "center",
								layer: layerPaint,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 34,
									width: 120,
								}}
							/>
							<rect
								style={{
									backgroundColor: "#34d399",
									height: 34,
									opacity: 0.55,
									transform: [{ translateY: -10 }],
									width: 88,
								}}
							/>
						</group>,
					),
				),
			},
		],
		title: "Paint And Clip",
	},
] as const satisfies readonly StylePropertySection[]
