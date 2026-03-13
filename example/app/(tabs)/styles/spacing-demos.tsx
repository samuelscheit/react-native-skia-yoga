import type { StylePropertySection } from "@/components/StyleShowcaseScreen"

import { chip, previewFrame, styleScene } from "./style-demo-builders"

export const spacingSections = [
	{
		description: "Outer spacing, inner spacing, and per-edge borders.",
		properties: [
			{
				example: 'margin: "auto"',
				name: "margin",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								height: 88,
								width: 164,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 26,
									margin: "auto",
									width: 64,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "marginTop: 12",
				name: "marginTop",
				preview: styleScene(
					previewFrame(
						<rect style={{ backgroundColor: "#0c1a27", padding: 10 }}>
							{chip("#34d399", 120, 18)}
							{chip("#7dd3fc", 120, 28, { marginTop: 12 })}
						</rect>,
					),
				),
			},
			{
				example: "marginRight: 16",
				name: "marginRight",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#0c1a27",
								padding: 10,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 32,
									marginRight: 16,
									width: 92,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "marginBottom: 24",
				name: "marginBottom",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
								padding: 10,
							}}
						>
							{chip("#7dd3fc", 112, 28, { marginBottom: 24 })}
							{chip("#34d399", 112, 18)}
						</rect>,
					),
				),
			},
			{
				example: "marginLeft: 8",
				name: "marginLeft",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#0c1a27",
								padding: 10,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 32,
									marginLeft: 8,
									width: 92,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: 'marginStart: "10%"',
				name: "marginStart",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#0c1a27",
								padding: 10,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 32,
									marginStart: "10%",
									width: 92,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "marginEnd: 18",
				name: "marginEnd",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#0c1a27",
								padding: 10,
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 32,
									marginEnd: 18,
									width: 92,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "marginHorizontal: 20",
				name: "marginHorizontal",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#0c1a27",
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 32,
									marginHorizontal: 20,
									width: 92,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: "marginVertical: 12",
				name: "marginVertical",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#0c1a27",
							}}
						>
							<rect
								style={{
									backgroundColor: "#7dd3fc",
									height: 32,
									marginVertical: 12,
									width: 92,
								}}
							/>
						</rect>,
					),
				),
			},
			{
				example: 'padding: "6%"',
				name: "padding",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								padding: "6%",
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingTop: 18",
				name: "paddingTop",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								paddingTop: 18,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingRight: 16",
				name: "paddingRight",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#7dd3fc",
								paddingRight: 16,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingBottom: 18",
				name: "paddingBottom",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								paddingBottom: 18,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingLeft: 16",
				name: "paddingLeft",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								paddingLeft: 16,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingStart: 14",
				name: "paddingStart",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								paddingStart: 14,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: 'paddingEnd: "8%"',
				name: "paddingEnd",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#7dd3fc",
								paddingEnd: "8%",
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingHorizontal: 24",
				name: "paddingHorizontal",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								alignItems: "flex-start",
								backgroundColor: "#7dd3fc",
								paddingHorizontal: 24,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "paddingVertical: 14",
				name: "paddingVertical",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								paddingVertical: 14,
								width: 148,
							}}
						>
							{chip("#14313f", 68, 24)}
						</rect>,
					),
				),
			},
			{
				example: "borderWidth: 4",
				name: "borderWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderWidth: 4,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderTopWidth: 8",
				name: "borderTopWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderTopWidth: 8,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderRightWidth: 2",
				name: "borderRightWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderRightWidth: 12,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderBottomWidth: 10",
				name: "borderBottomWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderBottomWidth: 10,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderLeftWidth: 6",
				name: "borderLeftWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderLeftWidth: 12,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderStartWidth: 5",
				name: "borderStartWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderStartWidth: 12,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderEndWidth: 7",
				name: "borderEndWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderEndWidth: 12,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderHorizontalWidth: 3",
				name: "borderHorizontalWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderHorizontalWidth: 10,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
			{
				example: "borderVerticalWidth: 9",
				name: "borderVerticalWidth",
				preview: styleScene(
					previewFrame(
						<rect
							style={{
								backgroundColor: "#7dd3fc",
								borderVerticalWidth: 10,
								height: 68,
								width: 124,
							}}
						/>,
					),
				),
			},
		],
		title: "Spacing And Borders",
	},
] as const satisfies readonly StylePropertySection[]
