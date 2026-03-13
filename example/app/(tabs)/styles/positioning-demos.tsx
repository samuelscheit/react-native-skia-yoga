import type { StylePropertySection } from "@/components/StyleShowcaseScreen"

import { previewFrame, styleScene } from "./style-demo-builders"

function absoluteDemo(targetStyle: Record<string, unknown>) {
	return styleScene(
		previewFrame(
			<rect
				style={{
					backgroundColor: "#0c1a27",
					height: 96,
					position: "relative",
					width: 164,
				}}
			>
				<rect
					style={{
						backgroundColor: "#14313f",
						height: 30,
						left: 12,
						opacity: 0.35,
						position: "absolute",
						top: 12,
						width: 42,
					}}
				/>
				<rect
					style={{
						backgroundColor: "#7dd3fc",
						height: 38,
						position: "absolute",
						width: 60,
						...targetStyle,
					}}
				/>
			</rect>,
		),
	)
}

export const positioningSections = [
	{
		description: "Relative and absolute placement using physical and logical edges.",
		properties: [
			{
				example: 'position: "absolute"',
				name: "position",
				preview: absoluteDemo({
					left: 18,
					position: "absolute",
					top: 14,
				}),
			},
			{
				example: "top: 12",
				name: "top",
				preview: absoluteDemo({
					left: 24,
					position: "absolute",
					top: 12,
				}),
			},
			{
				example: "right: 18",
				name: "right",
				preview: absoluteDemo({
					position: "absolute",
					right: 18,
					top: 20,
				}),
			},
			{
				example: "bottom: 20",
				name: "bottom",
				preview: absoluteDemo({
					bottom: 20,
					left: 22,
					position: "absolute",
				}),
			},
			{
				example: "left: 16",
				name: "left",
				preview: absoluteDemo({
					left: 16,
					position: "absolute",
					top: 26,
				}),
			},
			{
				example: 'start: "12%"',
				name: "start",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								direction: "rtl",
								height: 96,
								position: "relative",
								width: 164,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 38,
									position: "absolute",
									start: "12%",
									top: 24,
									width: 60,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "end: 14",
				name: "end",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								direction: "rtl",
								height: 96,
								position: "relative",
								width: 164,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									end: 14,
									height: 38,
									position: "absolute",
									top: 24,
									width: 60,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "inset: 24",
				name: "inset",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								height: 96,
								position: "relative",
								width: 164,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									inset: 24,
									position: "absolute",
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: 'insetHorizontal: "10%"',
				name: "insetHorizontal",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								height: 96,
								position: "relative",
								width: 164,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 42,
									insetHorizontal: "10%",
									position: "absolute",
									top: 28,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "insetVertical: 18",
				name: "insetVertical",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								height: 96,
								position: "relative",
								width: 164,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									insetVertical: 18,
									left: 30,
									position: "absolute",
									width: 76,
								}}
							/>
						</rect>,
					),
				),
			},
		],
		title: "Positioning",
	},
] as const satisfies readonly StylePropertySection[]
